import {localAppContext} from '../../app-context.js'
import {
  getCachedAppInfo,
  setCachedAppInfo,
  type AppLocalStorageSchema,
  type CachedAppInfo,
} from '../../local-storage.js'
import {LocalStorage} from '@shopify/cli-kit/node/local-storage'
import {runWithCommandEventsForCommand} from '@shopify/cli-kit/node/command-events'
import {withCapturedStandardStreams} from '@shopify/cli-kit/node/testing/output'
import {inTemporaryDirectory, mkdir, writeFile} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {unstyled} from '@shopify/cli-kit/node/output'
import {expect, test, vi} from 'vitest'

const scope = vi.hoisted(() => ({storage: undefined as LocalStorage<AppLocalStorageSchema> | undefined}))

// Inject the address of a real temporary cache, not cache responses or filesystem behavior.
vi.mock('../../local-storage.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../local-storage.js')>()
  const cache = () => {
    if (!scope.storage) throw new Error('Isolated fixture cache is not initialized.')
    return scope.storage
  }
  return {
    ...actual,
    getCachedAppInfo: (directory: string) => actual.getCachedAppInfo(directory, cache()),
    setCachedAppInfo: (options: CachedAppInfo) => actual.setCachedAppInfo(options, cache()),
    clearCurrentConfigFile: (directory: string) => actual.clearCurrentConfigFile(directory, cache()),
  }
})

vi.mock('@shopify/cli-kit/node/metadata', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@shopify/cli-kit/node/metadata')>()),
  addPublicMetadata: vi.fn(),
  addSensitiveMetadata: vi.fn(),
}))

const configuration = `name = "Recovery fixture"
client_id = "public-fixture-id"
application_url = "https://example.com"
embedded = true
[auth]
redirect_urls = []
[webhooks]
api_version = "2023-04"
`

async function fixture(root: string, multiple = false): Promise<string> {
  const directory = joinPath(root, 'app')
  await mkdir(directory)
  scope.storage = new LocalStorage<AppLocalStorageSchema>({cwd: joinPath(root, 'isolated-cache')})
  await writeFile(joinPath(directory, 'shopify.app.toml'), configuration)
  await writeFile(joinPath(directory, 'package.json'), JSON.stringify({name: 'recovery-fixture'}))
  if (multiple) await writeFile(joinPath(directory, 'shopify.app.other.toml'), configuration)
  setCachedAppInfo({directory, configFile: 'shopify.app.deleted.toml'})
  return directory
}

test.each([false, true])(
  'real stale-cache sole-config recovery preserves selection and warning: json=%s',
  async (json) => {
    await inTemporaryDirectory(async (root) => {
      const directory = await fixture(root)
      vi.stubEnv('SHOPIFY_FLAG_NO_INPUT', '1')
      try {
        await withCapturedStandardStreams(async ({stdout, stderr}) => {
          const result = await runWithCommandEventsForCommand(json ? ['--json', '--no-input'] : ['--no-input'], () =>
            localAppContext({directory}),
          )
          expect(result.app.name).toBe('Recovery fixture')
          expect(result.app.configPath).toBe(joinPath(directory, 'shopify.app.toml'))
          expect(getCachedAppInfo(directory)?.configFile).toBe('shopify.app.toml')
          expect(stdout()).toBe('')
          if (json) {
            const events = stderr()
              .trim()
              .split('\n')
              .map((line) => JSON.parse(line))
            expect(events).toContainEqual(
              expect.objectContaining({
                type: 'diagnostic',
                level: 'warning',
                message: expect.stringContaining("Couldn't find shopify.app.deleted.toml"),
              }),
            )
            expect(events.every((event) => event.type === 'diagnostic' || event.type === 'progress')).toBe(true)
          } else {
            expect(unstyled(stderr())).toContain("Couldn't find shopify.app.deleted.toml")
            expect(unstyled(stderr())).toContain('warning')
          }
        })
      } finally {
        scope.storage = undefined
        vi.unstubAllEnvs()
      }
    })
  },
)

test.each([false, true])(
  'multiple replacement configs still reject missing noninteractive input: json=%s',
  async (json) => {
    await inTemporaryDirectory(async (root) => {
      const directory = await fixture(root, true)
      vi.stubEnv('SHOPIFY_FLAG_NO_INPUT', '1')
      try {
        await withCapturedStandardStreams(async ({stdout}) => {
          await expect(
            runWithCommandEventsForCommand(json ? ['--json', '--no-input'] : ['--no-input'], () =>
              localAppContext({directory}),
            ),
          ).rejects.toThrow('Failed to prompt')
          expect(stdout()).toBe('')
          expect(getCachedAppInfo(directory)?.configFile).toBe('shopify.app.deleted.toml')
        })
      } finally {
        scope.storage = undefined
        vi.unstubAllEnvs()
      }
    })
  },
)
