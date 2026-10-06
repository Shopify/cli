import {promptSessionSelect} from './session-prompt.js'
import * as session from './session.js'
import * as system from './system.js'
import * as fqdn from './context/fqdn.js'
import {runWithCommandEvents, renderCommandEventAsJson} from './command-events.js'
import {outputResult} from './output.js'
import {withCapturedStandardStreams} from './testing/output.js'
import {LocalStorage} from './local-storage.js'
import {inTemporaryDirectory} from './fs.js'
import * as confStore from '../../private/node/conf-store.js'
import * as sessionStore from '../../private/node/session/store.js'
import * as ui from '../../private/node/ui.js'
import {Stdin, waitForInputsToBeReady} from '../../private/node/testing/ui.js'
import {afterEach, expect, test, vi} from 'vitest'

const {getSessions, setSessions, setCurrentSessionId} = confStore
const {render} = ui

afterEach(() => {
  vi.unstubAllEnvs()
})

test.each(['cached', 'new'])('keeps the real %s account prompt on stderr before the JSON result', async (flow) => {
  await inTemporaryDirectory(async (directory) => {
    vi.stubEnv('CI', '1')
    const storage = new LocalStorage<confStore.ConfSchema>({cwd: directory})
    vi.spyOn(confStore, 'getSessions').mockImplementation(() => getSessions(storage))
    vi.spyOn(confStore, 'setSessions').mockImplementation((value) => setSessions(value, storage))
    vi.spyOn(confStore, 'setCurrentSessionId').mockImplementation((value) => setCurrentSessionId(value, storage))
    vi.spyOn(fqdn, 'identityFqdn').mockResolvedValue('accounts.example.com')
    vi.spyOn(system, 'terminalSupportsPrompting').mockReturnValue(true)
    const sessions = {
      'accounts.example.com': {
        'user-123': {
          identity: {
            userId: 'user-123',
            alias: flow === 'cached' ? 'Work account' : undefined,
            accessToken: 'access-token',
            refreshToken: 'refresh-token',
            expiresAt: new Date('2030-01-01T00:00:00Z'),
            scopes: [],
          },
          applications: {},
        },
      },
    }
    if (flow === 'cached') await sessionStore.store(sessions)
    vi.spyOn(session, 'ensureAuthenticatedUser').mockImplementation(async () => {
      await sessionStore.store(sessions)
      return {userId: 'user-123'}
    })
    const stdin = new Stdin()
    vi.spyOn(ui, 'render').mockImplementation((element, options) =>
      render(element, {
        ...options,
        stdin: stdin as unknown as NodeJS.ReadStream,
        debug: true,
        patchConsole: false,
      }),
    )

    await withCapturedStandardStreams(async ({stdout, stderr}) => {
      const selection = runWithCommandEvents({outputMode: 'json', sink: renderCommandEventAsJson}, () =>
        promptSessionSelect(),
      )
      await vi.waitFor(() => expect(stdin.listenerCount('readable')).toBeGreaterThan(0))
      await waitForInputsToBeReady()
      if (flow === 'new') {
        stdin.write('Work account')
        await vi.waitFor(() => expect(stderr()).toContain('Work account'))
        await waitForInputsToBeReady()
      }
      stdin.write('\r')
      const alias = await selection
      expect(stdout()).toBe('')
      expect(stderr()).toContain(
        flow === 'cached' ? 'Which account would you like to use?' : 'Enter an alias for this account',
      )

      outputResult(JSON.stringify({status: 'success', alias}))

      expect(JSON.parse(stdout())).toEqual({
        status: 'success',
        alias: 'Work account',
      })
      expect(stdout()).not.toContain('access-token')
    })
  })
})
