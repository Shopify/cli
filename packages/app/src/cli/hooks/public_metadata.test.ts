import gatherPublicMetadata from './public_metadata.js'
import {logAppContextMetadata} from '../services/app-context.js'
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
    expect(logAppContextMetadata).toHaveBeenCalledWith('/some/app/dir')
    expect(result).toEqual(metadata.getAllPublicMetadata())
  })

  test('still returns metadata when the best-effort enrichment is a no-op', async () => {
    // Given the helper does nothing (e.g. not in an app project)
    vi.mocked(logAppContextMetadata).mockResolvedValue()

    // When
    const result = await (gatherPublicMetadata as () => Promise<unknown>)()

    // Then
    expect(logAppContextMetadata).toHaveBeenCalledOnce()
    expect(result).toBeTypeOf('object')
  })
})
