#!/usr/bin/env bash
# ==============================================================================
# Test Suite for scripts/spawn-remote-agent.sh & scripts/agy-wrapper.sh
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SPAWN_SCRIPT="${SCRIPT_DIR}/spawn-remote-agent.sh"
WRAPPER_SCRIPT="${SCRIPT_DIR}/agy-wrapper.sh"

TESTS_RUN=0
TESTS_PASSED=0

assert_eq() {
  local expected="$1"
  local actual="$2"
  local msg="$3"
  if [ "$expected" = "$actual" ]; then
    echo "  ✅ PASS: $msg"
    TESTS_PASSED=$((TESTS_PASSED + 1))
  else
    echo "  ❌ FAIL: $msg"
    echo "     Expected: '$expected'"
    echo "     Actual:   '$actual'"
    exit 1
  fi
  TESTS_RUN=$((TESTS_RUN + 1))
}

assert_contains() {
  local needle="$1"
  local haystack="$2"
  local msg="$3"
  if [[ "$haystack" == *"$needle"* ]]; then
    echo "  ✅ PASS: $msg"
    TESTS_PASSED=$((TESTS_PASSED + 1))
  else
    echo "  ❌ FAIL: $msg (expected to contain '$needle')"
    echo "     Output was:"
    echo "$haystack"
    exit 1
  fi
  TESTS_RUN=$((TESTS_RUN + 1))
}

assert_not_contains() {
  local needle="$1"
  local haystack="$2"
  local msg="$3"
  if [[ "$haystack" != *"$needle"* ]]; then
    echo "  ✅ PASS: $msg"
    TESTS_PASSED=$((TESTS_PASSED + 1))
  else
    echo "  ❌ FAIL: $msg (expected NOT to contain '$needle')"
    echo "     Output was:"
    echo "$haystack"
    exit 1
  fi
  TESTS_RUN=$((TESTS_RUN + 1))
}

assert_exit_code() {
  local expected_code="$1"
  shift
  local cmd=("$@")
  set +e
  "${cmd[@]}" >/dev/null 2>&1
  local actual_code=$?
  set -e
  assert_eq "$expected_code" "$actual_code" "Command exits with code $expected_code: ${cmd[*]}"
}

echo "============================================================"
echo "🧪 Starting Remote Agent Dispatcher & Guardrail Test Suite"
echo "============================================================"

# Test 1: Help flag
echo "[Test 1] --help outputs usage"
OUTPUT=$("$SPAWN_SCRIPT" --help)
assert_contains "Usage:" "$OUTPUT" "Help contains Usage"
assert_contains "--task" "$OUTPUT" "Help describes --task"
assert_contains "--model" "$OUTPUT" "Help describes --model"

# Test 2: Validation of required task argument
echo "[Test 2] Missing --task exits with error code 1"
assert_exit_code 1 "$SPAWN_SCRIPT" --prompt "hello"

# Test 3: Validation of empty prompt
echo "[Test 3] Missing prompt exits with error code 1"
assert_exit_code 1 "$SPAWN_SCRIPT" --task "issue-168"

# Test 4: Dry-run with default parameters
echo "[Test 4] Dry-run injects default model & permissions"
OUTPUT=$("$SPAWN_SCRIPT" --task "issue-168" --worktree ".worktrees/issue-168" --prompt "Resolve issue 168" --dry-run)
assert_contains "Agent Name:  agent-issue-168" "$OUTPUT" "Sanitizes agent name"
assert_contains "Model:       gemini-3.8-flash-medium" "$OUTPUT" "Defaults to gemini-3.8-flash-medium"
assert_contains "Worktree:    .worktrees/issue-168" "$OUTPUT" "Captures worktree path"
assert_contains "--dangerously-skip-permissions" "$OUTPUT" "Injects skip-permissions flag"
assert_contains "wsl -d Ubuntu -- bash -c" "$OUTPUT" "Builds wsl invocation"

# Test 5: Prompt from file
echo "[Test 5] Prompt loaded from file path"
TMP_PROMPT_FILE=$(mktemp /tmp/test-prompt.XXXXXX.txt)
printf "Special file instructions with 'single' and \"double\" quotes\nSecond line." > "$TMP_PROMPT_FILE"
OUTPUT=$("$SPAWN_SCRIPT" --task "agent-from-file" --prompt "$TMP_PROMPT_FILE" --dry-run)
rm -f "$TMP_PROMPT_FILE"
assert_contains "Agent Name:  agent-from-file" "$OUTPUT" "Preserves agent prefix"
assert_contains "Special file instructions" "$OUTPUT" "Prompt preview contains file prompt text"

# Test 6: Prompt from stdin
echo "[Test 6] Prompt piped from stdin"
OUTPUT=$(printf "Piped stdin prompt\nLine 2" | "$SPAWN_SCRIPT" --task "stdin-test" --dry-run)
assert_contains "Piped stdin prompt" "$OUTPUT" "Stdin prompt captured in dry-run output"

