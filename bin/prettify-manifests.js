#!/usr/bin/env node

import fs from 'fs'
import {fileURLToPath} from 'url'
import glob from 'fast-glob'
import path from 'path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(path.join(__dirname, '..'))
const manifestFiles = glob.sync(`packages/*/oclif.manifest.json`)

for (const file of manifestFiles) {
  console.log(`Prettifying ${file}...`)
  const content = fs.readFileSync(file)
  const prettyContent = JSON.stringify(JSON.parse(content),null,2).replaceAll(root, '.')
  fs.writeFileSync(file, prettyContent)
}
