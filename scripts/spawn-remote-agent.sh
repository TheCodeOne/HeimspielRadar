#!/usr/bin/env bash
# ==============================================================================
# HeimspielRadar Remote Agent Dispatcher
#
# Spawns an Antigravity (agy) agent on the remote Windows/WSL runner via Herdr (hc).
# Enforces mandatory Gemini Flash model (--model gemini-3.8-flash-medium) and
# auto-permissions (--dangerously-skip-permissions).
#
# Safely encapsulates prompts via base64 encoding to prevent quoting, escaping,
# and unexpected EOF errors across shell / WSL boundaries.
# ==============================================================================
set -euo pipefail

DEFAULT_MODEL="gemini-3.8-flash-medium"
DEFAULT_TARGET="windows"
DEFAULT_DISTRO="Ubuntu"

show_help() {
  cat << 'EOF'
Usage:
  scripts/spawn-remote-agent.sh --task <name> [options]

Required:
  -t, --task <name>         Task or issue name (e.g. 'issue-168' or 'agent-issue-168')

Options:
  -p, --prompt <file|text>  Agent instruction (path to prompt file or raw prompt text).
                            If omitted and stdin is piped, prompt is read from stdin.
  -w, --worktree <path>     Target worktree directory path (relative to repo or absolute)
  -m, --model <name>        Model flag (default: 'gemini-3.8-flash-medium')
      --target <name>       Herdr target runner (default: 'windows')
      --distro <name>       WSL distribution name (default: 'Ubuntu')
      --repo-dir <path>     Remote repository root directory in WSL (optional)
  -f, --foreground          Run agent in foreground (default: background via --bg)
      --no-skip-permissions Do not inject --dangerously-skip-permissions
      --dry-run             Print the constructed Herdr command without executing
      --install-guardrail   Install the agy model guardrail wrapper on the remote runner
  -h, --help                Show this help message and exit

Examples:
  # Dispatch issue resolution with prompt string:
  ./scripts/spawn-remote-agent.sh \
    --task issue-168 \
    --worktree .worktrees/issue-168 \
    --prompt "Implement dispatcher script and guardrail wrapper."

  # Dispatch with prompt from a file:
  ./scripts/spawn-remote-agent.sh \
    --task issue-168 \
    --worktree .worktrees/issue-168 \
    --prompt ./prompts/issue-168.md

  # Pipe prompt via stdin:
  cat instructions.txt | ./scripts/spawn-remote-agent.sh --task issue-168

  # Preview Herdr dispatch command without running:
  ./scripts/spawn-remote-agent.sh --task issue-168 --prompt "Run tests" --dry-run

  # Install agy model guardrail on remote runner:
  ./scripts/spawn-remote-agent.sh --install-guardrail
EOF
}

TASK=""
PROMPT_ARG=""
WORKTREE=""
MODEL="$DEFAULT_MODEL"
TARGET="$DEFAULT_TARGET"
DISTRO="$DEFAULT_DISTRO"
REPO_DIR=""
RUN_BG=true
SKIP_PERMISSIONS=true
DRY_RUN=false
INSTALL_GUARDRAIL=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    -t|--task)
      TASK="$2"
      shift 2
      ;;
    -p|--prompt)
      PROMPT_ARG="$2"
      shift 2
      ;;
    -w|--worktree)
      WORKTREE="$2"
      shift 2
      ;;
    -m|--model)
      MODEL="$2"
      shift 2
      ;;
    --target)
      TARGET="$2"
      shift 2
      ;;
    --distro)
      DISTRO="$2"
      shift 2
      ;;
    --repo-dir)
      REPO_DIR="$2"
      shift 2
      ;;
    -f|--foreground)
      RUN_BG=false
      shift
      ;;
    --no-skip-permissions)
      SKIP_PERMISSIONS=false
      shift
      ;;
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    --install-guardrail)
      INSTALL_GUARDRAIL=true
      shift
      ;;
    -h|--help)
      show_help
      exit 0
      ;;
    *)
      echo "Error: Unknown argument '$1'" >&2
      show_help >&2
      exit 1
      ;;
  esac
done

