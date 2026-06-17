#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${PRODUCTHUNTER_SKILL_BASE_URL:-{{BASE_URL}}}"
SKILL_NAME="${PRODUCTHUNTER_SKILL_NAME:-rss-group-digest}"

if [[ -n "${PRODUCTHUNTER_SKILL_ROOT:-}" ]]; then
  SKILL_ROOT="$PRODUCTHUNTER_SKILL_ROOT"
else
  SKILLS_DIR="${PRODUCTHUNTER_SKILLS_DIR:-${AGENT_SKILLS_DIR:-}}"
  if [[ -z "$SKILLS_DIR" ]]; then
    if [[ -n "${CLAUDE_SKILLS_DIR:-}" ]]; then
      SKILLS_DIR="$CLAUDE_SKILLS_DIR"
    elif [[ -d "$HOME/.claude" ]]; then
      SKILLS_DIR="$HOME/.claude/skills"
    elif [[ -n "${CODEX_HOME:-}" ]]; then
      SKILLS_DIR="$CODEX_HOME/skills"
    elif [[ -d "$HOME/.codex" ]]; then
      SKILLS_DIR="$HOME/.codex/skills"
    else
      echo "无法自动检测 Skill 安装目录，请手动指定："
      read -rp "Skill 安装目录: " SKILLS_DIR
      if [[ -z "$SKILLS_DIR" ]]; then
        echo "错误：未指定安装目录" >&2
        exit 1
      fi
    fi
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
ProductHunter 更新报告 Skill 已安装。

API 根地址：${BASE_URL}/api
（必须原样使用，保留协议和端口，不要改成 https，不要删除端口号）

下一步：
1. 通过 agent 自身的 Skill 加载机制加载 \$${SKILL_NAME}。
2. 将 api_base_url 预设为 ${BASE_URL}/api，写入 setup_state，无需询问用户。
3. 按 Skill 工作流引导用户完成更新报告配置。
EOF
