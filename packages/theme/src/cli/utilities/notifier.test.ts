import {Notifier} from './notifier.js'
import {vi, describe, expect, test} from 'vitest'
import {outputWarn} from '@shopify/cli-kit/node/output'
import fs from 'fs/promises'

vi.mock('fs/promises')
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
    const path = 'theme.update'
    notifier = new Notifier(path)
    const fileName = 'announcement.liquid'

    await notifier.notify(fileName)

    expect(fs.writeFile).toHaveBeenCalledWith(path, fileName)
  })

  test('does not update if path is empty', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch')
    notifier = new Notifier('')
    const fileName = 'announcement.liquid'

    await notifier.notify(fileName)

    expect(fetchSpy).not.toHaveBeenCalled()
    expect(fs.appendFile).not.toHaveBeenCalled()
  })

  test('does not notify file when path is URL', async () => {
    const url = 'https://example.com/notify'
    const mockFetch = vi.spyOn(global, 'fetch').mockResolvedValue(new Response())
    notifier = new Notifier(url)
    const fileName = 'announcement.liquid'

    await notifier.notify(fileName)

    expect(mockFetch).toHaveBeenCalled()
    expect(fs.appendFile).not.toHaveBeenCalled()
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
    const invalidPath = 'dir/file:theme.update'
    vi.spyOn(fs, 'writeFile').mockRejectedValue(new Error('No such file or directory'))
    notifier = new Notifier(invalidPath)
    const fileName = 'announcement.liquid'

    await notifier.notify(fileName)

    expect(outputWarn).toHaveBeenCalledWith(
      `Failed to notify filechange listener at ${invalidPath}: No such file or directory`,
    )
  })
})
