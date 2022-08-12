#!/usr/bin/env node
import {fileURLToPath} from 'url'
import {dirname, join} from 'pathe'

import {createRequire} from 'module'
const require = createRequire(import.meta.url)
const { rmSync, existsSync, mkdirSync, ensureFileSync  } = require('fs-extra')
const execa = require('execa')


const binDirectory = dirname(fileURLToPath(import.meta.url))
const rootDirectory = dirname(binDirectory)
const devConsoleDirectory = join(rootDirectory, "api/dev-console")
const indexHtmlPath = join(devConsoleDirectory, "index.html")

/**
 * The binary embeds files under api/dev-console and therefore if files
 * or directory are absent the test execution will fail.
 */
if (existsSync(devConsoleDirectory)) {
    rmSync(devConsoleDirectory, {recursive: true})
}
mkdirSync(devConsoleDirectory)
ensureFileSync(indexHtmlPath)

await execa("go", ["test", "./..."], {cwd: rootDirectory, stdio: 'inherit'})
