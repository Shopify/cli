import {createExtension} from './create-extension'
import {api} from '@shopify/cli-kit'
import {beforeEach, describe, expect, it, vi} from 'vitest'

const EXTENSION = {
  id: '1',
  uuid: 'aa',
  title: 'extension1',
  type: 'checkout_post_purchase',
  draftVerstion: {
    registrationId: '123',
    lastUserInteractionAt: '2022-05-18T07:47:48-04:00',
    validationErrors: [
      {
        field: [],
        message: '',
      },
    ],
  },
}

beforeEach(() => {
  vi.mock('@shopify/cli-kit', async () => {
    const cliKit: any = await vi.importActual('@shopify/cli-kit')
    return {
      ...cliKit,
      api: {
        partners: {
          request: vi.fn(),
        },
        graphql: cliKit.api.graphql,
      },
    }
  })
})

describe('createApp', () => {
  it('sends request to create extension and returns it', async () => {
    // Given
    vi.mocked(api.partners.request).mockResolvedValueOnce({
      extensionCreate: {extensionRegistration: EXTENSION, userErrors: null},
    })

    const variables = {
      apiKey: '123',
      type: 'CHECKOUT_POST_PURCHASE',
      title: 'my-ext',
      config: '{}',
      context: '',
    }

    // When
    const got = await createExtension('123', 'checkout_post_purchase', 'my-ext', 'token')

    // Then
    expect(got).toEqual(EXTENSION)
    expect(api.partners.request).toHaveBeenCalledWith(api.graphql.ExtensionCreateQuery, 'token', variables)
  })
})
