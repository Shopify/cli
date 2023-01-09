#!/usr/bin/env node

import * as path from 'pathe'
import fg from 'fast-glob'
import * as url from 'url'
import {promises as fs} from 'fs'
import {createRequire} from 'module'

const require = createRequire(import.meta.url)
const colors = require('ansi-colors')

const rootDirectory = path.join(url.fileURLToPath(new URL('.', import.meta.url)), '../..')
let exitCode = 0

/**
 * LINT 1 - Fix version dependencies
 * ----
 * Loose version requirements like ^1.2.3 might lead to broken installations on the user end if the
 * package managers resolve a graph with broken contracts between nodes. This can happen if a dependency,
 * either direct or indirect, releases a breaking change with a minor update. This issue happens more
 * often in the Javascript ecosystem than in others due to the deep nature of dependency graphs and the
 * lack of automated testing in projects.
 */
console.info(colors.green.bold(`Linting that packages have strict version requirements`))
const packageJsonPaths = await fg(path.join(rootDirectory, 'packages/*/package.json'), {type: 'file'})
const dependenciesWithLooseVersionRequirement = []
const internalPackages = ['@shopify/ui-extensions-dev-console-app']
for (const packageJsonPath of packageJsonPaths) {
  const {dependencies, name: pkg} = JSON.parse((await fs.readFile(packageJsonPath)).toString())
  if (internalPackages.includes(pkg) || !dependencies) {
    continue
  }
  for (const [dependency, version] of Object.entries(dependencies)) {
    if (version.startsWith('^')) {
      dependenciesWithLooseVersionRequirement.push({pkg, dependency, version})
    }
  }
}

if (dependenciesWithLooseVersionRequirement.length !== 0) {
  exitCode = 1
  console.error(colors.red.bold(`The following dependencies have dependencies with loose version requirements:`))
  console.error(colors.dim(`Loose version requirements might result in broken installations on the user end`))
  for (const dependency of dependenciesWithLooseVersionRequirement) {
    console.error(
      ` - ${colors.bold('Package')}: ${dependency.pkg} | ${colors.bold('Dependency')}: ${
        dependency.dependency
      } | ${colors.bold('Version')}: ${dependency.version}`,
    )
  }
}

process.exit(exitCode)
