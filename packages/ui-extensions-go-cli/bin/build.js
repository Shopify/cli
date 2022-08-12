#!/usr/bin/env node

import {fileURLToPath} from 'url'
import {dirname, join} from 'pathe'

import {createRequire} from 'module'
const require = createRequire(import.meta.url)
const execa = require('execa')

const binDirectory = dirname(fileURLToPath(import.meta.url))
const rootDirectory = dirname(binDirectory)

const os = process.env.GOOS

const executableName = (os === "windows") ? "shopify-extensions.exe" : "shopify-extensions"

await execa("go", ["build", "-o", executableName], {cwd: rootDirectory, stdio: 'inherit'})
