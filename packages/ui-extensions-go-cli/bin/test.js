#!/usr/bin/env node
import {fileURLToPath} from 'url'
import {dirname, join} from 'pathe'
import { platform } from "node:os"

if (platform() === "win32") {
  /**
   * The extensions binary tests did not run on Windows in CI,
   * so we are early-returning to not execute them in CI until
   * we make them work on Windows.
   *
   * https://github.com/Shopify/shopify-cli-extensions/blob/main/.github/workflows/testing.yml#L11
   */
  process.exit(0);
}

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
