import {POS_INTERCEPT_EVENTS} from './pos_ui_extension.js'
import * as appModule from '../../app/app.js'
import {ExtensionInstance} from '../extension-instance.js'
import {loadLocalExtensionsSpecifications} from '../load-specifications.js'
import {placeholderAppConfiguration} from '../../app/app.test-data.js'
import {inTemporaryDirectory} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {describe, expect, test, vi} from 'vitest'

describe('pos_ui_extension', async () => {
  const allSpecs = await loadLocalExtensionsSpecifications()
  const specification = allSpecs.find((spec) => spec.identifier === 'pos_ui_extension')!

  interface ParsedPosUIConfig {
    state: 'ok' | 'error'
    data?: {intercepts?: {event: string; block_progress: boolean}[]}
    errors?: {message: string}[]
  }

  function parse(configuration: Record<string, unknown>): ParsedPosUIConfig {
    return specification.parseConfigurationObject({
      type: 'pos_ui_extension',
      name: 'My POS Extension',
      ...configuration,
    }) as ParsedPosUIConfig
  }

  async function getTestPosUIExtension(directory: string, configuration: Record<string, unknown> = {}) {
    const configurationPath = joinPath(directory, 'shopify.extension.toml')
    const parsed = specification.parseConfigurationObject({
      type: 'pos_ui_extension',
      name: 'My POS Extension',
      ...configuration,
    })
    if (parsed.state !== 'ok') {
      throw new Error(`Couldn't parse configuration: ${JSON.stringify(parsed.errors)}`)
    }

    return new ExtensionInstance({
      configuration: parsed.data,
      directory,
      specification,
      configurationPath,
      entryPath: '',
    })
  }

  test('has the correct identifier', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const extension = await getTestPosUIExtension(tmpDir)
      expect(extension.specification.identifier).toBe('pos_ui_extension')
    })
  })

  describe('intercepts schema', () => {
    test('parses when no intercepts are declared', () => {
      const parsed = parse({})
      expect(parsed.state).toBe('ok')
      expect(parsed.data?.intercepts).toBeUndefined()
    })

    test('parses valid intercept declarations', () => {
      const parsed = parse({
        intercepts: [
          {event: 'beforecheckout', block_progress: true},
          {event: 'beforepayment', block_progress: false},
        ],
      })

      expect(parsed.state).toBe('ok')
      expect(parsed.data?.intercepts).toEqual([
        {event: 'beforecheckout', block_progress: true},
        {event: 'beforepayment', block_progress: false},
      ])
    })

    test('defaults block_progress to false when omitted', () => {
      const parsed = parse({
        intercepts: [{event: 'beforecheckout'}],
      })

      expect(parsed.state).toBe('ok')
      expect(parsed.data?.intercepts).toEqual([{event: 'beforecheckout', block_progress: false}])
    })

    test('rejects an unknown intercept event', () => {
      const parsed = parse({
        intercepts: [{event: 'notarealevent'}],
      })

      expect(parsed.state).toBe('error')
      expect(parsed.errors?.[0]?.message).toContain(
        `Intercept event must be one of: ${POS_INTERCEPT_EVENTS.join(', ')}`,
      )
    })

    test('rejects a non-boolean block_progress', () => {
      const parsed = parse({
        intercepts: [{event: 'beforecheckout', block_progress: 'yes'}],
      })

      expect(parsed.state).toBe('error')
    })

    test('rejects duplicate intercept events', () => {
      const parsed = parse({
        intercepts: [
          {event: 'beforecheckout', block_progress: true},
          {event: 'beforecheckout', block_progress: false},
        ],
      })

      expect(parsed.state).toBe('error')
      expect(parsed.errors?.[0]?.message).toContain('Duplicate intercept events found: beforecheckout')
    })
  })

  describe('deployConfig()', () => {
    test('includes intercepts in the deploy config', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        vi.spyOn(appModule, 'getDependencyVersion').mockResolvedValue({name: 'name', version: '1.2.3'})

        const extension = await getTestPosUIExtension(tmpDir, {
          intercepts: [{event: 'beforecheckout', block_progress: true}],
        })

        const deployConfig = await extension.deployConfig({
          apiKey: 'apiKey',
          appConfiguration: placeholderAppConfiguration,
        })

        expect(deployConfig).toMatchObject({
          name: 'My POS Extension',
          renderer_version: '1.2.3',
          intercepts: [{event: 'beforecheckout', block_progress: true}],
        })
      })
    })

    test('omits intercepts when none are declared', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        vi.spyOn(appModule, 'getDependencyVersion').mockResolvedValue({name: 'name', version: '1.2.3'})

        const extension = await getTestPosUIExtension(tmpDir)

        const deployConfig = await extension.deployConfig({
          apiKey: 'apiKey',
          appConfiguration: placeholderAppConfiguration,
        })

        expect(deployConfig?.intercepts).toBeUndefined()
      })
    })
  })
})
