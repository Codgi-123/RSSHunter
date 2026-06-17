# ProductHunter Update Report Skill 安装指引

这是 ProductHunter 更新报告 Skill 的公开安装与交接说明。安装后，agent 应通过自身的 Skill 加载机制读取 `rss-group-digest`，并引导用户配置订阅组或全局动态周期性更新报告。

## 适用对象

- OpenAI 兼容 Skill 客户端。
- 支持从本地目录加载 `SKILL.md` 的自定义 agent。
- 需要把 ProductHunter 订阅组或全局动态数据交给上层 agent 定期总结的自动化任务。

## 安装 agent 行为要求

当用户要求”安装这个 Skill”或”阅读此安装指引并安装”时：

- 用户明确说”只安装””先不要配置””安装完停止”时，只安装并回复安装结果。
- 其他情况安装完成后默认进入配置流程，**不要停在”是否需要帮你读 Skill 内容”这一步**。
- API 根地址已由本安装指引确定为 `{{BASE_URL}}/api`，**进入配置流程后无需再询问用户**。
- API URL 必须原样使用，保留协议、域名和端口，不要把 `http` 改成 `https`，不要删除端口号。

## 安装后行为

安装脚本执行成功后，通过 agent 自身的 Skill 加载机制加载 `rss-group-digest`。加载完成后，将 `api_base_url` 预设为 `{{BASE_URL}}/api` 写入 `setup_state`，然后输出 `references/conversation-flow.md` 中 **Entry Point: First Message After Skill Load** 一节定义的开场消息，再按 Skill 工作流驱动配置。

## 安装目标

安装完成后，上层 agent 应具备以下能力：

- 引导用户选择 ProductHunter 或兼容系统中的订阅组，或配置全局动态报告。
- 生成可持久化的周期性更新报告配置。
- 按时间窗口调用 ProductHunter API 获取条目数据。
- 使用内置 prompt 输出三段式报告：汇总、AI 选取的重要内容、详细列表。
- 明确区分职责：Skill 负责配置、取数契约和总结 prompt；上层 agent 负责调度、状态、重试、凭证和推送。

## 快速安装

运行安装脚本即可。安装位置由安装 agent 自行决定，不需要用户指定。

```bash
curl -fsSL "{{BASE_URL}}/api/skill/install.sh" | bash
```

## 安装内容

脚本会下载以下文件：

```text
rss-group-digest/
|-- SKILL.md
|-- agents/
|   `-- openai.yaml
`-- references/
    |-- config-schema.md
    |-- conversation-flow.md
    `-- prompt-templates.md
```

`agents/openai.yaml` 只用于 OpenAI 兼容界面的展示元数据。其他 agent 可以忽略它，直接读取 `SKILL.md` 和 `references/`。

## 安装后验证

安装脚本失败时会以非零状态退出。脚本成功后无需额外验证步骤，直接按"Skill 加载方式"一节加载并进入配置流程。

## ProductHunter API 契约

上层 agent 运行订阅组报告任务时，默认调用：

```text
GET /api/groups/{group_id}
GET /api/groups/{group_id}/entries?start=YYYY-MM-DD&end=YYYY-MM-DD&limit=100&offset=0
GET /api/groups/{group_id}/entries-by-source?start=YYYY-MM-DD&end=YYYY-MM-DD
GET /api/groups/{group_id}/calendar?start=YYYY-MM-DD&end=YYYY-MM-DD&month=YYYY-MM
```

默认时间窗口为上一个完整自然周，周一到周日。请求参数使用日期字符串，例如 `start=2026-06-08&end=2026-06-14`。

上层 agent 运行全局动态报告任务时，默认调用：

```text
GET /api/entries?start=YYYY-MM-DD&end=YYYY-MM-DD&limit=100&offset=0
GET /api/calendar?start=YYYY-MM-DD&end=YYYY-MM-DD&month=YYYY-MM
```

全局动态报告也可以追加筛选条件：

```text
keyword=关键词
vendor=厂商
product=产品
db_type=数据库类型
feed_id=订阅源 ID
group_id=订阅组 ID
```

`start` 和 `end` 都是日期字符串。ProductHunter 会按 `published_at` 过滤，`end` 表示报告窗口最后一个自然日。

## 上层 agent 职责

- 计算报告窗口并定时触发任务。
- 保存配置、运行状态和去重状态。
- 管理 API 凭证、重试、失败告警和最终推送。
- dry-run 时只生成预览，不发送到真实渠道。
- 报告生成后校验三段式结构和来源链接。

## 重要边界

不要把这个 Skill 当作常驻服务。它不实时监听 RSS，不在后台调度任务，不保存凭证，不直接推送消息。
