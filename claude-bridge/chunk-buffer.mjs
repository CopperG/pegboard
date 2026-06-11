/**
 * Coalesce streaming text and flush at most once per intervalMs.
 * MUST live on the bridge (sender) side: the Rust WS server disconnects
 * clients sending >100 messages/sec (ws_server.rs rate limit), and raw
 * text_delta events exceed that.
 */
export function createChunkBuffer(flush, intervalMs = 50) {
  let buf = ''
  let timer = null

  const fire = () => {
    timer = null
    const text = buf
    buf = ''
    if (text) flush(text)
  }

  return {
    push(text) {
      buf += text
      if (timer === null) {
        timer = setTimeout(fire, intervalMs)
      }
    },
    flushNow() {
      if (timer !== null) {
        clearTimeout(timer)
      }
      fire()
    },
  }
}
