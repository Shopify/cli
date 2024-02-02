import Command from '../../utilities/app-command.js'
import {appFlags} from '../../flags.js'
import {loadApp} from '../../models/app/loader.js'
import {AppInterface} from '../../models/app/app.js'
import {loadLocalExtensionsSpecifications} from '../../models/extensions/load-specifications.js'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import {outputInfo, outputNewline, outputWarn} from '@shopify/cli-kit/node/output'
import {glob, readFile, isDirectory} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {fetch} from '@shopify/cli-kit/node/http'
import fs from 'fs'

export default class PingURLs extends Command {
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

  async isWorkingUrl(url: string): Promise<boolean> {
    try {
      const urlResponse = await fetch(url)
      return urlResponse.ok
      // eslint-disable-next-line no-catch-all/no-catch-all
    } catch {
      return false
    }
  }

  async getInvalidUrlsFromFile(filepath: string): Promise<string[]> {
    const fileContent = await readFile(filepath)

    const urlRegex = /https?:\/\/[^\s/$.?#].[^\s]*/g
    const urls = fileContent.match(urlRegex) || []
    const sanitizedUrls = urls.map((url) => this.sanitizeURL(url))

    const invalidURLs = await Promise.all(
      sanitizedUrls.filter(async (url) => {
        const isWorking = await this.isWorkingUrl(url)
        return !isWorking
      }),
    )
    return invalidURLs
  }

  async checkFilesInDirectory(directoryPath: string): Promise<void> {
    const files = await glob(joinPath(directoryPath, '*.*'), {
      ignore: ['**.d.ts', '**.test.ts', '**.md', '**/package-lock.json', '**/package.json'],
    })

    await Promise.all(
      files.map(async (filepath) => {
        const invalidURLs = await this.getInvalidUrlsFromFile(filepath)
        if (invalidURLs.length > 0) {
          outputInfo(`Invalid URLs in file: ${filepath}`)
          outputInfo(invalidURLs.join('\n'))
          outputNewline()
        }
      }),
    )
  }

  async searchInDirectory(directory: string): Promise<void> {
    outputInfo(`--------Search in directory ${directory}-----------`)
    let files: string[] = []

    files = fs.readdirSync(directory)

    files.forEach(async (file) => {
      const filepath = joinPath(directory, file)
      if (await isDirectory(filepath)) {
        this.searchInDirectory(filepath)
      } else {
        outputInfo(`    Check in file ${filepath} `)
        const invalidURLs = await this.getInvalidUrlsFromFile(filepath)
        if (invalidURLs.length > 0) {
          outputInfo(`Invalid URLs in file: ${filepath}`)
          outputInfo(invalidURLs.join('\n'))
          outputNewline()
        }
      }
    })
  }

  public async run(): Promise<void> {
    const {flags} = await this.parse(PingURLs)
    const specifications = await loadLocalExtensionsSpecifications(this.config)
    const app: AppInterface = await loadApp({
      specifications,
      directory: flags.path,
      configName: flags.config,
      mode: 'report',
    })

    // await this.searchInDirectory(app.directory)
    await this.checkFilesInDirectory(app.directory)
  }
}
