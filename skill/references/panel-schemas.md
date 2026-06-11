# Panel Data Schemas

> 标注 **必填** 的字段缺失会导致渲染异常。未标注为可选。

## TextPanel

```json
{
  "summary": "文档摘要",              // 必填
  "content": "# 标题\n\n正文内容...", // 必填
  "format": "markdown"                // 必填: "markdown" | "plaintext"
}
```

## TablePanel

```json
{
  "columns": [                        // 必填
    { "key": "name", "label": "名称" },
    { "key": "age", "label": "年龄" }
  ],
  "rows": [                           // 必填
    { "name": "张三", "age": "28" },
    { "name": "李四", "age": "32" }
  ]
}
```

## ListPanel

```json
{
  "items": [                          // 必填
    {
      "id": "1", "title": "第一项", "subtitle": "说明",
      "badge": { "text": "新", "color": "blue" },
      "checked": false                // 可选: checkable 列表的勾选状态
    },
    { "id": "2", "title": "第二项", "subtitle": "说明" }
  ],
  "emptyText": "暂无数据"
}
```

## ChartPanel

```json
{
  "chartType": "line",                // 必填: "line" | "bar" | "pie" | "area"
  "data": [                           // 必填: { label, value, series? }
    { "label": "1 月", "value": 4000 },
    { "label": "2 月", "value": 5200 }
  ],
  "xAxis": "月份",                    // 必填
  "yAxis": "销售额"                   // 必填
}
```

## CodePanel

```json
{
  "language": "typescript",           // 必填
  "code": "const greeting = 'Hello';\nconsole.log(greeting);", // 必填
  "highlightLines": [2],
  "copyable": true,
  "filename": "example.ts"
}
```

## ImagePanel

```json
{
  "src": "data:image/png;base64,iVBOR...", // 必填
  "caption": "示例图片",
  "alt": "示例"
}
```

## TimelinePanel

```json
{
  "events": [                         // 必填
    {
      "id": "1",
      "title": "周会",
      "date": "2026-03-10T10:00",
      "endDate": "2026-03-10T11:00",
      "color": "#3b82f6",
      "checked": false                // 可选: checkable 时间轴的完成状态
    }
  ],
  "viewMode": "week"                  // 必填: "day" | "week" | "month"
}
```

## KVPanel

```json
{
  "items": [                          // 必填
    { "key": "状态", "value": "运行中", "type": "status", "status": "success" },
    { "key": "版本", "value": "1.2.3", "type": "text" }
  ],
  "columns": 2
}
```

## 面板交互配置 (`interaction`)

创建或更新面板时可通过 `interaction` 字段启用用户交互：

| 字段 | 类型 | 适用面板 | 说明 |
|------|------|----------|------|
| `sortable` | boolean | table | 表格列排序 |
| `filterable` | boolean | table | 表格列筛选 |
| `checkable` | boolean | list, timeline | 条目/事件勾选框 |
| `editable` | boolean | kv, text | 内联编辑（kv 双击改值；text 双击编辑全文）|

### 用户交互产生的消息

用户在面板上执行交互时，前端通过 WebSocket 发送 `panel_user_action` 消息：

```json
{
  "type": "panel_user_action",
  "action": "check_item",
  "panelId": "panel-xxx",
  "payload": { "itemId": "1", "checked": true },
  "timestamp": "2026-03-10T12:00:00Z"
}
```

可用 `action` 值：`pin` | `unpin` | `archive` | `restore` | `close` | `check_item` | `edit_value` | `status_change`

各 action 的 payload：

| action | 来源面板 | payload |
|--------|----------|---------|
| `check_item` | list, timeline | `{ "itemId": "<item/event id>", "checked": true }` |
| `edit_value` | kv | `{ "key": "...", "oldValue": "...", "newValue": "..." }` |
| `edit_value` | text | `{ "field": "content", "newValue": "<完整新内容>" }` |
| `status_change` | kv | `{ "key": "...", "oldStatus": "...", "newStatus": "..." }` |

## Agent 数据保全规则（重要）

用户可以直接在面板上修改数据（勾选、编辑文本/键值）。为避免覆盖用户的修改：

1. 更新带 `interaction`（checkable/editable）的面板前，先用 `canvas_query` 的 `getPanelDetail` 读取最新 data，在其基础上修改。
2. 局部修改优先使用 `patch`（JSON Patch），避免全量 `data` 覆盖。
3. 必须全量覆盖 `data` 时，要保留 `items[].checked`、`events[].checked`、`content` 等用户可写字段的当前值。
4. 用户操作会通过 `panel_user_action` 实时推送，收到后应将变更并入后续输出。

## 附件支持 (`attachments`)

用户消息可携带附件：

```json
{
  "type": "user_message",
  "content": "请分析这张图片",
  "attachments": [
    {
      "type": "image",
      "name": "screenshot.png",
      "path": "/tmp/pegboard/uploads/screenshot.png",
      "size": 204800,
      "mimeType": "image/png"
    }
  ]
}
```

附件类型：`image` (png/jpg/webp) | `file` (pdf/csv/xlsx) | `audio` (mp3/wav/m4a)
