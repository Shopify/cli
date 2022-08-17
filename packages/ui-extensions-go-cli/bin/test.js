#!/usr/bin/env node
import {fileURLToPath} from 'url'
import {dirname, join} from 'pathe'
import { platform } from "node:os"

import {createRequire} from 'module'
const require = createRequire(import.meta.url)
const { rmSync, existsSync, mkdirSync, ensureFileSync  } = require('fs-extra')
const execa = require('execa')


const binDirectory = dirname(fileURLToPath(import.meta.url))
const rootDirectory = dirname(binDirectory)

await execa("go", ["test", "./..."], {cwd: rootDirectory, stdio: 'inherit'}).catch((_) => {
  process.exit(1)
})
