import Command from '../../utilities/app-command.js'
import {appFlags} from '../../flags.js'
import {loadApp} from '../../models/app/loader.js'
import {AppInterface} from '../../models/app/app.js'
import {loadLocalExtensionsSpecifications} from '../../models/extensions/load-specifications.js'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import {outputInfo, outputNewline} from '@shopify/cli-kit/node/output'
import {glob, readFile} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {fetch} from '@shopify/cli-kit/node/http'

export default class CheckURLs extends Command {
  static description = 'Check the URLs in your app and ensure they are not on localhost.'

  static flags = {
    ...globalFlags,
    ...appFlags,
  }

  // remove trailing characters from json configurations
  sanitizeURL(url: string): string {
    let sanitizedUrl = url
    if (url.endsWith(',')) {
      sanitizedUrl = url.substring(0, url.length - 1)
    }
    if (sanitizedUrl.endsWith("'") || sanitizedUrl.endsWith('"')) {
      sanitizedUrl = url.substring(0, sanitizedUrl.length - 1)
    }
    return sanitizedUrl
  }

  // this can be moved to ESLint
  isHttp(url: string): boolean {
    const parsedUrl = new URL(url)
    return parsedUrl.protocol === 'http:'
  }

  // this can be moved to ESLint too
  isCloudflare(url: string): boolean {
    const parsedUrl = new URL(url)
    const hostname = parsedUrl.hostname || ''
    return hostname.toLowerCase() === 'cloudflare.com'
  }

  async isWorkingUrl(url: string): Promise<boolean> {
    try {
      const urlResponse = await fetch(url)
      return urlResponse.ok
      // eslint-disable-next-line no-catch-all/no-catch-all
    } catch {
      return false
    }
  }

  public async run(): Promise<void> {
    const {flags} = await this.parse(CheckURLs)
    const specifications = await loadLocalExtensionsSpecifications(this.config)
    const app: AppInterface = await loadApp({
      specifications,
      directory: flags.path,
      configName: flags.config,
      mode: 'report',
    })

    const files = await glob(joinPath(app.directory, '*.*'), {
      ignore: ['**.d.ts', '**.test.ts', '**.md', '**/package-lock.json', '**/package.json'],
    })

    await Promise.all(
      files.map(async (filepath) => {
        const fileContent = await readFile(filepath)

        const urlRegex = /https?:\/\/[^\s/$.?#].[^\s]*/g
        const urls = fileContent.match(urlRegex)

        urls?.map(async (url) => {
          const sanitizedUrl = this.sanitizeURL(url)
          const isWorking = await this.isWorkingUrl(sanitizedUrl)
          const isHttp = this.isHttp(sanitizedUrl)

          let errorMessage = ''
          if (this.isHttp(sanitizedUrl)) {
            errorMessage = 'Must use https'
          } else if (this.isCloudflare(sanitizedUrl)) {
            errorMessage = 'Avoid using cloudflare.com'
          } else if (!isWorking) {
            errorMessage = 'Unable to reach this URL'
          }

          if (errorMessage.length > 0) {
            outputInfo(`There is an issue with a URL in ${filepath} URL: ${sanitizedUrl}  Error: ${errorMessage}`)
            outputNewline()
          }
        })
      }),
    )
  }
}
