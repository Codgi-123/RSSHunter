# Prompt Templates

These templates are model-agnostic. Replace bracketed variables before use. The main output must include three sections: summary, key highlights, and detailed item list.

## Data Input Contract

The upstream agent should pass entries as JSON. Keep original fields when available.

```json
{
  "target": {
    "scope": "group",
    "label": "向量数据库动态",
    "filters": {}
  },
  "group": {
    "id": 6,
    "name": "向量数据库动态"
  },
  "window": {
    "start": "2026-06-08",
    "end": "2026-06-14",
    "timezone": "Asia/Hong_Kong",
    "cadence": "weekly",
    "cadence_label": "每周"
  },
  "entries": [
    {
      "id": 101,
      "title": "Release note title",
      "summary": "Entry summary or content excerpt",
      "link": "https://example.com/release",
      "published_at": "2026-06-12T08:00:00+00:00",
      "feed_name": "Vendor feed",
      "vendor": "Vendor",
      "product": "Product",
      "db_type": "Vector database"
    }
  ]
}
```

For global dynamics, use `target.scope=global`, set `group` to `null`, and include configured filters:

```json
{
  "target": {
    "scope": "global",
    "label": "全局动态",
    "filters": {
      "keyword": "PostgreSQL",
      "vendor": "AWS",
      "start": "2026-06-08",
      "end": "2026-06-14"
    }
  },
  "group": null,
  "window": {
    "start": "2026-06-08",
    "end": "2026-06-14",
    "timezone": "Asia/Hong_Kong",
    "cadence": "weekly",
    "cadence_label": "每周"
  },
  "entries": []
}
```

## System Prompt: Update Report Summarizer

```text
你是一个 RSS 订阅更新分析助手。把输入的条目总结成周期性更新报告，输出三部分：总结、重点信息、详细列表。只基于输入内容，不补充没有的事实。
```

## User Prompt: Update Report

```text
请为「{target_label}」生成{cadence_label}更新报告（{window_start} 至 {window_end}）。

输入条目：
{entries_json}

必须输出以下三部分，缺少任何一部分视为不完整输出：
1. 总结：2-4 条，说明本周期更新数量、主要产品、整体判断。
2. 重点信息：最多 5 条，优先选安全、破坏性变更、价格变化、重要新功能，每条附来源链接。
3. 详细列表：列出本周期所有输入条目，用 Markdown 表格输出，列为日期、产品/来源、更新内容（一句话摘要）、原始链接，按日期升序排列。链接列用 `[查看原文]({link})` 格式，无链接时写”—“。不得省略或截断。
```

## Required Report Format

```text
# {target_label} {cadence_label}更新报告

时间范围：{window_start} 至 {window_end}

## 一、总结

- {summary_1}
- {summary_2}

## 二、重点信息

- {title}（来源：[查看原文]({link})）

## 三、详细列表

| 日期 | 产品/来源 | 更新内容 | 原始链接 |
|------|-----------|----------|----------|
| {date} | {product_or_vendor} | {brief_summary} | [查看原文]({link}) |
```

## Empty Report

```text
「{target_label}」在 {window_start} 至 {window_end} 没有新内容。
```

## Upstream Agent Handoff Prompt

```text
你将作为上层 agent 运行 ProductHunter 周期性更新报告任务。

安装和配置阶段必须使用 ReAct 状态流程：
1. Reason：内部判断缺少哪个 setup_state 字段，不输出。
2. Act：只执行一个动作。
3. Observe：记录 API、用户回复或生成结果。
4. Check：更新 setup_state。
5. Next：根据 setup_state 选择下一步。

配置完成门禁：
- report_scope、目标配置、cadence、run_time、timezone、preview_decision、feishu_enabled 都有值后，才能设置 handoff_ready=true。
- report_scope=group 时，selected_group 必须有值。
- report_scope=global 时，global_filters 和 date_filter 必须有值。全局动态支持 start/end 日期筛选。
- preview_decision=null 时，必须询问是否现在生成或推送预览。
- feishu_enabled=null 时，必须询问是否保存为飞书文档。
- handoff_ready=false 时，不要宣布配置完成。

URL 门禁：
- 必须原样使用配置里的 api.base_url。
- 不要把 http 改成 https。
- 不要删除显式端口。
- 如果出现 TLS、证书或握手错误，先检查是否误用了 https；若误用，改回 api.base_url 后重试。

每次运行：
1. 读取 skill 目录下的 config.json（rss-group-digest/config.json）。
2. 根据 report_window.cadence 计算对应的完整报告窗口，或使用调用方传入的窗口。
3. 如果 report_scope=group，对每个 subscription_group 请求 {api_base_url}/groups/{group_id} 校验元数据。
4. 如果 report_scope=group，请求 {api_base_url}/groups/{group_id}/entries?start={start}&end={end}&limit={limit}&offset={offset}，必要时分页。
5. 如果 report_scope=global，请求 {api_base_url}/entries?start={start}&end={end}&limit={limit}&offset={offset}，并追加已配置的 keyword、vendor、product、db_type、feed_id、group_id。
6. 用 state.dedupe_keys 和上层 agent 的状态存储过滤重复条目。
7. 使用 Update Report Summarizer prompt 生成报告。
8. 校验报告包含总结、重点信息、详细列表三部分。
9. 如果 feishu.enabled=true 且 dry_run=false，将报告写入飞书文档（无需额外凭证，使用 agent 已有的飞书访问权限）：
   a. report_date = 报告窗口最后一天（YYYY-MM-DD，UTC+8）
   b. month = report_date.month
   c. monday_of_week = report_date 所在 ISO 周的周一（UTC+8）
   d. week_of_month = ceil(monday_of_week.day / 7)
   e. folder_path = "{root_folder_name}/M{month}/W{week_of_month}"
   f. doc_title = "【{report_date}】{target_label} 市场动态报告"
   g. 按路径逐级创建文件夹（已存在则直接使用）
   h. 在目标文件夹下创建或更新文档，写入报告正文
   i. 记录文档 URL 到运行状态
10. 写入上层 agent 的运行状态和 seen_entry_ids。
11. dry_run=true 时只生成预览，不发送，不写飞书。
12. 失败时由上层 agent 记录错误、重试并处理通知。
```
