echo "export const CLI_KIT_VERSION = '$(awk -F \" '/"version":/ {print $4}' package.json)'" > src/public/common/version.ts
