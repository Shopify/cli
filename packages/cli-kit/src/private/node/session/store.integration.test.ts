import {fetch, remove, setSessionAlias, store} from './store.js'
import {getCurrentSessionId, getSessions, setCurrentSessionId, setSessions} from '../conf-store.js'
import {identityFqdn} from '../../../public/node/context/fqdn.js'
import {inTemporaryDirectory} from '../../../public/node/fs.js'
import {LocalStorage} from '../../../public/node/local-storage.js'
import {describe, expect, test, vi} from 'vitest'
import type {ConfSchema} from '../conf-store.js'
import type {Session} from './schema.js'

vi.mock('../../../public/node/context/fqdn.js')

const fqdn = 'accounts.shopify.com'

function session(userId: string): Session {
  return {
    identity: {
      userId,
      accessToken: 'fake-access-token',
      refreshToken: 'fake-refresh-token',
      expiresAt: new Date('2100-01-01'),
      scopes: [],
    },
    applications: {},
  }
}

describe('session storage with real files', () => {
  test('merges overlapping account writes from separate storage instances', async () => {
    await inTemporaryDirectory(async (cwd) => {
      const first = new LocalStorage<ConfSchema>({cwd})
      const second = new LocalStorage<ConfSchema>({cwd})
      const alice = session('alice')
      const bob = session('bob')

      await Promise.all([store({[fqdn]: {alice}}, first), store({[fqdn]: {bob}}, second)])

      await expect(fetch(first)).resolves.toEqual({[fqdn]: {alice, bob}})
    })
  })

  test('preserves accounts saved after authentication started', async () => {
    await inTemporaryDirectory(async (cwd) => {
      const config = new LocalStorage<ConfSchema>({cwd})
      const alice = session('alice')
      const bob = session('bob')
      await store({[fqdn]: {alice}}, config)
      const beforeRefresh = await fetch(config)
      await store({[fqdn]: {bob}}, new LocalStorage<ConfSchema>({cwd}))
      setCurrentSessionId('bob', config)

      await store({[fqdn]: {alice: {...beforeRefresh![fqdn]!.alice!, applications: {}}}}, config)

      await expect(fetch(config)).resolves.toEqual({[fqdn]: {alice, bob}})
      expect(getCurrentSessionId(config)).toBe('bob')
    })
  })

  test('updates an alias without overwriting an overlapping account write', async () => {
    await inTemporaryDirectory(async (cwd) => {
      vi.mocked(identityFqdn).mockResolvedValue(fqdn)
      const config = new LocalStorage<ConfSchema>({cwd})
      const alice = session('alice')
      const bob = session('bob')
      await store({[fqdn]: {alice}}, config)

      await Promise.all([
        setSessionAlias('alice', 'work', config),
        store({[fqdn]: {bob}}, new LocalStorage<ConfSchema>({cwd})),
      ])

      await expect(fetch(config)).resolves.toEqual({
        [fqdn]: {alice: {...alice, identity: {...alice.identity, alias: 'work'}}, bob},
      })
    })
  })

  test.each(['{invalid json', JSON.stringify({unexpected: 'session format'})])(
    'preserves unreadable session content and releases the write lock',
    async (content) => {
      await inTemporaryDirectory(async (cwd) => {
        const config = new LocalStorage<ConfSchema>({cwd})
        setSessions(content, config)
        setCurrentSessionId('alice', config)

        await expect(fetch(config)).rejects.toThrow('The saved CLI accounts could not be read')
        await expect(store({[fqdn]: {bob: session('bob')}}, config)).rejects.toThrow(
          'The saved CLI accounts could not be read',
        )

        expect(getSessions(config)).toBe(content)
        expect(getCurrentSessionId(config)).toBe('alice')

        await remove(config)
        expect(getSessions(config)).toBeUndefined()
        expect(getCurrentSessionId(config)).toBeUndefined()
        await store({[fqdn]: {bob: session('bob')}}, config)
        await expect(fetch(config)).resolves.toEqual({[fqdn]: {bob: session('bob')}})
      })
    },
  )
})
