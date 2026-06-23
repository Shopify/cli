import gatherPublicMetadata from './public_metadata.js'
import {localAppContext} from '../services/app-context.js'
import metadata from '../metadata.js'
import {describe, expect, test, vi, beforeEach} from 'vitest'
import {cwd} from '@shopify/cli-kit/node/path'

vi.mock('../services/app-context.js')
vi.mock('@shopify/cli-kit/node/path')

describe('gatherPublicMetadata', () => {
  beforeEach(() => {
    vi.mocked(cwd).mockReturnValue('/some/app/dir')
    vi.mocked(localAppContext).mockResolvedValue({} as Awaited<ReturnType<typeof localAppContext>>)
  })

  test('opportunistically enriches metadata from the current directory and returns the public metadata', async () => {
    // Given
    vi.spyOn(metadata, 'getAllPublicMetadata').mockReturnValueOnce({}).mockReturnValue({api_key: 'from-loader'})

    // When
    const result = await (gatherPublicMetadata as () => Promise<unknown>)()

    // Then
    expect(localAppContext).toHaveBeenCalledWith({directory: '/some/app/dir', skipPrompts: true})
    expect(result).toEqual(metadata.getAllPublicMetadata())
  })

  test('skips local app loading when api_key is already set', async () => {
    // Given
    vi.spyOn(metadata, 'getAllPublicMetadata').mockReturnValue({api_key: 'already-set'})

    // When
    const result = await (gatherPublicMetadata as () => Promise<unknown>)()

    // Then
    expect(localAppContext).not.toHaveBeenCalled()
    expect(result).toEqual(metadata.getAllPublicMetadata())
  })

  test('still returns metadata when best-effort app loading fails', async () => {
    // Given
    vi.spyOn(metadata, 'getAllPublicMetadata').mockReturnValue({})
    vi.mocked(localAppContext).mockRejectedValue(new Error('not an app'))

    // When
    const result = await (gatherPublicMetadata as () => Promise<unknown>)()

    // Then
    expect(localAppContext).toHaveBeenCalledOnce()
    expect(result).toEqual(metadata.getAllPublicMetadata())
  })
})
