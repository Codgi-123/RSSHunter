# Update Report Conversation Flow

Use this flow to guide the user from intent to a complete recurring update report configuration. The target can be a subscription group or global dynamics. Ask in short batches. Do not ask for values that can be discovered from the current system.

## Entry Point: First Message After Skill Load

When the skill is first loaded (either just installed or explicitly invoked), output the following message to the user **before** starting the state machine. Fill in the bracketed values from the known context.

```text
ProductHunter 更新报告 Skill 已就绪。

API 地址：{api_base_url}

我会引导你完成以下配置，通常只需回答 3–4 个问题：

1. 报告范围：订阅组更新报告 或 全局动态报告
2. 目标选择：选择订阅组（或配置全局筛选条件）
3. 报告频率与时间：默认每周
4. 预览：现在生成一份预览报告确认效果

配置完成后你会得到一份可交给上层 Agent 使用的 JSON 配置，包含 API 取数契约和报告 Prompt。调度、推送和凭证由你的 Agent 负责。

我们开始——你想配置哪种报告？
1. 订阅组更新报告（先选择一个订阅组）
2. 全局动态报告（从全部条目中按条件筛选）
```

Rules for the entry point:
- Output this message exactly once, when entering the setup flow for the first time.
- Do not output it again if the user resumes a partially completed setup.
- `{api_base_url}` is the known API root from the install guide or user input. If unknown, omit the API address line and add it to `missing_dependencies`.
- After outputting this message, wait for the user's answer and then enter the state machine at gate 3 (`report_scope=null`).

## ReAct Driver

Use this flow as a state machine. Do not advance by intuition. After every action, update `setup_state`, check missing fields, and choose the next step from the state gates.

Do not expose private reasoning. It is acceptable to show a short user-facing status such as `已确认报告范围，下一步配置目标和时间窗口`.

Minimum `setup_state`:

```json
{
  "api_base_url": "",
  "api_url_locked": true,
  "report_scope": null,
  "groups_loaded": false,
  "groups_available": null,
  "selected_group": null,
  "global_filters": {},
  "date_filter": null,
  "cadence": null,
  "cadence_label": null,
  "run_time": null,
  "timezone": null,
  "preview_decision": null,
  "preview_result": null,
  "handoff_ready": false
}
```

ReAct loop for every step:

```text
Reason：内部判断当前缺哪个状态，不输出。
Act：执行一个动作。
Observe：记录 API、用户回复或生成结果。
Check：更新 setup_state。
Next：按状态门禁选择下一步。
```

URL rules:

- Preserve the exact scheme, host, and port from the install guide or user-provided API URL.
- Do not upgrade `http` to `https`.
- Do not remove explicit ports such as `:4000`.
- When deriving `producthunter_origin`, only remove the trailing `/api`. Keep the original scheme, host, and port.
- If a request fails with TLS, certificate, or handshake errors, check whether the agent accidentally used `https`. If so, retry once with the locked `api_base_url`.
- Do not offer “wait for the scheduled run” as a fix for a current API connectivity or URL error. Fix the API URL, mark the dependency missing, or ask the user for a reachable API address.

State gates:

1. `api_base_url` empty: derive or ask for API base URL.
   - **If coming from the ProductHunter install flow**: the install guide and install script already provide the API base URL. Write it directly into `api_base_url` and set `api_url_locked=true`. Do not ask the user.
   - If unknown: ask the user, or mark `api.base_url` as missing in `missing_dependencies`.
2. `api_url_locked=true`: use `api_base_url` exactly. Do not modify scheme, host, or port.
3. `report_scope=null`: infer from user intent or ask whether the target is a subscription group report or a global dynamics report.
4. `report_scope=group` and `groups_loaded=false`: call `GET {api.base_url}/groups`.
5. `report_scope=group` and `groups_available=false`: provide `{producthunter_origin}/?page=groups` and wait for the user to create a group.
   - When the user replies with a new group ID or name after creating one: reset `groups_available` to `null`, re-fetch `GET {api.base_url}/groups`, then continue from gate 4.
   - Do not skip straight to asking for cadence — the group must be selected first.
6. `report_scope=group` and `selected_group=null`: show available groups and ask for group ID or name.
7. `report_scope=global` and `global_filters` missing: ask for optional filters. Empty filters are valid when the user wants all global dynamics.
8. `report_scope=global` and `date_filter=null`: ask for date filtering policy. Global dynamics reports support `start=YYYY-MM-DD&end=YYYY-MM-DD`.
9. `cadence=null` or `run_time=null`: ask how often and when to send the report.
10. `timezone=null`: infer from locale when reliable, otherwise ask.
11. `preview_decision=null`: ask whether to generate or push a preview now.
12. `preview_decision=true` and `preview_result=null`: generate or push the preview according to available delivery capability.
13. All required fields present: produce final handoff and set `handoff_ready=true`.

