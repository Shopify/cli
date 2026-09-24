import {renderThemePullResult} from './result.js'
import {executeThemePull} from '../pull.js'
import {findOrSelectTheme} from '../../utilities/theme-selector.js'
import {DevelopmentThemeManager} from '../../utilities/development-theme-manager.js'
import {withCapturedStandardStreams} from '@shopify/cli-kit/node/testing/output'
import {inTemporaryDirectory, mkdir, writeFile, readFile, fileExists} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {fetchChecksums, fetchThemeAssets} from '@shopify/cli-kit/node/themes/api'
import {buildTheme} from '@shopify/cli-kit/node/themes/factories'
import {runWithCommandEvents, renderCommandEventAsJson} from '@shopify/cli-kit/node/command-events'
import {describe, expect, test, vi} from 'vitest'

vi.mock('../../utilities/theme-selector.js')
vi.mock('@shopify/cli-kit/node/themes/api')

const session = {storeFqdn: 'test.myshopify.com', token: 'token'}

describe('pull execution', () => {
  test.each([false, true])('downloads real files and honors nodelete=%s with JSON progress', async (nodelete) => {
    await inTemporaryDirectory(async (path) => {
      await mkdir(joinPath(path, 'assets'))
      await writeFile(joinPath(path, 'assets/old.css'), 'old')
      vi.spyOn(DevelopmentThemeManager.prototype, 'fetch').mockResolvedValue(undefined)
      vi.mocked(findOrSelectTheme).mockResolvedValue(
        buildTheme({id: 1, name: 'Theme', role: 'unpublished', processing: false})!,
      )
      vi.mocked(fetchChecksums).mockResolvedValue([{key: 'assets/theme.css', checksum: 'new'}])
      vi.mocked(fetchThemeAssets).mockResolvedValue([{key: 'assets/theme.css', checksum: 'new', value: 'body {}'}])
      await withCapturedStandardStreams(async ({stdout, stderr}) => {
        await runWithCommandEvents({outputMode: 'json', sink: renderCommandEventAsJson}, async () => {
          const result = await executeThemePull({path, force: true, nodelete}, session)
          expect(result).toEqual({
            path,
            theme: {
              id: 1,
              name: 'Theme',
              role: 'unpublished',
              processing: false,
              shop: session.storeFqdn,
              editor_url: 'https://test.myshopify.com/admin/themes/1/editor',
              preview_url: 'https://test.myshopify.com?preview_theme_id=1',
            },
          })
          renderThemePullResult(result!, 'json')
        })

        await expect(readFile(joinPath(path, 'assets/theme.css'))).resolves.toBe('body {}')
        await expect(fileExists(joinPath(path, 'assets/old.css'))).resolves.toBe(nodelete)
        expect(JSON.parse(stdout())).toMatchObject({path, theme: {id: 1}})
        const events = stderr()
          .trim()
          .split('\n')
          .map((line) => JSON.parse(line))
        expect(events).toEqual(
          expect.arrayContaining([
            expect.objectContaining({type: 'progress', status: 'completed', message: 'Theme download complete'}),
          ]),
        )
      })
    })
  })

  test('returns metadata when no files need downloading', async () => {
    await inTemporaryDirectory(async (path) => {
      vi.spyOn(DevelopmentThemeManager.prototype, 'fetch').mockResolvedValue(undefined)
      vi.mocked(findOrSelectTheme).mockResolvedValue({
        ...buildTheme({id: 1, name: 'Theme', role: 'live'})!,
        src: 'https://example.com/theme.zip',
      })
      vi.mocked(fetchChecksums).mockResolvedValue([])
      const result = await runWithCommandEvents({outputMode: 'json'}, () =>
        executeThemePull({path, force: true}, session),
      )
      expect(result?.theme).toMatchObject({role: 'live', src: 'https://example.com/theme.zip'})
      expect(fetchThemeAssets).not.toHaveBeenCalled()
    })
  })

  test('propagates download errors without writing a final result', async () => {
    await inTemporaryDirectory(async (path) => {
      vi.spyOn(DevelopmentThemeManager.prototype, 'fetch').mockResolvedValue(undefined)
      vi.mocked(findOrSelectTheme).mockResolvedValue(buildTheme({id: 1, name: 'Theme', role: 'unpublished'})!)
      vi.mocked(fetchChecksums).mockResolvedValue([{key: 'assets/theme.css', checksum: 'new'}])
      const failure = new Error('download failed')
      vi.mocked(fetchThemeAssets).mockRejectedValue(failure)
      await withCapturedStandardStreams(async ({stdout}) => {
        await runWithCommandEvents({outputMode: 'json', sink: renderCommandEventAsJson}, async () => {
          await expect(executeThemePull({path, force: true}, session)).rejects.toBe(failure)
        })

        expect(stdout()).toBe('')
      })
    })
  })
})
