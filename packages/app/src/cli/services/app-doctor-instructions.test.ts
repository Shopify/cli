import deliverAppDoctorInstructions, {
  generateAppDoctorInstructions,
  shellQuote,
  writeAppDoctorInstructionsResult,
} from './app-doctor-instructions.js'
import {resolveAppDoctorContext, type ResolveAppDoctorContextOptions} from './app-doctor-context.js'
import {
  decodeAppDoctorReviewBinding,
  getAgentInstructions,
  getEngineVersion,
  loadChecks,
} from './app-doctor-engine/index.js'
import {appDoctorInstructionsJsonOutputSchema} from './app-doctor-instructions-json.js'
import {
  inCanonicalTemporaryDirectory,
  linkedConfiguration,
  makeFixtureDirectory,
  writeFixtureFile,
} from './app-doctor-engine/tests/context-test-helpers.js'
import {smallCheckCatalogue} from './app-doctor-engine/tests/store-fixtures.js'
import {AppLocalStorageSchema} from './local-storage.js'
import {AbortError} from '@shopify/cli-kit/node/error'
import {readFile, writeFile} from '@shopify/cli-kit/node/fs'
import {LocalStorage} from '@shopify/cli-kit/node/local-storage'
import {joinPath} from '@shopify/cli-kit/node/path'
import {describe, expect, test, vi} from 'vitest'
import {readFileSync} from 'node:fs'
import {fileURLToPath} from 'node:url'

interface Fixture {
  readonly root: string
  readonly appRoot: string
  readonly configurationPath: string
}

/** A git repository containing one linked app with a `web` directory; the app cache lives in an isolated store. */
async function createFixture(root: string): Promise<Fixture> {
  const repository = await makeFixtureDirectory(root, 'repo')
  await makeFixtureDirectory(repository, '.git')
  const configurationPath = await writeFixtureFile(repository, 'app/shopify.app.toml', linkedConfiguration('id-1'))
  await makeFixtureDirectory(repository, 'app/web')
  return {root, appRoot: joinPath(repository, 'app'), configurationPath}
}

function generateDependencies(root: string) {
  const appStorage = new LocalStorage<AppLocalStorageSchema>({cwd: joinPath(root, 'storage')})
  return {
    resolveContext: (options: ResolveAppDoctorContextOptions) => resolveAppDoctorContext({...options, appStorage}),
    invocationDirectory: () => root,
    quote: (value: string) => `<${value}>`,
    // Nothing here records, so the real catalogue is cheap; it keeps these tests honest about production output.
    loadChecks,
  }
}

function writeDependencies() {
  return {
    copyToClipboard: vi.fn(async (_content: string) => {}),
    writeToFile: writeFile,
    output: vi.fn(),
    outputConfirmation: vi.fn(),
  }
}

describe('embedded instructions', () => {
  test('matches INSTRUCTIONS.md', () => {
    const source = readFileSync(fileURLToPath(new URL('./app-doctor-engine/INSTRUCTIONS.md', import.meta.url)), 'utf8')
    expect(getAgentInstructions()).toBe(source)
  })
})

describe('shellQuote', () => {
  test('quotes Windows cmd paths with spaces and paired percents for interactive cmd.exe', () => {
    expect(shellQuote('C:\\Users\\50%\\my app', 'win32', {PROMPT: '$P$G'})).toBe('"C:\\Users\\50"^%"\\my app"')
  })

  test('quotes POSIX paths with single quotes', () => {
    expect(shellQuote("it's here", 'linux', {})).toBe(`'it'\\''s here'`)
  })
})

