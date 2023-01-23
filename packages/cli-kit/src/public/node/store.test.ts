import {temporaryTestStore} from '../../private/node/testing/store.js'
import {describe, expect, it} from 'vitest'

describe('getSession', () => {
  it('returns the content of the SessionStore key', async () => {
    await temporaryTestStore(async (localConf) => {
      // Given
      localConf.set('sessionStore', 'my-session')

      // When
      const got = localConf.getSession()

      // Then
      expect(got).toEqual('my-session')
    })
  })
})

describe('setSession', () => {
  it('saves the desired content in the SessionStore key', async () => {
    await temporaryTestStore(async (localConf) => {
      // Given
      localConf.set('sessionStore', 'my-session')

      // When
      localConf.setSession('my-session')

      // Then
      expect(localConf.get('sessionStore')).toEqual('my-session')
    })
  })
})

describe('removeSession', () => {
  it('removes the SessionStore key', async () => {
    await temporaryTestStore(async (localConf) => {
      // Given
      localConf.set('sessionStore', 'my-session')

      // When
      localConf.removeSession()

      // Then
      expect(localConf.get('sessionStore')).toEqual('')
    })
  })
})
