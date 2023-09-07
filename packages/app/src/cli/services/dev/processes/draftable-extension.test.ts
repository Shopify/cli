import {pushUpdatesForDraftableExtensions, setupDraftableExtensionsProcess} from './draftable-extension.js'
import {testApp, testUIExtension} from '../../../models/app/app.test-data.js'
import {ExtensionInstance} from '../../../models/extensions/extension-instance.js'
import {installJavy} from '../../function/build.js'
import {AppInterface} from '../../../models/app/app.js'
import {getAppIdentifiers} from '../../../models/app/identifiers.js'
import {ensureDeploymentIdsPresence} from '../../context/identifiers.js'
import {describe, expect, test, vi} from 'vitest'
import {AbortController} from '@shopify/cli-kit/node/abort'
import {Writable} from 'stream'

vi.mock('../../function/build.js')
vi.mock('../../../models/app/identifiers.js')
vi.mock('../../context/identifiers.js')

const LOCAL_APP = (uiExtensions: ExtensionInstance[], functionExtensions: ExtensionInstance[] = []): AppInterface => {
  return testApp({
    name: 'my-app',
    directory: '/app',
    configuration: {path: '/shopify.app.toml', scopes: 'read_products', extension_directories: ['extensions/*']},
    allExtensions: [...uiExtensions, ...functionExtensions],
  })
}
describe('pushUpdatesForDraftableExtensions', () => {
  test('calls installJavy for the provided app', async () => {
    // given
    const mockedInstallJavy = vi.fn()
    vi.mocked(installJavy).mockImplementation(mockedInstallJavy)

    const stdout = new Writable()
    const stderr = new Writable()
    const abortSignal = new AbortController().signal
    const extensions = [] as ExtensionInstance[]
    const token = ''
    const apiKey = ''
    const remoteExtensionIds = {}
    const proxyUrl = ''

    const localApp = LOCAL_APP([], [])

    // when
    await pushUpdatesForDraftableExtensions(
      {stderr, stdout, abortSignal},
      {extensions, token, apiKey, remoteExtensionIds, proxyUrl, localApp},
    )

    // then
    expect(mockedInstallJavy).toHaveBeenCalledOnce()
    expect(mockedInstallJavy).toHaveBeenCalledWith(localApp)
  })
})

describe('setupDraftableExtensionsProcess', () => {
  test('updates the local app with the remote extension UUIDs', async () => {
    // given
    vi.mocked(getAppIdentifiers).mockReturnValue({app: undefined})
    vi.mocked(ensureDeploymentIdsPresence).mockResolvedValue({extensionIds: {}, app: 'app-id', extensions: {}})
    const localExtension = await testUIExtension()
    const localExtensions = [localExtension]
    const localApp = LOCAL_APP(localExtensions, [])
    const apiKey = ''
    const token = ''
    const remoteApp = {id: '', title: '', apiKey: ''}
    const proxyUrl = ''
    const options = {localApp, apiKey, token, remoteApp, proxyUrl}

    // when
    const result = await setupDraftableExtensionsProcess(options)

    // then
    expect(result).toEqual({
      type: 'draftable-extension',
      prefix: 'extensions',
      function: pushUpdatesForDraftableExtensions,
      options: {
        apiKey: '',
        extensions: localExtensions,
        localApp,
        proxyUrl,
        token,
        remoteExtensionIds: {},
      },
    })
  })
})
