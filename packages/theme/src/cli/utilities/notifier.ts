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
  constructor(notifyPath: string) {
    this.notifyPath = notifyPath
    this.initialized = false
  }

  async notify(fileInfo: FileChangeInfo): Promise<void> {
    if (!this.initialized) {
      await this.init()
    }
    try {
      outputDebug(`Notifying filechange listener at ${this.notifyPath}...`)
      if (!this.notifyPath) return

      const content = JSON.stringify(fileInfo, null, 2)

      if (this.isValidUrl(this.notifyPath)) {
        await this.notifyUrl(content)
      } else {
        await this.notifyFile(content)
      }
      // eslint-disable-next-line no-catch-all/no-catch-all
    } catch (error) {
      outputWarn(`Failed to notify filechange listener at ${this.notifyPath}: ${error}`)
    }
  }

  private async init() {
    await fs.writeFile(this.notifyPath, '')
    this.initialized = true
  }

  private async notifyUrl(_content: string): Promise<void> {}

  private async notifyFile(content: string): Promise<void> {
    outputDebug(`Updating file timestamps at ${this.notifyPath}...`)
    await fs.appendFile(this.notifyPath, content)
  }

  private isValidUrl(url: string): boolean {
    try {
      const parsedUrl = new URL(url)
      return parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:'
      // eslint-disable-next-line no-catch-all/no-catch-all
    } catch (error) {
      return false
    }
  }
}
