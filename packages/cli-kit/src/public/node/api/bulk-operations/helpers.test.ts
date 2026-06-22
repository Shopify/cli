import {
  normalizeBulkOperationId,
  extractBulkOperationId,
  isMutation,
  validateSingleOperation,
  resolveApiVersion,
} from './helpers.js'
import {fetchApiVersions} from '../admin.js'
import {AbortError} from '../../error.js'
import {describe, test, expect, vi} from 'vitest'

vi.mock('../admin.js')

const adminSession = {token: 'token', storeFqdn: 'shop.myshopify.com'}

describe('normalizeBulkOperationId', () => {
  test('returns a GID unchanged', () => {
    expect(normalizeBulkOperationId('gid://shopify/BulkOperation/123')).toBe('gid://shopify/BulkOperation/123')
  })

  test('converts a numeric ID to a GID', () => {
    expect(normalizeBulkOperationId('123')).toBe('gid://shopify/BulkOperation/123')
  })

  test('returns a non-numeric, non-GID string unchanged', () => {
    expect(normalizeBulkOperationId('not-an-id')).toBe('not-an-id')
  })
})

describe('extractBulkOperationId', () => {
  test('extracts the numeric ID from a GID', () => {
    expect(extractBulkOperationId('gid://shopify/BulkOperation/123')).toBe('123')
  })

  test('returns the input unchanged when not a recognized GID', () => {
    expect(extractBulkOperationId('123')).toBe('123')
    expect(extractBulkOperationId('gid://shopify/BulkOperation/abc')).toBe('gid://shopify/BulkOperation/abc')
  })
})

describe('isMutation', () => {
  test('returns true for a mutation', () => {
    expect(isMutation('mutation { foo }')).toBe(true)
  })

  test('returns false for a query', () => {
    expect(isMutation('query { foo }')).toBe(false)
    expect(isMutation('{ foo }')).toBe(false)
  })
})

describe('validateSingleOperation', () => {
  test('accepts a single operation', () => {
    expect(() => validateSingleOperation('query { foo }')).not.toThrow()
  })

  test('throws on invalid syntax', () => {
    expect(() => validateSingleOperation('query {')).toThrow(AbortError)
  })

  test('throws when multiple operations are present', () => {
    expect(() => validateSingleOperation('query A { foo } query B { bar }')).toThrow(AbortError)
  })
})

describe('resolveApiVersion', () => {
  test('returns unstable without fetching versions', async () => {
    const version = await resolveApiVersion({adminSession, userSpecifiedVersion: 'unstable'})
    expect(version).toBe('unstable')
    expect(fetchApiVersions).not.toHaveBeenCalled()
  })

  test('returns the latest supported version when none specified', async () => {
    vi.mocked(fetchApiVersions).mockResolvedValue([
      {handle: '2025-07', supported: true},
      {handle: '2025-10', supported: true},
      {handle: '2099-01', supported: false},
    ])
    const version = await resolveApiVersion({adminSession})
    expect(version).toBe('2025-10')
  })

  test('falls back to the minimum default version when newer than supported', async () => {
    vi.mocked(fetchApiVersions).mockResolvedValue([{handle: '2024-01', supported: true}])
    const version = await resolveApiVersion({adminSession, minimumDefaultVersion: '2026-01'})
    expect(version).toBe('2026-01')
  })

  test('returns a valid user-specified version', async () => {
    vi.mocked(fetchApiVersions).mockResolvedValue([{handle: '2025-10', supported: true}])
    const version = await resolveApiVersion({adminSession, userSpecifiedVersion: '2025-10'})
    expect(version).toBe('2025-10')
  })

  test('throws for an invalid user-specified version', async () => {
    vi.mocked(fetchApiVersions).mockResolvedValue([{handle: '2025-10', supported: true}])
    await expect(resolveApiVersion({adminSession, userSpecifiedVersion: '1999-01'})).rejects.toThrow(AbortError)
  })
})
