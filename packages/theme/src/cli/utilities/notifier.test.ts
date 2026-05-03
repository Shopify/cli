import {Notifier} from './notifier.js'
import {vi, describe, expect, test} from 'vitest'
import {outputWarn} from '@shopify/cli-kit/node/output'
import {inTemporaryDirectory, readFile} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'

vi.mock('@shopify/cli-kit/node/output')

describe('Notifier', () => {
  let notifier: Notifier

  test('updates notifyPath via POST request when path is a URL', async () => {
    const mockFetch = vi.spyOn(global, 'fetch').mockResolvedValue(new Response())
    const url = 'https://example.com/notify'
    notifier = new Notifier(url)
    const fileName = 'announcement.liquid'

    await notifier.notify(fileName)

    expect(mockFetch).toHaveBeenCalledWith(url, {
      method: 'POST',
      body: JSON.stringify({files: [fileName]}),
      headers: {'Content-Type': 'application/json'},
    })
  })

  test('updates file atime and mtime when path is not a URL', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const path = joinPath(tmpDir, 'theme.update')
      notifier = new Notifier(path)
      const fileName = 'announcement.liquid'

      await notifier.notify(fileName)

      const content = await readFile(path)
      expect(content).toEqual(fileName)
    })
  })

  test('does not update if path is empty', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch')
    notifier = new Notifier('')
    const fileName = 'announcement.liquid'

    await notifier.notify(fileName)

    expect(fetchSpy).not.toHaveBeenCalled()
  })

  test('does not notify file when path is URL', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const url = 'https://example.com/notify'
      const mockFetch = vi.spyOn(global, 'fetch').mockResolvedValue(new Response())
      notifier = new Notifier(url)
      const fileName = 'announcement.liquid'
      const path = joinPath(tmpDir, 'theme.update')

      await notifier.notify(fileName)

      expect(mockFetch).toHaveBeenCalled()
      const fileExists = await readFile(path).catch(() => null)
      expect(fileExists).toBeNull()
    })
  })

  test('prints error if response is not successful', async () => {
    const url = 'https://example.com/notify'
    vi.spyOn(global, 'fetch').mockResolvedValue(new Response(null, {status: 500, statusText: 'Internal Server Error'}))
    notifier = new Notifier(url)
    const fileName = 'announcement.liquid'

    await notifier.notify(fileName)

    expect(outputWarn).toHaveBeenCalledWith(
      'Failed to notify filechange listener at https://example.com/notify: Internal Server Error',
    )
  })

  test('outputs error if request fails', async () => {
    const url = 'https://example.com/notify'
    vi.spyOn(global, 'fetch').mockRejectedValue(new URIError('Network error'))
    notifier = new Notifier(url)
    const fileName = 'announcement.liquid'

    await notifier.notify(fileName)

    expect(outputWarn).toHaveBeenCalledWith(
      'Failed to notify filechange listener at https://example.com/notify: Network error',
    )
  })

  test('outputs error if file update fails', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const invalidPath = tmpDir
      notifier = new Notifier(invalidPath)
      const fileName = 'announcement.liquid'

      await notifier.notify(fileName)

      expect(outputWarn).toHaveBeenCalledWith(expect.stringContaining(`Failed to notify filechange listener at ${tmpDir}`))
    })
  })
})
