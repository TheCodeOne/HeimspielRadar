#!/usr/bin/env bash
# ==============================================================================
# agy Model Guardrail Wrapper
#
# Enforces mandatory Gemini Flash model flag (--model gemini-3.8-flash-medium)
# when invoking Google Antigravity CLI ('agy') if no model flag was provided.
# Prevents unintentional fallback to quota-heavy models (e.g. Argon).
# ==============================================================================
set -euo pipefail

DEFAULT_MODEL="${AGY_DEFAULT_MODEL:-gemini-3.8-flash-medium}"

# Handle --install request
if [ "${1:-}" = "--install" ]; then
  TARGET_DIR="${HOME}/.local/bin"
  mkdir -p "$TARGET_DIR"
  TARGET_FILE="${TARGET_DIR}/agy"
  SCRIPT_PATH="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/$(basename "${BASH_SOURCE[0]}")"

  EXISTING_AGY=$(which agy 2>/dev/null || true)
  if [ -n "$EXISTING_AGY" ] && [ "$EXISTING_AGY" != "$TARGET_FILE" ]; then
    echo "Found existing agy binary at: $EXISTING_AGY"
  fi

  cp "$SCRIPT_PATH" "$TARGET_FILE"
  chmod +x "$TARGET_FILE"
  echo "✅ Installed agy guardrail wrapper to: $TARGET_FILE"

  # Update ~/.bashrc with fallback alias & ensure ~/.local/bin is in PATH
  BASHRC="${HOME}/.bashrc"
  if [ -f "$BASHRC" ]; then
    if ! grep -q "AGY_GUARDRAIL_INSTALLED" "$BASHRC"; then
      cat << 'EOF' >> "$BASHRC"

# AGY_GUARDRAIL_INSTALLED
export PATH="$HOME/.local/bin:$PATH"
agy() {
  local has_model=false
  for arg in "$@"; do
    case "$arg" in
      --model|--model=*|-m) has_model=true; break ;;
    esac
  done
  if [ "$has_model" = true ]; then
    command agy "$@"
  else
    command agy --model gemini-3.8-flash-medium "$@"
  fi
}
EOF
      echo "✅ Configured $BASHRC with agy guardrail"
    else
      echo "ℹ️  $BASHRC already configured with AGY_GUARDRAIL_INSTALLED"
    fi
  fi
  exit 0
fi

# Detect whether a model flag is already present in arguments
has_model=false
for arg in "$@"; do
  case "$arg" in
    --model|--model=*|-m)
      has_model=true
      break
      ;;
  esac
done

# Resolve real agy binary path (skipping this wrapper)
THIS_SCRIPT="$(readlink -f "${BASH_SOURCE[0]}" 2>/dev/null || realpath "${BASH_SOURCE[0]}" 2>/dev/null || echo "${BASH_SOURCE[0]}")"
REAL_AGY="${REAL_AGY_BIN:-}"

if [ -z "$REAL_AGY" ]; then
  IFS=: read -ra PATH_DIRS <<< "${PATH}"
  for dir in "${PATH_DIRS[@]}"; do
    candidate="${dir}/agy"
    if [ -x "$candidate" ]; then
      cand_real="$(readlink -f "$candidate" 2>/dev/null || realpath "$candidate" 2>/dev/null || echo "$candidate")"
      if [ "$cand_real" != "$THIS_SCRIPT" ]; then
        REAL_AGY="$candidate"
        break
      fi
    fi
  done
fi

# Check standard installation locations if still not found
if [ -z "$REAL_AGY" ]; then
  for loc in \
    "${HOME}/.gemini/antigravity-cli/bin/agy" \
    "${HOME}/.local/share/gemini/antigravity-cli/bin/agy" \
    "/usr/local/bin/agy.real" \
    "/usr/bin/agy" \
    "/snap/bin/agy"
  do
    if [ -x "$loc" ]; then
      loc_real="$(readlink -f "$loc" 2>/dev/null || realpath "$loc" 2>/dev/null || echo "$loc")"
      if [ "$loc_real" != "$THIS_SCRIPT" ]; then
        REAL_AGY="$loc"
        break
      fi
    fi
  done
fi

if [ -z "$REAL_AGY" ]; then
  echo "Error: Could not locate real 'agy' executable." >&2
  echo "Ensure 'agy' is installed in PATH or at ~/.gemini/antigravity-cli/bin/agy" >&2
  exit 1
fi

if [ "$has_model" = true ]; then
  exec "$REAL_AGY" "$@"
else
  exec "$REAL_AGY" --model "$DEFAULT_MODEL" "$@"
fi
