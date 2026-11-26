import {DevSession} from './dev-session.js'
import {DevSessionStatusManager} from './dev-session-status-manager.js'
import {AppEvent, AppEventWatcher} from '../../app-events/app-event-watcher.js'
import {testAppLinked, testDeveloperPlatformClient} from '../../../../models/app/app.test-data.js'
import {MfaRequiredError} from '@shopify/cli-kit/node/error'
import {expect, test, vi} from 'vitest'
import {Writable} from 'stream'

test('preserves the MFA error and its recovery guidance when preparing a dev session', async () => {
  const error = new MfaRequiredError('mfa-request-id')
  const app = testAppLinked()
  vi.spyOn(app, 'manifest').mockRejectedValue(error)
  const appWatcher = new AppEventWatcher(app)
  const stdout = new Writable({
    write(_chunk, _encoding, callback) {
      callback()
    },
  })
  await DevSession.start(
    {
      app,
      appWatcher,
      developerPlatformClient: testDeveloperPlatformClient(),
      storeFqdn: 'test.myshopify.com',
      apiKey: 'test-api-key',
      url: 'https://test.dev',
      organizationId: 'org123',
      appId: 'app123',
      appPreviewURL: 'https://test.preview.url',
      devSessionStatusManager: new DevSessionStatusManager(),
    },
    stdout,
  )
  const [onStart] = appWatcher.listeners('ready') as ((event: AppEvent) => Promise<void>)[]

  await expect(
    onStart!({app, extensionEvents: [], path: '/test', startTime: [0, 0], appWasReloaded: false}),
  ).rejects.toBe(error)
})
