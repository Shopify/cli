import Command from './base-command.js'
import {Environments} from './environments.js'
import {encodeToml as encodeTOML} from './toml.js'
import {globalFlags} from './cli.js'
import {inTemporaryDirectory, mkdir, writeFile} from './fs.js'
import {joinPath, resolvePath, cwd} from './path.js'
import {mockAndCaptureOutput} from './testing/output.js'
import {terminalSupportsPrompting} from './system.js'
import {unstyled} from './output.js'
import {beforeEach, describe, expect, test, vi} from 'vitest'
import {Flags} from '@oclif/core'

vi.mock('./system.js')

beforeEach(() => {
  vi.mocked(terminalSupportsPrompting).mockReturnValue(true)
  vi.unstubAllEnvs()
})

let testResult: {[flag: string]: unknown} = {}
let testError: Error | undefined

class MockCommand extends Command {
  /* eslint-disable @shopify/cli/command-flags-with-env */
  static flags = {
    ...globalFlags,
    path: Flags.string({
      parse: async (input) => resolvePath(input),
      default: async () => cwd(),
    }),
    someString: Flags.string({}),
    someInteger: Flags.integer({}),
    someBoolean: Flags.boolean({}),
    someExclusiveString: Flags.string({
      exclusive: ['someBoolean'],
    }),
    someMultipleString: Flags.string({multiple: true}),
    someStringWithDefault: Flags.string({
      default: 'default stringy',
    }),
    password: Flags.string({}),
    environment: Flags.string({
      multiple: true,
      default: [],
    }),
    nonTTYRequiredFlag: Flags.string({}),
    noRelease: Flags.boolean({}),
  }
  /* eslint-enable @shopify/cli/command-flags-with-env */

  async run(): Promise<void> {
    const {flags} = await this.parse(MockCommand)
    testResult = flags
  }

  async catch(error: Error): Promise<void> {
    testError = error
  }

  environmentsFilename(): string {
    return 'shopify.environments.toml'
  }
}

class MockCommandWithRequiredFlagInNonTTY extends MockCommand {
  async run(): Promise<void> {
    const {flags} = await this.parse(MockCommandWithRequiredFlagInNonTTY)
    this.failMissingNonTTYFlags(flags, ['nonTTYRequiredFlag'])
  }
}

class MockCommandWithoutEnvironmentFlag extends Command {
  /* eslint-disable @shopify/cli/command-flags-with-env */
  static flags = {
    ...globalFlags,
    path: Flags.string({
      parse: async (input) => resolvePath(input),
      default: async () => cwd(),
    }),
    someString: Flags.string({}),
  }
  /* eslint-enable @shopify/cli/command-flags-with-env */

  async run(): Promise<void> {
    const {flags} = await this.parse(MockCommandWithoutEnvironmentFlag)
    testResult = flags
  }

  async catch(error: Error): Promise<void> {
    testError = error
  }

  environmentsFilename(): string {
    return 'shopify.environments.toml'
  }
}

const validEnvironment = {
  someString: 'stringy',
  someBoolean: true,
}

const defaultEnvironment = {
  someString: 'default-string',
}

const validEnvironmentWithIrrelevantFlag = {
  ...validEnvironment,
  irrelevantString: 'stringy',
}

const environmentWithIncorrectType = {
  someInteger: 'stringy',
}

const environmentWithExclusiveArguments = {
  someBoolean: true,
  someExclusiveString: 'exclusive stringy',
}

const environmentWithNegativeBoolean = {
  someBoolean: false,
}

const environmentWithMultiples = {
  someMultipleString: ['multiple', 'stringies'],
}

const environmentMatchingDefault = {
  someStringWithDefault: 'default stringy',
}

const environmentWithDefaultOverride = {
  someStringWithDefault: 'non-default stringy',
}

const environmentWithPassword = {
  password: 'password',
}

const allEnvironments: Environments = {
  environments: {
    validEnvironment,
    default: defaultEnvironment,
    validEnvironmentWithIrrelevantFlag,
    environmentWithIncorrectType,
    environmentWithExclusiveArguments,
    environmentWithNegativeBoolean,
    environmentWithMultiples,
    environmentMatchingDefault,
    environmentWithDefaultOverride,
    environmentWithPassword,
  },
}