Stop conditions:

- Do not say the setup is complete while `preview_decision=null`.
- Do not say the first scheduled report will arrive while `handoff_ready=false`.
- Do not claim an external push happened unless `preview_result.sent=true`.

## Phase 1: Runtime, Scope, And Target Discovery

Goal: identify the ProductHunter-compatible API, confirm whether the report targets a subscription group or global dynamics, then configure the target.

Ask when missing:

1. What API base URL should the upstream agent call?
   - Default to `http://localhost:9000/api` only for local ProductHunter.
   - For installed ProductHunter, default to the exact API base URL from the install guide.
   - Preserve `http` when the install guide uses `http`.
   - Preserve explicit ports.
   - If unknown, mark `api.base_url` in `missing_dependencies`.

Required first action when the API is available:

1. Determine `report_scope`.
   - If the user says “订阅组”“group”“某个组”“Memory 组”, set `report_scope=group`.
   - If the user says “全局动态”“所有动态”“全部更新”“不限定订阅组”, set `report_scope=global`.
   - If unclear, ask:

```text
你想配置哪种更新报告？
1. 订阅组更新报告：先选择一个订阅组。
2. 全局动态报告：从全部条目里按关键词、厂商、产品、数据库类型或日期筛选。
```

2. For `report_scope=group`, list groups:

```text
GET {api.base_url}/groups
```

Show the result before asking the user to choose. Include:

- ID.
- Name.
- Description, use `暂无描述` when empty.
- Feed count.
- Enabled or disabled status.
- Latest update when available.
- Tags when available.

Suggested response:

```text
我先列出当前可用订阅组，请回复要订阅的组 ID 或名称。

1. {name}
   ID：{id}
   描述：{description}
   订阅源数：{feed_count}
   状态：{enabled_label}
   最近更新：{latest_update_or_none}
```

If there are no groups:

- Tell the user there is no available subscription group yet.
- Provide the creation link: `{producthunter_origin}/?page=groups`.
- Explain that they should create a group first, then reply with the group ID or name.
- Derive `producthunter_origin` from `api.base_url` by removing the trailing `/api` when no explicit frontend URL is known. Keep the same protocol and port.
- Do not continue to cadence or report questions until at least one group has been selected.

When the user replies:

1. Accept group ID or exact group name.
2. Validate with `GET /api/groups/{group_id}` when the user gives an ID.
3. If the user gives a name, match against the list from `GET /api/groups`, then validate the matched ID.
4. If multiple names match, ask the user to pick one by ID.
5. Prefer stable group IDs in the final config.

Multiple groups:

- Support multiple groups when the user asks.
- Ask whether the report should be per group or combined.
   - Default: per group when multiple groups are selected.
   - Use combined only when the user wants a single cross-group report.

Validate when possible:

- `GET /api/groups/{group_id}` for each group.
- Optionally fetch a small date window from `/api/groups/{group_id}/entries`.

For `report_scope=global`, skip group selection:

- Ask for optional filters: `keyword`, `vendor`, `product`, `db_type`, `feed_id`, `group_id`.
- Ask whether the report should use the recurring report window automatically or a fixed date range.
- Global dynamics supports date filtering with `start` and `end`.
- For a fixed one-off or backfill report, record explicit `date_filter.start` and `date_filter.end`.
- For a recurring report, record `date_filter.mode=report_window` and derive `start/end` from the cadence on each run.

Global dynamic API:

```text
GET {api.base_url}/entries?start={start}&end={end}&limit=100&offset=0
GET {api.base_url}/calendar?start={start}&end={end}&month=YYYY-MM
```

Append only the filters the user selected:

```text
keyword={keyword}
vendor={vendor}
product={product}
db_type={db_type}
feed_id={feed_id}
group_id={group_id}
```

Suggested prompt:

```text
全局动态报告会从全部条目里取数，也支持日期筛选。

你要加哪些筛选条件？可以留空表示全部动态。
可选：关键词、厂商、产品、数据库类型、订阅源 ID、订阅组 ID。

日期范围默认按报告周期自动计算。你也可以指定固定范围，例如 2026-06-01 到 2026-06-15。
```

## Phase 2: Report Cadence And Window

Goal: set how often the user receives update reports and define the report window contract.

Defaults:

- Cadence: weekly unless the user chooses another interval.
- Weekly week start: Monday.
- Weekly window: previous full week.
- Run time hint for the upstream agent: 09:00 in the selected timezone.
- Date format: `YYYY-MM-DD`.

Ask only when missing or ambiguous:

