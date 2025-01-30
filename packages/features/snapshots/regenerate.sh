#! /usr/bin/env bash

set -euo pipefail

# enter this dir so that we can run this script from the top-level
cd "$(dirname "$0")"

# regenerate commands snapshot file
../../cli/bin/dev.js commands --tree > commands.txt
