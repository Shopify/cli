import EnvPull from './pull.js'
import {linkedAppContext} from '../../../services/app-context.js'
import {pullEnv} from '../../../services/app/env/pull.js'
import {testAppLinked, testOrganization, testOrganizationApp} from '../../../models/app/app.test-data.js'
import {outputResult} from '@shopify/cli-kit/node/output'
import {joinPath, resolvePath} from '@shopify/cli-kit/node/path'
import {describe, expect, test, vi} from 'vitest'

vi.mock('../../../services/app-context.js')
vi.mock('../../../services/app/env/pull.js')
vi.mock('@shopify/cli-kit/node/output', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@shopify/cli-kit/node/output')>()
  return {...actual, outputResult: vi.fn()}
})

describe('app env pull command', () => {
  test('uses absolute --env-file paths as-is', async () => {
    const app = testAppLinked({
      directory: joinPath('F:', 'Project', 'cherhomeliving.shopify', 'shopify-app'),
      configPath: joinPath('F:', 'Project', 'cherhomeliving.shopify', 'shopify-app', 'shopify.app.toml'),
    })
    const remoteApp = testOrganizationApp()
    const organization = testOrganization()
    const envFile = joinPath(app.directory, '.env')

    vi.mocked(linkedAppContext).mockResolvedValue({app, remoteApp, organization} as Awaited<
      ReturnType<typeof linkedAppContext>
    >)
    vi.mocked(pullEnv).mockResolvedValue('Created env file')

    await EnvPull.run(['--path', app.directory, '--env-file', envFile], import.meta.url)

    expect(pullEnv).toHaveBeenCalledWith({
      app,
      remoteApp,
      organization,
      envFile,
    })
    expect(outputResult).toHaveBeenCalledWith('Created env file')
  })

  test('resolves relative --env-file paths from the app directory', async () => {
    const app = testAppLinked({directory: '/tmp/my-app', configPath: '/tmp/my-app/shopify.app.toml'})
    const remoteApp = testOrganizationApp()
    const organization = testOrganization()

    vi.mocked(linkedAppContext).mockResolvedValue({app, remoteApp, organization} as Awaited<
      ReturnType<typeof linkedAppContext>
    >)
    vi.mocked(pullEnv).mockResolvedValue('Created env file')

    await EnvPull.run(['--path', app.directory, '--env-file', 'config/.env'], import.meta.url)

    expect(pullEnv).toHaveBeenCalledWith({
      app,
      remoteApp,
      organization,
      envFile: resolvePath(app.directory, 'config/.env'),
    })
  })
})
