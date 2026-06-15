import {
  ConfSchema,
  cacheRetrieve,
  cacheRetrieveOrRepopulate,
  getSessions,
  removeSessions,
  setSessions,
  getCurrentSessionId,
  setCurrentSessionId,
  removeCurrentSessionId,
  runAtMinimumInterval,
  getConfigStoreForPartnerStatus,
  getCachedPartnerAccountStatus,
  setCachedPartnerAccountStatus,
  runWithRateLimit,
} from './conf-store.js'
import {isLocalEnvironment} from './context/service.js'
import {LocalStorage} from '../../public/node/local-storage.js'
import {inTemporaryDirectory} from '../../public/node/fs.js'

import {afterEach, beforeEach, describe, expect, test, vi} from 'vitest'

vi.mock('./context/service.js')

beforeEach(() => {
  vi.mocked(isLocalEnvironment).mockReturnValue(false)
})

describe('getSession', () => {
  test('returns the content of the SessionStore key', async () => {
    await inTemporaryDirectory(async (cwd) => {
      // Given
      const config = new LocalStorage<ConfSchema>({cwd})
      config.set('sessionStore', 'my-session')

      // When
      const got = getSessions(config)

      // Then
      expect(got).toEqual('my-session')
    })
  })
})

describe('setSession', () => {
  test('saves the desired content in the SessionStore key', async () => {
    await inTemporaryDirectory(async (cwd) => {
      // Given
      const config = new LocalStorage<ConfSchema>({cwd})
      config.set('sessionStore', 'my-session')

      // When
      setSessions('my-session', config)

      // Then
      expect(config.get('sessionStore')).toEqual('my-session')
    })
  })
})

describe('removeSession', () => {
  test('removes the SessionStore key', async () => {
    await inTemporaryDirectory(async (cwd) => {
      // Given
      const config = new LocalStorage<ConfSchema>({cwd})
      config.set('sessionStore', 'my-session')

      // When
      removeSessions(config)

      // Then
      expect(config.get('sessionStore')).toEqual(undefined)
    })
  })
})

describe('getCurrentSessionId', () => {
  test('returns the content of the currentSessionId key in production', async () => {
    await inTemporaryDirectory(async (cwd) => {
      // Given
      const config = new LocalStorage<ConfSchema>({cwd})
      config.set('currentSessionId', 'user-123')

      // When
      const got = getCurrentSessionId(config)

      // Then
      expect(got).toEqual('user-123')
    })
  })

  test('returns the content of the currentDevSessionId key in dev', async () => {
    await inTemporaryDirectory(async (cwd) => {
      // Given
      vi.mocked(isLocalEnvironment).mockReturnValue(true)
      const config = new LocalStorage<ConfSchema>({cwd})
      config.set('currentDevSessionId', 'dev-user-456')

      // When
      const got = getCurrentSessionId(config)

      // Then
      expect(got).toEqual('dev-user-456')
    })
  })

  test('returns undefined when currentSessionId is not set', async () => {
    await inTemporaryDirectory(async (cwd) => {
      // Given
      const config = new LocalStorage<ConfSchema>({cwd})

      // When
      const got = getCurrentSessionId(config)

      // Then
      expect(got).toBeUndefined()
    })
  })

  test('does not return dev session when in production', async () => {
    await inTemporaryDirectory(async (cwd) => {
      // Given
      const config = new LocalStorage<ConfSchema>({cwd})
      config.set('currentDevSessionId', 'dev-user')

      // When
      const got = getCurrentSessionId(config)

      // Then
      expect(got).toBeUndefined()
    })
  })
})

describe('setCurrentSessionId', () => {
  test('saves to currentSessionId in production', async () => {
    await inTemporaryDirectory(async (cwd) => {
      // Given
      const config = new LocalStorage<ConfSchema>({cwd})

      // When
      setCurrentSessionId('user-456', config)

      // Then
      expect(config.get('currentSessionId')).toEqual('user-456')
      expect(config.get('currentDevSessionId')).toBeUndefined()
    })
  })

  test('saves to currentDevSessionId in dev', async () => {
    await inTemporaryDirectory(async (cwd) => {
      // Given
      vi.mocked(isLocalEnvironment).mockReturnValue(true)
      const config = new LocalStorage<ConfSchema>({cwd})

      // When
      setCurrentSessionId('dev-user-789', config)

      // Then
      expect(config.get('currentDevSessionId')).toEqual('dev-user-789')
      expect(config.get('currentSessionId')).toBeUndefined()
    })
  })
})

