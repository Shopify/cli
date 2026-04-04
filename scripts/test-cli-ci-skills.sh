#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

usage() {
  cat <<'EOF'
Usage:
  scripts/test-cli-ci-skills.sh [scenario]

Scenarios:
  pre-submit-current-branch   Run pre-submit smoke tests against the current branch
  example-prs                 Run example PR prompts for pre-submit behavior
  all                         Run both current-branch and example-PR scenarios

This harness uses `pi -p` so it exercises real skill discovery. It saves
sessions in a temporary directory and prints a compact summary for each case.
EOF
}

scenario="${1:-pre-submit-current-branch}"
case "$scenario" in
  -h|--help)
    usage
    exit 0
    ;;
  pre-submit-current-branch|example-prs|all)
    ;;
  *)
    echo "Unknown scenario: $scenario" >&2
    usage >&2
    exit 1
    ;;
esac

example_pr_current="https://github.com/Shopify/cli/pull/7138"
example_pr_codegen="https://github.com/Shopify/cli/pull/7133"
example_pr_workflow="https://github.com/Shopify/cli/pull/7116"
example_pr_unit_test="https://github.com/Shopify/cli/pull/7101"

if ! command -v pi >/dev/null 2>&1; then
  echo "pi not found in PATH" >&2
  exit 1
fi

run_case() {
  local label="$1"
  local prompt="$2"
  local expected_skill="$3"
  local expect_lightweight="$4"
  local key_pattern="$5"
  local heavy_pattern="$6"

  local case_dir
  case_dir="$(mktemp -d "${TMPDIR:-/tmp}/cli-skill-test-${label//[^a-zA-Z0-9_-]/_}-XXXXXX")"
  local output_file="$case_dir/output.txt"

  echo "=== CASE: $label ==="
  echo "PROMPT: $prompt"
  echo "SESSION_DIR: $case_dir"

  if ! PI_OFFLINE=1 pi -p --model openai/gpt-5.4-mini --thinking low --session-dir "$case_dir" "$prompt" | tee "$output_file"; then
    echo "pi invocation failed for case: $label" >&2
    return 1
  fi

  local session
  session="$(find "$case_dir" -type f -name '*.jsonl' | head -n 1 || true)"
  if [[ -z "$session" ]]; then
    echo "No session file found for case: $label" >&2
    return 1
  fi

  echo "--- SESSION: $session"

  local skill_hits key_hits heavy_hits
  skill_hits="$(rg -n "\.agents/skills/${expected_skill}/SKILL\.md" "$session" || true)"
  key_hits="$(rg -n "$key_pattern" "$session" || true)"
  if [[ -n "$heavy_pattern" ]]; then
    heavy_hits="$(rg -n "$heavy_pattern" "$session" || true)"
  else
    heavy_hits=""
  fi

  echo "--- SKILL READS ---"
  if [[ -n "$skill_hits" ]]; then
    echo "$skill_hits"
  else
    echo "(none)"
  fi

  echo "--- KEY STEPS ---"
  if [[ -n "$key_hits" ]]; then
    echo "$key_hits"
  else
    echo "(none)"
  fi

  if [[ -n "$heavy_pattern" ]]; then
    echo "--- HEAVY CHECK SIGNALS ---"
    if [[ -n "$heavy_hits" ]]; then
      echo "$heavy_hits"
    else
      echo "(none)"
    fi
  fi

  local pass=true

  if [[ -z "$skill_hits" ]]; then
    echo "FAIL: expected skill '$expected_skill' was not read" >&2
    pass=false
  fi

  if [[ -z "$key_hits" ]]; then
    echo "FAIL: expected to see key signals matching: $key_pattern" >&2
    pass=false
  fi

  if [[ "$expect_lightweight" == "yes" && -n "$heavy_hits" ]]; then
    echo "FAIL: expected lightweight behavior but saw heavyweight-check signals" >&2
    pass=false
  fi

  if [[ "$pass" == true ]]; then
    echo "RESULT: PASS"
  else
    echo "RESULT: FAIL"
    return 1
  fi

  echo
}

run_pre_submit_current_branch() {
  run_case \
    "pre-pr-run" \
    "Please run pre-PR checks on this branch" \
    "cli-pre-submit-ci" \
    "yes" \
    'git diff --name-only|git status --short|git diff --check|tests-pr\.yml|dev\.yml|package\.json' \
    '"type":"toolCall".*"name":"bash".*(target=lint|target=type-check|target=build|pnpm knip|vitest run|graphql-codegen|refresh-manifests|refresh-readme|refresh-code-documentation|build-dev-docs)'

  run_case \
    "pre-pr-advice" \
    "Submit this PR" \
    "cli-pre-submit-ci" \
    "yes" \
    'git diff --name-only|git status --short|git diff --check|tests-pr\.yml|dev\.yml|package\.json' \
    '"type":"toolCall".*"name":"bash".*(target=lint|target=type-check|target=build|pnpm knip|vitest run|graphql-codegen|refresh-manifests|refresh-readme|refresh-code-documentation|build-dev-docs)'
}

run_example_prs() {
  run_case \
    "example-pre-submit-current-pr" \
    "I am about to update ${example_pr_current}. What minimal pre-submit checks should I run first?" \
    "cli-pre-submit-ci" \
    "no" \
    '7138|statusCheckRollup|github_pull_request_read|gh pr view|git diff --check|git status --short|tests-pr\.yml|dev\.yml|package\.json' \
    ''

  run_case \
    "example-pre-submit-codegen-pr" \
    "Before I update ${example_pr_codegen}, what minimal pre-submit checks should I run first?" \
    "cli-pre-submit-ci" \
    "no" \
    '7133|statusCheckRollup|github_pull_request_read|gh pr view|git diff --check|git status --short|tests-pr\.yml|dev\.yml|package\.json|graphql-codegen' \
    ''

  run_case \
    "example-pre-submit-workflow-pr" \
    "Before I update ${example_pr_workflow}, what minimal pre-submit checks should I run first?" \
    "cli-pre-submit-ci" \
    "no" \
    '7116|github_pull_request_read|gh pr view|git diff --check|git status --short|tests-pr\.yml|tests-main\.yml|coverage|dev\.yml|package\.json' \
    ''

  run_case \
    "example-pre-submit-unit-test-pr" \
    "Before I update ${example_pr_unit_test}, what minimal pre-submit checks should I run first?" \
    "cli-pre-submit-ci" \
    "no" \
    '7101|github_pull_request_read|gh pr view|git diff --check|git status --short|build\.test\.ts|unit-tests|vitest|tests-pr\.yml|dev\.yml|package\.json' \
    ''
}

case "$scenario" in
  pre-submit-current-branch)
    run_pre_submit_current_branch
    ;;
  example-prs)
    run_example_prs
    ;;
  all)
    run_pre_submit_current_branch
    run_example_prs
    ;;
esac
