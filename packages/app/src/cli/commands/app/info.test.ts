import AppInfo from './info.js'
import {linkedAppContext} from '../../services/app-context.js'
import {info} from '../../services/info.js'
import {testAppLinked, testOrganization, testOrganizationApp, testProject} from '../../models/app/app.test-data.js'
import {outputResult} from '@shopify/cli-kit/node/output'
import {renderInfo} from '@shopify/cli-kit/node/ui'
import {describe, expect, test, vi, beforeEach} from 'vitest'

vi.mock('../../services/app-context.js')
vi.mock('../../services/info.js')
vi.mock('@shopify/cli-kit/node/output', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@shopify/cli-kit/node/output')>()
  return {...actual, outputResult: vi.fn()}
})
vi.mock('@shopify/cli-kit/node/ui', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@shopify/cli-kit/node/ui')>()
  return {...actual, renderInfo: vi.fn()}
})

describe('app info command', () => {
  const app = testAppLinked()
  const remoteApp = testOrganizationApp()
  const organization = testOrganization()
  const project = testProject()

  beforeEach(() => {
    vi.mocked(linkedAppContext).mockResolvedValue({
      app,
      remoteApp,
      organization,
      project,
      developerPlatformClient: remoteApp.developerPlatformClient,
    } as any)
  })

  test('prepares app/store context and renders info custom sections by default', async () => {
    // Given
    const mockSections = [{header: 'My Section', body: 'My Body'}]
    vi.mocked(info).mockResolvedValue(mockSections as any)

    // When
    await AppInfo.run(['--path', '/tmp/app', '--config', 'my-config'])

    // Then
    expect(linkedAppContext).toHaveBeenCalledWith({
      directory: '/tmp/app',
      clientId: undefined,
      forceRelink: false,
      userProvidedConfigName: 'my-config',
      unsafeTolerateErrors: true,
    })
    expect(info).toHaveBeenCalledWith(app, remoteApp, organization, project, {
      format: 'text',
      webEnv: false,
      configName: 'my-config',
      developerPlatformClient: remoteApp.developerPlatformClient,
    })
    expect(renderInfo).toHaveBeenCalledWith({customSections: mockSections})
    expect(outputResult).not.toHaveBeenCalled()
  })

  test('passes json format and calls outputResult when --json is supplied', async () => {
    // Given
    const mockJSONResponse = {value: '{"app": "info"}'}
    vi.mocked(info).mockResolvedValue(mockJSONResponse as any)

    // When
    await AppInfo.run(['--json'])

    // Then
    expect(info).toHaveBeenCalledWith(
      app,
      remoteApp,
      organization,
      project,
      expect.objectContaining({
        format: 'json',
      }),
    )
    expect(outputResult).toHaveBeenCalledWith(mockJSONResponse)
    expect(renderInfo).not.toHaveBeenCalled()
  })

  test('calls outputResult when info service returns a string', async () => {
    // Given
    const mockStringResponse = 'some plain text output'
    vi.mocked(info).mockResolvedValue(mockStringResponse as any)

    // When
    await AppInfo.run([])

    // Then
    expect(outputResult).toHaveBeenCalledWith(mockStringResponse)
    expect(renderInfo).not.toHaveBeenCalled()
  })

  test('exits with code 2 if app has errors', async () => {
    // Given
    const processExitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
      return undefined as never
    })
    vi.mocked(info).mockResolvedValue([] as any)

    const appWithErrors = testAppLinked()
    appWithErrors.errors.addError({
      file: 'shopify.app.toml',
      message: 'Invalid config option',
    })

    vi.mocked(linkedAppContext).mockResolvedValue({
      app: appWithErrors,
      remoteApp,
      organization,
      project,
      developerPlatformClient: remoteApp.developerPlatformClient,
    } as any)

    // When
    await AppInfo.run([])

    // Then
    expect(processExitSpy).toHaveBeenCalledWith(2)
    processExitSpy.mockRestore()
  })
})
