import {createExtension} from './create-extension.js'
import {extensionCreateResponse, testDeveloperPlatformClient} from '../../models/app/app.test-data.js'
import {describe, expect, test} from 'vitest'

describe('createExtension', () => {
  test('sends request to create extension and returns it', async () => {
    // Given
    const developerPlatformClient = testDeveloperPlatformClient()

    const variables = {
      apiKey: '123',
      type: 'CHECKOUT_POST_PURCHASE',
      title: 'my-ext',
      config: '{}',
      context: null,
      handle: 'my-ext',
    }

    // When
    const got = await createExtension('123', 'CHECKOUT_POST_PURCHASE', 'my-ext', developerPlatformClient)

    // Then
    expect(got).toEqual(extensionCreateResponse.extensionCreate.extensionRegistration)
    expect(developerPlatformClient.createExtension).toHaveBeenCalledWith(variables)
  })

  test('sends request to create extension with context and returns it', async () => {
    // Given
    const developerPlatformClient = testDeveloperPlatformClient()

    const variables = {
      apiKey: '321',
      type: 'PAYMENTS_EXTENSION',
      title: 'my-ext',
      config: '{}',
      context: 'offsite.payments.render',
      handle: 'my-ext',
    }

    // When
    const got = await createExtension(
      '321',
      'PAYMENTS_EXTENSION',
      'my-ext',
      developerPlatformClient,
      'offsite.payments.render',
    )

    // Then
    expect(got).toEqual(extensionCreateResponse.extensionCreate.extensionRegistration)
    expect(developerPlatformClient.createExtension).toHaveBeenCalledWith(variables)
  })
})
