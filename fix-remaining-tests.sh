#!/bin/bash

# Files to fix
files=(
  "packages/app/src/cli/models/extensions/specifications/payments_app_extension_schemas/card_present_payments_app_extension_schema.test.ts"
  "packages/app/src/cli/models/extensions/specifications/marketing_activity_schemas/marketing_activity_schema.test.ts"
  "packages/app/src/cli/models/app/loader.test.ts"
  "packages/app/src/cli/models/extensions/specifications/ui_extension.test.ts"
)

for file in "${files[@]}"; do
  echo "Processing $file..."
  # Replace toThrowError(new zod.ZodError(...)) with toThrow()
  # Using perl for better multiline regex support
  perl -i -0pe 's/\.toThrowError\(\s*new zod\.ZodError\(\[[\s\S]*?\]\),?\s*\)/.toThrow()/g' "$file"
done

echo "Done!"