1. How often should the user receive update reports?
   - Offer: daily, weekly, every two weeks, monthly, or custom.
   - Default to weekly.
   - Record both the human label and normalized cadence.

2. Which timezone should define the schedule and report window?
   - Default to the user's locale when known.

3. Does the organization define weeks differently?
   - Default to Monday through Sunday.

4. Should the upstream agent use a custom window?
   - Use custom `start` and `end` only when the user requests a special backfill or one-off report.

Suggested prompt for a group target:

```text
订阅组已确认：{group_id}，{group_name}。

你希望多久收到一次更新报告？
可选：每天、每周、每两周、每月，或告诉我自定义间隔。
默认我会按每周生成。
```

After the user answers cadence and run time:

- Record `report_window.cadence`, `report_window.cadence_label`, and `report_window.run_time_hint`.
- Do not announce that scheduling is configured.
- Do not say when the first report will be received.
- Move immediately to Phase 3 and ask the preview question.

Example:

```text
已记录：每天 10:00 为 {target_label} 生成更新报告。

是否需要我现在先生成一份预览报告给你看？
如果当前 agent 已配置推送渠道，我可以按上层 agent 能力推送；如果没有推送渠道，我会直接在对话里生成预览内容。
```

## Phase 3: First Preview

Goal: ask whether to generate or push one report immediately so the user can inspect the result.

Ask after target and cadence are configured:

```text
是否需要我现在先生成一份预览报告给你看？
如果当前 agent 已配置推送渠道，我可以按上层 agent 能力推送；如果没有推送渠道，我会直接在对话里生成预览内容。
```

Rules:

- This phase is required. The setup is incomplete until the user explicitly accepts or declines the preview.
- Default to preview-only when the user says yes.
- If the user declines, record `initial_preview.requested=false` and continue to the final handoff.
- Use the selected cadence to compute a recent window. For weekly, use the previous full week by default.
- For `report_scope=group`, fetch entries from `/api/groups/{group_id}/entries`.
- For `report_scope=global`, fetch entries from `/api/entries` with the selected filters and `start/end`.
- If no delivery channel is configured, generate the preview in the current conversation and state that no external push was sent.
- Do not claim a real push was sent unless the upstream agent actually sends it.
- Keep `dry_run=true` unless the user explicitly confirms live delivery.
- Do not say “配置完成” or equivalent until the preview decision has been recorded.

## Phase 4: Summary Requirements

Goal: shape the output the user actually wants.

Ask when missing:

1. Audience:
   - Individual user, engineering team, product team, sales, leadership, customer support, or mixed.

2. Language:
   - Default to the user's language.

3. Priority signals:
   - Security, breaking changes, pricing, deprecations, compatibility, incidents, new features, performance, or all.

4. AI-selected highlights:
   - Default: 3 to 8 important items.
   - Increase only when the target has many high-value updates.

5. Detailed list grouping:
   - Default: group by source.
   - Alternative: group by date, vendor, product, or priority.

Required report sections:

- Overview.
- AI-selected important content.
- Detailed item list.

## Phase 5: Upstream Agent Handoff

Goal: make the boundary explicit so the config can be used by another agent.

Ask when missing:

1. Where should the configuration be stored?
   - If unknown, return the JSON in the response and let the upstream agent store it.

2. Does the upstream agent already own scheduling and state?
   - Default: yes.
   - If no, list that as a missing dependency.

3. Does delivery need to be included in the config?
   - Ask only when the user wants the handoff to include channel metadata.
   - Never ask the user to paste raw secrets.

4. Should future runs send to a delivery channel?
   - Ask only when the user wants real delivery setup.
   - Keep the first preview as dry-run unless the user explicitly confirms live delivery.

## Phase 6: Confirmation

Before producing the final config, summarize the choices:

```text
我将为 {target_label} 配置更新报告。
报告间隔：{cadence_label}
时间窗口：{timezone}，{window_policy}
日期筛选：{date_filter_summary}
输出：{language}，三段式报告，面向 {audience}
重点：{priority_signals}
预览：{preview_plan}
运行方：上层 agent 负责调度、状态和推送
缺失项：{missing_dependencies}
```

Ask the user to confirm only when updating an existing config, binding delivery metadata, or producing a live handoff that an upstream agent will immediately run.

## Minimal Question Set

When the user wants a fast setup and no system data is available, ask:

1. ProductHunter API 地址是什么？
2. 报告范围是订阅组还是全局动态？
3. 如果是订阅组，订阅组 ID 或名称是什么？如果是全局动态，日期范围和筛选条件是什么？
4. 希望多久收到一次更新报告？
5. 用哪个时区计算报告窗口？
6. 是否现在先生成一份预览报告？

Then generate a draft config with missing fields clearly marked.
