import {Then, When} from '@cucumber/cucumber'
import * as path from 'pathe'
import glob from 'fast-glob'
import {fileURLToPath} from 'url'
import fs from 'fs/promises'
import {strict as assert} from 'assert'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

interface PackageJson {
  dependencies?: {[key: string]: string}
  devDependencies?: {[key: string]: string}
  peerDependencies?: {[key: string]: string}
  resolutions?: {[key: string]: string}
}

async function parsePackageJson(path: string): Promise<PackageJson> {
  return JSON.parse(await fs.readFile(path, 'utf-8')) as PackageJson
}

When(/I look at the package.json files in all packages/, async function () {
  this.packageJsonMap = {}
  for (const packageJson of glob.sync(`${__dirname}/../../*/package.json`)) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const packageName = path.dirname(packageJson).split('/').pop()!
    // eslint-disable-next-line no-await-in-loop
    this.packageJsonMap[packageName] = await parsePackageJson(packageJson)
  }
  this.packageJsonMap.root = await parsePackageJson(`${__dirname}/../../../package.json`)
})

const sharedDependencies = [
  // react is not included as cli-kit uses 18, while other packages use 17
  '@babel/core',
  '@oclif/core',
  '@shopify/cli-kit',
  '@types/node',
  '@typescript-eslint/parser',
  'esbuild',
  'execa',
  'fast-glob',
  'graphql',
  'graphql-request',
  'graphql-tag',
  'ink',
  'liquidjs',
  'node-fetch',
  'typescript',
  'vite',
  'vitest',
  'zod',
]

Then(/I see all shared node dependencies on the same version/, async function () {
  const different: {dep: string; versions: {packageName: string; version: string}[]}[] = []

  sharedDependencies.forEach((dep) => {
    const depVersions = Object.entries(this.packageJsonMap).reduce(
      (acc: {packageName: string; version: string}[], [packageName, json]) => {
        const packageJson = json as PackageJson
        const depVersion =
          packageJson.dependencies?.[dep] ??
          packageJson.devDependencies?.[dep] ??
          packageJson.peerDependencies?.[dep] ??
          packageJson.resolutions?.[dep]
        if (depVersion) {
          acc.push({packageName, version: depVersion.replace(/^\^/, '')})
        }
        return acc
      },
      [],
    )

    const allVersions = depVersions.map((pair) => pair.version)
    const someVersionsAreDifferent = [...new Set(allVersions)].length > 1

    if (someVersionsAreDifferent) {
      different.push({dep, versions: depVersions})
    }
  })

  const errorMessage = `The following node dependencies are on different versions across packages:\n\n${different
    .map(
      ({dep, versions}) =>
        `  - ${dep}:\n${versions.map(({packageName, version}) => `    - ${packageName}: ${version}`).join('\n')}`,
    )
    .join('\n\n')}\n\nPlease make sure they are all on the same version.`

  assert.equal(different.length, 0, errorMessage)
})
