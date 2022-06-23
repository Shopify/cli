import {
  clearAppInfo,
  cliKit,
  getAppInfo,
  getSessionStore,
  removeSessionStore,
  setAppInfo,
  setSessionStore,
} from './store'
import {beforeEach, describe, expect, it} from 'vitest'

const APP1 = {appId: 'app1', storeFqdn: 'store1', orgId: 'org1', directory: '/app1'}
const APP2 = {appId: 'app2', storeFqdn: 'store2', orgId: 'org2', directory: '/app2'}
const APP1Updated = {appId: 'updated-app1', storeFqdn: 'store1-updated', orgId: 'org1-updated', directory: '/app1'}

beforeEach(() => {
  cliKit.clear()
})

describe('getAppInfo', () => {
  it('returns cached info if exists', () => {
    // Given
    cliKit.set('appInfo', [APP1, APP2])

    // When
    const got = getAppInfo(APP1.directory)

    // Then
    expect(got).toEqual(APP1)
  })

  it('returns undefined if it does not exists', () => {
    // Given
    cliKit.set('appInfo', [APP1, APP2])

    // When
    const got = getAppInfo('app3')

    // Then
    expect(got).toEqual(undefined)
  })
})

describe('setAppInfo', () => {
  it('updates cached info if exists', () => {
    // Given
    cliKit.set('appInfo', [APP1, APP2])

    // When
    setAppInfo({appId: 'updated-app1', directory: '/app1', storeFqdn: 'store1-updated', orgId: 'org1-updated'})
    const got = cliKit.get('appInfo')

    // Then
    expect(got).toEqual([APP1Updated, APP2])
  })

  it('creates new info if it does not exists', () => {
    // Given
    cliKit.set('appInfo', [APP1])

    // When
    setAppInfo({appId: 'app2', directory: '/app2', storeFqdn: APP2.storeFqdn, orgId: APP2.orgId})
    const got = cliKit.get('appInfo')

    // Then
    expect(got).toEqual([APP1, APP2])
  })
})

describe('clearAppInfo', () => {
  it('removes cached info if exists', () => {
    // Given
    cliKit.set('appInfo', [APP1, APP2])

    // When
    clearAppInfo('/app1')
    const got = cliKit.get('appInfo')

    // Then
    expect(got).toEqual([APP2])
  })
})

describe('getSessionStore', () => {
  it('returns the content of the SessionStore key', () => {
    // Given
    cliKit.set('SessionStore', 'my-session')

    // When
    const got = getSessionStore()

    // Then
    expect(got).toEqual('my-session')
  })
})

describe('setSessionStore', () => {
  it('saves the desired content in the SessionStore key', () => {
    // Given
    cliKit.set('SessionStore', 'my-session')

    // When
    setSessionStore('my-session')

    // Then
    expect(cliKit.get('SessionStore')).toEqual('my-session')
  })
})

describe('removeSessionStore', () => {
  it('removes the SessionStore key', () => {
    // Given
    cliKit.set('SessionStore', 'my-session')

    // When
    removeSessionStore()

    // Then
    expect(cliKit.get('SessionStore')).toEqual('')
  })
})
