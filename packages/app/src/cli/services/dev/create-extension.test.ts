import {createExtension} from './create-extension.js'
import {ExtensionCreateQuery} from '../../api/graphql/extension_create.js'
import {describe, expect, vi, test} from 'vitest'
import {partnersRequest} from '@shopify/cli-kit/node/api/partners'

vi.mock('@shopify/cli-kit/node/api/partners')

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

describe('createApp', () => {
  test('sends request to create extension and returns it', async () => {
    // Given
    vi.mocked(partnersRequest).mockResolvedValueOnce({
      extensionCreate: {extensionRegistration: EXTENSION, userErrors: null},
    })

    const variables = {
      apiKey: '123',
      type: 'CHECKOUT_POST_PURCHASE',
      title: 'my-ext',
      config: '{}',
      context: null,
      handle: 'my-ext',
    }

    // When
    const got = await createExtension('123', 'CHECKOUT_POST_PURCHASE', 'my-ext', 'token')

    // Then
    expect(got).toEqual(EXTENSION)
    expect(partnersRequest).toHaveBeenCalledWith(ExtensionCreateQuery, 'token', variables)
  })
})