# Handle remote guardrail installation
if [ "$INSTALL_GUARDRAIL" = true ]; then
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  WRAPPER_SCRIPT="${SCRIPT_DIR}/agy-wrapper.sh"

  if [ ! -f "$WRAPPER_SCRIPT" ]; then
    echo "Error: Guardrail wrapper script not found at '$WRAPPER_SCRIPT'" >&2
    exit 1
  fi

  WRAPPER_CONTENT="$(cat "$WRAPPER_SCRIPT")"
  WRAPPER_B64="$(printf "%s" "$WRAPPER_CONTENT" | base64 | tr -d '\r\n')"

  GUARDRAIL_INSTALL_CMD="mkdir -p ~/.local/bin && echo ${WRAPPER_B64} | base64 -d > ~/.local/bin/agy && chmod +x ~/.local/bin/agy && grep -q AGY_GUARDRAIL_INSTALLED ~/.bashrc 2>/dev/null || (printf '\n# AGY_GUARDRAIL_INSTALLED\nexport PATH=\"\$HOME/.local/bin:\$PATH\"\n' >> ~/.bashrc) && echo 'Guardrail installed successfully.'"

  HC_GUARDRAIL_CMD="hc exec --on ${TARGET} \"wsl -d ${DISTRO} -- bash -c '${GUARDRAIL_INSTALL_CMD}'\""

  if [ "$DRY_RUN" = true ]; then
    echo "=== Guardrail Installation (Dry Run) ==="
    echo "Target runner: ${TARGET} (WSL ${DISTRO})"
    echo "Command:"
    echo "  ${HC_GUARDRAIL_CMD}"
    exit 0
  fi

  if ! command -v hc >/dev/null 2>&1; then
    echo "Error: 'hc' (Herdr Core CLI) command not found in PATH." >&2
    echo "To test installation without executing, run with --dry-run." >&2
    exit 1
  fi

  echo "==> Installing agy model guardrail on remote runner '${TARGET}' (WSL ${DISTRO})..."
  hc exec --on "$TARGET" "wsl -d ${DISTRO} -- bash -c \"${GUARDRAIL_INSTALL_CMD}\""
  echo "✅ Remote guardrail installation complete."
  exit 0
fi

# Validate task parameter
if [ -z "$TASK" ]; then
  echo "Error: Missing required option: --task <name>" >&2
  show_help >&2
  exit 1
fi

# Sanitize task name for agent name & temp files
CLEAN_TASK="${TASK#agent-}"
AGENT_NAME="agent-${CLEAN_TASK}"

# Read prompt content from file, argument, or stdin
PROMPT_CONTENT=""
if [ -n "$PROMPT_ARG" ]; then
  if [ "$PROMPT_ARG" = "-" ]; then
    PROMPT_CONTENT="$(cat)"
  elif [ -f "$PROMPT_ARG" ]; then
    PROMPT_CONTENT="$(cat "$PROMPT_ARG")"
  else
    PROMPT_CONTENT="$PROMPT_ARG"
  fi
elif [ ! -t 0 ]; then
  PROMPT_CONTENT="$(cat)"
fi

if [ -z "$PROMPT_CONTENT" ]; then
  echo "Error: Prompt cannot be empty. Provide via --prompt <file|text> or stdin." >&2
  exit 1
fi

# Base64-encode prompt to avoid any shell escaping or unexpected EOF errors
PROMPT_B64="$(printf "%s" "$PROMPT_CONTENT" | base64 | tr -d '\r\n')"

# Determine permission flag
EXTRA_FLAGS=""
if [ "$SKIP_PERMISSIONS" = true ]; then
  EXTRA_FLAGS="--dangerously-skip-permissions"
fi

