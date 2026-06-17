# Update Report Configuration Schema

Use this schema as the canonical handoff between setup conversation and the upstream agent that runs recurring ProductHunter update report jobs. A report can target subscription groups or global dynamics.

## JSON Shape

This is a schema reference. All values in angle brackets are placeholders that must be filled in during setup — do not use this example as a default config.

```json
{
  "version": "1.0",
  "name": "<report-name>",
  "report_scope": "<group|global>",
  "dry_run": true,
  "owner": {
    "team": "",
    "contact": ""
  },
  "runner": {
    "type": "external_agent",
    "schedule_owned_by": "upstream_agent",
    "state_owned_by": "upstream_agent",
    "delivery_owned_by": "upstream_agent"
  },
  "setup_state": {
    "api_base_url": "<API base URL from install guide>",
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
    "feishu_enabled": null,
    "feishu_config": null,
    "handoff_ready": false
  },
  "api": {
    "base_url": "<API base URL from install guide>",
    "preserve_url": true,
    "auth": {
      "type": "none",
      "secret_ref": ""
    }
  },
  "subscription_groups": [],
  "global_report": {
    "enabled": false,
    "label": "全局动态",
    "filters": {
      "keyword": "",
      "vendor": "",
      "product": "",
      "db_type": "",
      "feed_id": null,
      "group_id": null
    },
    "date_filter": {
      "mode": "report_window",
      "start": "",
      "end": ""
    }
  },
  "report_window": {
    "cadence": null,
    "cadence_label": null,
    "interval_count": 1,
    "timezone": null,
    "week_start": "monday",
    "default_window": "previous_full_week",
    "run_time_hint": null,
    "date_format": "YYYY-MM-DD"
  },
  "initial_preview": {
    "offered": false,
    "requested": null,
    "decision_required": true,
    "mode": null,
    "sent": false
  },
  "fetch": {
    "mode": "entries",
    "endpoint": "/groups/{group_id}/entries",
    "global_endpoint": "/entries",
    "source_endpoint": "/groups/{group_id}/entries-by-source",
    "calendar_endpoint": "/groups/{group_id}/calendar",
    "global_calendar_endpoint": "/calendar",
    "window_params": {
      "start": "YYYY-MM-DD",
      "end": "YYYY-MM-DD"
    },
    "filter_params": ["keyword", "vendor", "product", "db_type", "feed_id", "group_id"],
    "pagination": {
      "limit": 100,
      "offset_start": 0,
      "continue_until_empty": true
    },
    "time_field": "published_at",
    "fallback_time_field": "created_at",
    "sort": "published_at_desc"
  },
  "report": {
    "language": "zh-CN",
    "audience": "engineering",
    "format": "recurring_three_part_report",
    "sections": ["overview", "ai_selected_highlights", "detailed_item_list"],
    "priority_signals": ["security", "breaking_change", "deprecation", "pricing", "compatibility", "new_feature", "performance", "incident"],
    "max_highlights": 8,
    "detailed_list_group_by": "source",
    "include_source_links": true,
    "include_entry_ids": true,
    "include_low_priority_items": true
  },
  "state": {
    "owned_by": "upstream_agent",
    "dedupe_keys": ["id", "guid", "link"],
    "last_success_window_end": "",
    "seen_entry_ids": []
  },
  "delivery": {
    "owned_by": "upstream_agent",
    "channel": "",
    "destination": "",
    "on_empty": "send_short_empty_notice"
  },
  "feishu": {
    "enabled": false,
    "root_folder_name": "{target_label}市场动态报告",
    "folder_path_template": "{root_folder_name}/M{month}/W{week_of_month}",
    "doc_title_template": "【{report_date}】{target_label} 市场动态报告",
    "timezone": "Asia/Shanghai",
    "week_start": "monday",
    "week_of_month_algorithm": "ceil(monday_of_week.day / 7)"
  },
  "missing_dependencies": []
}
```

