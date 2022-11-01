#! /usr/bin/env bash

set -euo pipefail

# enter this dir so that we can run this script from the top-level
cd "$(dirname "$0")"

# regenerate commands snapshot file
../../cli-main/bin/dev.js commands --no-header --columns=Command,Plugin | awk '{ gsub(/ +$/, ""); print }' > commands.txt
