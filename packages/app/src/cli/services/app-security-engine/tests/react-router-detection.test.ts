import {mergeScanDirectories} from '../../app-security-selection.js'
import {scan} from '../scanners/index.js'
import {fileRealPath, inTemporaryDirectory, mkdir, writeFile} from '@shopify/cli-kit/node/fs'
import {dirname, joinPath} from '@shopify/cli-kit/node/path'
import {describe, expect, test} from 'vitest'
import type {ScanResult} from '../types.js'

/** Every deterministic check that React Router detection gates, fully or for its app-source part. */
const REACT_ROUTER_GATED_CHECKS = [
  'UNAUTHENTICATED_ENDPOINT',
  'REQUEST_CONTROLLED_ADMIN_CONTEXT',
  'CREDENTIAL_LOG_LEAKAGE',
  'CREDENTIAL_BROWSER_LEAKAGE',
  'APP_PROXY_LIQUID_INJECTION',
  'DEPRECATED_SCRIPT_TAG_SCOPE',
  'UNSAFE_INNERHTML',
  'EOL_API_VERSION',
  'EXPIRING_OFFLINE_TOKEN',
]

const appConfiguration = `name = "React Router detection"
application_url = "https://example.com"
embedded = true

[app_proxy]
url = "https://example.com/proxy"
subpath = "proxy"
prefix = "apps"

[access_scopes]
scopes = "write_script_tags"
`

/** A React Router server whose `shopify.server` pins an end-of-life API version, so EOL_API_VERSION must find it. */
function reactRouterServer(root: string): Record<string, string> {
  const prefix = root === '.' ? '' : `${root}/`
  return {
    [`${prefix}package.json`]: JSON.stringify({dependencies: {'@shopify/shopify-app-react-router': '^1.0.0'}}),
    [`${prefix}app/shopify.server.ts`]: 'export const shopify = shopifyApp({apiVersion: "2023-01"})\n',
    [`${prefix}app/routes/app._index.tsx`]: 'export const loader = async () => null\n',
  }
}

async function writeFiles(root: string, files: Record<string, string>): Promise<void> {
  await Promise.all(
    Object.entries(files).map(async ([path, content]) => {
      await mkdir(dirname(joinPath(root, path)))
      await writeFile(joinPath(root, path), content)
    }),
  )
}

/** Scans `appDirectory` with the scan directories the CLI derives from `--include-dir`. */
async function scanWithIncludeDirectories(appDirectory: string, includeDirectories: string[] = []) {
  const {scanDirectories, requestedScanDirectories} = mergeScanDirectories(appDirectory, includeDirectories)
  return scan({
    appDirectory,
    scanDirectories: scanDirectories.map(({directory}) => directory),
    requestedScanDirectories,
    appConfigFilePath: joinPath(appDirectory, 'shopify.app.toml'),
  })
}

function frameworkGatedChecks(result: ScanResult) {
  return result.scan.checks_executed.filter(
    (execution) =>
      REACT_ROUTER_GATED_CHECKS.includes(execution.id) && execution.reason?.code === 'unsupported_framework',
  )
}

function eolSourceFindings(result: ScanResult) {
  return result.issues
    .filter((issue) => issue.id === 'EOL_API_VERSION' && issue.location.file !== 'shopify.app.toml')
    .map((issue) => issue.location.file)
}

