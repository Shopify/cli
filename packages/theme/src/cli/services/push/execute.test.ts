import {executeThemePush} from '../push.js'
import {findOrSelectTheme} from '../../utilities/theme-selector.js'
import {uploadTheme} from '../../utilities/theme-uploader.js'
import {Operation} from '@shopify/cli-kit/node/themes/types'
import {inTemporaryDirectory} from '@shopify/cli-kit/node/fs'
import {buildTheme} from '@shopify/cli-kit/node/themes/factories'
import {fetchChecksums, themePublish} from '@shopify/cli-kit/node/themes/api'
import {renderConfirmationPrompt} from '@shopify/cli-kit/node/ui'
import {mockAndCaptureOutput} from '@shopify/cli-kit/node/testing/output'
import {describe, expect, test, vi} from 'vitest'

vi.mock('../../utilities/theme-selector.js')
vi.mock('../../utilities/theme-uploader.js')
vi.mock('@shopify/cli-kit/node/themes/api')
vi.mock('@shopify/cli-kit/node/ui', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@shopify/cli-kit/node/ui')>()),
  renderConfirmationPrompt: vi.fn(),
}))

const session = {storeFqdn: 'test.myshopify.com', token: 'token'}

describe('push execution', () => {
  test('returns transfer facts without rendering a final result', async () => {
    await inTemporaryDirectory(async (path) => {
      vi.mocked(findOrSelectTheme).mockResolvedValue(buildTheme({id: 1, name: 'Theme', role: 'unpublished'})!)
      vi.mocked(fetchChecksums).mockResolvedValue([])
      vi.mocked(uploadTheme).mockImplementation((_theme, _session, _checksums, fileSystem) => ({
        workPromise: Promise.resolve(),
        uploadResults: new Map([
          [
            'assets/theme.css',
            {key: 'assets/theme.css', operation: Operation.Upload, success: false, errors: {asset: ['bad CSS']}},
          ],
          ['assets/valid.js', {key: 'assets/valid.js', operation: Operation.Upload, success: true}],
        ]),
        renderThemeSyncProgress: async () => {
          await fileSystem.ready()
        },
      }))
      const output = mockAndCaptureOutput()
      output.clear()
      const result = await executeThemePush({path, force: true, publish: true, environment: ['staging']}, session)
      expect(result).toEqual({
        environment: 'staging',
        theme: {
          id: 1,
          name: 'Theme',
          role: 'unpublished',
          shop: session.storeFqdn,
          editor_url: 'https://test.myshopify.com/admin/themes/1/editor',
          preview_url: 'https://test.myshopify.com?preview_theme_id=1',
        },
        published: true,
        hasErrors: true,
        errors: {'assets/theme.css': ['bad CSS']},
      })
      expect(themePublish).toHaveBeenCalledWith(1, session)
      expect(output.output()).toBe('')
      expect(output.info()).not.toContain('was pushed')
    })
  })

  test('does not upload or publish after live-theme confirmation is declined', async () => {
    await inTemporaryDirectory(async (path) => {
      vi.mocked(findOrSelectTheme).mockResolvedValue(buildTheme({id: 1, name: 'Theme', role: 'live'})!)
      vi.mocked(renderConfirmationPrompt).mockResolvedValue(false)
      await expect(executeThemePush({path, force: true, publish: true}, session)).resolves.toBeUndefined()
      expect(uploadTheme).not.toHaveBeenCalled()
      expect(themePublish).not.toHaveBeenCalled()
    })
  })

  test('propagates publish failures without producing a result', async () => {
    await inTemporaryDirectory(async (path) => {
      vi.mocked(findOrSelectTheme).mockResolvedValue(buildTheme({id: 1, name: 'Theme', role: 'unpublished'})!)
      vi.mocked(fetchChecksums).mockResolvedValue([])
      vi.mocked(uploadTheme).mockImplementation((_theme, _session, _checksums, fileSystem) => ({
        workPromise: Promise.resolve(),
        uploadResults: new Map(),
        renderThemeSyncProgress: async () => {
          await fileSystem.ready()
        },
      }))
      const failure = new Error('publish failed')
      vi.mocked(themePublish).mockRejectedValue(failure)
      await expect(executeThemePush({path, force: true, publish: true}, session)).rejects.toBe(failure)
    })
  })
})
