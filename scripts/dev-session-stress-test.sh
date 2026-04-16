#!/bin/bash
#
# Stress test for dev session hot reloading (issue #2417).
#
# Makes small source code changes to a hosted app at a configurable interval
# to trigger repeated vite rebuilds → admin extension builds → dev session updates.
# Designed for apps generated from the Preact template with a home/ directory.
#
# Usage:
#   ./dev-session-stress-test.sh <app_path> [interval_seconds] [duration_minutes]
#
# Example:
#   ./dev-session-stress-test.sh ~/src/apps/my-app 5 10
#
# The script toggles strings back and forth so the app stays valid.
# Kill with: kill $(pgrep -f dev-session-stress-test)

set -euo pipefail

APP_PATH="${1:?Usage: $0 <app_path> [interval_seconds] [duration_minutes]}"
INTERVAL="${2:-5}"
DURATION="${3:-10}"
ITERATIONS=$(( (DURATION * 60) / INTERVAL ))

# Verify the app has the expected structure
if [ ! -f "$APP_PATH/home/pages/home.tsx" ]; then
  echo "Error: $APP_PATH/home/pages/home.tsx not found."
  echo "This script is designed for apps with a home/ directory (Preact template)."
  exit 1
fi

cd "$APP_PATH"
echo "Stress test: $ITERATIONS changes every ${INTERVAL}s for ${DURATION}m in $APP_PATH"

toggle() {
  local file="$1" from="$2" to="$3"
  if grep -q "$from" "$file" 2>/dev/null; then
    sed -i '' "s|$from|$to|" "$file"
  else
    sed -i '' "s|$to|$from|" "$file"
  fi
}

for i in $(seq 1 $ITERATIONS); do
  case $((i % 6)) in
    1) toggle home/pages/home.tsx \
         'Create frequently asked questions to boost sales.' \
         'Add FAQs to help customers find answers quickly.'
       echo "[$(date '+%H:%M:%S')] $i/$ITERATIONS: home.tsx paragraph" ;;
    2) toggle home/pages/home.tsx \
         'alt="Illustration of FAQ creation"' \
         'alt="FAQ empty state illustration"'
       echo "[$(date '+%H:%M:%S')] $i/$ITERATIONS: home.tsx alt text" ;;
    3) toggle home/pages/faq.tsx \
         'e.g. What is your return policy?' \
         'e.g. How long does shipping take?'
       echo "[$(date '+%H:%M:%S')] $i/$ITERATIONS: faq.tsx placeholder" ;;
    4) toggle home/pages/faq.tsx \
         'Provide a clear, helpful answer' \
         'Write a concise and informative response'
       echo "[$(date '+%H:%M:%S')] $i/$ITERATIONS: faq.tsx details" ;;
    5) toggle home/pages/_404.tsx \
         'Go to home' 'Back to FAQs'
       echo "[$(date '+%H:%M:%S')] $i/$ITERATIONS: _404.tsx button" ;;
    0) toggle home/index.html \
         '<title>Vite + Preact</title>' '<title>FAQ Manager</title>'
       echo "[$(date '+%H:%M:%S')] $i/$ITERATIONS: index.html title" ;;
  esac
  [ "$i" -lt "$ITERATIONS" ] && sleep "$INTERVAL"
done

echo "[$(date '+%H:%M:%S')] Done. $ITERATIONS changes over ${DURATION}m."
