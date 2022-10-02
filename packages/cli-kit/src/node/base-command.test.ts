import Command from './base-command.js'
import {globalFlags} from '../cli.js'
import {mkTmpDir, rmdir, write as writeFile} from '../file.js'
import {encode as encodeTOML} from '../toml.js'
import {join as pathJoin, resolve as resolvePath} from '../path.js'
import {afterEach, beforeEach, describe, expect, test} from 'vitest'
import {Flags} from '@oclif/core'

let testResult: {[flag: string]: unknown} = {}
let testError: Error | undefined

class MockCommand extends Command {
  static flags = {
    ...globalFlags,
    path: Flags.string({
      parse: (input, _) => Promise.resolve(resolvePath(input)),
      default: '.',
    }),
    someString: Flags.string({}),
    someInteger: Flags.integer({}),
    someBoolean: Flags.boolean({
      allowNo: true,
    }),
    someExclusiveBoolean: Flags.boolean({
      exclusive: ['someBoolean'],
    })
  }

  async presetsPath(rawFlags: {path?: string}): Promise<string> {
    return rawFlags.path ? rawFlags.path : process.cwd()
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(MockCommand)
    testResult = flags
  }

  async catch(error: Error): Promise<void> {
    testError = error
  }
}

const validPreset = {
  someString: 'stringy',
  someBoolean: true,
}

const validPresetWithIrrelevantFlag = {
  ...validPreset,
  irrelevantString: 'stringy',
}

const presetWithIncorrectType = {
  someInteger: 'stringy',
}

const presetWithExclusiveArguments = {
  someBoolean: true,
  someExclusiveBoolean: false,
}

const presetWithNegativeBoolean = {
  someBoolean: false,
}

describe('applying presets', async () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await mkTmpDir()
    await writeFile(pathJoin(tmpDir, 'shopify.presets.toml'), encodeTOML({
      validPreset,
      validPresetWithIrrelevantFlag,
      presetWithIncorrectType,
      presetWithExclusiveArguments,
      presetWithNegativeBoolean,
    }))
  })

  afterEach(async () => {
    if (tmpDir) {
      await rmdir(tmpDir)
    }
    testResult = {}
    testError = undefined
  })

  test('does not apply a preset when none is specified', async () => {
    // When
    await MockCommand.run(['--path', tmpDir])

    // Then
    expect(testResult).toEqual({path: resolvePath(tmpDir)})
  })

  test('applies a preset when one is specified', async () => {
    // When
    await MockCommand.run(['--path', tmpDir, '--preset', 'validPreset'])

    // Then
    expect(testResult).toEqual({
      path: resolvePath(tmpDir),
      preset: 'validPreset',
      ...validPreset,
    })
  })

  test('prefers command line arguments to preset settings', async () => {
    // When
    await MockCommand.run(['--path', tmpDir, '--preset', 'validPreset', '--someString', 'cheesy'])

    // Then
    expect(testResult.someString).toEqual('cheesy')
  })

  test('ignores the specified preset when it does not exist', async () => {
    // When
    await MockCommand.run(['--path', tmpDir, '--preset', 'nonexistentPreset'])

    // Then
    expect(testResult).toEqual({
      path: resolvePath(tmpDir),
      preset: 'nonexistentPreset',
    })
  })

  test('does not apply flags irrelevant to the current command', async () => {
    // When
    await MockCommand.run(['--path', tmpDir, '--preset', 'validPresetWithIrrelevantFlag'])

    // Then
    expect(testResult).toEqual({
      path: resolvePath(tmpDir),
      preset: 'validPresetWithIrrelevantFlag',
      ...validPreset,
    })
  })

  test('throws when an argument of the incorrect type is provided', async () => {
    // When
    await MockCommand.run(['--path', tmpDir, '--preset', 'presetWithIncorrectType'])

    // Then
    expect(testError?.message).toEqual('Expected an integer but received: stringy')
  })

  test('throws when exclusive arguments are provided', async () => {
    // When
    await MockCommand.run(['--path', tmpDir, '--preset', 'presetWithExclusiveArguments'])

    // Then
    expect(testError?.message).toMatch('Unexpected argument: --no-someExclusiveBoolean')
  })

  test('negates booleans correctly', async () => {
    // When
    await MockCommand.run(['--path', tmpDir, '--preset', 'presetWithNegativeBoolean'])

    //Then
    expect(testResult).toEqual({
      path: resolvePath(tmpDir),
      preset: 'presetWithNegativeBoolean',
      someBoolean: false,
    })
  })

  test('throws when exclusive arguments are provided when combining command line + preset', async () => {
    // When
    await MockCommand.run(['--path', tmpDir, '--preset', 'validPreset', '--someExclusiveBoolean'])

    // Then
    expect(testError?.message).toMatch('--someBoolean= cannot also be provided when using --someExclusiveBoolean=')
  })
})
