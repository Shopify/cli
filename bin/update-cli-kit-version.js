#!/usr/bin/env node
import {readFileSync, writeFileSync} from 'fs'
import {dirname, join} from 'path'
import {fileURLToPath} from 'url'

// Always work from the repo root (where this script is located in bin/)
const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(__dirname, '..')

// Update the cli-kit version in version.ts
const packageJsonPath = join(repoRoot, 'packages/cli-kit/package.json')
const cliKitVersion = JSON.parse(readFileSync(packageJsonPath, 'utf-8')).version
const versionFilePath = join(repoRoot, 'packages/cli-kit/src/public/common/version.ts')
const content = `export const CLI_KIT_VERSION = '${cliKitVersion}'\n`
writeFileSync(versionFilePath, content)
