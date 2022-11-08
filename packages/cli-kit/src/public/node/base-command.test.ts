import Command, {Environments} from './base-command.js'
import {globalFlags} from '../../cli.js'
import {mockAndCaptureOutput} from '../../testing/output.js'
import {describe, expect, test} from 'vitest'
import {Flags} from '@oclif/core'

let testResult: {[flag: string]: unknown} = {}
let testError: Error | undefined

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

class MockCommand extends Command {
  /* eslint-disable rulesdir/command-flags-with-env */
  static flags = {
    ...globalFlags,
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
  /* eslint-enable rulesdir/command-flags-with-env */

  async run(): Promise<void> {
    const {flags} = await this.parse(MockCommand)
    testResult = flags
  }

  async catch(error: Error): Promise<void> {
    testError = error
  }

  async environments(_flags: unknown) {
    return allEnvironments
  }
}

describe('applying environments', async () => {
  function expectFlags(environment: keyof typeof allEnvironments) {
    expect(testResult).toEqual({
      someStringWithDefault: 'default stringy',
      environment,
      ...allEnvironments[environment],
    })
  }

  test('does not apply a environment when none is specified', async () => {
    // Given
    const outputMock = mockAndCaptureOutput()
    outputMock.clear()

    // When
    await MockCommand.run()

    // Then
    expect(testResult).toEqual({
      someStringWithDefault: 'default stringy',
    })
    expect(outputMock.info()).toEqual('')
  })

  test('applies a environment when one is specified', async () => {
    // Given
    const outputMock = mockAndCaptureOutput()
    outputMock.clear()

    // When
    await MockCommand.run(['--environment', 'validEnvironment'])

    // Then
    expectFlags('validEnvironment')
    expect(outputMock.info()).toMatchInlineSnapshot(`
      "Using applicable flags from the environment validEnvironment:

      • someString = stringy
      • someBoolean = true\n"
    `)
  })

  test('prefers command line arguments to environment settings', async () => {
    // Given
    const outputMock = mockAndCaptureOutput()
    outputMock.clear()

    // When
    await MockCommand.run(['--environment', 'validEnvironment', '--someString', 'cheesy'])

    // Then
    expect(testResult.someString).toEqual('cheesy')
    expect(outputMock.info()).toMatchInlineSnapshot(`
      "Using applicable flags from the environment validEnvironment:

      • someBoolean = true\n"
    `)
  })

  test('ignores the specified environment when it does not exist', async () => {
    // When
    await MockCommand.run(['--environment', 'nonexistentEnvironment'])

    // Then
    expect(testResult).toEqual({
      environment: 'nonexistentEnvironment',
      someStringWithDefault: 'default stringy',
    })
  })

  test('does not apply flags irrelevant to the current command', async () => {
    // When
    await MockCommand.run(['--environment', 'validEnvironmentWithIrrelevantFlag'])

    // Then
    expect(testResult).toEqual({
      environment: 'validEnvironmentWithIrrelevantFlag',
      ...validEnvironment,
      someStringWithDefault: 'default stringy',
    })
  })

  test('throws when an argument of the incorrect type is provided', async () => {
    // When
    await MockCommand.run(['--environment', 'environmentWithIncorrectType'])

    // Then
    expect(testError?.message).toEqual('Expected an integer but received: stringy')
  })

  test('throws when exclusive arguments are provided', async () => {
    // When
    await MockCommand.run(['--environment', 'environmentWithExclusiveArguments'])

    // Then
    expect(testError?.message).toMatch('--someBoolean= cannot also be provided when using --someExclusiveString')
  })

  test('throws on negated booleans', async () => {
    // When
    await MockCommand.run(['--environment', 'environmentWithNegativeBoolean'])

    // Then
    expect(testError?.message).toMatch(
      /Environments can only specify true for boolean flags\. Attempted to set .+someBoolean.+ to false\./,
    )
  })

  test('handles multiples correctly', async () => {
    // When
    await MockCommand.run(['--environment', 'environmentWithMultiples'])

    // Then
    expectFlags('environmentWithMultiples')
  })

  test(
    'throws when exclusive arguments are provided when combining command line + environment',
    async () => {
      // When
      await MockCommand.run(['--environment', 'validEnvironment', '--someExclusiveString', 'stringy'])

      // Then
      expect(testError?.message).toMatch('--someBoolean= cannot also be provided when using --someExclusiveString')
    },
  )

  test('reports environment settings that do not match defaults', async () => {
    // Given
    const outputMock = mockAndCaptureOutput()
    outputMock.clear()

    // When
    await MockCommand.run(['--environment', 'environmentWithDefaultOverride'])

    // Then
    expectFlags('environmentWithDefaultOverride')
    expect(outputMock.info()).toMatchInlineSnapshot(`
      "Using applicable flags from the environment environmentWithDefaultOverride:

      • someStringWithDefault = non-default stringy\n"
    `)
  })

  test('reports environment settings that match defaults', async () => {
    // Given
    const outputMock = mockAndCaptureOutput()
    outputMock.clear()

    // When
    await MockCommand.run(['--environment', 'environmentMatchingDefault'])

    // Then
    expectFlags('environmentMatchingDefault')
    expect(outputMock.info()).toMatchInlineSnapshot(`
      "Using applicable flags from the environment environmentMatchingDefault:

      • someStringWithDefault = default stringy\n"
    `)
  })
})