describe('React Router detection', () => {
  test('detects a flat app whose React Router code is in the app directory', async () => {
    await inTemporaryDirectory(async (temporaryDirectory) => {
      const app = await fileRealPath(temporaryDirectory)
      await writeFiles(app, {'shopify.app.toml': appConfiguration, ...reactRouterServer('.')})

      const result = await scanWithIncludeDirectories(app)

      expect(result.detection).toMatchObject({framework: 'react_router', surface: 'react_router'})
      expect(frameworkGatedChecks(result)).toEqual([])
      expect(eolSourceFindings(result)).toEqual(['app/shopify.server.ts'])
    })
  })

  test('detects a React Router server in another package that --include-dir adds', async () => {
    await inTemporaryDirectory(async (temporaryDirectory) => {
      const repository = await fileRealPath(temporaryDirectory)
      await writeFiles(repository, {
        'apps/foo/shopify.app.toml': appConfiguration,
        ...reactRouterServer('packages/server'),
      })

      const result = await scanWithIncludeDirectories(joinPath(repository, 'apps/foo'), [
        joinPath(repository, 'packages/server'),
      ])

      expect(result.detection).toMatchObject({framework: 'react_router', surface: 'react_router'})
      expect(frameworkGatedChecks(result)).toEqual([])
      expect(eolSourceFindings(result)).toEqual(['../../packages/server/app/shopify.server.ts'])
    })
  })

  test('detects a React Router server in another package when --include-dir is the repository root', async () => {
    await inTemporaryDirectory(async (temporaryDirectory) => {
      const repository = await fileRealPath(temporaryDirectory)
      await writeFiles(repository, {
        'package.json': JSON.stringify({private: true, workspaces: ['apps/*', 'packages/*']}),
        'apps/foo/shopify.app.toml': appConfiguration,
        ...reactRouterServer('packages/server'),
      })

      const result = await scanWithIncludeDirectories(joinPath(repository, 'apps/foo'), [repository])

      expect(result.detection).toMatchObject({framework: 'react_router', surface: 'react_router'})
      expect(frameworkGatedChecks(result)).toEqual([])
      expect(eolSourceFindings(result)).toEqual(['../../packages/server/app/shopify.server.ts'])
    })
  })

  test('detects a React Router server in a subdirectory of the app directory', async () => {
    await inTemporaryDirectory(async (temporaryDirectory) => {
      const app = await fileRealPath(temporaryDirectory)
      await writeFiles(app, {
        'shopify.app.toml': appConfiguration,
        'package.json': JSON.stringify({private: true, workspaces: ['web']}),
        ...reactRouterServer('web'),
      })

      const result = await scanWithIncludeDirectories(app)

      expect(result.detection).toMatchObject({framework: 'react_router', surface: 'react_router'})
      expect(frameworkGatedChecks(result)).toEqual([])
      expect(eolSourceFindings(result)).toEqual(['web/app/shopify.server.ts'])
    })
  })

  test("doesn't count a sibling app's React Router server as this app's", async () => {
    await inTemporaryDirectory(async (temporaryDirectory) => {
      const repository = await fileRealPath(temporaryDirectory)
      await writeFiles(repository, {
        'apps/foo/shopify.app.toml': appConfiguration,
        'apps/foo/src/index.ts': 'export const foo = true\n',
        'apps/bar/shopify.app.toml': appConfiguration,
        ...reactRouterServer('apps/bar'),
      })

      const result = await scanWithIncludeDirectories(joinPath(repository, 'apps/foo'), [repository])

      expect(result.otherAppDirectories).toEqual([joinPath(repository, 'apps/bar')])
      expect(result.detection.framework).toBe('unknown')
      expect(eolSourceFindings(result)).toEqual([])
    })
  })

  test("checks only this app's React Router server when a sibling app is also in scope", async () => {
    await inTemporaryDirectory(async (temporaryDirectory) => {
      const repository = await fileRealPath(temporaryDirectory)
      await writeFiles(repository, {
        'apps/foo/shopify.app.toml': appConfiguration,
        ...reactRouterServer('packages/server'),
        'apps/bar/shopify.app.toml': appConfiguration,
        ...reactRouterServer('apps/bar'),
      })

      const result = await scanWithIncludeDirectories(joinPath(repository, 'apps/foo'), [repository])

      expect(result.detection.framework).toBe('react_router')
      expect(eolSourceFindings(result)).toEqual(['../../packages/server/app/shopify.server.ts'])
    })
  })

  test("checks only source under this app's React Router roots when a sibling app is also in scope", async () => {
    await inTemporaryDirectory(async (temporaryDirectory) => {
      const repository = await fileRealPath(temporaryDirectory)
      const unsafeRoute = 'export function preview(element, payload) {\n  element.innerHTML = payload\n}\n'
      await writeFiles(repository, {
        'package.json': JSON.stringify({private: true, workspaces: ['apps/*', 'packages/*']}),
        'apps/foo/shopify.app.toml': appConfiguration,
        ...reactRouterServer('packages/server'),
        'packages/server/app/routes/app.preview.tsx': unsafeRoute,
        'apps/bar/shopify.app.toml': appConfiguration,
        'apps/bar/app/routes/app.preview.tsx': unsafeRoute,
      })

      const result = await scanWithIncludeDirectories(joinPath(repository, 'apps/foo'), [repository])

      expect(result.detection.framework).toBe('react_router')
      expect(
        result.issues.filter((issue) => issue.id === 'UNSAFE_INNERHTML').map((issue) => issue.location.file),
      ).toEqual(['../../packages/server/app/routes/app.preview.tsx'])
      const gatedInspectedFiles = result.scan.checks_executed
        .filter((execution) => REACT_ROUTER_GATED_CHECKS.includes(execution.id))
        .flatMap((execution) => execution.inspected_files)
      expect(gatedInspectedFiles).toContain('../../packages/server/app/routes/app.preview.tsx')
      expect(gatedInspectedFiles.filter((file) => file.startsWith('../bar/'))).toEqual([])
    })
  })

  test("doesn't count a parent app's React Router web directory as a nested app's", async () => {
    await inTemporaryDirectory(async (temporaryDirectory) => {
      const repository = await fileRealPath(temporaryDirectory)
      await writeFiles(repository, {
        'shopify.app.toml': appConfiguration,
        'package.json': JSON.stringify({private: true, workspaces: ['web', 'apps/*']}),
        ...reactRouterServer('web'),
        'apps/foo/shopify.app.toml': appConfiguration,
        'apps/foo/src/index.ts': 'export const foo = true\n',
      })

      const result = await scanWithIncludeDirectories(joinPath(repository, 'apps/foo'), [repository])

      expect(result.otherAppDirectories).toEqual([repository])
      expect(result.detection.framework).toBe('unknown')
      expect(eolSourceFindings(result)).toEqual([])
    })
  })

  test('detects a React Router server in a shared package under a parent app directory', async () => {
    await inTemporaryDirectory(async (temporaryDirectory) => {
      const repository = await fileRealPath(temporaryDirectory)
      await writeFiles(repository, {
        'shopify.app.toml': appConfiguration,
        'package.json': JSON.stringify({private: true, workspaces: ['apps/*', 'packages/*']}),
        'apps/foo/shopify.app.toml': appConfiguration,
        ...reactRouterServer('packages/server'),
      })

      const result = await scanWithIncludeDirectories(joinPath(repository, 'apps/foo'), [repository])

      expect(result.otherAppDirectories).toEqual([repository])
      expect(result.detection.framework).toBe('react_router')
      expect(eolSourceFindings(result)).toEqual(['../../packages/server/app/shopify.server.ts'])
    })
  })
})
