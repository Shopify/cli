/**
 * Parity tests for non-config AppModule implementations.
 * Validates that AppModule.encode() produces identical output to the old spec.deployConfig().
 */

import {checkoutPostPurchaseModule} from './checkout-post-purchase.js'
import {functionModule} from './function.js'
import {uiExtensionModule} from './ui-extension.js'
import checkoutPostPurchaseSpec from '../../extensions/specifications/checkout_post_purchase.js'
import functionSpec from '../../extensions/specifications/function.js'
import uiExtensionSpec from '../../extensions/specifications/ui_extension.js'
import {placeholderAppConfiguration} from '../app.test-data.js'
import {describe, test, expect, vi} from 'vitest'

vi.mock('@shopify/cli-kit/node/fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@shopify/cli-kit/node/fs')>()
  return {
    ...actual,
    fileExists: vi.fn().mockResolvedValue(false),
  }
})

vi.mock('@shopify/cli-kit/node/crypto', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@shopify/cli-kit/node/crypto')>()
  return {
    ...actual,
    randomUUID: vi.fn().mockReturnValue('deterministic-uuid'),
  }
})

vi.mock('../../../utilities/extensions/locales-configuration.js', () => ({
  loadLocalesConfig: vi.fn().mockResolvedValue({}),
}))

const encodeCtx = {
  appConfiguration: placeholderAppConfiguration,
  directory: '/tmp/test-extension',
  apiKey: 'test-api-key',
}

// ============================================================================
// checkout_post_purchase -- trivial encode
// ============================================================================

describe('CheckoutPostPurchaseModule encode parity', () => {
  test('with metafields', async () => {
    const config = {
      name: 'my-post-purchase',
      type: 'checkout_post_purchase',
      metafields: [{namespace: 'my-namespace', key: 'my-key'}],
    }

    const newResult = await checkoutPostPurchaseModule.encode(config, encodeCtx)
    const oldResult = await checkoutPostPurchaseSpec.deployConfig!(
      config,
      encodeCtx.directory,
      encodeCtx.apiKey,
      undefined,
    )

    expect(newResult).toEqual(oldResult)
  })

  test('without metafields (defaults to empty array)', async () => {
    const config = {
      name: 'my-post-purchase',
      type: 'checkout_post_purchase',
    }

    const newResult = await checkoutPostPurchaseModule.encode(config, encodeCtx)
    const oldResult = await checkoutPostPurchaseSpec.deployConfig!(
      config,
      encodeCtx.directory,
      encodeCtx.apiKey,
      undefined,
    )

    expect(newResult).toEqual(oldResult)
  })
})

// ============================================================================
// function -- async file I/O, UUID generation, field restructuring
// ============================================================================

describe('FunctionModule encode parity', () => {
  test('basic function config (no file I/O)', async () => {
    const config = {
      name: 'my-function',
      type: 'order_discounts',
      description: 'My discount function',
      api_version: '2024-01',
      configuration_ui: true,
    }

    const newResult = await functionModule.encode(config, encodeCtx)
    const oldResult = await functionSpec.deployConfig!(config, encodeCtx.directory, encodeCtx.apiKey, undefined)

    expect(newResult).toEqual(oldResult)
  })

  test('function with UI config', async () => {
    const config = {
      name: 'my-function',
      type: 'cart_transform',
      api_version: '2024-01',
      configuration_ui: true,
      ui: {
        paths: {
          create: '/create',
          details: '/details',
        },
        handle: 'my-ui-handle',
        enable_create: false,
      },
      input: {
        variables: {namespace: 'my-ns', key: 'my-key'},
      },
    }

    const newResult = await functionModule.encode(config, encodeCtx)
    const oldResult = await functionSpec.deployConfig!(config, encodeCtx.directory, encodeCtx.apiKey, undefined)

    expect(newResult).toEqual(oldResult)
  })
})

// ============================================================================
// ui_extension -- dist path prefixing + localization
// ============================================================================

describe('UIExtensionModule encode parity', () => {
  test('with extension points', async () => {
    const config = {
      name: 'my-ui-ext',
      type: 'ui_extension',
      api_version: '2024-01',
      extension_points: [
        {
          target: 'admin.product-details.block.render',
          module: './src/index.tsx',
          build_manifest: {
            assets: {
              main: {filepath: 'src/index.tsx', module: './src/index.tsx'},
            },
          },
        },
      ],
      capabilities: {network_access: true},
      settings: {fields: []},
    }

    const newResult = await uiExtensionModule.encode(config, encodeCtx)
    const oldResult = await uiExtensionSpec.deployConfig!(
      config as any,
      encodeCtx.directory,
      encodeCtx.apiKey,
      undefined,
    )

    expect(newResult).toEqual(oldResult)
  })

  test('without extension points', async () => {
    const config = {
      name: 'my-ui-ext',
      type: 'ui_extension',
    }

    const newResult = await uiExtensionModule.encode(config, encodeCtx)
    const oldResult = await uiExtensionSpec.deployConfig!(
      config as any,
      encodeCtx.directory,
      encodeCtx.apiKey,
      undefined,
    )

    expect(newResult).toEqual(oldResult)
  })
})
