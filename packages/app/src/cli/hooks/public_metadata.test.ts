import gatherPublicMetadata from './public_metadata.js'
import {logAppContextMetadataIfAuthenticated} from '../services/app-context.js'
import metadata from '../metadata.js'
import {describe, expect, test, vi, beforeEach} from 'vitest'
import {cwd} from '@shopify/cli-kit/node/path'

vi.mock('../services/app-context.js')
vi.mock('@shopify/cli-kit/node/path')

describe('gatherPublicMetadata', () => {
  beforeEach(() => {
    vi.mocked(cwd).mockReturnValue('/some/app/dir')
  })

  test('opportunistically enriches metadata from the current directory and returns the public metadata', async () => {
    // Given
    await metadata.addPublicMetadata(() => ({api_key: 'from-helper'}))

    // When
    const result = await (gatherPublicMetadata as () => Promise<unknown>)()

    // Then
    expect(logAppContextMetadataIfAuthenticated).toHaveBeenCalledWith('/some/app/dir')
    expect(result).toEqual(metadata.getAllPublicMetadata())
  })

  test('still returns metadata when the best-effort enrichment is a no-op', async () => {
    // Given the helper does nothing (e.g. not authenticated)
    vi.mocked(logAppContextMetadataIfAuthenticated).mockResolvedValue()

    // When
    const result = await (gatherPublicMetadata as () => Promise<unknown>)()

    // Then
    expect(logAppContextMetadataIfAuthenticated).toHaveBeenCalledOnce()
    expect(result).toBeTypeOf('object')
  })
})
