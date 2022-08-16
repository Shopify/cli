import {temporaryTestStore} from './testing/store.js'
import {describe, expect, it} from 'vitest'

const APP1 = {appId: 'app1', storeFqdn: 'store1', orgId: 'org1', directory: '/app1'}
const APP2 = {appId: 'app2', storeFqdn: 'store2', orgId: 'org2', directory: '/app2'}
const APP1Updated = {appId: 'updated-app1', storeFqdn: 'store1-updated', orgId: 'org1-updated', directory: '/app1'}

describe('getAppInfo', () => {
  it('returns cached info if existss', async () => {
    await temporaryTestStore(async (localConf) => {
      // Given
      localConf.set('appInfo', [APP1, APP2])

      // When
      const got = localConf.getAppInfo(APP1.directory)

      // Then
      expect(got).toEqual(APP1)
    })
  })

  it('returns undefined if it does not exists', async () => {
    await temporaryTestStore(async (localConf) => {
      // Given
      localConf.set('appInfo', [APP1, APP2])

      // When
      const got = localConf.getAppInfo('app3')

      // Then
      expect(got).toEqual(undefined)
    })
  })
})

describe('setAppInfo', () => {
  it('updates cached info if exists', async () => {
    await temporaryTestStore(async (localConf) => {
      // Given
      localConf.set('appInfo', [APP1, APP2])

      // When
      localConf.setAppInfo({
        appId: 'updated-app1',
        directory: '/app1',
        storeFqdn: 'store1-updated',
        orgId: 'org1-updated',
      })
      const got = localConf.get('appInfo')

      // Then
      expect(got).toEqual([APP1Updated, APP2])
    })
  })

  it('creates new info if it does not exists', async () => {
    await temporaryTestStore(async (localConf) => {
      // Given
      localConf.set('appInfo', [APP1])

      // When
      localConf.setAppInfo({appId: 'app2', directory: '/app2', storeFqdn: APP2.storeFqdn, orgId: APP2.orgId})
      const got = localConf.get('appInfo')

      // Then
      expect(got).toEqual([APP1, APP2])
    })
  })
})

describe('clearAppInfo', () => {
  it('removes cached info if exists', async () => {
    await temporaryTestStore(async (localConf) => {
      // Given
      localConf.set('appInfo', [APP1, APP2])

      // When
      localConf.clearAppInfo('/app1')
      const got = localConf.get('appInfo')

      // Then
      expect(got).toEqual([APP2])
    })
  })
})

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
