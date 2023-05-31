#!/usr/bin/env node
process.removeAllListeners('warning');

// ES Modules
import {createRequire} from 'module'
import {fileURLToPath} from "node:url"
import * as path from "pathe"
import glob from 'fast-glob'

// CJS Modules
const require = createRequire(import.meta.url)
const {readFile, outputFile} = require('fs-extra')
const {program} = require('commander')
const colors = require('ansi-colors')

const packagesDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../packages")

program
  .description('Converts all packages to private')
  .action(async (options) => {
    const packageJsons = await glob(path.join(packagesDirectory, '*/package.json'))
    await Promise.all(packageJsons.map(async (packageJsonPath) => {
      const json = JSON.parse(await readFile(packageJsonPath, 'utf8'))
      if (!json.private) json.publishConfig = {access: 'restricted'}
      await outputFile(packageJsonPath, JSON.stringify(json, null, 2) + '\n', 'utf8')
    }))
   })

program.parse()