## Field Rules

- `dry_run`: keep `true` for the first generated config unless the user explicitly asks for a live handoff.
- `report_scope`: use `group` for subscription group reports and `global` for global dynamics reports.
- `runner`: always mark schedule, state, delivery, retry, and credentials as upstream-agent responsibilities.
- `setup_state`: maintain this during the ReAct setup flow. Check it after every action before asking the next question or declaring completion.
- `setup_state.api_url_locked`: when `true`, use `setup_state.api_base_url` exactly. Do not change `http` to `https`, and do not remove explicit ports.
- `setup_state.report_scope`: keep `null` until the target is known. Ask whether the target is a subscription group report or global dynamics report when it cannot be inferred.
- `setup_state.global_filters`: for `report_scope=global`, store selected `keyword`, `vendor`, `product`, `db_type`, `feed_id`, and `group_id` filters.
- `setup_state.date_filter`: for `report_scope=global`, record whether `start/end` are derived from the report window or fixed by the user.
- `setup_state.handoff_ready`: set `true` only after report scope, target configuration, cadence, run time, timezone, and preview decision are all captured.
- `setup_state.preview_decision`: keep `null` until the user explicitly accepts or declines a preview.
- `api.base_url`: use the ProductHunter-compatible API root. Preserve the exact protocol, host, and port from the install guide or user input. If unknown, ask for it or mark as missing.
- `api.preserve_url`: when `true`, the upstream agent must not normalize, upgrade, or rewrite the URL.
- `subscription_groups`: for `report_scope=group`, support one or many groups. Each group should have a stable `id` when available. For `report_scope=global`, leave this empty unless the user uses `group_id` as a global filter.
- `global_report.enabled`: set `true` when `report_scope=global`.
- `global_report.filters`: include only user-selected filters in API requests. Empty values mean no filter.
- `global_report.date_filter.mode`: use `report_window` for recurring reports that derive `start/end` from cadence. Use `fixed_range` only when the user requests a fixed range or backfill.
- `global_report.date_filter.start` and `global_report.date_filter.end`: date-only strings. Preserve user-provided values when mode is `fixed_range`.
- `report_window.cadence`: default to `weekly`. Accept `daily`, `weekly`, `biweekly`, `monthly`, or `custom` when the user chooses another interval.
- `report_window.cadence_label`: preserve the user's human-readable interval, such as `每天`, `每周`, `每两周`, `每月`, or a custom phrase.
- `report_window.interval_count`: use `1` for daily, weekly, and monthly defaults. Use `2` for every two weeks. For `custom`, record the parsed count when available.
- `report_window.run_time_hint`: default to `09:00` in `report_window.timezone` unless the user chooses another time.
- `report_window.default_window`: default to `previous_full_week` for weekly reports. Use the previous completed cadence window for other cadences.
- `report_window.week_start`: default to `monday` unless the user's organization uses another convention.
- `initial_preview.offered`: set to `true` once the agent asks the preview question.
- `initial_preview.requested`: keep `null` until the user answers. Set `true` when the user wants a preview and `false` when the user declines.
- `initial_preview.decision_required`: keep `true` during setup. The configuration is incomplete while `initial_preview.requested` is `null`.
- `initial_preview.mode`: use `conversation_preview` when no external push channel is available. Use `delivery_channel_preview` only when the upstream agent actually sends through a configured channel.
- `initial_preview.sent`: set `true` only when an external push was actually sent.
- `fetch.mode`:
  - `entries`: default, fetch paginated entries and let the report prompt group them. For `report_scope=group`, use `fetch.endpoint`. For `report_scope=global`, use `fetch.global_endpoint`.
  - `entries_by_source`: use when the report must preserve vendor or source grouping from the API.
  - `calendar`: use only for distribution checks or dry-run diagnostics.
