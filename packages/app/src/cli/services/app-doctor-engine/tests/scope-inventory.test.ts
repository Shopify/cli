import {inCanonicalTemporaryDirectory} from './context-test-helpers.js'
import {agentResultInput, staticResultInput} from './fixtures/result-contract.js'
import {
  AppDoctorScopeError,
  appDoctorScopeIdentity,
  buildAppDoctorMetadataInventory,
  createAppDoctorResult,
} from '../index.js'
import {describe, expect, test} from 'vitest'
import {fileExists} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import type {AppDoctorContext, AppDoctorResult, AppDoctorScopeDescriptor} from '../index.js'

const CONFIGURATION_IDENTITY = 'c'.repeat(32)

/**
 * A context whose directories are absolute but never created: the inventory is
 * pure, so nothing under `root` may be touched.
 */
function ghostContext(root: string): AppDoctorContext {
  const storageAnchor = joinPath(root, 'ghost-repo')
  const appRoot = joinPath(storageAnchor, 'packages', 'app')
  return {
    appRoot,
    configurationPath: joinPath(appRoot, 'shopify.app.toml'),
    configurationFileName: 'shopify.app.toml',
    configurationIdentity: CONFIGURATION_IDENTITY,
    storageAnchor,
    storageAnchorKind: 'repository',
    storeDirectory: joinPath(storageAnchor, '.shopify', 'app-doctor', 'v1', CONFIGURATION_IDENTITY),
    configurationState: 'parsed',
    selectionSource: 'default',
  }
}

const appScopeDescriptor = (directory: AppDoctorScopeDescriptor['directory']): AppDoctorScopeDescriptor => ({
  descriptor_version: 1,
  app_directory: {base: 'storage_anchor', up: 0, path: 'packages/app'},
  selected_config: {base: 'storage_anchor', up: 0, path: 'packages/app/shopify.app.toml'},
  directory,
  boundary: {app: directory.path.startsWith('packages/app') ? 'inside' : 'outside', anchor: 'inside'},
  exclusions: {semantics: 'literal-file-or-subtree-v1', declared_from: 'selected_config_directory', entries: []},
})

function retainedResult(
  overrides: Partial<
    Pick<AppDoctorResult, 'configuration_identity' | 'scope_identity' | 'check_id' | 'produced_at'>
  > & {
    readonly mode?: AppDoctorResult['mode']
    readonly scope?: AppDoctorScopeDescriptor
  } = {},
): AppDoctorResult {
  const {mode = 'static', scope, ...rest} = overrides
  const base = mode === 'static' ? staticResultInput() : agentResultInput()
  const checkId = rest.check_id ?? base.check_id
  return createAppDoctorResult({
    ...base,
    configuration_identity: CONFIGURATION_IDENTITY,
    scope: scope ?? appScopeDescriptor({base: 'storage_anchor', up: 0, path: 'packages/app'}),
    ...rest,
    // Finding codes must equal the owning check ID.
    findings: base.findings.map((finding) => ({...finding, code: checkId})),
  })
}

describe('buildAppDoctorMetadataInventory', () => {
  test('reports the implicit app scope as the only current scope', async () => {
    await inCanonicalTemporaryDirectory(async (root) => {
      const context = ghostContext(root)

      const inventory = buildAppDoctorMetadataInventory(context, [])

      expect(inventory).toEqual({
        current: [
          {
            scopeIdentity: appDoctorScopeIdentity(context.storageAnchor, context.appRoot),
            directory: context.appRoot,
            reference: {base: 'storage_anchor', up: 0, path: 'packages/app'},
            selection: 'implicit_app',
          },
        ],
        retained: [],
      })
      await expect(fileExists(context.storageAnchor)).resolves.toBe(false)
    })
  })

  test('reports retained results verbatim, in input order, flagging which match a current scope', async () => {
    await inCanonicalTemporaryDirectory(async (root) => {
      const context = ghostContext(root)
      const appIdentity = appDoctorScopeIdentity(context.storageAnchor, context.appRoot)
      const webDescriptor = appScopeDescriptor({base: 'storage_anchor', up: 0, path: 'packages/app/web'})
      const webIdentity = appDoctorScopeIdentity(context.storageAnchor, joinPath(context.appRoot, 'web'))
      const web = retainedResult({
        mode: 'agent',
        scope_identity: webIdentity,
        scope: webDescriptor,
        produced_at: '2026-09-17T08:00:00.000Z',
      })
      const app = retainedResult({scope_identity: appIdentity, check_id: 'OPEN_REDIRECT'})

      const inventory = buildAppDoctorMetadataInventory(context, [web, app])

      expect(inventory.retained).toEqual([
        {
          owner: {
            configuration_identity: CONFIGURATION_IDENTITY,
            scope_identity: webIdentity,
            check_id: web.check_id,
            mode: 'agent',
          },
          descriptor: webDescriptor,
          producedAt: '2026-09-17T08:00:00.000Z',
          selection: 'retained_only',
          matchesCurrent: false,
        },
        {
          owner: {
            configuration_identity: CONFIGURATION_IDENTITY,
            scope_identity: appIdentity,
            check_id: 'OPEN_REDIRECT',
            mode: 'static',
          },
          descriptor: app.scope,
          producedAt: app.produced_at,
          selection: 'retained_only',
          matchesCurrent: true,
        },
      ])
      await expect(fileExists(context.storageAnchor)).resolves.toBe(false)
    })
  })

  test('keeps every observation for a duplicated scope identity without choosing a winner', async () => {
    await inCanonicalTemporaryDirectory(async (root) => {
      const context = ghostContext(root)
      const identity = appDoctorScopeIdentity(context.storageAnchor, context.appRoot)
      const older = retainedResult({scope_identity: identity, produced_at: '2026-09-01T00:00:00.000Z'})
      const newer = retainedResult({scope_identity: identity, produced_at: '2026-09-02T00:00:00.000Z'})

      const inventory = buildAppDoctorMetadataInventory(context, [newer, older])

      expect(inventory.retained.map((observation) => observation.producedAt)).toEqual([
        '2026-09-02T00:00:00.000Z',
        '2026-09-01T00:00:00.000Z',
      ])
      expect(inventory.retained.every((observation) => observation.matchesCurrent)).toBe(true)
    })
  })

  test('never resolves retained descriptors, even for directories that do not exist', async () => {
    await inCanonicalTemporaryDirectory(async (root) => {
      const context = ghostContext(root)
      const vanished = appScopeDescriptor({base: 'storage_anchor', up: 0, path: 'packages/app/removed%20dir'})
      const result = retainedResult({scope_identity: `sha256:${'d'.repeat(64)}`, scope: vanished})

      const inventory = buildAppDoctorMetadataInventory(context, [result])

      expect(inventory.retained[0]).toMatchObject({descriptor: vanished, matchesCurrent: false})
    })
  })

  test('rejects retained results owned by a different configuration', async () => {
    await inCanonicalTemporaryDirectory(async (root) => {
      const context = ghostContext(root)
      const foreign = retainedResult({configuration_identity: 'f'.repeat(32)})

      expect(() => buildAppDoctorMetadataInventory(context, [retainedResult(), foreign])).toThrow(
        expect.objectContaining({code: 'FOREIGN_CONFIGURATION'}) as unknown as Error,
      )
      expect(() => buildAppDoctorMetadataInventory(context, [foreign])).toThrow(AppDoctorScopeError)
    })
  })
})
