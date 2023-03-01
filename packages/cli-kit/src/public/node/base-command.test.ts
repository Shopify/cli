import Command from './base-command.js'
import {Environments, environmentsFilename} from './environments.js'
import {encodeToml as encodeTOML} from './toml.js'
import {globalFlags} from './cli.js'
import {inTemporaryDirectory, mkdir, writeFile} from './fs.js'
import {joinPath, resolvePath} from './path.js'
import {mockAndCaptureOutput} from './testing/output.js'
import {describe, expect, test} from 'vitest'
import {Flags} from '@oclif/core'

let testResult: {[flag: string]: unknown} = {}
let testError: Error | undefined
let disableFindUpEnvironments = true

class MockCommand extends Command {
  /* eslint-disable @shopify/cli/command-flags-with-env */
  static flags = {
    ...globalFlags,
    path: Flags.string({
      parse: (input, _) => Promise.resolve(resolvePath(input)),
      default: '.',
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
  }
  /* eslint-enable @shopify/cli/command-flags-with-env */

  async run(): Promise<void> {
    const {flags} = await this.parse(MockCommand)
    testResult = flags
  }

  async catch(error: Error): Promise<void> {
    testError = error
  }

  findUpForEnvironments() {
    if (disableFindUpEnvironments) return false
    return super.findUpForEnvironments()
  }
}

const validEnvironment = {
  someString: 'stringy',
  someBoolean: true,
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

const allEnvironments: Environments = {
  validEnvironment,
  validEnvironmentWithIrrelevantFlag,
  environmentWithIncorrectType,
  environmentWithExclusiveArguments,
  environmentWithNegativeBoolean,
  environmentWithMultiples,
  environmentMatchingDefault,
  environmentWithDefaultOverride,
}

describe('applying environments', async () => {
  const runTestInTmpDir = (testName: string, testFunc: (tmpDir: string) => Promise<void>) => {
    test(testName, async () => {
      testResult = {}
      testError = undefined
      disableFindUpEnvironments = false

      await inTemporaryDirectory(async (tmpDir) => {
        await writeFile(joinPath(tmpDir, environmentsFilename), encodeTOML(allEnvironments as any))
        await testFunc(tmpDir)
      })
    })
  }

  function expectFlags(path: string, environment: keyof typeof allEnvironments) {
    expect(testResult).toEqual({
      path: resolvePath(path),
      someStringWithDefault: 'default stringy',
      environment,
      ...allEnvironments[environment],
    })
  }

  runTestInTmpDir('does not apply a environment when none is specified', async (tmpDir: string) => {
    // Given
    const outputMock = mockAndCaptureOutput()
    outputMock.clear()

    // When
    await MockCommand.run(['--path', tmpDir])

    // Then
    expect(testResult).toEqual({
      path: resolvePath(tmpDir),
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
      "Using applicable flags from the environment validEnvironment:

      • someString = stringy
      • someBoolean = true\n"
    `)
  })

  runTestInTmpDir('searches up recursively from path by default', async (tmpDir: string) => {
    // Given
    const subdir = joinPath(tmpDir, 'somedir', '--environment', 'validEnvironment')
    await mkdir(subdir)

    // When
    await MockCommand.run(['--path', subdir, '--environment', 'validEnvironment'])

    // Then
    expectFlags(subdir, 'validEnvironment')
  })

  runTestInTmpDir(
    'searches only in the current directory when recursive search is disabled',
    async (tmpDir: string) => {
      // Given
      const subdir = joinPath(tmpDir, 'somedir')
      await mkdir(subdir)
      disableFindUpEnvironments = true

      // When
      await MockCommand.run(['--path', subdir, '--environment', 'validEnvironment'])

      // Then
      expect(testResult).toEqual({
        path: resolvePath(subdir),
        environment: 'validEnvironment',
        // no flags applied from the environment
        someStringWithDefault: 'default stringy',
      })
    },
  )

  runTestInTmpDir('prefers command line arguments to environment settings', async (tmpDir: string) => {
    // Given
    const outputMock = mockAndCaptureOutput()
    outputMock.clear()

    // When
    await MockCommand.run(['--path', tmpDir, '--environment', 'validEnvironment', '--someString', 'cheesy'])

    // Then
    expect(testResult.someString).toEqual('cheesy')
    expect(outputMock.info()).toMatchInlineSnapshot(`
      "Using applicable flags from the environment validEnvironment:

      • someBoolean = true\n"
    `)
  })

  runTestInTmpDir('ignores the specified environment when it does not exist', async (tmpDir: string) => {
    // When
    await MockCommand.run(['--path', tmpDir, '--environment', 'nonexistentEnvironment'])

    // Then
    expect(testResult).toEqual({
      path: resolvePath(tmpDir),
      environment: 'nonexistentEnvironment',
      someStringWithDefault: 'default stringy',
    })
  })

  runTestInTmpDir('does not apply flags irrelevant to the current command', async (tmpDir: string) => {
    // When
    await MockCommand.run(['--path', tmpDir, '--environment', 'validEnvironmentWithIrrelevantFlag'])

    // Then
    expect(testResult).toEqual({
      path: resolvePath(tmpDir),
      environment: 'validEnvironmentWithIrrelevantFlag',
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

  runTestInTmpDir('reports environment settings that do not match defaults', async (tmpDir: string) => {
    // Given
    const outputMock = mockAndCaptureOutput()
    outputMock.clear()

    // When
    await MockCommand.run(['--path', tmpDir, '--environment', 'environmentWithDefaultOverride'])

    // Then
    expectFlags(tmpDir, 'environmentWithDefaultOverride')
    expect(outputMock.info()).toMatchInlineSnapshot(`
      "Using applicable flags from the environment environmentWithDefaultOverride:

      • someStringWithDefault = non-default stringy\n"
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
      "Using applicable flags from the environment environmentMatchingDefault:

      • someStringWithDefault = default stringy\n"
    `)
  })
})
