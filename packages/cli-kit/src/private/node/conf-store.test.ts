import {ConfSchema, cacheRetrieveOrRepopulate, getSession, removeSession, setSession} from './conf-store.js'
import {LocalStorage} from '../../public/node/local-storage.js'
import {describe, expect, it} from 'vitest'
import {inTemporaryDirectory} from '@shopify/cli-kit/node/fs'

describe('getSession', () => {
  it('returns the content of the SessionStore key', async () => {
    await inTemporaryDirectory(async (cwd) => {
      // Given
      const config = new LocalStorage<ConfSchema>({cwd})
      config.set('sessionStore', 'my-session')

      // When
      const got = getSession(config)

      // Then
      expect(got).toEqual('my-session')
    })
  })
})

describe('setSession', () => {
  it('saves the desired content in the SessionStore key', async () => {
    await inTemporaryDirectory(async (cwd) => {
      // Given
      const config = new LocalStorage<ConfSchema>({cwd})
      config.set('sessionStore', 'my-session')

      // When
      setSession('my-session', config)

      // Then
      expect(config.get('sessionStore')).toEqual('my-session')
    })
  })
})

describe('removeSession', () => {
  it('removes the SessionStore key', async () => {
    await inTemporaryDirectory(async (cwd) => {
      // Given
      const config = new LocalStorage<ConfSchema>({cwd})
      config.set('sessionStore', 'my-session')

      // When
      removeSession(config)

      // Then
      expect(config.get('sessionStore')).toEqual(undefined)
    })
  })
})

describe('cacheRetrieveOrRepopulate', () => {
  // flaky test
  it.skip('returns the cached contents when they exist', async () => {
    await inTemporaryDirectory(async (cwd) => {
      // Given
      const config = new LocalStorage<ConfSchema>({cwd})
      // populate the cache
      await cacheRetrieveOrRepopulate('identity-introspection-url-IDENTITYURL', async () => 'URL1', 1000, config)

      // When
      const got = await cacheRetrieveOrRepopulate(
        'identity-introspection-url-IDENTITYURL',
        async () => 'URL2',
        1000,
        config,
      )

      // Then
      // Uses the prior run to return the cached value
      expect(got).toEqual('URL1')
    })
  })

  it('derives the cached contents when the cache is not populated', async () => {
    await inTemporaryDirectory(async (cwd) => {
      // Given
      const config = new LocalStorage<ConfSchema>({cwd})

      // Then
      const got = await cacheRetrieveOrRepopulate(
        'identity-introspection-url-IDENTITYURL',
        async () => 'URL1',
        1000,
        config,
      )
      expect(got).toEqual('URL1')
    })
  })

  it('re-derives the cached contents when the cache is outdated', async () => {
    await inTemporaryDirectory(async (cwd) => {
      // Given
      const config = new LocalStorage<ConfSchema>({cwd})

      // When
      // populate the cache
      await cacheRetrieveOrRepopulate('identity-introspection-url-IDENTITYURL', async () => 'URL1', 1000, config)

      // Then
      const got = await cacheRetrieveOrRepopulate(
        'identity-introspection-url-IDENTITYURL',
        async () => 'URL2',
        0,
        config,
      )
      // Fetches a new value because the old one is outdated per the current request
      expect(got).toEqual('URL2')
    })
  })
})
