#!/usr/bin/env node
// Pegboard <-> Claude Code bridge (persistent process mode).
//
// One long-lived `claude` process handles all turns: no per-message CLI
// cold start, natural session continuity. Crash -> respawn with --resume.
//
// NOTE: imports from ../skill/scripts — the bridge must run from the repo
// checkout (README documents `node claude-bridge/index.mjs`).
//
// Env:
//   PEGBOARD_CLAUDE_BIN         claude binary (default "claude")
//   PEGBOARD_CLAUDE_FLAGS       extra flags, space-separated (default: spike result)
//   PEGBOARD_CLAUDE_CWD         working directory for claude (default $HOME)
//   PEGBOARD_CLAUDE_TIMEOUT_MS  per-turn timeout (default 600000)

import { spawn } from 'node:child_process'
import { createInterface } from 'node:readline'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { getWsToken } from '../skill/scripts/ws-helper.mjs'
import { buildPrompt } from './prompt.mjs'
import { createSessionState, resetTurn, interpretEvent } from './stream-parser.mjs'
import { createTurnQueue } from './queue.mjs'
import { loadSession, saveSession } from './session.mjs'
import { createChunkBuffer } from './chunk-buffer.mjs'

const CLAUDE_BIN = process.env.PEGBOARD_CLAUDE_BIN || 'claude'
const CLAUDE_CWD = process.env.PEGBOARD_CLAUDE_CWD || homedir()
const TURN_TIMEOUT_MS = Number(process.env.PEGBOARD_CLAUDE_TIMEOUT_MS) || 600_000
// allowlist: Task 0 spike 实测最窄可用形式。窄 glob `Bash(node <绝对脚本目录>/*)`
// 实测可用（前缀形式 `node <dir>/:*` 被拦截）。
// 注意：该规则内部含空格（"node " + 路径），必须作为【单个 argv 元素】传给
// --allowedTools，绝不能按空格 split——否则规则被切碎、node 脚本不被授权。
const SKILL_SCRIPTS_DIR = join(homedir(), '.claude', 'skills', 'pegboard', 'scripts')
const DEFAULT_ALLOWED_TOOLS = `Skill(pegboard),Bash(node ${SKILL_SCRIPTS_DIR}/*),Read`
const ALLOWED_TOOLS = process.env.PEGBOARD_CLAUDE_ALLOWED_TOOLS || DEFAULT_ALLOWED_TOOLS
// 其余杂项 flags（不含 allowlist）可按空格 split。
const EXTRA_FLAGS = (process.env.PEGBOARD_CLAUDE_FLAGS || '').split(' ').filter(Boolean)

const RECONNECT_BASE_MS = 1000
const RECONNECT_MAX_MS = 30000

let ws = null
let child = null
let childRl = null
let sessionId = null
const parserState = createSessionState()
// Current turn: { messageId, buffer, timer, finish }
let turn = null

const queue = createTurnQueue({
  capacity: 10,
  onOverflow: () => {
    sendWs({
      type: 'app_control',
      action: 'showNotification',
      notificationType: 'warning',
      title: '消息队列已满',
      body: '请等待当前回复完成后再发送',
    })
  },
})

function log(...args) {
  console.log(`[claude-bridge ${new Date().toISOString()}]`, ...args)
}

function sendWs(msg) {
  if (ws && ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(msg))
  }
}

function isUserMessage(msg) {
  return msg && msg.type === 'user_message' && typeof msg.content === 'string'
}

// ── Persistent claude process ────────────────────────────────────────

