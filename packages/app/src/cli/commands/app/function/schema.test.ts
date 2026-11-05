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
import {fileExists, inTemporaryDirectory, mkdir, readFile, rmdir, tempDirectory} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {withCapturedStandardStreams} from '@shopify/cli-kit/node/testing/output'
import {describeJsonCommand} from '@shopify/cli-kit/node/testing/json-command'

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

test.each([['--json']])('writes the native schema and one absolute file receipt: %j', async (...argv) => {
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
})

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

let schemaDirectory: string
let schemaApp: ReturnType<typeof testAppLinked>
let schemaExtension: Awaited<ReturnType<typeof testFunctionExtension>>
let schemaClient: ReturnType<typeof testDeveloperPlatformClient>

describeJsonCommand({
  command: FetchSchema,
  commandId: 'app:function:schema',
  moduleURL: new URL('../../../../../../cli/bin/dev.js', import.meta.url).href,
  args: () => ['--path', schemaDirectory],
  expectedResult: () => ({path: resolve(schemaDirectory, 'schema.graphql'), format: 'graphql'}),
  expectedSchema: {
    anyOf: [{$ref: '#/definitions/FunctionSchemaFile'}, {$ref: '#/definitions/FunctionSchemaContent'}],
  },
  setup: async () => {
    schemaDirectory = tempDirectory()
    const {app, extension, developerPlatformClient} = await command([], schemaDirectory)
    schemaApp = app
    schemaExtension = extension
    schemaClient = developerPlatformClient
    const directory = schemaDirectory
    return () => rmdir(directory)
  },
  assertExecuted: () => {
    expect(linkedAppContext).toHaveBeenCalledExactlyOnceWith({
      directory: schemaDirectory,
      clientId: undefined,
      forceRelink: false,
      userProvidedConfigName: undefined,
    })
    expect(chooseFunction).toHaveBeenCalledExactlyOnceWith(schemaApp, schemaDirectory)
    expect(schemaClient.apiSchemaDefinition).toHaveBeenCalledOnce()
  },
  assertNotExecuted: () => {
    expect(linkedAppContext).not.toHaveBeenCalled()
    expect(chooseFunction).not.toHaveBeenCalled()
    expect(schemaClient.apiSchemaDefinition).not.toHaveBeenCalled()
  },
  textOutput: ({stdout, stderr}) => {
    expect(stdout).toBe('')
    expect(stderr).toContain(
      `GraphQL Schema for ${schemaExtension.localIdentifier} written to ${joinPath(schemaDirectory, 'schema.graphql')}`,
    )
  },
  failure: {
    setup: () => {
      vi.spyOn(schemaClient, 'apiSchemaDefinition').mockResolvedValue(null)
    },
    expectedError: {
      error: {
        type: 'abort',
        message: 'A schema could not be generated for test-function-extension',
        tryMessage: 'Check that the Function API type and version are valid.',
      },
    },
    exitCode: 1,
  },
})
