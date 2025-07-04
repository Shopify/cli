#!/usr/bin/env bash

# Initialize arrays to store successful and failed commands
SUCCESSES=()
FAILURES=()

# Function to execute a command, track its success/failure, and print immediate feedback
expect_success() {
  local command_string="$1"
  echo "Executing: ${command_string}" # Print the command being executed

  if eval "$command_string"; then
    echo "${command_string} ✅" # Indicate success
    SUCCESSES+=("${command_string}") # Add to successes array
  else
    echo "${command_string} ❌" # Indicate failure
    FAILURES+=("${command_string}") # Add to failures array
  fi
}
pnpm nx run store:build
# Define the base command for the CLI tool
CMD="node packages/cli/bin/dev.js"

# --- Command Execution Section ---

# Clear the screen before starting
clear

# Command 1: Display help for 'store copy'
cmd="$CMD store copy --help"
expect_success "$cmd"
sleep 1 # Reduced sleep for faster execution during testing

# Clear the screen
clear

# Command 2: Copy from file to store with mock and force-yes
cmd="$CMD store copy --from-file=foo.sqlite --to-store=source.myshopify.com --mock -y"
expect_success "$cmd"
sleep 1

# Clear the screen
clear

# Command 3: Copy with specific key (products:metafield:custom_id:erp_id)
cmd="$CMD store copy --from-file=foo.sqlite --to-store=source.myshopify.com --key=products:metafield:custom_id:erp_id --mock -y"
expect_success "$cmd"
sleep 1

# Clear the screen
clear

# Command 4: Copy with specific key (products:handle)
cmd="$CMD store copy --from-file=foo.sqlite --to-store=source.myshopify.com --key=products:handle --mock -y"
expect_success "$cmd"
sleep 1

# Clear the screen
clear

# Command 5: Copy with specific key (products:title)
cmd="$CMD store copy --from-file=foo.sqlite --to-store=source.myshopify.com --key=products:title --mock -y"
expect_success "$cmd"
sleep 1

# Clear the screen
clear

# Command 6: Copy with specific key (products:handle) - duplicate of Command 4
cmd="$CMD store copy --from-file=foo.sqlite --to-store=source.myshopify.com --key=products:handle --mock -y"
expect_success "$cmd"
sleep 1

# Clear the screen
clear

# Command 7: Copy from file to store with mock and force-yes - duplicate of Command 2
cmd="$CMD store copy --from-file=foo.sqlite --to-store=source.myshopify.com --mock -y"
expect_success "$cmd"
sleep 1

# Clear the screen
clear

# Command 8: Copy to file from store with mock and force-yes
cmd="$CMD store copy --to-file=foo.sqlite --from-store=source.myshopify.com --mock -y"
expect_success "$cmd"
sleep 1

# Clear the screen
clear

# Command 9: Copy from store to store with mock and force-yes
cmd="$CMD store copy --from-store=source.myshopify.com --to-store=target.myshopify.com --mock -y"
expect_success "$cmd" # This line was missing 'expect_success' in the original script
sleep 1

# --- Summary Section ---

echo -e "\n--- Script Summary ---"

# Print failures if any
if [ ${#FAILURES[@]} -gt 0 ]; then
  echo -e "\n❌ Failed Commands:"
  for failed_cmd in "${FAILURES[@]}"; do
    echo "- ${failed_cmd}"
  done
else
  echo "✅ All commands succeeded!"
fi

# Optionally, print successes (uncomment if desired)
# if [ ${#SUCCESSES[@]} -gt 0 ]; then
#   echo -e "\n✅ Successful Commands:"
#   for successful_cmd in "${SUCCESSES[@]}"; do
#     echo "- ${successful_cmd}"
#   done
# fi

echo -e "\nTotal commands executed: $(( ${#SUCCESSES[@]} + ${#FAILURES[@]} ))"
echo "Successful: ${#SUCCESSES[@]}"
echo "Failed: ${#FAILURES[@]}"
$

