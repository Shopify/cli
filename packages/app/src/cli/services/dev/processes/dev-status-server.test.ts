import {setupDevStatusServerProcess, launchDevStatusServer} from './dev-status-server.js'
import {DevSessionStatusManager} from './dev-session/dev-session-status-manager.js'
import {testAppLinked} from '../../../models/app/app.test-data.js'
import {AppEventWatcher} from '../app-events/app-event-watcher.js'
import {describe, expect, test} from 'vitest'

describe('dev-status-server', () => {
  test('setupDevStatusServerProcess returns the correct process definition', async () => {
    // Given
    const devSessionStatusManager = new DevSessionStatusManager()
    const localApp = await testAppLinked()
    const appWatcher = new AppEventWatcher(localApp)
    const options = {
      devSessionStatusManager,
      localApp,
      appWatcher,
      graphiqlUrl: 'http://localhost:3000/graphiql',
    }

    // When
    const process = await setupDevStatusServerProcess(options)

    // Then
    expect(process).toMatchObject({
      type: 'dev-status-server',
      prefix: 'status',
      function: launchDevStatusServer,
      options,
    })
  })
})
