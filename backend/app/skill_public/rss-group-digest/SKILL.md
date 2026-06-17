---
name: rss-group-digest
description: "Set up a recurring RSS subscription group or global dynamics digest report, including cadence, date filters, preview, and upstream agent handoff config."
---

# ProductHunter Update Report

## Overview

Use this skill to configure a reusable recurring update report for one of these ProductHunter-compatible targets:

- One or more subscription groups.
- Global dynamics from `/api/entries`, with optional filters and date filtering.

The result is a concrete handoff package for an upstream agent: configuration, API fetch contract, report prompt, and dry-run checklist.

Keep responsibilities clear:

- This skill owns conversational setup, report-scope selection, target configuration, API contract, and summarization prompts.
- The upstream agent owns scheduling, state persistence, retries, credentials, and final delivery.
- ProductHunter-compatible services own group metadata and date-window entry APIs.

## Workflow

1. On load, check whether `config.json` already exists in the skill directory:
   - If it exists: show the existing config to the user and ask whether to keep it or reconfigure. Do not silently apply it.
   - If it does not exist: start the full setup flow.

2. Drive setup with a ReAct-style state loop:
   - Reason internally about the missing state. Do not reveal private reasoning.
   - Act by doing exactly one next action.
   - Observe the result from the API, user response, or generated config.
   - Check and update `setup_state` after every action.
   - Continue only according to the next missing state.

3. Maintain `setup_state` throughout setup:
   - `api_base_url`
   - `api_url_locked`
   - `report_scope`
   - `groups_loaded`
   - `groups_available`
   - `selected_group`
   - `global_filters`
   - `date_filter`
   - `cadence`
   - `run_time`
   - `timezone`
   - `preview_decision`
   - `preview_result`
   - `handoff_ready`

4. Enforce state gates:
   - When `api_base_url` is already provided by the install guide or install script, use it directly. Do not ask the user for the API URL.
   - When `api_url_locked=true`, use `api_base_url` exactly. Do not change `http` to `https`, and do not remove explicit ports.
   - When an API request fails with TLS, certificate, or handshake errors, check whether `https` was used accidentally. If so, retry with the locked `api_base_url`.
   - When `report_scope` is empty, infer or ask whether the user wants a subscription group report or a global dynamics report.
   - When `report_scope=group` and `groups_loaded=false`, fetch and show groups before asking for a group choice.
   - When `report_scope=group` and `groups_available=false`, send the user to create a group at `{producthunter_origin}/?page=groups` and wait. When the user returns with a group ID or name, reset `groups_available` to null, re-fetch `GET /api/groups`, then continue from the groups-loaded gate.
   - When `report_scope=group` and `selected_group` is empty, ask only for group ID or name.
   - When `report_scope=global`, skip group selection and configure `global_filters` plus `date_filter`. Global dynamics reports support `start` and `end` date filtering.
   - When `cadence` or `run_time` is empty, ask for report interval and time.
   - When `preview_decision` is empty, ask whether to generate or push a preview.
   - When `feishu_enabled` is null, ask whether to save reports to Feishu documents. Do not declare setup complete until the user has answered this question.
   - Set `handoff_ready=true` only after report scope, target configuration, cadence, run time, timezone, preview decision, and feishu_enabled are all captured.

5. Discover the runtime context:
   - ProductHunter-compatible API base URL.
   - Exact API URL from the install guide or user input, preserving protocol and port.
   - Report scope: `group` for subscription groups or `global` for global dynamics.
   - For `group`, available subscription groups from `GET /api/groups` before asking the user to choose.
   - For `group`, target subscription group ID or name. Support multiple groups when requested.
   - For `global`, optional filters: `keyword`, `vendor`, `product`, `db_type`, `feed_id`, `group_id`, `start`, and `end`.
   - Report cadence and interval. Default to weekly when the user has no preference.
   - User timezone. Default to the user's locale when known.
   - Report window policy. For weekly reports, default to the previous full week, Monday through Sunday.
   - Report audience, language, priority signals, length, and grouping preference.
   - Upstream agent constraints only when the user mentions them.

