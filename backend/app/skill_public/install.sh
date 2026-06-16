#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${PRODUCTHUNTER_SKILL_BASE_URL:-{{BASE_URL}}}"
SKILL_NAME="${PRODUCTHUNTER_SKILL_NAME:-rss-group-digest}"

if [[ -n "${PRODUCTHUNTER_SKILL_ROOT:-}" ]]; then
  SKILL_ROOT="$PRODUCTHUNTER_SKILL_ROOT"
else
  SKILLS_DIR="${PRODUCTHUNTER_SKILLS_DIR:-${AGENT_SKILLS_DIR:-}}"
  if [[ -z "$SKILLS_DIR" ]]; then
    SKILLS_DIR="${CODEX_HOME:-$HOME/.codex}/skills"
  fi
  SKILL_ROOT="${SKILLS_DIR%/}/${SKILL_NAME}"
fi

download() {
  local remote_path="$1"
  local local_path="$2"
  mkdir -p "$(dirname "$local_path")"
  curl -fsSL "${BASE_URL}/api/skill/package/${remote_path}" -o "$local_path"
}

mkdir -p "$SKILL_ROOT"

download "SKILL.md" "${SKILL_ROOT}/SKILL.md"
download "agents/openai.yaml" "${SKILL_ROOT}/agents/openai.yaml"
download "references/config-schema.md" "${SKILL_ROOT}/references/config-schema.md"
download "references/conversation-flow.md" "${SKILL_ROOT}/references/conversation-flow.md"
download "references/prompt-templates.md" "${SKILL_ROOT}/references/prompt-templates.md"

cat <<EOF
ProductHunter 更新报告 Skill 已安装至 ${SKILL_ROOT}

API 根地址：${BASE_URL}/api
（必须原样使用，保留协议和端口，不要改成 https，不要删除端口号）

下一步：
1. 加载已安装的 Skill：
   - 支持 \$skill 语法：使用 \$${SKILL_NAME}
   - 不支持时：直接读取 ${SKILL_ROOT}/SKILL.md 和 ${SKILL_ROOT}/references/conversation-flow.md
2. 将 api_base_url 预设为 ${BASE_URL}/api，写入 setup_state，无需询问用户。
3. 按 Skill 工作流引导用户完成更新报告配置。
EOF