- `fetch.global_endpoint`: use `/entries` for global dynamics. It supports `start`, `end`, `keyword`, `vendor`, `product`, `db_type`, `feed_id`, `group_id`, `limit`, and `offset`.
- `fetch.global_calendar_endpoint`: use `/calendar` for global distribution checks. It supports the same filters and date parameters.
- `report.sections`: keep all three required sections unless the user explicitly asks for a narrower report.
- `report.priority_signals`: order matters. Higher priority appears earlier.
- `state`: include dedupe hints, but do not assume this skill can persist them.
- `delivery`: leave channel and destination empty unless the user provides them. The upstream agent binds these values.
- `feishu.enabled`: set `true` only when the user explicitly opts in during setup.
- `feishu.root_folder_name`: default to `{target_label}市场动态报告`. Accept user override. The upstream agent creates this folder hierarchy in Feishu if it does not exist — no credentials are needed, the agent already has Feishu access.
- `feishu.folder_path_template`: `{root_folder_name}/M{month}/W{week_of_month}`. The upstream agent resolves `month` and `week_of_month` from `report_date` in UTC+8 before each run.
- `feishu.doc_title_template`: `【{report_date}】{target_label} 市场动态报告`. `report_date` is the last day of the report window (YYYY-MM-DD, UTC+8).
- `feishu.week_of_month_algorithm`: `ceil(monday_of_week.day / 7)` where `monday_of_week` is the Monday of the ISO week containing `report_date` in UTC+8.
- `missing_dependencies`: list anything required before automation can run.

## Report Schedule And Window Defaults

- The upstream agent should normally run according to `report_window.cadence`.
- Default cadence: weekly.
- Default runtime: 09:00 in `report_window.timezone`.
- Weekly reporting window: previous Monday 00:00 through previous Sunday 23:59:59 in the configured timezone.
- Daily reporting window: previous full calendar day in the configured timezone.
- Biweekly reporting window: previous two completed weeks, Monday through Sunday.
- Monthly reporting window: previous full calendar month.
- API request values should be date-only strings: `start=YYYY-MM-DD` and `end=YYYY-MM-DD`.
- Global dynamics reports use the same `start` and `end` date filtering through `/api/entries`.
- Example: for a Monday run on 2026-06-15, request `start=2026-06-08` and `end=2026-06-14`.

## API Calls

For `report_scope=group`, call for each group:

```text
GET {api.base_url}/groups
GET {api.base_url}/groups/{group_id}
GET {api.base_url}/groups/{group_id}/entries?start={start}&end={end}&limit=100&offset=0
GET {api.base_url}/groups/{group_id}/entries?start={start}&end={end}&limit=100&offset=100
```

Continue pagination until `items` is empty or fewer than `limit`.

For `report_scope=global`, call:

```text
GET {api.base_url}/entries?start={start}&end={end}&limit=100&offset=0
GET {api.base_url}/entries?start={start}&end={end}&limit=100&offset=100
GET {api.base_url}/calendar?start={start}&end={end}&month={month}
```

Append `keyword`, `vendor`, `product`, `db_type`, `feed_id`, or `group_id` only when configured. Continue pagination until `items` is empty or fewer than `limit`.

## Dry-Run Checklist

1. Confirm `report_scope`.
2. For `report_scope=group`, fetch group metadata.
3. For `report_scope=global`, fetch one date-filtered `/entries` sample with the selected filters.
4. Fetch one historical window matching `report_window.cadence` with `start` and `end`.
5. Confirm response items contain stable IDs, titles, links, source metadata, and time fields.
6. Run the update report prompt on a small sample.
7. Ask whether the user wants an initial preview.
8. Record `initial_preview.requested`.
9. If preview is requested, confirm the generated report includes overview, AI-selected highlights, and detailed item list.
10. Update `setup_state.preview_decision` and `setup_state.preview_result`.
11. Confirm `setup_state.handoff_ready=true` only after all required state fields are complete.
12. Confirm the upstream agent can persist state and handle delivery.
