import {describe, test, expect} from 'vitest'
import * as fs from 'fs/promises'
import * as path from 'path'
import glob from 'fast-glob'

const repoRoot = path.join(__dirname, '..')

describe('GitHub Actions pinning', () => {
  test('all non-official actions are pinned to SHA', async () => {
    const workflowDir = path.join(repoRoot, '.github/workflows')
    const workflowFiles = await glob('*.yml', {cwd: workflowDir, absolute: true})
    expect(workflowFiles.length).toBeGreaterThan(0)

    const allActions: string[] = []
    for (const file of workflowFiles) {
      const content = await fs.readFile(file, 'utf-8')
      const matches = content.match(/uses:\s+\S+/g) ?? []
      allActions.push(...matches.map((m) => m.split(/\s+/)[1]!))
    }

    const thirdParty = allActions.filter(
      (action) => !action.startsWith('actions/') && !action.startsWith('./') && !action.startsWith('Shopify/'),
    )

    const unpinned = thirdParty.filter((action) => !action.match(/^[^@]+@[0-9a-f]+/))

    expect(unpinned, [
      'The following unofficial GitHub actions have not been pinned:\n',
      ...unpinned.map((el) => `  - ${el}\n`),
      '\nRun bin/pin-github-actions.js, verify the action is not doing anything malicious, then commit your changes.',
    ].join('')).toHaveLength(0)
  })
})

describe('Node dependency version sync', () => {
  const sharedDependencies = [
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

  interface PackageJson {
    dependencies?: Record<string, string>
    devDependencies?: Record<string, string>
    peerDependencies?: Record<string, string>
    resolutions?: Record<string, string>
  }

  test('shared dependencies are on the same version across packages', async () => {
    const packageJsonPaths = await glob('packages/*/package.json', {cwd: repoRoot, absolute: true})
    const packageJsonMap: Record<string, PackageJson> = {}

    for (const pkgPath of packageJsonPaths) {
      const name = path.dirname(pkgPath).split('/').pop()!
      packageJsonMap[name] = JSON.parse(await fs.readFile(pkgPath, 'utf-8')) as PackageJson
    }
    packageJsonMap['root'] = JSON.parse(await fs.readFile(path.join(repoRoot, 'package.json'), 'utf-8')) as PackageJson

    const different: {dep: string; versions: {packageName: string; version: string}[]}[] = []

    for (const dep of sharedDependencies) {
      const depVersions: {packageName: string; version: string}[] = []

      for (const [packageName, json] of Object.entries(packageJsonMap)) {
        const version =
          json.dependencies?.[dep] ??
          json.devDependencies?.[dep] ??
          json.peerDependencies?.[dep] ??
          json.resolutions?.[dep]
        if (version) {
          depVersions.push({packageName, version: version.replace(/^\^/, '')})
        }
      }

      const uniqueVersions = [...new Set(depVersions.map((v) => v.version))]
      if (uniqueVersions.length > 1) {
        different.push({dep, versions: depVersions})
      }
    }

    const errorMessage = [
      'The following node dependencies are on different versions across packages:\n\n',
      ...different.map(
        ({dep, versions}) =>
          `  - ${dep}:\n${versions.map(({packageName, version}) => `    - ${packageName}: ${version}`).join('\n')}`,
      ),
      '\n\nPlease make sure they are all on the same version.',
    ].join('')

    expect(different, errorMessage).toHaveLength(0)
  })
})