describe('removeCurrentSessionId', () => {
  test('removes the currentSessionId key in production', async () => {
    await inTemporaryDirectory(async (cwd) => {
      // Given
      const config = new LocalStorage<ConfSchema>({cwd})
      config.set('currentSessionId', 'user-789')

      // When
      removeCurrentSessionId(config)

      // Then
      expect(config.get('currentSessionId')).toBeUndefined()
    })
  })

  test('removes the currentDevSessionId key in dev', async () => {
    await inTemporaryDirectory(async (cwd) => {
      // Given
      vi.mocked(isLocalEnvironment).mockReturnValue(true)
      const config = new LocalStorage<ConfSchema>({cwd})
      config.set('currentDevSessionId', 'dev-user')

      // When
      removeCurrentSessionId(config)

      // Then
      expect(config.get('currentDevSessionId')).toBeUndefined()
    })
  })
})

describe('session environment isolation', () => {
  test('getSessions returns production sessions in production', async () => {
    await inTemporaryDirectory(async (cwd) => {
      // Given
      const config = new LocalStorage<ConfSchema>({cwd})
      config.set('sessionStore', 'prod-sessions')
      config.set('devSessionStore', 'dev-sessions')

      // When
      const got = getSessions(config)

      // Then
      expect(got).toEqual('prod-sessions')
    })
  })

  test('getSessions returns dev sessions in dev', async () => {
    await inTemporaryDirectory(async (cwd) => {
      // Given
      vi.mocked(isLocalEnvironment).mockReturnValue(true)
      const config = new LocalStorage<ConfSchema>({cwd})
      config.set('sessionStore', 'prod-sessions')
      config.set('devSessionStore', 'dev-sessions')

      // When
      const got = getSessions(config)

      // Then
      expect(got).toEqual('dev-sessions')
    })
  })

  test('setSessions writes to devSessionStore in dev without affecting production', async () => {
    await inTemporaryDirectory(async (cwd) => {
      // Given
      const config = new LocalStorage<ConfSchema>({cwd})
      setSessions('prod-sessions', config)

      // When
      vi.mocked(isLocalEnvironment).mockReturnValue(true)
      setSessions('dev-sessions', config)

      // Then
      expect(config.get('sessionStore')).toEqual('prod-sessions')
      expect(config.get('devSessionStore')).toEqual('dev-sessions')
    })
  })

  test('removeSessions only removes sessions for the current environment', async () => {
    await inTemporaryDirectory(async (cwd) => {
      // Given
      const config = new LocalStorage<ConfSchema>({cwd})
      config.set('sessionStore', 'prod-sessions')
      config.set('devSessionStore', 'dev-sessions')

      // When
      vi.mocked(isLocalEnvironment).mockReturnValue(true)
      removeSessions(config)

      // Then
      expect(config.get('devSessionStore')).toBeUndefined()
      expect(config.get('sessionStore')).toEqual('prod-sessions')
    })
  })
})

