import {fetch, store, getSessionAccount, findSessionAccountByAlias, setSessionAlias} from './store.js'
import * as exchange from './exchange.js'
import * as deviceAuthorization from './device-authorization.js'
import {allDefaultScopes} from './scopes.js'
import {applicationId} from './identity.js'
import {ensureAuthenticated} from '../session.js'
import * as confStore from '../conf-store.js'
import * as fqdn from '../../../public/node/context/fqdn.js'
import * as environment from '../../../public/node/environment.js'
import * as businessPlatform from '../../../public/node/api/business-platform.js'
import {LocalStorage} from '../../../public/node/local-storage.js'
import {inTemporaryDirectory} from '../../../public/node/fs.js'
import {expect, test, vi} from 'vitest'
import type {Sessions} from './schema.js'

const {getSessions, setSessions, getCurrentSessionId, setCurrentSessionId} = confStore

test.each([undefined, 'verified@example.com'])(
  'preserves stored account email %s through file reload and alias changes',
  async (email) => {
    await inTemporaryDirectory(async (directory) => {
      const storage = new LocalStorage<confStore.ConfSchema>({cwd: directory})
      vi.spyOn(confStore, 'getSessions').mockImplementation(() => getSessions(storage))
      vi.spyOn(confStore, 'setSessions').mockImplementation((sessions) => setSessions(sessions, storage))
      vi.spyOn(fqdn, 'identityFqdn').mockResolvedValue('accounts.example.com')
      const sessions: Sessions = {
        'accounts.example.com': {
          'user-123': {
            identity: {
              userId: 'user-123',
              alias: 'nickname@example.com',
              email,
              accessToken: 'access-token',
              refreshToken: 'refresh-token',
              expiresAt: new Date('2030-01-01T00:00:00Z'),
              scopes: [],
            },
            applications: {},
          },
        },
      }

      await store(sessions)

      const reloadedStorage = new LocalStorage<confStore.ConfSchema>({cwd: directory})
      vi.mocked(confStore.getSessions).mockImplementation(() => getSessions(reloadedStorage))
      vi.mocked(confStore.setSessions).mockImplementation((value) => setSessions(value, reloadedStorage))
      const reloaded = JSON.parse(getSessions(reloadedStorage)!)
      expect(reloaded['accounts.example.com']['user-123'].identity.email).toBe(email)
      expect((await fetch())!['accounts.example.com']!['user-123']!.identity.email).toBe(email)
      await expect(getSessionAccount('user-123')).resolves.toEqual({
        userId: 'user-123',
        alias: 'nickname@example.com',
        email,
      })

      await setSessionAlias('user-123', 'New label')

      await expect(findSessionAccountByAlias('New label')).resolves.toEqual({
        userId: 'user-123',
        alias: 'New label',
        email,
      })
      expect(JSON.parse(getSessions(reloadedStorage)!)['accounts.example.com']['user-123'].identity.email).toBe(email)
    })
  },
)

test.each(['full-auth', 'invalid-grant'])(
  'retains the authenticated account email after %s selects another stored account',
  async (flow) => {
    await inTemporaryDirectory(async (directory) => {
      const storage = new LocalStorage<confStore.ConfSchema>({cwd: directory})
      vi.spyOn(confStore, 'getSessions').mockImplementation(() => getSessions(storage))
      vi.spyOn(confStore, 'setSessions').mockImplementation((value) => setSessions(value, storage))
      vi.spyOn(confStore, 'getCurrentSessionId').mockImplementation(() => getCurrentSessionId(storage))
      vi.spyOn(confStore, 'setCurrentSessionId').mockImplementation((value) => setCurrentSessionId(value, storage))
      vi.spyOn(fqdn, 'identityFqdn').mockResolvedValue('accounts.example.com')
      vi.spyOn(environment, 'getIdentityTokenInformation').mockReturnValue(undefined)
      vi.spyOn(environment, 'getAppAutomationToken').mockReturnValue(undefined)
      const identity = {
        userId: 'second-user',
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        expiresAt: new Date('2030-01-01T00:00:00Z'),
        scopes: allDefaultScopes(),
      }
      vi.spyOn(deviceAuthorization, 'requestDeviceAuthorization').mockResolvedValue({
        deviceCode: 'device-code',
        userCode: 'user-code',
        verificationUri: 'https://accounts.example.com/activate',
        verificationUriComplete: 'https://accounts.example.com/activate?user_code=user-code',
        expiresIn: 3600,
        interval: 5,
      })
      vi.spyOn(deviceAuthorization, 'pollForDeviceAuthorization').mockResolvedValue(identity)
      vi.spyOn(exchange, 'exchangeAccessForApplicationTokens').mockResolvedValue({
        [applicationId('business-platform')]: {
          accessToken: 'business-platform-token',
          expiresAt: identity.expiresAt,
          scopes: [],
        },
      })
      vi.spyOn(exchange, 'refreshAccessToken').mockRejectedValue(new exchange.InvalidGrantError())
      const emailRequest = vi
        .spyOn(businessPlatform, 'businessPlatformRequest')
        .mockResolvedValue({currentUserAccount: {email: 'unexpected@example.com'}})
      await store({
        'accounts.example.com': {
          'first-user': {
            identity: {
              ...identity,
              userId: 'first-user',
              alias: 'Work',
              email: 'first@example.com',
              scopes: flow === 'full-auth' ? [] : identity.scopes,
              expiresAt: new Date(0),
            },
            applications: {},
          },
          'second-user': {
            identity: {...identity, alias: 'Personal', email: 'second@example.com'},
            applications: {},
          },
        },
      })
      setCurrentSessionId('first-user', storage)

      await expect(ensureAuthenticated({})).resolves.toEqual({userId: 'second-user'})

      const reloadedStorage = new LocalStorage<confStore.ConfSchema>({cwd: directory})
      vi.mocked(confStore.getSessions).mockImplementation(() => getSessions(reloadedStorage))
      await expect(getSessionAccount('second-user')).resolves.toEqual({
        userId: 'second-user',
        alias: 'Work',
        email: 'second@example.com',
      })
      expect(emailRequest).not.toHaveBeenCalled()
      expect(exchange.refreshAccessToken).toHaveBeenCalledTimes(flow === 'invalid-grant' ? 1 : 0)
    })
  },
)