describe('generateAppDoctorInstructions', () => {
  test('resolves the app, defaults to the app-root scope, and freezes the checks into the token', async () => {
    await inCanonicalTemporaryDirectory(async (root) => {
      const fixture = await createFixture(root)

      const result = await generateAppDoctorInstructions(
        {directory: fixture.appRoot, interactive: false, format: 'text'},
        generateDependencies(root),
      )

      expect(result.schema_version).toBe(1)
      expect(result.app_root).toBe(fixture.appRoot)
      expect(result.configuration).toEqual({
        identity: expect.any(String),
        path: fixture.configurationPath,
        name: 'shopify.app.toml',
        client_id: 'id-1',
      })
      expect(result.scopes).toHaveLength(1)
      expect(result.scopes[0]!.directory).toBe(fixture.appRoot)
      expect(result.scopes[0]!.record_command.args).toEqual([
        'app',
        'doctor',
        'record',
        '--path',
        fixture.appRoot,
        '--config',
        'shopify.app.toml',
        '--review',
        result.scopes[0]!.token,
        '--findings',
        result.scopes[0]!.findings_path,
      ])
      const binding = decodeAppDoctorReviewBinding(result.scopes[0]!.token)
      expect(binding.engine).toEqual({name: 'shopify-app-doctor', version: getEngineVersion()})
      expect(binding.checks.map((check) => check.id)).toEqual(result.checks.map((check) => check.id))
      // The default dependency freezes the whole embedded catalogue into the token.
      expect(result.checks.length).toBe(loadChecks().size)
      expect(result.instructions).toContain(`--review <${result.scopes[0]!.token}>`)
      expect(result.instructions).not.toMatch(/\{\{[A-Z_]+\}\}/)
    })
  })

  test('freezes only the injected check catalogue into the token and instructions', async () => {
    await inCanonicalTemporaryDirectory(async (root) => {
      const fixture = await createFixture(root)
      const catalogue = smallCheckCatalogue()

      const result = await generateAppDoctorInstructions(
        {directory: fixture.appRoot, interactive: false, format: 'text'},
        {...generateDependencies(root), loadChecks: () => catalogue},
      )

      const catalogueIds = [...catalogue.keys()]
      expect(catalogueIds).toHaveLength(2)
      expect(result.checks.map((check) => check.id)).toEqual(catalogueIds)
      const binding = decodeAppDoctorReviewBinding(result.scopes[0]!.token)
      expect(binding.checks.map((check) => check.id)).toEqual(catalogueIds)
    })
  })

  test('resolves --review directories against the invocation directory', async () => {
    await inCanonicalTemporaryDirectory(async (root) => {
      const fixture = await createFixture(root)

      const result = await generateAppDoctorInstructions(
        {directory: fixture.appRoot, reviewDirectories: ['repo/app/web'], interactive: false, format: 'text'},
        generateDependencies(root),
      )

      expect(result.scopes.map((scope) => scope.directory)).toEqual([joinPath(fixture.appRoot, 'web')])
    })
  })

  test('encodes through the JSON output schema and round-trips', async () => {
    await inCanonicalTemporaryDirectory(async (root) => {
      const fixture = await createFixture(root)

      const result = await generateAppDoctorInstructions(
        {directory: fixture.appRoot, interactive: false, format: 'json'},
        generateDependencies(root),
      )

      const encoded = appDoctorInstructionsJsonOutputSchema.encode(result)
      expect(appDoctorInstructionsJsonOutputSchema.schema.parse(JSON.parse(encoded))).toEqual(result)
    })
  })

  test('surfaces a missing --review directory as an AbortError', async () => {
    await inCanonicalTemporaryDirectory(async (root) => {
      const fixture = await createFixture(root)
      const missing = joinPath(fixture.appRoot, 'does-not-exist')

      const promise = generateAppDoctorInstructions(
        {directory: fixture.appRoot, reviewDirectories: [missing], interactive: false, format: 'text'},
        generateDependencies(root),
      )

      await expect(promise).rejects.toBeInstanceOf(AbortError)
      await expect(promise).rejects.toThrow(`${missing} does not exist.`)
    })
  })

  test('surfaces a missing app as an AbortError', async () => {
    await inCanonicalTemporaryDirectory(async (root) => {
      const promise = generateAppDoctorInstructions(
        {directory: root, interactive: false, format: 'text'},
        generateDependencies(root),
      )

      await expect(promise).rejects.toBeInstanceOf(AbortError)
    })
  })
})