# Test 7: Complex quote & special characters roundtrip in runner script
echo "[Test 7] Complex prompt with tricky characters survives base64 decoding"
COMPLEX_PROMPT="Multiline prompt with 'single quotes' and \"double quotes\"
Variables: \$HOME and \`uname -a\`
Symbols: & < > | ; # * % ~
Unicode & Emojis: 🎯 ÄÖÜ äöü ß"
OUTPUT=$("$SPAWN_SCRIPT" --task "quotes-test" --prompt "$COMPLEX_PROMPT" --dry-run)

# Extract runner script from output and execute the decode step in a subshell
RUNNER_B64=$(echo "$OUTPUT" | grep -o 'echo [A-Za-z0-9+/=]* | base64 -d | bash' | awk '{print $2}')
DECODED_RUNNER=$(echo "$RUNNER_B64" | base64 -d)
PROMPT_B64_FROM_RUNNER=$(echo "$DECODED_RUNNER" | grep -o 'echo "[A-Za-z0-9+/=]*" | base64 -d' | awk -F'"' '{print $2}')
DECODED_PROMPT=$(echo "$PROMPT_B64_FROM_RUNNER" | base64 -d)

assert_eq "$COMPLEX_PROMPT" "$DECODED_PROMPT" "Decoded prompt exactly matches complex input"

# Test 8: Custom model override
echo "[Test 8] Custom --model override"
OUTPUT=$("$SPAWN_SCRIPT" --task "model-test" --prompt "Test" --model "custom-fast-model" --dry-run)
assert_contains "Model:       custom-fast-model" "$OUTPUT" "Displays custom model"
assert_contains "MODEL=\"custom-fast-model\"" "$OUTPUT" "Injects custom model into runner script"

# Test 9: --no-skip-permissions flag
echo "[Test 9] --no-skip-permissions suppresses permission bypass"
OUTPUT=$("$SPAWN_SCRIPT" --task "perm-test" --prompt "Test" --no-skip-permissions --dry-run)
assert_not_contains "--dangerously-skip-permissions" "$OUTPUT" "Omits permission flag"

# Test 10: --install-guardrail dry-run
echo "[Test 10] --install-guardrail dry-run generation"
OUTPUT=$("$SPAWN_SCRIPT" --install-guardrail --dry-run)
assert_contains "=== Guardrail Installation (Dry Run) ===" "$OUTPUT" "Guardrail header shown"
assert_contains "hc exec --on windows" "$OUTPUT" "Generates hc exec command"
assert_contains "~/.local/bin/agy" "$OUTPUT" "Targets ~/.local/bin/agy"

# Test 11: agy-wrapper.sh behavior with and without model flag
echo "[Test 11] agy-wrapper.sh model enforcement"
TMP_TEST_DIR=$(mktemp -d /tmp/agy-guardrail-test.XXXXXX)
MOCK_LOG="${TMP_TEST_DIR}/mock_agy.log"
MOCK_AGY="${TMP_TEST_DIR}/mock-agy-bin"

# Create a mock agy executable that logs its arguments
cat << 'EOF' > "$MOCK_AGY"
#!/usr/bin/env bash
printf "%s\n" "$*" >> "$MOCK_LOG_PATH"
EOF
chmod +x "$MOCK_AGY"

# 11a: Run wrapper WITHOUT model flag -> should inject --model gemini-3.8-flash-medium
MOCK_LOG_PATH="$MOCK_LOG" REAL_AGY_BIN="$MOCK_AGY" "$WRAPPER_SCRIPT" -p "Hello world"
LAST_CALL=$(tail -n 1 "$MOCK_LOG")
assert_contains "--model gemini-3.8-flash-medium" "$LAST_CALL" "Wrapper injects default model when omitted"
assert_contains "-p Hello world" "$LAST_CALL" "Wrapper preserves other arguments"

# 11b: Run wrapper WITH --model flag -> should preserve user-specified model without duplicate
MOCK_LOG_PATH="$MOCK_LOG" REAL_AGY_BIN="$MOCK_AGY" "$WRAPPER_SCRIPT" --model custom-model -p "Test"
LAST_CALL=$(tail -n 1 "$MOCK_LOG")
assert_contains "--model custom-model" "$LAST_CALL" "Wrapper preserves user model"
assert_not_contains "gemini-3.8-flash-medium" "$LAST_CALL" "Wrapper does not override user model"

# 11c: Run wrapper WITH --model=... syntax
MOCK_LOG_PATH="$MOCK_LOG" REAL_AGY_BIN="$MOCK_AGY" "$WRAPPER_SCRIPT" --model=assigned-model -p "Test"
LAST_CALL=$(tail -n 1 "$MOCK_LOG")
assert_contains "--model=assigned-model" "$LAST_CALL" "Wrapper preserves --model=arg"
assert_not_contains "gemini-3.8-flash-medium" "$LAST_CALL" "Wrapper does not duplicate model"

rm -rf "$TMP_TEST_DIR"

echo "============================================================"
echo "🎉 All $TESTS_PASSED / $TESTS_RUN tests passed successfully!"
echo "============================================================"
