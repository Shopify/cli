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

const urlFields = ['runtime_url', 'validation_url', 'config_page_url', 'config_page_preview_url'] as const

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

  test.each(urlFields)('rejects a relative %s containing a newline', (field) => {
    // When
    const parsed = extension.specification.parseConfigurationObject({
      ...config,
      [field]: `/${field}\nmalicious-header: value`,
    })

    // Then
    expect(parsed.state).toBe('error')
  })

  test('preserves absolute URLs and prepends the app URL to relative URLs in the deploy configuration', async () => {
    // Given
    extension.configuration = {
      ...extension.configuration,
      runtime_url: '/api/execute',
      validation_url: 'https://my-app.example.com/api/validate',
      config_page_url: '/config',
      config_page_preview_url: 'https://my-app.example.com/config/preview',
    }

    // When
    const got = await extension.deployConfig({
      apiKey: 'api-key',
      appConfiguration: {
        ...placeholderAppConfiguration,
        application_url: 'https://my-app.example.com',
      },
    })

    // Then
    expect(got).toEqual({
      title: extension.configuration.name,
      description: extension.configuration.description,
      url: 'https://my-app.example.com/api/execute',
      fields: [],
      validation_url: 'https://my-app.example.com/api/validate',
      custom_configuration_page_url: 'https://my-app.example.com/config',
      custom_configuration_page_preview_url: 'https://my-app.example.com/config/preview',
      schema_patch: '',
      return_type_ref: undefined,
    })
  })

  test.each(urlFields)('throws when deploying a relative %s without an app URL', async (field) => {
    // Given
    extension.configuration = {
      ...extension.configuration,
      runtime_url: 'https://my-prod-host.example.com/api/execute',
      validation_url: 'https://my-prod-host.example.com/api/validate',
      config_page_url: 'https://my-prod-host.example.com/config',
      config_page_preview_url: 'https://my-prod-host.example.com/config/preview',
    }
    extension.configuration[field] = `/${field}`

    // When/Then
    await expect(
      extension.deployConfig({
        apiKey: 'api-key',
        appConfiguration: placeholderAppConfiguration,
      }),
    ).rejects.toThrow(
      `Flow action ${field} is a relative URL, but no application_url is configured. Set application_url in your app configuration or use an absolute HTTPS URL.`,
    )
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
