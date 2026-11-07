#!/usr/bin/env node

import fs from 'fs'
import {fileURLToPath} from 'url'
import glob from 'fast-glob'
import path from 'path'
import stringify from 'json-stringify-deterministic'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(path.join(__dirname, '..'))
const manifestFiles = glob.sync(`packages/*/oclif.manifest.json`)

for (const file of manifestFiles) {
  console.log(`Prettifying ${file}...`)
  const content = fs.readFileSync(file)
  const manifest = JSON.parse(content)
  for (const command of Object.values(manifest.commands)) {
    // Runtime schemas belong to command classes, not cached metadata.
    delete command.jsonOutputSchema
  }
  const prettyContent = stringify(manifest, {space: '  '}).replaceAll(root, '.')
  fs.writeFileSync(file, prettyContent)
}
