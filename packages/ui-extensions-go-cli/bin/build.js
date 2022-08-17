#!/usr/bin/env node

import {fileURLToPath} from 'url'
import {dirname, join} from 'pathe'
import { platform } from "node:os"
import {createRequire} from 'module'
const require = createRequire(import.meta.url)
const execa = require('execa')

const binDirectory = dirname(fileURLToPath(import.meta.url))
const rootDirectory = dirname(binDirectory)

let fileExtension = ""
if (process.env.GOOS === "windows" || platform() === "win32") {
  fileExtension = ".exe"
} else {
  await execa("go", ["build","-gcflags='all=-N -l'" ,"-o", executableName.concat("-debug")], {cwd: rootDirectory, stdio: 'inherit'}).catch((_) => {
    process.exit(1)
  })

}

const executableName = `shopify-extensions${fileExtension}`

await execa("go", ["build", "-o", executableName], {cwd: rootDirectory, stdio: 'inherit'}).catch((_) => {
  process.exit(1)
})
