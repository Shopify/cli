import {outputDebug, outputWarn} from '@shopify/cli-kit/node/output'
import fs from 'fs/promises'

interface FileChangeInfo {
  name: string
  accessedAt: Date
  modifiedAt: Date
}

export class Notifier {
  private notifyPath: string
  private initialized: boolean
  private isValidUrl: boolean

  constructor(notifyPath: string) {
    this.notifyPath = notifyPath
    this.initialized = false
    this.isValidUrl = this.validateUrl(notifyPath)
  }

  async notify(fileInfo: FileChangeInfo): Promise<void> {
    if (this.notifyPath === '') {
      outputDebug('Notification skipped: notifyPath is an empty string')
      return
    }

    try {
      if (!this.initialized && !this.isValidUrl) {
        await this.initFile()
      }

      outputDebug(`Notifying filechange listener at ${this.notifyPath}...`)
      const content = JSON.stringify({files: [fileInfo]})

      if (this.isValidUrl) {
        const response = await this.notifyUrl(content)
        if (!response.ok) {
          throw new Error(response.statusText)
        }
      } else {
        await this.notifyFile(content)
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

  private async initFile() {
    await fs.writeFile(this.notifyPath, '')
    this.initialized = true
  }

  private async notifyUrl(content: string): Promise<Response> {
    return fetch(this.notifyPath, {
      method: 'POST',
      body: content,
      headers: {'Content-Type': 'application/json'},
    })
  }

  private async notifyFile(content: string): Promise<void> {
    outputDebug(`Updating file timestamps at ${this.notifyPath}...`)
    await fs.appendFile(this.notifyPath, `${content}\n`)
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