describe('cacheRetrieveOrRepopulate', () => {
  test('returns the cached contents when they exist', async () => {
    await inTemporaryDirectory(async (cwd) => {
      // Given
      const config = new LocalStorage<ConfSchema>({cwd})
      const cacheValue = {
        'notifications-IDENTITYURL': {value: 'URL1', timestamp: Date.now()},
      }
      config.set('cache', cacheValue)

      // When
      const got = await cacheRetrieveOrRepopulate('notifications-IDENTITYURL', async () => 'URL2', 60 * 1000, config)

      // Then
      // Uses the prior run to return the cached value
      expect(got).toEqual('URL1')
    })
  })

  test('derives the cached contents when the cache is not populated', async () => {
    await inTemporaryDirectory(async (cwd) => {
      // Given
      const config = new LocalStorage<ConfSchema>({cwd})

      // When
      const got = await cacheRetrieveOrRepopulate('notifications-IDENTITYURL', async () => 'URL1', 60 * 1000, config)

      // Then
      expect(got).toEqual('URL1')
    })
  })

  test('re-derives the cached contents when the cache is outdated', async () => {
    await inTemporaryDirectory(async (cwd) => {
      // Given
      const config = new LocalStorage<ConfSchema>({cwd})
      const cacheValue = {
        'notifications-IDENTITYURL': {value: 'URL1', timestamp: Date.now() - 60 * 1000},
      }
      config.set('cache', cacheValue)

      // When
      const got = await cacheRetrieveOrRepopulate('notifications-IDENTITYURL', async () => 'URL2', 0, config)

      // Then
      // Fetches a new value because the old one is outdated per the current request
      expect(got).toEqual('URL2')
    })
  })

  test('re-derives the cached contents when the cache is invalid', async () => {
    await inTemporaryDirectory(async (cwd) => {
      // Given
      const config = new LocalStorage<any>({cwd})
      const cacheValue = {'notifications-IDENTITYURL': {value: undefined, timestamp: Date.now()}}
      config.set('cache', cacheValue)

      // When
      const got = await cacheRetrieveOrRepopulate('notifications-IDENTITYURL', async () => 'URL2', 60 * 1000, config)

      // Then
      // Fetches a new value because the old one is wrong
      expect(got).toEqual('URL2')
    })
  })
})

describe('cacheRetrieve', () => {
  test('returns the value if the cache is populated', async () => {
    await inTemporaryDirectory(async (cwd) => {
      // Given
      const config = new LocalStorage<any>({cwd})
      const cacheValue = {value: 'URL1', timestamp: Date.now()}
      const cacheEntry = {'notifications-IDENTITYURL': cacheValue}
      config.set('cache', cacheEntry)

      // When
      const got = cacheRetrieve('notifications-IDENTITYURL', config)

      // Then
      expect(got).toEqual(cacheValue)
    })
  })

  test('returns undefined if the cache is not populated', async () => {
    await inTemporaryDirectory(async (cwd) => {
      // Given
      const config = new LocalStorage<any>({cwd})
      config.set('cache', {})

      // When
      const got = cacheRetrieve('notifications-IDENTITYURL', config)

      // Then
      expect(got).toBeUndefined()
    })
  })
})

describe('runAtMinimumInterval', () => {
  const key = 'TASK'
  const timeout = {seconds: 1}

  afterEach(() => {
    vi.useRealTimers()
  })

  test('runs the task as usual when the cache is not populated', async () => {
    await inTemporaryDirectory(async (cwd) => {
      // Given
      const config = new LocalStorage<any>({cwd})

      // When
      let taskRan = false
      const got = await runAtMinimumInterval(
        key,
        timeout,
        async () => {
          taskRan = true
        },
        config,
      )

      // Then
      expect(got).toBe(true)
      expect(taskRan).toBe(true)
    })
  })

  test('throttles the task when the cache is populated recently', async () => {
    await inTemporaryDirectory(async (cwd) => {
      // Given
      const config = new LocalStorage<any>({cwd})
      await runAtMinimumInterval(key, timeout, async () => {}, config)

      // When
      let taskRan = false
      const got = await runAtMinimumInterval(
        key,
        timeout,
        async () => {
          taskRan = true
        },
        config,
      )

      // Then
      expect(got).toBe(false)
      expect(taskRan).toBe(false)
    })
  })

  test('runs the task as usual when the cache is populated but outdated', async () => {
    await inTemporaryDirectory(async (cwd) => {
      // Given
      const config = new LocalStorage<any>({cwd})
      await runAtMinimumInterval(key, timeout, async () => {}, config)

      // When
      let taskRan = false
      vi.setSystemTime(vi.getRealSystemTime() + 1000)
      const got = await runAtMinimumInterval(
        key,
        timeout,
        async () => {
          taskRan = true
        },
        config,
      )

      // Then
      expect(got).toBe(true)
      expect(taskRan).toBe(true)
    })
  })
})

