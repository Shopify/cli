import * as url from 'url'
import {promises as fs} from 'fs'

import * as path from 'pathe'
import fg from 'fast-glob'

const colors = {
  bold: (string) => `\x1b[1m${string}\x1b[22m`,
  dim: (string) => `\x1b[2m${string}\x1b[22m`,
  green: Object.assign((string) => `\x1b[32m${string}\x1b[39m`, {
    bold: (string) => `\x1b[1m\x1b[32m${string}\x1b[39m\x1b[22m`,
  }),
  red: Object.assign((string) => `\x1b[31m${string}\x1b[39m`, {
    bold: (string) => `\x1b[1m\x1b[31m${string}\x1b[39m\x1b[22m`,
  }),
}

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
const ignoredDependencies = ['react']
for (const packageJsonPath of packageJsonPaths) {
  const {dependencies, name: pkg} = JSON.parse((await fs.readFile(packageJsonPath)).toString())
  if (internalPackages.includes(pkg) || !dependencies) {
    continue
  }
  for (const [dependency, version] of Object.entries(dependencies)) {
    if (version.startsWith('^') && !ignoredDependencies.includes(dependency)) {
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