# Construct remote runner script executed inside WSL
REMOTE_RUNNER_SCRIPT=$(cat << EOF
#!/usr/bin/env bash
set -euo pipefail

TASK="${CLEAN_TASK}"
MODEL="${MODEL}"
WORKTREE="${WORKTREE}"
REPO_DIR="${REPO_DIR}"
EXTRA_FLAGS="${EXTRA_FLAGS}"

PROMPT_FILE="/tmp/agy-prompt-\${TASK}.txt"
echo "${PROMPT_B64}" | base64 -d > "\$PROMPT_FILE"

# Resolve worktree directory inside WSL
if [ -n "\$WORKTREE" ]; then
  TARGET_DIR="\$WORKTREE"
  if [[ "\$TARGET_DIR" != /* && "\$TARGET_DIR" != ~* ]]; then
    if [ -n "\$REPO_DIR" ] && [ -d "\${REPO_DIR}/\${TARGET_DIR}" ]; then
      TARGET_DIR="\${REPO_DIR}/\${TARGET_DIR}"
    elif [ -d "\$TARGET_DIR" ]; then
      TARGET_DIR="\$TARGET_DIR"
    elif [ -d "\$HOME/HeimspielRadar/\$TARGET_DIR" ]; then
      TARGET_DIR="\$HOME/HeimspielRadar/\$TARGET_DIR"
    elif [ -d "\$HOME/Documents/git/HeimspielRadar/\$TARGET_DIR" ]; then
      TARGET_DIR="\$HOME/Documents/git/HeimspielRadar/\$TARGET_DIR"
    fi
  fi
  if [ -d "\$TARGET_DIR" ]; then
    cd "\$TARGET_DIR"
  else
    echo "Warning: Target worktree '\$TARGET_DIR' not found. Operating in \$(pwd)" >&2
  fi
fi

echo "🚀 [Herdr Agent \${TASK}] Starting agy with model '\${MODEL}' in \$(pwd)..."
exec agy --model "\${MODEL}" \${EXTRA_FLAGS} -p "\$(cat "\$PROMPT_FILE")"
EOF
)

# Base64-encode entire runner payload for zero-escape Windows dispatch
RUNNER_B64="$(printf "%s" "$REMOTE_RUNNER_SCRIPT" | base64 | tr -d '\r\n')"

# Assemble WSL command string
WSL_INVOCATION="wsl -d ${DISTRO} -- bash -c \"echo ${RUNNER_B64} | base64 -d | bash\""

# Assemble Herdr arguments
HC_CMD_DISPLAY="hc"
if [ "$RUN_BG" = true ]; then
  HC_CMD_DISPLAY+=" run --bg --name ${AGENT_NAME} --on ${TARGET} \"${WSL_INVOCATION}\""
else
  HC_CMD_DISPLAY+=" run --name ${AGENT_NAME} --on ${TARGET} \"${WSL_INVOCATION}\""
fi

if [ "$DRY_RUN" = true ]; then
  echo "=== HeimspielRadar Remote Agent Dispatch (Dry Run) ==="
  echo "Agent Name:  ${AGENT_NAME}"
  echo "Target Host: ${TARGET}"
  echo "WSL Distro:  ${DISTRO}"
  echo "Worktree:    ${WORKTREE:-<default>}"
  echo "Model:       ${MODEL}"
  echo "Background:  ${RUN_BG}"
  PROMPT_PREVIEW="$(printf "%s" "$PROMPT_CONTENT" | tr '\n' ' ' | cut -c1-60)"
  echo "Prompt Size: $(printf "%s" "$PROMPT_CONTENT" | wc -c) bytes ('${PROMPT_PREVIEW}...' )"
  echo "--------------------------------------------------------"
  echo "WSL Runner Script:"
  echo "$REMOTE_RUNNER_SCRIPT"
  echo "--------------------------------------------------------"
  echo "Herdr Command:"
  echo "  $HC_CMD_DISPLAY"
  exit 0
fi

if ! command -v hc >/dev/null 2>&1; then
  echo "Error: 'hc' (Herdr Core CLI) command not found in PATH." >&2
  echo "To preview the command and runner script, run with --dry-run." >&2
  exit 1
fi

echo "==> Dispatching remote agent '${AGENT_NAME}' to ${TARGET} (WSL ${DISTRO})..."
if [ "$RUN_BG" = true ]; then
  hc run --bg --name "$AGENT_NAME" --on "$TARGET" "$WSL_INVOCATION"
else
  hc run --name "$AGENT_NAME" --on "$TARGET" "$WSL_INVOCATION"
fi

echo "✅ Agent '${AGENT_NAME}' dispatched successfully."
echo "   Monitor status:  hc ls"
echo "   View logs:       hc read ${TARGET}/${AGENT_NAME}"
echo "   Wait for exit:   hc wait ${TARGET}/${AGENT_NAME}"
