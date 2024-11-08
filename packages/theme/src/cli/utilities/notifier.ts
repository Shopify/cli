import {outputDebug, outputWarn} from '@shopify/cli-kit/node/output'
import fs from 'fs/promises'

// A valid NotifyPath can be:
// - a URL
// - a relative or absolute path on the filesystem
export class Notifier {
  private readonly notifyPath: string
  private readonly isValidUrl: boolean

  constructor(notifyPath: string) {
    this.notifyPath = notifyPath
    this.isValidUrl = this.validateUrl(notifyPath)
    if (this.notifyPath === '') {
      outputWarn('Notification skipped: notifyPath is an empty string')
    }
  }

  async notify(fileName: string): Promise<void> {
    if (this.notifyPath === '') {
      return
    }

    try {
      outputDebug(`Notifying filechange listener at ${this.notifyPath}...`)

      if (this.isValidUrl) {
        await this.notifyUrl(fileName)
      } else {
        await this.notifyFile(fileName)
      }
      // eslint-disable-next-line no-catch-all/no-catch-all
    } catch (error) {
      let message = `Failed to notify filechange listener at ${this.notifyPath}`
      if (error instanceof Error) {
        message = message.concat(`: ${error.message}`)
      }
      outputWarn(message)
    }
  }

  private async notifyUrl(fileName: string): Promise<void> {
    const response = await fetch(this.notifyPath, {
      method: 'POST',
      body: JSON.stringify({files: [fileName]}),
      headers: {'Content-Type': 'application/json'},
    })

    if (!response.ok) {
      throw new Error(response.statusText)
    }
  }

  private async notifyFile(fileName: string): Promise<void> {
    await fs.writeFile(this.notifyPath, fileName)
    await fs.utimes(this.notifyPath, new Date(), new Date())
  }

  private validateUrl(url: string): boolean {
    try {
      const parsedUrl = new URL(url)
      return parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:'
      // eslint-disable-next-line no-catch-all/no-catch-all
    } catch (error) {
      return false
    }
  }
}
