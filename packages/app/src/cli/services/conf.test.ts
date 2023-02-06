import {AppConfSchema, clearAppInfo, getAppInfo, setAppInfo} from './conf.js'
import {describe, expect, it} from 'vitest'
import {Conf} from '@shopify/cli-kit/node/conf'
import {inTemporaryDirectory} from '@shopify/cli-kit/node/fs'

const APP1 = {appId: 'app1', storeFqdn: 'store1', orgId: 'org1', directory: '/app1'}
const APP2 = {appId: 'app2', storeFqdn: 'store2', orgId: 'org2', directory: '/app2'}
const APP1Updated = {appId: 'updated-app1', storeFqdn: 'store1-updated', orgId: 'org1-updated', directory: '/app1'}

describe('getAppInfo', async () => {
  it('returns cached info if existss', async () => {
    await inTemporaryDirectory(async (cwd) => {
      // Given
      const conf = new Conf<AppConfSchema>({cwd})
      setAppInfo(APP1, conf)

      // When
      const got = getAppInfo(APP1.directory, conf)

      // Then
      expect(got).toEqual(APP1)
    })
  })

  it('returns undefined if it does not exists', async () => {
    await inTemporaryDirectory(async (cwd) => {
      // Given
      const conf = new Conf<AppConfSchema>({cwd})

      // When
      const got = getAppInfo('app3', conf)

      // Then
      expect(got).toEqual(undefined)
    })
  })
})

describe('setAppInfo', async () => {
  it('updates cached info if exists', async () => {
    await inTemporaryDirectory(async (cwd) => {
      // Given
      const conf = new Conf<AppConfSchema>({cwd})
      conf.set(APP1.directory, APP1)

      // When
      setAppInfo(APP1Updated, conf)
      const got = conf.get(APP1.directory)

      // Then
      expect(got).toEqual(APP1Updated)
    })
  })

  it('creates new info if it does not exists', async () => {
    await inTemporaryDirectory(async (cwd) => {
      // Given
      const conf = new Conf<AppConfSchema>({cwd})

      // When
      setAppInfo({appId: 'app2', directory: '/app2', storeFqdn: APP2.storeFqdn, orgId: APP2.orgId}, conf)
      const got = conf.get(APP2.directory)

      // Then
      expect(got).toEqual(APP2)
    })
  })

  it('creates new info normalizing the path', async () => {
    await inTemporaryDirectory(async (cwd) => {
      // Given
      const conf = new Conf<AppConfSchema>({cwd})

      // When
      setAppInfo({appId: 'app2', directory: '\\app2\\something', storeFqdn: APP2.storeFqdn, orgId: APP2.orgId}, conf)
      const got = conf.get('/app2/something')

      // Then
      expect(got.appId).toEqual(APP2.appId)
    })
  })
})

describe('clearAppInfo', async () => {
  it('removes cached info if exists', async () => {
    await inTemporaryDirectory(async (cwd) => {
      // Given
      const conf = new Conf<AppConfSchema>({cwd})
      conf.set(APP1.directory, APP1)
      conf.set(APP2.directory, APP2)

      // When
      clearAppInfo(APP1.directory, conf)
      const got = getAppInfo(APP1.directory, conf)

      // Then
      expect(got).toEqual(undefined)
    })
  })
})
