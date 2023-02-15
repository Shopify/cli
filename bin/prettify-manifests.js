#!/usr/bin/env node

import fs from 'fs';
import glob from 'fast-glob';

const manifestFiles = glob.sync(`packages/*/oclif.manifest.json`)
for (const file of manifestFiles) {
  console.log(`Prettifying ${file}...`)
  const content = fs.readFileSync(file)
  const prettyContent = JSON.stringify(JSON.parse(content),null,2)
  fs.writeFileSync(file, prettyContent)
}
