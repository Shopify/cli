#!/usr/bin/env bash
# Runs the checks that need no Shopify account against the globally installed `shopify`.
# Works on Linux, macOS and Git Bash on Windows.
#
# Usage: smoke-test-cli.sh <expected-version>
set -euo pipefail

if [ "$#" -ne 1 ] || [ -z "$1" ]; then
  echo "Usage: $0 <expected-version>" >&2
  exit 2
fi
EXPECTED_VERSION="$1"

# No color codes in the output, no prompts, no analytics, and no auto-upgrade, which the CLI skips
# when CI is set.
export NO_COLOR=1
export SHOPIFY_CLI_NO_ANALYTICS=1
export CI=1

WORK_DIR=$(mktemp -d)
trap 'rm -rf "$WORK_DIR"' EXIT
cd "$WORK_DIR"

CURRENT_CASE=""
trap 'echo "::error::Smoke test failed: $CURRENT_CASE"' ERR

start_case() {
  CURRENT_CASE="$1"
  echo
  echo "=== $1"
}

fail() {
  echo "::error::$CURRENT_CASE: $1"
  exit 1
}

start_case "Turn off auto-upgrade"
shopify config autoupgrade off

start_case "shopify version is $EXPECTED_VERSION"
VERSION_OUTPUT=$(shopify version)
echo "$VERSION_OUTPUT"
# Exact match on one whitespace-separated token, so 5.1.1 doesn't match 5.1.10.
if ! tr -s ' \t\r' '\n' <<< "$VERSION_OUTPUT" | grep -Fxq "$EXPECTED_VERSION"; then
  fail "expected version $EXPECTED_VERSION, got: $VERSION_OUTPUT"
fi

start_case "shopify help"
shopify help

start_case "shopify commands"
COMMANDS_OUTPUT=$(shopify commands)
echo "Listed $(wc -l <<< "$COMMANDS_OUTPUT" | tr -d ' ') lines of commands"

# Each topic's help loads the plugin that provides it.
for TOPIC in app theme hydrogen; do
  start_case "shopify $TOPIC --help"
  shopify "$TOPIC" --help
done

# --latest checks out the repository's latest tag without prompting. The explicit URL takes the
# Git-only path: the default Skeleton URL looks up its release through the GitHub API, whose
# unauthenticated rate limit is shared by every machine behind the same address.
start_case "shopify theme init"
shopify theme init qa-theme --clone-url https://github.com/Shopify/skeleton-theme --latest
[ -f qa-theme/config/settings_schema.json ] || fail "qa-theme/config/settings_schema.json is missing"

# The default fail level, error, lets warnings and suggestions pass.
start_case "shopify theme check"
shopify theme check --path qa-theme --fail-level error

start_case "shopify theme package"
shopify theme package --path qa-theme
ZIPS=$(find qa-theme -maxdepth 1 -name '*.zip')
[ -n "$ZIPS" ] || fail "no .zip file in qa-theme"
echo "Packaged $ZIPS"

CURRENT_CASE=""
echo
echo "All smoke tests passed for @shopify/cli $EXPECTED_VERSION"
