import {formatProjectFollowUpCommand} from './project-command.js'
import {beforeEach, describe, expect, test, vi} from 'vitest'
import {formatPackageManagerCommand} from '@shopify/cli-kit/node/output'

vi.mock('@shopify/cli-kit/node/output', async () => {
  const actual: any = await vi.importActual('@shopify/cli-kit/node/output')
  return {
    ...actual,
    formatPackageManagerCommand: vi.fn(),
  }
})

describe('formatProjectFollowUpCommand', () => {
  beforeEach(() => {
    vi.mocked(formatPackageManagerCommand).mockReturnValue('formatted command')
  })

  test('delegates known package managers to formatPackageManagerCommand', () => {
    const result = formatProjectFollowUpCommand({packageManager: 'pnpm'} as any, 'shopify app dev', '--reset')

    expect(formatPackageManagerCommand).toHaveBeenCalledWith('pnpm', 'shopify app dev', '--reset')
    expect(result).toBe('formatted command')
  })

  test('delegates unknown package manager metadata for display-only callers', () => {
    const result = formatProjectFollowUpCommand({packageManager: 'unknown'} as any, 'shopify app config link')

    expect(formatPackageManagerCommand).toHaveBeenCalledWith('unknown', 'shopify app config link')
    expect(result).toBe('formatted command')
  })
})