6. Guide setup in this order. Use `references/conversation-flow.md` for details:
   - Determine the report scope.
   - If `group`, show available subscription groups with ID, name, description, feed count, status, and latest update.
   - If no groups exist, send the user to the ProductHunter group creation page and wait for a group ID or name.
   - If `group`, let the user choose by group ID or exact name, then validate the group.
   - If `global`, ask for filters and date policy. Use `/api/entries` with `start` and `end` for date-filtered global dynamics.
   - Ask how often the user wants the update report.
   - Ask whether to generate or push one preview report immediately. Validate that the preview contains all three sections: 总结、重点信息、详细列表.
   - Ask whether to save reports to Feishu documents. Do not claim setup is complete until the user has answered this question.
   - Ask only the remaining high-impact questions.

7. Validate the target before producing a final handoff:
   - If the API is reachable and `report_scope=group`, verify every subscription group.
   - If the API is reachable and `report_scope=global`, run a small `/api/entries` fetch with the selected filters and date window.
   - If the API is not reachable, produce a draft config and list `missing_dependencies`.
   - If sample entries are available, fetch a small historical window and confirm the prompt can consume the response shape.
   - Do not promise live scheduling, background jobs, or push delivery from this skill.

8. Generate or update a configuration object. Use `references/config-schema.md` for canonical fields, defaults, and API call examples. Save the final config as `config.json` inside the skill directory. Do not ask the user where to save it.

9. Select prompts:
   - Use `references/prompt-templates.md` for the update report system prompt, user prompt, empty report, highlight selection rules, and upstream agent handoff prompt.
   - Customize templates with the selected audience, language, priority signals, time window, and target labels.

10. Return a concise handoff:
   - Final configuration JSON or YAML.
   - Update report prompt templates to install in the upstream agent.
   - API calls the upstream agent should make for each date window.
   - Missing decisions, credentials, or backend dependencies.
   - A short dry-run plan.

## ProductHunter API Notes

For this repository, use these endpoints when available:

- `GET /api/groups/{group_id}`: validate group metadata.
- `GET /api/groups`: list group candidates before asking the user to choose.
- `GET /api/groups/{group_id}/entries?start=YYYY-MM-DD&end=YYYY-MM-DD&limit=100&offset=0`: fetch group entries for a date window.
- `GET /api/groups/{group_id}/entries-by-source?start=YYYY-MM-DD&end=YYYY-MM-DD`: fetch grouped entries for source-aware summaries.
- `GET /api/groups/{group_id}/calendar?start=YYYY-MM-DD&end=YYYY-MM-DD&month=YYYY-MM`: inspect daily distribution.
- `GET /api/entries?start=YYYY-MM-DD&end=YYYY-MM-DD&limit=100&offset=0`: fetch date-filtered global dynamics.
- `GET /api/calendar?start=YYYY-MM-DD&end=YYYY-MM-DD&month=YYYY-MM`: inspect global dynamics daily distribution.

Global dynamics endpoints also support `keyword`, `vendor`, `product`, `db_type`, `feed_id`, and `group_id`. Use these filters only when the user requests them or when the report scope requires them.

Use `published_at` as the primary content time. Fall back to `created_at` only when `published_at` is empty. For recurring reports, pass date-only `start` and `end` values, and treat `end` as the last calendar day in the report window when the API supports that convention.

## Output Standards

- Default to weekly reports, but ask the user how often they want to receive updates during setup.
- Treat global dynamics date filtering as first-class. Preserve user-provided `start` and `end`, or derive them from the recurring report window.
- Do not configure real-time notification behavior as the default.
- Keep generated prompts model-agnostic unless the user chooses a provider or model.
- Make the report structure explicit: 总结、重点信息、详细列表. All three sections are required; a report missing any section is incomplete.
- Preserve source links and entry IDs so users can audit every conclusion.
- Keep scheduling, state, retry, credential, and delivery responsibilities assigned to the upstream agent.
- Treat the preview decision as required. After the user provides cadence and run time, the next assistant response must ask whether to generate or push a preview report. Do not say the schedule is configured until the preview decision is captured.

## Agent Compatibility

This skill is model-agnostic. Agents that support `$rss-group-digest` can invoke it directly. Other agents should load this `SKILL.md` first, then read the relevant reference files for conversation flow, configuration schema, or prompt templates.
