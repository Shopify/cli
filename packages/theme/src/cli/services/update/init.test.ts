import {init} from './init.js'
import {test, describe, expect, vi} from 'vitest'
import {renderSuccess} from '@shopify/cli-kit/node/ui'
import {AbortError} from '@shopify/cli-kit/node/error'
import {fileExists, writeFile} from '@shopify/cli-kit/node/fs'

vi.mock('@shopify/cli-kit/node/ui')
vi.mock('@shopify/cli-kit/node/error')
vi.mock('@shopify/cli-kit/node/fs')

describe('init', () => {
  test('when file cannot be created', async () => {
    // Given
    vi.mocked(writeFile).mockRejectedValue(new Error('Invalid path'))

    // When
    const got = init(undefined)

    // Then
    await expect(got).rejects.toThrowError(AbortError)
  })

  test('when file already exists', async () => {
    // Given
    vi.mocked(fileExists).mockResolvedValue(true)

    // When
    const got = init(undefined)

    // Then
    await expect(got).rejects.toThrowError(AbortError)
  })

  test('when file is successfully created', async () => {
    // Given
    const path = '/tmp/dawn'

    // When
    await init(path)

    // Then
    expect(writeFile).toBeCalledWith('/tmp/dawn/update_extension.json', expect.any(String))

    expect(renderSuccess).toBeCalledWith({
      body: [`The '/tmp/dawn/update_extension.json' script has been created.`],
    })
  })
})
