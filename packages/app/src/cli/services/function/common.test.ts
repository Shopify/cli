import {inFunctionContext} from './common.js'
import {loadApp} from '../../models/app/loader.js'
import {testApp, testFunctionExtension} from '../../models/app/app.test-data.js'
import {AppInterface} from '../../models/app/app.js'
import {ExtensionInstance} from '../../models/extensions/extension-instance.js'
import {describe, vi, expect, beforeEach, test} from 'vitest'
import {renderAutocompletePrompt, renderFatalError} from '@shopify/cli-kit/node/ui'
import {joinPath} from '@shopify/cli-kit/node/path'
import {isTerminalInteractive} from '@shopify/cli-kit/node/context/local'

vi.mock('../../models/app/loader.js')
vi.mock('@shopify/cli-kit/node/ui')
vi.mock('@shopify/cli-kit/node/context/local')

let app: AppInterface
let ourFunction: ExtensionInstance

beforeEach(async () => {
  ourFunction = await testFunctionExtension()
  app = testApp({allExtensions: [ourFunction]})
  vi.mocked(loadApp).mockResolvedValue(app)
  vi.mocked(renderFatalError).mockReturnValue('')
  vi.mocked(renderAutocompletePrompt).mockResolvedValue(ourFunction)
  vi.mocked(isTerminalInteractive).mockReturnValue(true)
})

describe('ensure we are within a function context', () => {
  test('runs callback when we are inside a function directory', async () => {
    // Given
    let ranCallback = false

    // When
    await inFunctionContext({
      path: joinPath(app.directory, 'extensions/my-function'),
      callback: async (_app, _fun) => {
        ranCallback = true
      },
    })

    // Then
    expect(ranCallback).toBe(true)
    expect(renderFatalError).not.toHaveBeenCalled()
  })

  test('displays function prompt when we are not inside a function directory', async () => {
    // Given
    const callback = vi.fn()

    // When
    await inFunctionContext({
      path: 'random/dir',
      callback,
    })

    // Then
    expect(callback).toHaveBeenCalledOnce()
    expect(renderAutocompletePrompt).toHaveBeenCalledOnce()
    expect(renderFatalError).not.toHaveBeenCalled()
  })

  test('displays an error when terminal is not interactive and we are not inside a function directory', async () => {
    // Given
    let ranCallback = false
    vi.mocked(isTerminalInteractive).mockReturnValue(false)

    // When
    await expect(
      inFunctionContext({
        path: 'random/dir',
        callback: async (_app, _fun) => {
          ranCallback = true
        },
      }),
    ).rejects.toThrowError()

    expect(ranCallback).toBe(false)
  })
})