function spawnClaude() {
  const args = [
    '-p',
    '--input-format', 'stream-json',
    '--output-format', 'stream-json',
    '--include-partial-messages',
    '--verbose',
    // allowlist value kept as ONE element — it contains a space ("node <path>")
    '--allowedTools', ALLOWED_TOOLS,
    ...(sessionId ? ['--resume', sessionId] : []),
    ...EXTRA_FLAGS,
  ]
  log(`spawning claude (resume=${sessionId ?? 'new'})`)
  child = spawn(CLAUDE_BIN, args, { cwd: CLAUDE_CWD, stdio: ['pipe', 'pipe', 'pipe'] })

  let stderr = ''
  child.stderr.on('data', (d) => { stderr += d })

  childRl = createInterface({ input: child.stdout })
  childRl.on('line', (line) => {
    let event
    try { event = JSON.parse(line) } catch { return }
    for (const action of interpretEvent(event, parserState)) {
      if (action.kind === 'session') {
        sessionId = action.id
        void saveSession(sessionId)
      } else if (action.kind === 'chunk' && turn) {
        turn.buffer.push(action.text)
      } else if (action.kind === 'done' && turn) {
        finishTurn()
      }
    }
  })

  child.on('close', (code) => {
    log(`claude exited (code=${code}) ${stderr ? `stderr: ${stderr.slice(0, 300)}` : ''}`)
    child = null
    childRl = null
    if (turn) {
      turn.buffer.flushNow()
      sendWs({ type: 'stream_chunk', messageId: turn.messageId, content: `\n[claude 进程异常退出 (code ${code})]` })
      finishTurn()
    }
  })

  child.on('error', (err) => {
    log(`failed to start claude: ${err}`)
    child = null
    childRl = null
    if (turn) {
      sendWs({ type: 'stream_chunk', messageId: turn.messageId, content: `无法启动 Claude Code: ${String(err)}` })
      finishTurn()
    }
  })
}

function finishTurn() {
  if (!turn) return
  clearTimeout(turn.timer)
  turn.buffer.flushNow()
  sendWs({ type: 'stream_end', messageId: turn.messageId, timestamp: new Date().toISOString() })
  log(`turn done (messageId=${turn.messageId})`)
  turn = null
  queue.done()
  processNext()
}

function runTurn(userMsg) {
  if (!child) spawnClaude()
  if (!child) { queue.done(); return }

  const messageId = crypto.randomUUID()
  resetTurn(parserState)

  const buffer = createChunkBuffer((text) => {
    sendWs({ type: 'stream_chunk', messageId, content: text })
  })

  const timer = setTimeout(() => {
    log(`turn timeout after ${TURN_TIMEOUT_MS}ms, killing claude`)
    sendWs({ type: 'stream_chunk', messageId, content: `\n[回复超时 (${TURN_TIMEOUT_MS / 1000}s)，已中止]` })
    // kill 触发 child close handler -> finishTurn；下一轮懒重拉
    child?.kill('SIGKILL')
  }, TURN_TIMEOUT_MS)

  turn = { messageId, buffer, timer }

  sendWs({ type: 'stream_start', messageId, timestamp: new Date().toISOString() })

  const prompt = buildPrompt(userMsg)
  log(`turn start (messageId=${messageId}, prompt=${prompt.length} chars)`)
  child.stdin.write(
    JSON.stringify({
      type: 'user',
      message: { role: 'user', content: [{ type: 'text', text: prompt }] },
    }) + '\n',
  )
}

function processNext() {
  const msg = queue.next()
  if (msg) runTurn(msg)
}

// ── WS connection loop ───────────────────────────────────────────────

async function connectLoop() {
  let attempt = 0
  for (;;) {
    const token = await getWsToken()
    const url = token ? `ws://localhost:9800?token=${token}` : 'ws://localhost:9800'
    log(`connecting (attempt ${attempt + 1})`)

    await new Promise((resolve) => {
      const socket = new WebSocket(url)
      socket.onopen = () => {
        log('connected')
        attempt = 0
        ws = socket
      }
      socket.onmessage = (event) => {
        let msg
        try { msg = JSON.parse(String(event.data)) } catch { return }
        if (!isUserMessage(msg)) return
        log(`user_message received (len=${msg.content.length})`)
        queue.push(msg)
        processNext()
      }
      socket.onclose = () => {
        ws = null
        resolve()
      }
      socket.onerror = () => { /* onclose follows */ }
    })

    const delay = Math.min(RECONNECT_BASE_MS * 2 ** attempt, RECONNECT_MAX_MS)
    attempt++
    log(`disconnected, retrying in ${delay}ms`)
    await new Promise((r) => setTimeout(r, delay))
  }
}

sessionId = await loadSession()
log(`starting (claude=${CLAUDE_BIN}, cwd=${CLAUDE_CWD}, timeout=${TURN_TIMEOUT_MS}ms, session=${sessionId ?? 'none'})`)
connectLoop()
