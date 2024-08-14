import {Replay} from './Replay.js'
import {testFunctionExtension, testApp} from '../../../../models/app/app.test-data.js'
import {ExtensionInstance} from '../../../../models/extensions/extension-instance.js'
import {FunctionConfigType} from '../../../../models/extensions/specifications/function.js'
import {render} from '@shopify/cli-kit/node/testing/ui'
import {AbortController} from '@shopify/cli-kit/node/abort'
import React from 'react'
import {beforeAll, describe, expect, test} from 'vitest'
import {unstyled} from '@shopify/cli-kit/node/output'

const defaultConfig = {
  name: 'MyFunction',
  type: 'product_discounts',
  build: {
    command: 'make build',
    path: 'dist/index.wasm',
  },
  configuration_ui: true,
  api_version: '2022-07',
  metafields: [],
  handle: 'function-handle',
}

let extension: ExtensionInstance<FunctionConfigType>

beforeAll(async () => {
  extension = await testFunctionExtension({config: defaultConfig})
})

describe('Replay', () => {
  test('renders a stream of lines from function-runner output, and shortcuts', async () => {
    // Given

    const selectedRun = {
      shopId: 69665030382,
      apiClientId: 124042444801,
      payload: {
        export: 'run',
        input: {
          cart: {
            lines: [
              {
                quantity: 3,
                merchandise: {
                  typename: 'ProductVariant',
                  id: 'gid://shopify/ProductVariant/45334064595182',
                },
              },
            ],
          },
        },
        inputBytes: 136,
        output: {
          discountApplicationStrategy: 'FIRST',
          discounts: [
            {
              message: '10% off',
              value: {
                percentage: {
                  value: 10,
                },
              },
              targets: [
                {
                  productVariant: {
                    id: 'gid://shopify/ProductVariant/45334064595182',
                  },
                },
              ],
            },
          ],
        },
        outputBytes: 195,
        logs: 'First Log\nLog the second!,\n1,\nfourth line, length should be above!,\nFifth line!',
        functionId: '34236fa9-42f5-4bb6-adaf-956e12fff0b0',
        fuelConsumed: 532632,
      },
      logType: 'function_run',
      cursor: '2024-08-02T17:45:27.683139Z',
      status: 'success',
      source: 'product-discount',
      sourceNamespace: 'extensions',
      logTimestamp: '2024-08-02T17:45:27.382075Z',
      identifier: '123456',
    }

    const renderInstanceReplay = render(
      <Replay
        selectedRun={selectedRun}
        abortController={new AbortController()}
        app={testApp()}
        extension={extension}
      />,
    )

    // await frontendPromise

    // Then
    expect(unstyled(renderInstanceReplay.lastFrame()!.replace(/\d/g, '0'))).toMatchInlineSnapshot(`
      "
      ────────────────────────────────────────────────────────────────────────────────────────────────────

      › Watching for changes to product-discount...
      › Instruction count delta: 0
      › Press q │ quit
      "
    `)

    // unmount so that polling is cleared after every test
    renderInstanceReplay.unmount()
  })
})
