import spec from './channel.js'
import {describe, expect, test} from 'vitest'

const SUBDIRECTORY = 'specifications'

describe('channel_config', () => {
  describe('clientSteps', () => {
    test('uses copy_files mode', () => {
      expect(spec.buildConfig.mode).toBe('copy_files')
    })

    test('has a single copy-files step scoped to the specifications subdirectory', () => {
      expect(spec.clientSteps![0]!.steps).toHaveLength(1)
      expect(spec.clientSteps![0]!.steps[0]).toMatchObject({
        id: 'copy-files',
        type: 'include_assets',
        config: {
          inclusions: [{type: 'pattern', baseDir: SUBDIRECTORY, destination: SUBDIRECTORY}],
        },
      })

      const {include} = (spec.clientSteps![0]!.steps[0]!.config as {inclusions: [{include: string[]}]}).inclusions[0]

      expect(include).toEqual(expect.arrayContaining(['**/*.json', '**/*.toml', '**/*.yaml', '**/*.yml', '**/*.svg']))
    })

    test('config is serializable to JSON', () => {
      const serialized = JSON.stringify(spec.clientSteps!)
      const deserialized = JSON.parse(serialized)

      expect(deserialized[0].steps).toHaveLength(1)
      expect(deserialized[0].steps[0].config.inclusions[0].type).toBe('pattern')
    })
  })
})