describe('applying environments', async () => {
  const runTestInTmpDir = (testName: string, testFunc: (tmpDir: string) => Promise<void>) => {
    test(testName, async () => {
      testResult = {}
      testError = undefined

      await inTemporaryDirectory(async (tmpDir) => {
        await writeFile(joinPath(tmpDir, 'shopify.environments.toml'), encodeTOML(allEnvironments as any))
        await testFunc(tmpDir)
      })
    })
  }

  function expectFlags(path: string, environment: keyof typeof allEnvironments) {
    const envFlags = allEnvironments.environments && (allEnvironments.environments[environment] as Environments)
    expect(testResult).toEqual({
      path: resolvePath(path),
      someStringWithDefault: 'default stringy',
      environment: [environment],
      ...envFlags,
    })
  }

  runTestInTmpDir(
    'does not apply a environment when none is specified and there is no default',
    async (tmpDir: string) => {
      // Given
      const outputMock = mockAndCaptureOutput()
      outputMock.clear()
      await deleteDefaultEnvironment(tmpDir)

      // When
      await MockCommand.run(['--path', tmpDir])

      // Then
      expect(testResult).toMatchObject({
        path: resolvePath(tmpDir),
        someStringWithDefault: 'default stringy',
        environment: [],
      })
      expect(outputMock.info()).toEqual('')
    },
  )

  runTestInTmpDir('does not apply flags when multiple environments are specified', async (tmpDir: string) => {
    // Given
    const outputMock = mockAndCaptureOutput()
    outputMock.clear()

    // When
    await MockCommand.run(['--path', tmpDir, '--environment', 'validEnvironment', '--environment', 'validEnvironment'])

    // Then
    expect(testResult).toEqual({
      path: resolvePath(tmpDir),
      environment: ['validEnvironment', 'validEnvironment'],
      someStringWithDefault: 'default stringy',
    })
    expect(outputMock.info()).toEqual('')
  })

  runTestInTmpDir('applies a environment when one is specified', async (tmpDir: string) => {
    // Given
    const outputMock = mockAndCaptureOutput()
    outputMock.clear()

    // When
    await MockCommand.run(['--path', tmpDir, '--environment', 'validEnvironment'])

    // Then
    expectFlags(tmpDir, 'validEnvironment')
    expect(outputMock.info()).toMatchInlineSnapshot(`
      "╭─ info ───────────────────────────────────────────────────────────────────────╮
      │                                                                              │
      │  Using applicable flags from validEnvironment environment:                   │
      │                                                                              │
      │    • someString: stringy                                                     │
      │    • someBoolean: true                                                       │
      │                                                                              │
      ╰──────────────────────────────────────────────────────────────────────────────╯
      "
    `)
  })

  runTestInTmpDir('applies default environment when no environment is specified', async (tmpDir: string) => {
    // Given
    const outputMock = mockAndCaptureOutput()
    outputMock.clear()

    // When
    await MockCommand.run(['--path', tmpDir])

    // Then
    expectFlags(tmpDir, 'default')
    expect(outputMock.info()).toMatchInlineSnapshot(`
      "╭─ info ───────────────────────────────────────────────────────────────────────╮
      │                                                                              │
      │  Using applicable flags from default environment:                            │
      │                                                                              │
      │    • someString: default-string                                              │
      │                                                                              │
      ╰──────────────────────────────────────────────────────────────────────────────╯
      "
    `)
  })

  describe('when the command does not support the environment flag', () => {
    runTestInTmpDir('does not apply default environment', async (tmpDir: string) => {
      // Given
      const outputMock = mockAndCaptureOutput()
      outputMock.clear()

      // When
      await MockCommandWithoutEnvironmentFlag.run(['--path', tmpDir])

      // Then
      expect(testResult).toMatchObject({
        path: resolvePath(tmpDir),
      })
      expect(testResult.environment).toBeUndefined()
    })
  })

  runTestInTmpDir(
    'base Command does not apply environment specified via environment variable',
    async (tmpDir: string) => {
      // Given
      const environmentName = 'validEnvironmentWithPassword'
      const flagName = 'SHOPIFY_FLAG_ENVIRONMENT'
      vi.stubEnv(flagName, environmentName)
      await deleteDefaultEnvironment(tmpDir)

      const outputMock = mockAndCaptureOutput()
      outputMock.clear()

      // When
      await MockCommand.run(['--path', tmpDir])

      // Then
      expect(testResult.environment).toEqual([])
      expect(testResult.password).toBeUndefined()
      expect(testResult.someString).toBeUndefined()
      expect(testResult.path).toEqual(resolvePath(tmpDir))
      expect(testResult.someStringWithDefault).toEqual('default stringy')
      expect(outputMock.info()).toEqual('')
    },
  )

  runTestInTmpDir('searches up recursively from path by default', async (tmpDir: string) => {
    // Given
    const subdir = joinPath(tmpDir, 'somedir', '--environment', 'validEnvironment')
    await mkdir(subdir)

    // When
    await MockCommand.run(['--path', subdir, '--environment', 'validEnvironment'])

    // Then
    expectFlags(subdir, 'validEnvironment')
  })

  runTestInTmpDir('prefers command line arguments to environment settings', async (tmpDir: string) => {
    // Given
    const outputMock = mockAndCaptureOutput()
    outputMock.clear()

    // When
    await MockCommand.run(['--path', tmpDir, '--environment', 'validEnvironment', '--someString', 'cheesy'])

    // Then
    expect(testResult.someString).toEqual('cheesy')
    expect(outputMock.info()).toMatchInlineSnapshot(`
      "╭─ info ───────────────────────────────────────────────────────────────────────╮
      │                                                                              │
      │  Using applicable flags from validEnvironment environment:                   │
      │                                                                              │
      │    • someBoolean: true                                                       │
      │                                                                              │
      ╰──────────────────────────────────────────────────────────────────────────────╯
      "
    `)
  })

  runTestInTmpDir('ignores the specified environment when it does not exist', async (tmpDir: string) => {
    // When
    await MockCommand.run(['--path', tmpDir, '--environment', 'nonexistentEnvironment'])

    // Then
    expect(testResult).toEqual({
      path: resolvePath(tmpDir),
      environment: ['nonexistentEnvironment'],
      someStringWithDefault: 'default stringy',
    })
  })

  runTestInTmpDir('does not apply flags irrelevant to the current command', async (tmpDir: string) => {
    // When
    await MockCommand.run(['--path', tmpDir, '--environment', 'validEnvironmentWithIrrelevantFlag'])

    // Then
    expect(testResult).toEqual({
      path: resolvePath(tmpDir),
      environment: ['validEnvironmentWithIrrelevantFlag'],
      ...validEnvironment,
      someStringWithDefault: 'default stringy',
    })
  })

  runTestInTmpDir('throws when an argument of the incorrect type is provided', async (tmpDir: string) => {
    // When
    await MockCommand.run(['--path', tmpDir, '--environment', 'environmentWithIncorrectType'])

    // Then
    expect(testError?.message).toMatch('Expected an integer but received: stringy')
  })

  runTestInTmpDir('throws when exclusive arguments are provided', async (tmpDir: string) => {
    // When
    await MockCommand.run(['--path', tmpDir, '--environment', 'environmentWithExclusiveArguments'])

    // Then
    expect(testError?.message).toMatch('--someBoolean=true cannot also be provided when using --someExclusiveString')
  })

  runTestInTmpDir('throws on negated booleans', async (tmpDir: string) => {
    // When
    await MockCommand.run(['--path', tmpDir, '--environment', 'environmentWithNegativeBoolean'])

    // Then
    expect(testError?.message).toMatch(
      /Environments can only specify true for boolean flags\. Attempted to set .+someBoolean.+ to false\./,
    )
  })

  runTestInTmpDir('handles multiples correctly', async (tmpDir: string) => {
    // When
    await MockCommand.run(['--path', tmpDir, '--environment', 'environmentWithMultiples'])

    // Then
    expectFlags(tmpDir, 'environmentWithMultiples')
  })

  runTestInTmpDir(
    'throws when exclusive arguments are provided when combining command line + environment',
    async (tmpDir: string) => {
      // When
      await MockCommand.run(['--path', tmpDir, '--environment', 'validEnvironment', '--someExclusiveString', 'stringy'])

      // Then
      expect(testError?.message).toMatch('--someBoolean=true cannot also be provided when using --someExclusiveString')
    },
  )

  runTestInTmpDir('does not throw in TTY mode when a non-TTY required argument is missing', async (tmpDir: string) => {
    // Given
    vi.mocked(terminalSupportsPrompting).mockReturnValue(true)

    // When
    await MockCommandWithRequiredFlagInNonTTY.run(['--path', tmpDir])

    // Then
    expect(testError).toBeUndefined()
  })

  runTestInTmpDir('throws in non-TTY mode when a non-TTY required argument is missing', async (tmpDir: string) => {
    // Given
    vi.mocked(terminalSupportsPrompting).mockReturnValue(false)

    // When
    await MockCommandWithRequiredFlagInNonTTY.run(['--path', tmpDir])

    // Then
    expect(unstyled(testError!.message)).toMatch('Flag not specified:\n\nnonTTYRequiredFlag')
  })

  runTestInTmpDir('reports environment settings that do not match defaults', async (tmpDir: string) => {
    // Given
    const outputMock = mockAndCaptureOutput()
    outputMock.clear()

    // When
    await MockCommand.run(['--path', tmpDir, '--environment', 'environmentWithDefaultOverride'])

    // Then
    expectFlags(tmpDir, 'environmentWithDefaultOverride')
    expect(outputMock.info()).toMatchInlineSnapshot(`
      "╭─ info ───────────────────────────────────────────────────────────────────────╮
      │                                                                              │
      │  Using applicable flags from environmentWithDefaultOverride environment:     │
      │                                                                              │
      │    • someStringWithDefault: non-default stringy                              │
      │                                                                              │
      ╰──────────────────────────────────────────────────────────────────────────────╯
      "
    `)
  })

  runTestInTmpDir('reports environment settings that match defaults', async (tmpDir: string) => {
    // Given
    const outputMock = mockAndCaptureOutput()
    outputMock.clear()

    // When
    await MockCommand.run(['--path', tmpDir, '--environment', 'environmentMatchingDefault'])

    // Then
    expectFlags(tmpDir, 'environmentMatchingDefault')
    expect(outputMock.info()).toMatchInlineSnapshot(`
      "╭─ info ───────────────────────────────────────────────────────────────────────╮
      │                                                                              │
      │  Using applicable flags from environmentMatchingDefault environment:         │
      │                                                                              │
      │    • someStringWithDefault: default stringy                                  │
      │                                                                              │
      ╰──────────────────────────────────────────────────────────────────────────────╯
      "
    `)
  })

  runTestInTmpDir('reports environment settings with masked passwords', async (tmpDir: string) => {
    // Given
    const outputMock = mockAndCaptureOutput()
    outputMock.clear()

    // When
    await MockCommand.run(['--path', tmpDir, '--environment', 'environmentWithPassword'])

    // Then
    expectFlags(tmpDir, 'environmentWithPassword')
    expect(outputMock.info()).toMatchInlineSnapshot(`
      "╭─ info ───────────────────────────────────────────────────────────────────────╮
      │                                                                              │
      │  Using applicable flags from environmentWithPassword environment:            │
      │                                                                              │
      │    • password: ********word                                                  │
      │                                                                              │
      ╰──────────────────────────────────────────────────────────────────────────────╯
      "
    `)
  })

  test('shows a warning about NPM separator when using a flag that matches a NPM config env variable', async () => {
    // Given
    const outputMock = mockAndCaptureOutput()
    outputMock.clear()
    vi.stubEnv('npm_config_some_string', '')

    // When
    await MockCommand.run()

    // Then
    expect(testResult).toMatchObject({
      environment: [],
      someStringWithDefault: 'default stringy',
    })
    expect(outputMock.warn()).toMatchInlineSnapshot(`
      "╭─ warning ────────────────────────────────────────────────────────────────────╮
      │                                                                              │
      │  NPM scripts require an extra \`--\` separator to pass the flags. Example:     │
      │  \`npm run dev -- --reset\`                                                    │
      │                                                                              │
      ╰──────────────────────────────────────────────────────────────────────────────╯
      "
    `)
  })

  test('shows a warning about NPM separator when using a negated flag that matches a NPM config env variable', async () => {
    // Given
    const outputMock = mockAndCaptureOutput()
    outputMock.clear()
    vi.stubEnv('npm_config_release', 'true')

    // When
    await MockCommand.run()

    // Then
    expect(outputMock.warn()).toMatchInlineSnapshot(`
      "╭─ warning ────────────────────────────────────────────────────────────────────╮
      │                                                                              │
      │  NPM scripts require an extra \`--\` separator to pass the flags. Example:     │
      │  \`npm run dev -- --reset\`                                                    │
      │                                                                              │
      ╰──────────────────────────────────────────────────────────────────────────────╯
      "
    `)
  })

  test('does not show a warning about NPM separator when no flag matches a NPM config env variable', async () => {
    // Given
    const outputMock = mockAndCaptureOutput()
    outputMock.clear()
    vi.stubEnv('npm_config_other', 'x')

    // When
    await MockCommand.run()

    // Then
    expect(outputMock.warn()).toMatchInlineSnapshot('""')
  })
})

const deleteDefaultEnvironment = async (tmpDir: string): Promise<void> => {
  const clone = {...allEnvironments}
  clone.environments = {...allEnvironments.environments}
  delete clone.environments.default
  await writeFile(joinPath(tmpDir, 'shopify.environments.toml'), encodeTOML({environments: clone} as any))
}
