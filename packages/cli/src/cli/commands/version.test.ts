import Version from './version.js'
import {versionJsonOutputSchema} from '../services/commands/version/types.js'
import {CLI_KIT_VERSION} from '@shopify/cli-kit/common/version'
import {launchCLI} from '@shopify/cli-kit/node/cli-launcher'
import {mockAndCaptureOutput, withCapturedStandardStreams} from '@shopify/cli-kit/node/testing/output'
import {afterEach, beforeEach, describe, expect, test, vi} from 'vitest'

beforeEach(() => {
  // Capturing real output disables unit-test mode; keep notifications disabled too.
  vi.stubEnv('CI', '1')
})

afterEach(() => {
  vi.unstubAllEnvs()
  mockAndCaptureOutput().clear()
})

describe('version command', () => {
  test('writes the installed version without stderr output', async () => {
    await withCapturedStandardStreams(async ({stdout, stderr}) => {
      await Version.run([], import.meta.url)

      expect(stdout()).toBe(`${CLI_KIT_VERSION}\n`)
      expect(stderr()).toBe('')
    })
  })

  test('writes the installed version as JSON without stderr output', async () => {
    await withCapturedStandardStreams(async ({stdout, stderr}) => {
      await Version.run(['--json'], import.meta.url)

      expect(stdout()).toBe(`${JSON.stringify({version: CLI_KIT_VERSION}, null, 2)}\n`)
      expect(JSON.parse(stdout())).toEqual({version: CLI_KIT_VERSION})
      expect(stderr()).toBe('')
    })
  })

  test('exposes the object schema and JSON flags in help', () => {
    expect(Version.jsonOutputSchema).toBe(versionJsonOutputSchema)
    expect(Version.flags.json).toBeDefined()
    expect(Version.description).toContain('Output from `--json` conforms to the `VersionResult` schema.')
    expect(Version.description).toContain('"type": "object"')
  })

  test('writes a schema with an object result without stderr output', async () => {
    await withCapturedStandardStreams(async ({stdout, stderr}) => {
      await launchCLI({
        moduleURL: import.meta.url,
        argv: ['version', '--json-schema'],
        lazyCommandLoader: async () => Version,
      })

      expect(stderr()).toBe('')
      const definition = JSON.parse(stdout()).definitions.Result
      expect(definition.type).toBe('object')
      expect(definition.properties.version).toEqual({type: 'string'})
      expect(definition.required).toEqual(['version'])
      expect(definition.additionalProperties).toBe(false)
    })
  })
})
