import {DevSessionStatus, DevSessionStatusManager} from './dev-session-status-manager.js'
import {describe, test, expect, beforeEach, vi} from 'vitest'

describe('DevSessionStatusManager', () => {
  const devSessionStatusManager = new DevSessionStatusManager()

  beforeEach(() => {
    devSessionStatusManager.removeAllListeners()
    devSessionStatusManager.reset()
  })

  test('initializes with default status', () => {
    expect(devSessionStatusManager.status).toEqual({
      isReady: false,
      previewURL: undefined,
      graphiqlURL: undefined,
      statusMessage: undefined,
    })
  })

  test('updates status with partial updates', () => {
    devSessionStatusManager.updateStatus({isReady: true})

    expect(devSessionStatusManager.status).toEqual({
      isReady: true,
      previewURL: undefined,
    })
  })

  test('emits event when status changes', () => {
    const listener = vi.fn()
    devSessionStatusManager.on('dev-session-update', listener)

    devSessionStatusManager.updateStatus({
      isReady: true,
      previewURL: 'http://localhost:3000',
    })

    expect(listener).toHaveBeenCalledWith({
      isReady: true,
      previewURL: 'http://localhost:3000',
    })
  })

  test('does not emit event when status is unchanged', () => {
    const listener = vi.fn()
    devSessionStatusManager.on('dev-session-update', listener)

    // Set initial status
    devSessionStatusManager.updateStatus({
      isReady: true,
      previewURL: 'http://localhost:3000',
    })

    // Clear the mock to start fresh
    listener.mockClear()

    // Update with same values
    devSessionStatusManager.updateStatus({
      isReady: true,
      previewURL: 'http://localhost:3000',
    })

    expect(listener).not.toHaveBeenCalled()
  })

  test('resets status to initial state', () => {
    // Set some non-default values
    devSessionStatusManager.updateStatus({
      isReady: true,
      previewURL: 'http://localhost:3000',
    })

    devSessionStatusManager.reset()

    expect(devSessionStatusManager.status).toEqual({
      isReady: false,
      previewURL: undefined,
    })
  })

  test('maintains status object immutability', () => {
    const originalStatus = devSessionStatusManager.status
    const newStatus: Partial<DevSessionStatus> = {isReady: true}

    devSessionStatusManager.updateStatus(newStatus)

    expect(devSessionStatusManager.status).not.toBe(originalStatus)
    expect(originalStatus).toEqual({
      isReady: false,
      previewURL: undefined,
    })
  })

  describe('setMessage', () => {
    test('updates status with BUILD_ERROR message', () => {
      devSessionStatusManager.setMessage('BUILD_ERROR')

      expect(devSessionStatusManager.status.statusMessage).toEqual({
        message: 'Build error. Please review your code and try again',
        type: 'error',
      })
    })

    test('updates status with READY message', () => {
      devSessionStatusManager.setMessage('READY')

      expect(devSessionStatusManager.status.statusMessage).toEqual({
        message: 'Ready, watching for changes in your app',
        type: 'success',
      })
    })

    test('emits event when message changes', () => {
      const listener = vi.fn()
      devSessionStatusManager.on('dev-session-update', listener)

      devSessionStatusManager.setMessage('LOADING')

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          statusMessage: {
            message: 'Preparing dev session',
            type: 'loading',
          },
        }),
      )
    })

    test('does not emit event when setting same message twice', () => {
      const listener = vi.fn()
      devSessionStatusManager.on('dev-session-update', listener)

      devSessionStatusManager.setMessage('READY')
      listener.mockClear()

      devSessionStatusManager.setMessage('READY')

      expect(listener).not.toHaveBeenCalled()
    })
  })
})
