import {versionDiffByVersion} from './version-diff.js'
import {describe, expect, vi, test} from 'vitest'
import {AbortError, AbortSilentError} from '@shopify/cli-kit/node/error'
import {mockAndCaptureOutput} from '@shopify/cli-kit/node/testing/output'
import {partnersRequest} from '@shopify/cli-kit/node/api/partners'

vi.mock('@shopify/cli-kit/node/api/partners')

describe('versionDiffByVersion', () => {
  test('throws an abort silent error and display an error message when the version is not found', async () => {
    // Given
    vi.mocked(partnersRequest).mockRejectedValue(new AbortError('Not found'))
    const outputMock = mockAndCaptureOutput()

    // When/Then
    await expect(versionDiffByVersion('apiKey', 'version', 'token')).rejects.toThrow(AbortSilentError)
    expect(outputMock.error()).toMatchInlineSnapshot(`
      "╭─ error ──────────────────────────────────────────────────────────────────────╮
      │                                                                              │
      │  Version couldn't be released.                                               │
      │                                                                              │
      │  Version version could not be found.                                         │
      │                                                                              │
      ╰──────────────────────────────────────────────────────────────────────────────╯
      "
    `)
  })

  test('returns versionDiff and versionDetails when the version is found', async () => {
    // Given
    const versionDetails = {id: 'id', uuid: 'uuid', versionTag: 'versionTag', location: 'location', message: 'message'}
    const versionsDiff = {
      added: [{registrationTitle: 'Extension 1', uuid: 'uuid1'}],
      updated: [{registrationTitle: 'Extension 2', uuid: 'uuid2'}],
      removed: [{registrationTitle: 'Extension 3', uuid: 'uuid3'}],
    }
    vi.mocked(partnersRequest).mockResolvedValueOnce({app: {appVersion: versionDetails}})
    vi.mocked(partnersRequest).mockResolvedValueOnce({app: {versionsDiff}})

    // When
    const result = await versionDiffByVersion('apiKey', 'version', 'token')

    // Then
    expect(result).toEqual({versionsDiff, versionDetails})
  })
})
