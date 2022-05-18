import {clearAppInfo, cliKit, getAppInfo, setAppInfo} from './store'
import {describe, expect, it} from 'vitest'

const APP1 = {appId: 'app1', storeFqdn: 'store1', orgId: 'org1'}
const APP2 = {appId: 'app2', storeFqdn: 'store2', orgId: 'org2'}
const APP1Updated = {appId: 'app1', storeFqdn: 'store1-updated', orgId: 'org1-updated'}

describe('getAppInfo', () => {
  it('returns cached info if exists', () => {
    // Given
    cliKit.set('appInfo', [APP1, APP2])

    // When
    const got = getAppInfo('app1')

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
    setAppInfo('app1', {storeFqdn: 'store1-updated', orgId: 'org1-updated'})
    const got = cliKit.get('appInfo')

    // Then
    expect(got).toEqual([APP1Updated, APP2])
  })

  it('creates new info if it does not exists', () => {
    // Given
    cliKit.set('appInfo', [APP1])

    // When
    setAppInfo('app2', {storeFqdn: APP2.storeFqdn, orgId: APP2.orgId})
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
    clearAppInfo('app1')
    const got = cliKit.get('appInfo')

    // Then
    expect(got).toEqual([APP2])
  })
})
