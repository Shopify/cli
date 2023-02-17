#!/usr/bin/env node
import {readFileSync, writeFile, writeFileSync} from 'fs';

// Update the cli-kit version in version.ts
const cliKitVersion = JSON.parse(readFileSync('packages/cli-kit/package.json')).version
const content = `export const CLI_KIT_VERSION = '${cliKitVersion}'\n`
writeFileSync('packages/cli-kit/src/public/common/version.ts', content)
