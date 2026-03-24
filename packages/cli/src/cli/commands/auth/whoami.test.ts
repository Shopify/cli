import Whoami from './whoami.js'
import {describe, expect, vi, test} from 'vitest'
import {getCurrentUserInfo} from '@shopify/cli-kit/node/session'
import {mockAndCaptureOutput} from '@shopify/cli-kit/node/testing/output'

vi.mock('@shopify/cli-kit/node/session')

describe('Whoami command', () => {
  test('outputs account alias when logged in', async () => {
    // Given
    const outputMock = mockAndCaptureOutput()
    vi.mocked(getCurrentUserInfo).mockResolvedValue({alias: 'user@example.com'})

    // When
    await Whoami.run([])

    // Then
    expect(outputMock.info()).toMatch('Logged in as: user@example.com')
  })

  test('exits with error when not logged in', async () => {
    // Given
    const outputMock = mockAndCaptureOutput()
    vi.mocked(getCurrentUserInfo).mockResolvedValue(undefined)

    // When
    await expect(Whoami.run([])).rejects.toThrow()

    // Then
    expect(outputMock.error()).toMatch('Not logged in.')
  })
})
