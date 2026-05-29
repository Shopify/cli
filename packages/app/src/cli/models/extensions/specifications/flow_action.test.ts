import {placeholderAppConfiguration, testFlowActionExtension} from '../../app/app.test-data.js'
import {ExtensionInstance} from '../extension-instance.js'
import {BaseConfigType} from '../schemas.js'
import {ApplicationURLs} from '../../../services/dev/urls.js'
import {beforeEach, describe, expect, test} from 'vitest'

type FlowActionConfig = BaseConfigType & {
  type: 'flow_action'
  handle: string
  name: string
  runtime_url: string
  validation_url?: string
  config_page_url?: string
  config_page_preview_url?: string
}

const tunnelUrls: ApplicationURLs = {
  applicationUrl: 'https://my-tunnel.example.com',
  redirectUrlWhitelist: [],
}

describe('FlowActionExtension', () => {
  let extension: ExtensionInstance<FlowActionConfig>

  const config: FlowActionConfig = {
    type: 'flow_action',
    handle: 'place-bid',
    name: 'Place auction bid',
    description: 'Place a bid on an auction',
    runtime_url: '/api/execute',
    validation_url: '/api/validate',
    config_page_url: '/config',
    config_page_preview_url: '/config/preview',
  }

  beforeEach(async () => {
    extension = (await testFlowActionExtension()) as ExtensionInstance<FlowActionConfig>
    extension.configuration = {...config}
  })

  test('accepts an absolute https runtime_url', () => {
    // When
    const parsed = extension.specification.parseConfigurationObject({
      ...config,
      runtime_url: 'https://example.com/api/execute',
    })

    // Then
    expect(parsed.state).toBe('ok')
  })

  test('accepts a relative runtime_url starting with /', () => {
    // When
    const parsed = extension.specification.parseConfigurationObject(config)

    // Then
    expect(parsed.state).toBe('ok')
  })

  test('rejects a non-https absolute runtime_url', () => {
    // When
    const parsed = extension.specification.parseConfigurationObject({
      ...config,
      runtime_url: 'http://example.com/api/execute',
    })

    // Then
    expect(parsed.state).toBe('error')
  })

  test('handles the deploy configuration', async () => {
    // When
    const got = await extension.deployConfig({
      apiKey: 'api-key',
      appConfiguration: placeholderAppConfiguration,
    })

    // Then
    expect(got).toEqual({
      title: extension.configuration.name,
      description: extension.configuration.description,
      url: extension.configuration.runtime_url,
      fields: [],
      validation_url: extension.configuration.validation_url,
      custom_configuration_page_url: extension.configuration.config_page_url,
      custom_configuration_page_preview_url: extension.configuration.config_page_preview_url,
      schema_patch: '',
      return_type_ref: undefined,
    })
  })

  test('prepends the dev application URL to relative URL fields', () => {
    // When
    extension.patchWithAppDevURLs(tunnelUrls)

    // Then
    expect(extension.configuration.runtime_url).toBe('https://my-tunnel.example.com/api/execute')
    expect(extension.configuration.validation_url).toBe('https://my-tunnel.example.com/api/validate')
    expect(extension.configuration.config_page_url).toBe('https://my-tunnel.example.com/config')
    expect(extension.configuration.config_page_preview_url).toBe('https://my-tunnel.example.com/config/preview')
  })

  test('leaves absolute dev URLs untouched', () => {
    // Given
    extension.configuration.runtime_url = 'https://my-prod-host.example.com/api/execute'
    extension.configuration.validation_url = undefined
    extension.configuration.config_page_url = undefined
    extension.configuration.config_page_preview_url = undefined

    // When
    extension.patchWithAppDevURLs(tunnelUrls)

    // Then
    expect(extension.configuration.runtime_url).toBe('https://my-prod-host.example.com/api/execute')
    expect(extension.configuration.validation_url).toBeUndefined()
  })
})
