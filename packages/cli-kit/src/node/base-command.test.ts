import Command from './base-command.js'
import {globalFlags} from '../cli.js'
import {mkTmpDir, rmdir, write as writeFile} from '../file.js'
import {encode as encodeTOML} from '../toml.js'
import {join as pathJoin, resolve as resolvePath} from '../path.js'
import {afterEach, beforeEach, describe, expect, test} from 'vitest'
import {Flags} from '@oclif/core'

let testResult: {[flag: string]: unknown} = {}

class MockCommand extends Command {
  static flags = {
    ...globalFlags,
    path: Flags.string({
      parse: (input, _) => Promise.resolve(resolvePath(input)),
      default: '.',
    }),
    someString: Flags.string({
    }),
  }

  async presetsPath(rawFlags: {path?: string}): Promise<string> {
    return rawFlags.path ? rawFlags.path : process.cwd()
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(MockCommand)
    testResult = flags
  }
}

const validPreset = {
  someString: 'stringy',
}

const validPresetWithIrrelevantFlag = {
  ...validPreset,
  irrelevantString: 'stringy',
}

describe('applying presets', async () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await mkTmpDir()
    await writeFile(pathJoin(tmpDir, 'shopify.presets.toml'), encodeTOML({
      validPreset,
      validPresetWithIrrelevantFlag,
    }))
  })

  afterEach(async () => {
    if (tmpDir) {
      await rmdir(tmpDir)
    }
    testResult = {}
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
})
