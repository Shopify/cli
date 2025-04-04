import {isRemoteDomExperimentEnabled} from './is-remote-dom-experiment-enabled.js'
import {describe, test, expect, vi} from 'vitest'

describe('isRemoteDomExperimentEnabled', () => {
  test('returns true when REMOTE_DOM_EXPERIMENT is set to truthy value', () => {
    vi.stubEnv('REMOTE_DOM_EXPERIMENT', 'true')
    expect(isRemoteDomExperimentEnabled()).toBe(true)
  })

  test('returns false when REMOTE_DOM_EXPERIMENT is set to falsy value', () => {
    vi.stubEnv('REMOTE_DOM_EXPERIMENT', 'false')
    expect(isRemoteDomExperimentEnabled()).toBe(false)
  })

  test('returns false when REMOTE_DOM_EXPERIMENT is not set', () => {
    expect(isRemoteDomExperimentEnabled()).toBe(false)
  })
})