describe('writeAppDoctorInstructionsResult', () => {
  test('prints the encoded JSON document exactly once in json format', async () => {
    await inCanonicalTemporaryDirectory(async (root) => {
      const fixture = await createFixture(root)
      const result = await generateAppDoctorInstructions(
        {directory: fixture.appRoot, interactive: false, format: 'json'},
        generateDependencies(root),
      )
      const dependencies = writeDependencies()

      await writeAppDoctorInstructionsResult(result, {format: 'json'}, dependencies)

      expect(dependencies.output).toHaveBeenCalledOnce()
      expect(dependencies.output).toHaveBeenCalledWith(appDoctorInstructionsJsonOutputSchema.encode(result))
      expect(dependencies.outputConfirmation).not.toHaveBeenCalled()
      expect(dependencies.copyToClipboard).not.toHaveBeenCalled()
    })
  })

  test('prints the markdown in text format by default', async () => {
    await inCanonicalTemporaryDirectory(async (root) => {
      const fixture = await createFixture(root)
      const result = await generateAppDoctorInstructions(
        {directory: fixture.appRoot, interactive: false, format: 'text'},
        generateDependencies(root),
      )
      const dependencies = writeDependencies()

      await writeAppDoctorInstructionsResult(result, {format: 'text'}, dependencies)

      expect(dependencies.output).toHaveBeenCalledExactlyOnceWith(result.instructions)
      expect(dependencies.outputConfirmation).not.toHaveBeenCalled()
    })
  })

  test('copies to the clipboard and confirms', async () => {
    await inCanonicalTemporaryDirectory(async (root) => {
      const fixture = await createFixture(root)
      const result = await generateAppDoctorInstructions(
        {directory: fixture.appRoot, interactive: false, format: 'text'},
        generateDependencies(root),
      )
      const dependencies = writeDependencies()

      await writeAppDoctorInstructionsResult(result, {format: 'text', copy: true}, dependencies)

      expect(dependencies.copyToClipboard).toHaveBeenCalledExactlyOnceWith(result.instructions)
      expect(dependencies.outputConfirmation).toHaveBeenCalledWith('Copied App Doctor instructions to the clipboard')
      expect(dependencies.output).not.toHaveBeenCalled()
    })
  })

  test('writes a file with a trailing newline and confirms', async () => {
    await inCanonicalTemporaryDirectory(async (root) => {
      const fixture = await createFixture(root)
      const result = await generateAppDoctorInstructions(
        {directory: fixture.appRoot, interactive: false, format: 'text'},
        generateDependencies(root),
      )
      const dependencies = writeDependencies()
      const writePath = joinPath(root, 'instructions.md')

      await writeAppDoctorInstructionsResult(result, {format: 'text', writePath}, dependencies)

      await expect(readFile(writePath)).resolves.toBe(`${result.instructions}\n`)
      expect(dependencies.outputConfirmation).toHaveBeenCalledWith(`Wrote App Doctor instructions to ${writePath}`)
      expect(dependencies.output).not.toHaveBeenCalled()
    })
  })
})

describe('deliverAppDoctorInstructions', () => {
  test('generates and prints in one step', async () => {
    await inCanonicalTemporaryDirectory(async (root) => {
      const fixture = await createFixture(root)
      const dependencies = writeDependencies()

      await deliverAppDoctorInstructions(
        {directory: fixture.appRoot, interactive: false, format: 'text'},
        {...generateDependencies(root), ...dependencies},
      )

      expect(dependencies.output).toHaveBeenCalledOnce()
      expect(dependencies.output.mock.calls[0]![0]).toContain('shopify app doctor record --path')
    })
  })
})
