import Deploy from './deploy.js'
import {deploy} from '../../services/deploy.js'
import {linkedAppContext} from '../../services/app-context.js'
import {testAppLinked, testOrganizationApp} from '../../models/app/app.test-data.js'
import {inTemporaryDirectory} from '@shopify/cli-kit/node/fs'
import {beforeEach, describe, expect, test, vi} from 'vitest'

vi.mock('../../services/deploy.js')
vi.mock('../../services/app-context.js')

describe('app deploy command', () => {
  beforeEach(() => {
    vi.mocked(linkedAppContext).mockReset()
    const app = testAppLinked()
    vi.mocked(linkedAppContext).mockResolvedValue({
      app,
      remoteApp: testOrganizationApp(),
    } as Awaited<ReturnType<typeof linkedAppContext>>)
    vi.mocked(deploy).mockResolvedValue({app} as Awaited<ReturnType<typeof deploy>>)
  })

  test('accepts --config together with --client-id to deploy a configuration to a different app', async () => {
    await inTemporaryDirectory(async (tmp) => {
      await Deploy.run(
        ['--path', tmp, '--config', 'prod', '--client-id', 'a-different-app', '--allow-updates'],
        import.meta.url,
      )

      expect(linkedAppContext).toHaveBeenCalledWith({
        directory: tmp,
        clientId: 'a-different-app',
        forceRelink: false,
        userProvidedConfigName: 'prod',
      })
    })
  })

  test('still rejects --reset together with --config', async () => {
    await inTemporaryDirectory(async (tmp) => {
      await expect(
        Deploy.run(['--path', tmp, '--config', 'prod', '--reset', '--allow-updates'], import.meta.url),
      ).rejects.toThrow()

      expect(linkedAppContext).not.toHaveBeenCalled()
    })
  })
})