describe('runWithRateLimit', () => {
  const key = 'TASK'
  const timeout = {seconds: 1}
  const limit = 2

  afterEach(() => {
    vi.useRealTimers()
  })

  test('runs the task as usual when the cache is not populated', async () => {
    await inTemporaryDirectory(async (cwd) => {
      // Given
      const config = new LocalStorage<any>({cwd})

      // When
      let taskRan = false
      const got = await runWithRateLimit(
        {
          key,
          timeout,
          limit,
          task: async () => {
            taskRan = true
          },
        },
        config,
      )

      // Then
      expect(got).toBe(true)
      expect(taskRan).toBe(true)
    })
  })

  test('throttles the task when the cache is populated recently', async () => {
    await inTemporaryDirectory(async (cwd) => {
      // Given
      vi.useFakeTimers()
      const config = new LocalStorage<any>({cwd})
      for (let i = 0; i < limit; i++) {
        // eslint-disable-next-line no-await-in-loop
        await runWithRateLimit(
          {
            key,
            timeout,
            limit,
            task: async () => {},
          },
          config,
        )
      }

      // When
      let taskRan = false
      const got = await runWithRateLimit(
        {
          key,
          limit,
          timeout,
          task: async () => {
            taskRan = true
          },
        },
        config,
      )

      // Then
      expect(got).toBe(false)
      expect(taskRan).toBe(false)
    })
  })

  test("runs the task as usual when the cache is populated recently but the rate limit isn't used up", async () => {
    await inTemporaryDirectory(async (cwd) => {
      // Given
      vi.useFakeTimers()
      const config = new LocalStorage<any>({cwd})
      // Run the task once, but the rate limit is 2
      await runWithRateLimit(
        {
          key,
          timeout,
          limit,
          task: async () => {},
        },
        config,
      )

      // When
      let taskRan = false
      const got = await runWithRateLimit(
        {
          key,
          limit,
          timeout,
          task: async () => {
            taskRan = true
          },
        },
        config,
      )

      // Then
      expect(got).toBe(true)
      expect(taskRan).toBe(true)
    })
  })

  test('runs the task as usual when the cache is populated but outdated', async () => {
    await inTemporaryDirectory(async (cwd) => {
      // Given
      const config = new LocalStorage<any>({cwd})
      for (let i = 0; i < limit; i++) {
        // eslint-disable-next-line no-await-in-loop
        await runWithRateLimit(
          {
            key,
            timeout,
            limit,
            task: async () => {},
          },
          config,
        )
      }

      // When
      let taskRan = false
      vi.setSystemTime(vi.getRealSystemTime() + 1000)
      const got = await runWithRateLimit(
        {
          key,
          limit,
          timeout,
          task: async () => {
            taskRan = true
          },
        },
        config,
      )

      // Then
      expect(got).toBe(true)
      expect(taskRan).toBe(true)
    })
  })
})

describe('Partner Account Status Cache', () => {
  beforeEach(() => {
    // Clear the partner status store before each test
    const store = getConfigStoreForPartnerStatus()
    store.clear()
  })

  describe('getCachedPartnerAccountStatus', () => {
    test('returns null for empty token', () => {
      expect(getCachedPartnerAccountStatus('')).toBeNull()
    })

    test('returns null for non-existent token', () => {
      expect(getCachedPartnerAccountStatus('non-existent-token')).toBeNull()
    })

    test('returns true for existing token', () => {
      const token = 'existing-token'
      setCachedPartnerAccountStatus(token)

      expect(getCachedPartnerAccountStatus(token)).toBe(true)
    })
  })

  describe('setCachedPartnerAccountStatus', () => {
    test('sets a new token', () => {
      const token = 'new-token'
      setCachedPartnerAccountStatus(token)

      expect(getCachedPartnerAccountStatus(token)).toBe(true)
    })
  })
})
