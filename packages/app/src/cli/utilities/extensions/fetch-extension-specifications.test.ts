import {fetchExtensionSpecifications} from './fetch-extension-specifications.js'
import {describe, expect, it, vi} from 'vitest'
import {api} from '@shopify/cli-kit'

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

describe('fetchExtensionSpecifications', () => {
  it('returns the filtered and mapped results', async () => {
    // Given
    vi.mocked(api.partners.request).mockResolvedValue({extensionSpecifications: rawResponse})

    // When
    const got = await fetchExtensionSpecifications('token', 'apiKey')

    // Then
    expect(got).toEqual(expectedResult)
  })
})

const expectedResult = [
  {
    name: 'Checkout Post Purchase',
    externalName: 'Post-purchase UI',
    identifier: 'checkout_post_purchase',
    externalIdentifier: 'post_purchase_ui',
    gated: false,
    options: {
      managementExperience: 'cli',
      registrationLimit: 1,
    },
    features: {
      argo: {
        surface: 'checkout',
      },
    },
  },
  {
    name: 'Online Store - App Theme Extension',
    externalName: 'Theme App Extension',
    identifier: 'theme',
    externalIdentifier: 'theme_app_extension',
    gated: false,
    options: {
      managementExperience: 'cli',
      registrationLimit: 1,
    },
    features: {
      argo: null,
    },
  },
  {
    name: 'Product Subscription',
    externalName: 'Subscription UI',
    identifier: 'product_subscription',
    externalIdentifier: 'subscription_ui',
    gated: false,
    options: {
      managementExperience: 'cli',
      registrationLimit: 1,
    },
    features: {
      argo: {
        surface: 'admin',
      },
    },
  },
]

const rawResponse = [
  {
    name: 'Checkout Post Purchase',
    externalName: 'Post-purchase UI',
    identifier: 'checkout_post_purchase',
    externalIdentifier: 'post_purchase_ui',
    gated: false,
    options: {
      managementExperience: 'cli',
      registrationLimit: 1,
    },
    features: {
      argo: {
        surface: 'checkout',
      },
    },
  },
  {
    name: 'Marketing Activity',
    externalName: 'Marketing Activity',
    identifier: 'marketing_activity_extension',
    externalIdentifier: 'marketing_activity_extension',
    gated: false,
    options: {
      managementExperience: 'dashboard',
      registrationLimit: 100,
    },
    features: {
      argo: null,
    },
  },
  {
    name: 'Online Store - App Theme Extension',
    externalName: 'Theme App Extension',
    identifier: 'theme_app_extension',
    externalIdentifier: 'theme_app_extension',
    gated: false,
    options: {
      managementExperience: 'cli',
      registrationLimit: 1,
    },
    features: {
      argo: null,
    },
  },
  {
    name: 'Product Subscription',
    externalName: 'Subscription UI',
    identifier: 'subscription_management',
    externalIdentifier: 'subscription_ui',
    gated: false,
    options: {
      managementExperience: 'cli',
      registrationLimit: 1,
    },
    features: {
      argo: {
        surface: 'admin',
      },
    },
  },
]
