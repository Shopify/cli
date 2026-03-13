#!/bin/bash
set -euo pipefail

# This is a CI-based experiment - we push and check results on GitHub
# This script just validates the workflow files are valid YAML and pushes

echo "Validating workflow files..."
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/tests-pr.yml'))" 2>/dev/null || {
  echo "ERROR: tests-pr.yml is not valid YAML"
  exit 1
}

echo "Pushing to faster-ci branch..."
git push origin faster-ci 2>&1

echo "METRIC push_ok=1"
echo "Check CI results at: https://github.com/Shopify/cli/pull/7002"
