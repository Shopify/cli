import FetchSchema from './schema.js'
import {chooseFunction} from '../../../services/function/common.js'
import {linkedAppContext} from '../../../services/app-context.js'
import {
  testAppLinked,
  testDeveloperPlatformClient,
  testFunctionExtension,
  testOrganization,
  testOrganizationApp,
  testProject,
} from '../../../models/app/app.test-data.js'
import {functionSchemaJsonOutputSchema} from '../../../services/generate-schema/types.js'
import {Config} from '@oclif/core'
import {afterEach, expect, test, vi} from 'vitest'
import {fileExists, inTemporaryDirectory, mkdir, readFile} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {withCapturedStandardStreams} from '@shopify/cli-kit/node/testing/output'
import {runWithCommandEventsForCommand} from '@shopify/cli-kit/node/command-events'
import {AbortError, handler} from '@shopify/cli-kit/node/error'

// eslint-disable-next-line no-restricted-imports
import {resolve} from 'node:path'

vi.mock('../../../services/app-context.js')
vi.mock('../../../services/function/common.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../services/function/common.js')>()),
  chooseFunction: vi.fn(),
}))
afterEach(() => vi.unstubAllEnvs())

async function command(argv: string[], directory: string) {
  const app = testAppLinked({directory})
  const extension = await testFunctionExtension({dir: directory})
  const developerPlatformClient = testDeveloperPlatformClient()
  vi.mocked(linkedAppContext).mockResolvedValue({
    app,
    developerPlatformClient,
    organization: testOrganization(),
    remoteApp: testOrganizationApp(),
    project: testProject(),
    activeConfig: {} as never,
    specifications: [],
  })
  vi.mocked(chooseFunction).mockResolvedValue(extension)
  return {instance: new FetchSchema(argv, await Config.load()), extension, app, developerPlatformClient}
}

test.each([['--json'], ['--json', '--no-input']])(
  'writes the native schema and one absolute file receipt: %j',
  async (...argv) => {
    await inTemporaryDirectory(async (directory) => {
      const {instance, extension, app} = await command(argv, directory)
      await withCapturedStandardStreams(async ({stdout, stderr}) => {
        await expect(instance.run()).resolves.toEqual({app})
        expect(JSON.parse(stdout())).toEqual({path: resolve(directory, 'schema.graphql'), format: 'graphql'})
        expect(stderr()).toBe('')
        await expect(readFile(joinPath(directory, 'schema.graphql'))).resolves.toBe(
          `# api_version: ${extension.configuration.api_version}\n\nschema`,
        )
      })
    })
  },
)

test.each([true, false])('preserves native SDL with --stdout, json=%s', async (json) => {
  await inTemporaryDirectory(async (directory) => {
    const {instance, extension} = await command(['--stdout', ...(json ? ['--json'] : [])], directory)
    await withCapturedStandardStreams(async ({stdout, stderr}) => {
      await instance.run()
      const schema = `# api_version: ${extension.configuration.api_version}\n\nschema`
      expect(stdout()).toBe(json ? `${functionSchemaJsonOutputSchema.encode({schema})}\n` : `${schema}\n`)
      expect(stderr()).toBe('')
    })
    await expect(fileExists(joinPath(directory, 'schema.graphql'))).resolves.toBe(false)
  })
})

test('keeps the default text schema file and message', async () => {
  await inTemporaryDirectory(async (directory) => {
    const {instance, extension} = await command([], directory)
    await withCapturedStandardStreams(async ({stdout, stderr}) => {
      await instance.run()
      expect(stdout()).toBe('')
      expect(stderr()).toContain(
        `GraphQL Schema for ${extension.localIdentifier} written to ${joinPath(directory, 'schema.graphql')}`,
      )
    })
  })
})

test('does not emit a receipt if writing the schema fails', async () => {
  await inTemporaryDirectory(async (directory) => {
    const {instance} = await command(['--json'], directory)
    await mkdir(joinPath(directory, 'schema.graphql'))
    await withCapturedStandardStreams(async ({stdout}) => {
      await expect(instance.run()).rejects.toThrow()
      expect(stdout()).toBe('')
    })
  })
})

test('emits one standard fatal document for an unavailable schema', async () => {
  vi.stubEnv('SHOPIFY_FLAG_JSON', '1')
  await inTemporaryDirectory(async (directory) => {
    const {instance, developerPlatformClient} = await command(['--json'], directory)
    vi.spyOn(developerPlatformClient, 'apiSchemaDefinition').mockResolvedValue(null)
    await withCapturedStandardStreams(async ({stdout}) => {
      await runWithCommandEventsForCommand(instance.argv, async () => {
        try {
          await instance.run()
          expect.unreachable('Expected schema generation to fail')
        } catch (error) {
          if (!(error instanceof AbortError)) throw error
          await handler(error)
        }
      })
      expect(JSON.parse(stdout())).toMatchObject({
        error: {type: 'abort', message: expect.stringContaining('could not be generated')},
      })
    })
    await expect(fileExists(joinPath(directory, 'schema.graphql'))).resolves.toBe(false)
  })
})

test('exposes the result variants in help and retains inherited flags', () => {
  expect(FetchSchema.flags.json).toBeDefined()
  expect(FetchSchema.flags.stdout).toBeDefined()
  expect(FetchSchema.flags['no-input']).toBeDefined()
  expect(FetchSchema.jsonOutputSchema).toBe(functionSchemaJsonOutputSchema)
  expect(FetchSchema.descriptionForHelp()).toContain('FunctionSchemaResult')
})
