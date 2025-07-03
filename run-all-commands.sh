#!/usr/bin/env bash

# Initialize arrays to store successful and failed commands
SUCCESSES=()
FAILURES=()

# Function to execute a command, track its success/failure, and print immediate feedback
expect_success() {
  local command_string="$1"
  local t="Expect '${command_string}' to succeed" # Print the command being executed
  echo "${t}" # Print the command being executed
  if eval "$command_string"; then
    SUCCESSES+=("${t}") # Add to successes array
  else
    FAILURES+=("${t}") # Add to failures array
  fi
}

expect_failure() {
  local command_string="$1"
  local t="Expect '${command_string}' to fail" # Print the command being executed
  echo "${t}" # Print the command being executed
  if eval "$command_string"; then
    FAILURES+=("${t}") # Add to successes array
  else
    SUCCESSES+=("${t}") # Add to failures array
  fi
}

# Define the base command for the CLI tool
CMD="node packages/cli/bin/dev.js"
# if arg1 is "snap" or "shopify", set CMD to "shopify"
if [ $# -gt 0 ] && ([ "$1" == "snap" ] || [ "$1" == "shopify" ]); then
  CMD="shopify"
else
    pnpm nx run store:build
fi

# --- Command Execution Section ---

# Clear the screen before starting
clear

cmd="$CMD store copy --help"
expect_success "$cmd"

cmd="$CMD store copy --from-file=foo.sqlite --to-store=source.myshopify.com --mock -y"
expect_success "$cmd"

cmd="$CMD store copy --from-file=foo.sqlite --to-store=source.myshopify.com --key=products:metafield:custom_id:erp_id --mock -y"
expect_success "$cmd"

cmd="$CMD store copy --from-file=foo.sqlite --to-store=source.myshopify.com --key=products:handle --mock -y"
expect_success "$cmd"

cmd="$CMD store copy --from-file=foo.sqlite --to-store=source.myshopify.com --key=products:id --mock -y"
expect_failure "$cmd"

cmd="$CMD store copy --from-file=foo.sqlite --to-store=source.myshopify.com --key=products:title --mock -y"
expect_failure "$cmd"

cmd="$CMD store copy --from-file=foo.sqlite --to-store=source.myshopify.com --key=customers:title --mock -y"
expect_failure "$cmd"


cmd="$CMD store copy --from-file=foo.sqlite --to-store=source.myshopify.com --mock -y"
expect_success "$cmd"

cmd="$CMD store copy --to-file=foo.sqlite --from-store=source.myshopify.com --mock -y"
expect_success "$cmd"

cmd="$CMD store copy --from-store=source.myshopify.com --to-store=target.myshopify.com --mock -y"
expect_success "$cmd"

cmd="$CMD store copy --from-store=source.myshopify.com --to-store=target.myshopify.com --mock -y --key=products:handle"
expect_success "$cmd"

cmd="$CMD store copy --from-store=source.myshopify.com --to-store=target.myshopify.com --mock -y --key=products:handle"
expect_success "$cmd"

# --- Summary Section ---
echo
echo
echo -e "\n--- Test Summary ---"

# Print failures if any
if [ ${#FAILURES[@]} -gt 0 ]; then
  for failed_cmd in "${FAILURES[@]}"; do
    echo "❌ ${failed_cmd} "
  done
else
  echo "✅ All commands succeeded!"
fi

echo -e "\nTotal commands tested: $(( ${#SUCCESSES[@]} + ${#FAILURES[@]} ))"
echo "Successful tests: ${#SUCCESSES[@]}"
echo "Failed: ${#FAILURES[@]}"
