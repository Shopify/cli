import {uploadTheme} from './theme-uploader.js'
import {mountThemeFileSystem} from './theme-fs.js'
import {withCapturedStandardStreams} from '@shopify/cli-kit/node/testing/output'
import {inTemporaryDirectory, mkdir, writeFile} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {bulkUploadThemeAssets, deleteThemeAssets} from '@shopify/cli-kit/node/themes/api'
import {Operation} from '@shopify/cli-kit/node/themes/types'
import {buildTheme} from '@shopify/cli-kit/node/themes/factories'
import {runWithCommandEvents, renderCommandEventAsJson} from '@shopify/cli-kit/node/command-events'
import {expect, test, vi} from 'vitest'

vi.mock('@shopify/cli-kit/node/themes/api')

test('reports upload polling as updates until the upload finishes', async () => {
  await inTemporaryDirectory(async (path) => {
    await mkdir(joinPath(path, 'assets'))
    await writeFile(joinPath(path, 'assets/theme.css'), 'body {}')
    let finishUpload!: () => void
    const pendingUpload = new Promise<void>((resolve) => {
      finishUpload = resolve
    })
    let startedUpload!: () => void
    const uploadStarted = new Promise<void>((resolve) => {
      startedUpload = resolve
    })
    vi.mocked(bulkUploadThemeAssets).mockImplementation(async (_themeId, assets) => {
      if (!assets.some((asset) => asset.key === 'assets/theme.css')) return []
      startedUpload()
      await pendingUpload
      return [{key: 'assets/theme.css', operation: Operation.Upload, success: true}]
    })
    vi.mocked(deleteThemeAssets).mockResolvedValue([])
    const sink = vi.fn()
    vi.useFakeTimers({toFake: ['setTimeout', 'clearTimeout']})
    const rendering = runWithCommandEvents({outputMode: 'json', sink}, async () => {
      const upload = uploadTheme(
        buildTheme({id: 1, name: 'Theme', role: 'unpublished'})!,
        {storeFqdn: 'test.myshopify.com', token: 'token'},
        [],
        mountThemeFileSystem(path),
      )
      await upload.renderThemeSyncProgress()
    })

    try {
      await uploadStarted
      await vi.advanceTimersByTimeAsync(2000)
      const events = sink.mock.calls.map(([event]) => event).filter((event) => event.type === 'progress')
      expect(events.map((event) => event.status)).toEqual(['started', 'updated', 'updated'])
      expect(new Set(events.map((event) => event.operation)).size).toBe(1)
      finishUpload()
      await rendering
      const uploadEvents = sink.mock.calls
        .map(([event]) => event)
        .filter((event) => event.operation === events[0].operation)
      expect(uploadEvents.map((event) => event.status)).toEqual(['started', 'updated', 'updated', 'completed'])
    } finally {
      finishUpload()
      vi.clearAllTimers()
      vi.useRealTimers()
      await rendering
    }
  })
})

test('uploads real local files with typed progress and failure diagnostics on stderr', async () => {
  await inTemporaryDirectory(async (path) => {
    await mkdir(joinPath(path, 'assets'))
    await writeFile(joinPath(path, 'assets/theme.css'), 'body {}')
    const theme = buildTheme({id: 1, name: 'Theme', role: 'unpublished'})!
    vi.mocked(bulkUploadThemeAssets).mockResolvedValue([
      {key: 'assets/theme.css', operation: Operation.Upload, success: false, errors: {asset: ['bad CSS']}},
    ])
    vi.mocked(deleteThemeAssets).mockResolvedValue([])
    await withCapturedStandardStreams(async ({stdout, stderr}) => {
      await runWithCommandEvents({outputMode: 'json', sink: renderCommandEventAsJson}, async () => {
        const upload = uploadTheme(
          theme,
          {storeFqdn: 'test.myshopify.com', token: 'token'},
          [],
          mountThemeFileSystem(path),
        )
        await upload.renderThemeSyncProgress()
        expect(upload.uploadResults.get('assets/theme.css')?.success).toBe(false)
      })

      expect(stdout()).toBe('')
      const events = stderr()
        .trim()
        .split('\n')
        .map((line) => JSON.parse(line))
      expect(events).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'progress',
            status: 'started',
            message: expect.stringContaining('Uploading files to remote theme'),
          }),
          expect.objectContaining({
            type: 'progress',
            status: 'completed',
            message: expect.stringContaining('Cleaning your remote theme'),
          }),
          expect.objectContaining({type: 'diagnostic', level: 'error', message: 'assets/theme.css\nbad CSS'}),
        ]),
      )
    })
  })
})
