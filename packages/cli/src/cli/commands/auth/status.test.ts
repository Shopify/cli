import Status from './status.js'
import {authStatusService} from '../../services/commands/auth-status.js'

import {describe, expect, test, vi} from 'vitest'

vi.mock('../../services/commands/auth-status.js')

describe('auth status command', () => {
  test('checks auth status as text by default', async () => {
    // When
    await Status.run([])

    // Then
    expect(authStatusService).toHaveBeenCalledWith(false)
  })

  test('checks auth status as JSON', async () => {
    // When
    await Status.run(['--json'])

    // Then
    expect(authStatusService).toHaveBeenCalledWith(true)
  })
})
