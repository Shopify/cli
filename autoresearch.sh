#!/bin/bash
set -euo pipefail

# Ensure bundle is up to date (bundle includes build as dependency)
pnpm nx bundle cli 2>&1 | tail -1

# Warmup run (filesystem cache)
node packages/cli/bin/dev.js help > /dev/null 2>&1

# Benchmark: median of 7 runs (wall clock and user time)
wall_times=()
user_times=()
for i in 1 2 3 4 5 6 7; do
  output=$( { /usr/bin/time -p node packages/cli/bin/dev.js help > /dev/null; } 2>&1 )
  wall=$( echo "$output" | awk '/^real/{print $2}' )
  user=$( echo "$output" | awk '/^user/{print $2}' )
  wall_ms=$(echo "$wall * 1000" | bc | cut -d. -f1)
  user_ms=$(echo "$user * 1000" | bc | cut -d. -f1)
  wall_times+=("$wall_ms")
  user_times+=("$user_ms")
done

# Sort and take median (index 3 of 7)
IFS=$'\n' sorted_wall=($(sort -n <<<"${wall_times[*]}")); unset IFS
IFS=$'\n' sorted_user=($(sort -n <<<"${user_times[*]}")); unset IFS
median_wall=${sorted_wall[3]}
median_user=${sorted_user[3]}

echo "METRIC total_ms=$median_wall"
echo "METRIC user_ms=$median_user"
