import * as presets from './presets.js'
import {inTemporaryDirectory, mkdir, write as fileWrite} from './file.js'
import {join as pathJoin} from './path.js'
import {encode as tomlEncode} from './toml.js'
import {describe, expect, test} from 'vitest'

describe('loading presets', async () => {
  test('returns empty array when no presets file exists', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      expect(await presets.load(tmpDir)).toEqual({})
    })
  })

  test('returns available presets when they exist', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const preset1 = {
        flag1: 'value',
        flag2: true,
        flag3: 0,
        flag4: ['hello', 'world']
      }
      const preset2 = {
        flag1: 'value2',
        flag2: false,
        flag3: 1,
        flag4: ['goodbye', 'world']
      }
      await fileWrite(`${tmpDir}/shopify.presets.toml`, tomlEncode({preset1, preset2}))
      expect(await presets.load(tmpDir)).toEqual({preset1, preset2})
    })
  })

  test('does not search upwards for presets when no file exists and searching up is disabled', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const preset1 = {flag1: 'value'}
      await fileWrite(`${tmpDir}/shopify.presets.toml`, tomlEncode({preset1}))
      const subdir = pathJoin(tmpDir, 'subdir')
      await mkdir(subdir)
      expect(await presets.load(subdir)).toEqual({})
    })
  })

  test('searches upwards for presets when no file exists and searching up is enabled', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const preset1 = {flag1: 'value'}
      await fileWrite(`${tmpDir}/shopify.presets.toml`, tomlEncode({preset1}))
      const subdir = pathJoin(tmpDir, 'subdir')
      await mkdir(subdir)
      expect(await presets.load(subdir, {findUp: true})).toEqual({preset1})
    })
  })
})
