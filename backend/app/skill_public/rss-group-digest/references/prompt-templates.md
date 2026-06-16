# Prompt Templates

These templates are model-agnostic. Replace bracketed variables before use. The main output must include three sections: overview, AI-selected highlights, and detailed item list.

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
      "guid": "vendor-item-guid",
      "title": "Release note title",
      "summary": "Entry summary or content excerpt",
      "link": "https://example.com/release",
      "published_at": "2026-06-12T08:00:00+00:00",
      "created_at": "2026-06-12T08:05:00+00:00",
      "feed_name": "Vendor feed",
      "vendor": "Vendor",
      "product": "Product",
      "db_type": "Vector database",
      "tags": ["vector", "release-note"]
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
你是一个严谨的 ProductHunter 更新报告分析助手。你的任务是把 ProductHunter 兼容系统提供的订阅组条目或全局动态条目总结成周期性更新报告。

要求：
1. 只基于输入条目总结，不补充输入中没有的事实。
2. 输出必须包含三部分：汇总、AI 选取的重要内容、详细列表。
3. 优先识别安全、破坏性变更、弃用、价格变化、兼容性、事故、新功能和性能改进。
4. 可以合并重复或高度相似的条目，但必须保留所有相关 entry ID 或来源链接。
5. 每条重要判断都要附带来源条目 ID 或链接。
6. 没有证据时写“未从输入中看到明确证据”。
7. 不要把普通小更新夸大成高风险事项。
8. 如果没有新内容，输出简短的空报告。
9. 用 {language} 输出，面向 {audience}。
```

## User Prompt: Update Report

```text
请为「{target_label}」生成{cadence_label}更新报告。

时间范围：{window_start} 到 {window_end}
时区：{timezone}
报告间隔：{cadence_label}
报告范围：{report_scope}
筛选条件：{filters_summary}

配置：
- 受众：{audience}
- 语言：{language}
- 优先关注：{priority_signals}
- AI 选取的重要内容上限：{max_highlights}
- 详细列表分组方式：{detailed_list_group_by}
- 必须包含来源链接：{include_source_links}
- 必须包含 entry ID：{include_entry_ids}

输入条目：
{entries_json}

请输出：
1. 标题：一句话概括本周期最重要变化。
2. 汇总：3 到 6 条，说明本周期更新数量、涉及来源、主要产品或主题、整体判断。
3. AI 选取的重要内容：最多 {max_highlights} 条，按重要性排序。每条包含重要级别、标题、入选原因、影响、建议动作、来源链接或 entry ID。
4. 详细列表：列出本周期所有输入条目。优先按 {detailed_list_group_by} 分组，其次按发布时间倒序。每条包含标题、产品或来源、发布时间、简短摘要、链接、entry ID。
5. 证据不足事项：只列真实存在但证据不足的事项。没有则写“无”。
```

## Required Report Format

```text
# {target_label} {cadence_label}更新报告

时间范围：{window_start} 至 {window_end}
报告范围：{report_scope}
筛选条件：{filters_summary}
覆盖条目：{item_count}
覆盖来源：{source_count}

## 一、汇总

- {summary_1}
- {summary_2}
- {summary_3}

## 二、AI 选取的重要内容

### [{severity}] {title}

- 入选原因：{selection_reason}
- 影响：{impact}
- 建议动作：{recommended_action}
- 来源：{entry_ids_or_links}

## 三、详细列表

### {source_or_group}

- {published_at} | {product_or_vendor} | {title}
  摘要：{brief_summary}
  来源：{entry_id_or_link}

## 证据不足事项

- {uncertain_item_or_none}
```

## Important Item Selection Rules

```text
按以下优先级选择“AI 选取的重要内容”：

1. 安全风险、事故、数据丢失、可用性风险。
2. 破坏性变更、弃用、兼容性变化、迁移要求。
3. 价格、计费、配额、服务等级变化。
4. 对 {audience} 有明确行动价值的新功能或能力变化。
5. 性能、稳定性、可观测性、运维体验改进。
6. 产品方向、生态集成、平台支持范围变化。

不要选择仅有营销表述且缺少实质变化的条目，除非它影响用户决策。
不要因为标题看起来重要就推断风险。风险必须来自输入内容。
```

## Empty Report

```text
「{target_label}」在 {window_start} 至 {window_end} 没有新内容。

本报告由上层 agent 生成。请在下一次报告窗口继续检查。
```

## Deduplication Prompt

```text
下面是本周期抓取到的 ProductHunter 条目。请把重复、同一版本多端发布、同一功能的相关条目合并为主题组。

判断规则：
1. 标题版本号、产品名、PR 编号、CVE 编号相同或高度相关时优先合并。
2. 不要合并不同产品或不同风险级别的条目。
3. 每个主题组保留所有来源 ID。

输入：
{entries_json}

输出 JSON：
[
  {
    "topic": "...",
    "severity": "critical|high|medium|low|info",
    "entry_ids": [1, 2],
    "reason": "..."
  }
]
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
- report_scope、目标配置、cadence、run_time、timezone、preview_decision 都有值后，才能设置 handoff_ready=true。
- report_scope=group 时，selected_group 必须有值。
- report_scope=global 时，global_filters 和 date_filter 必须有值。全局动态支持 start/end 日期筛选。
- preview_decision=null 时，必须询问是否现在生成或推送预览。
- handoff_ready=false 时，不要宣布配置完成。

URL 门禁：
- 必须原样使用配置里的 api.base_url。
- 不要把 http 改成 https。
- 不要删除显式端口。
- 如果出现 TLS、证书或握手错误，先检查是否误用了 https；若误用，改回 api.base_url 后重试。

每次运行：
1. 读取配置 {config_ref}。
2. 根据 report_window.cadence 计算对应的完整报告窗口，或使用调用方传入的窗口。
3. 如果 report_scope=group，对每个 subscription_group 请求 {api_base_url}/groups/{group_id} 校验元数据。
4. 如果 report_scope=group，请求 {api_base_url}/groups/{group_id}/entries?start={start}&end={end}&limit={limit}&offset={offset}，必要时分页。
5. 如果 report_scope=global，请求 {api_base_url}/entries?start={start}&end={end}&limit={limit}&offset={offset}，并追加已配置的 keyword、vendor、product、db_type、feed_id、group_id。
6. 用 state.dedupe_keys 和上层 agent 的状态存储过滤重复条目。
7. 使用 Update Report Summarizer prompt 生成报告。
8. 校验报告包含汇总、AI 选取的重要内容、详细列表。
9. 写入上层 agent 的运行状态和 seen_entry_ids。
10. dry_run=true 时只生成预览，不发送。
11. 失败时由上层 agent 记录错误、重试并处理通知。
```
