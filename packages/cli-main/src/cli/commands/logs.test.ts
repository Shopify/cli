import Logs from './logs.js'
import {describe, test, afterEach, vi, expect, beforeEach} from 'vitest'
import {log} from '@shopify/cli-kit'

describe('logs command', () => {
  beforeEach(() => {
    vi.mock('@shopify/cli-kit', async () => {
      return {
        ...(await vi.importActual<typeof import('@shopify/cli-kit')>('@shopify/cli-kit')),
        log: {
          pageLogs: vi.fn(),
        },
      }
    })
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('launches service', async () => {
    await Logs.run(['--last-command'], import.meta.url)

    expect(log.pageLogs).toHaveBeenCalledWith({lastCommand: true})
  })
})
