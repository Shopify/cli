import {UserError} from './dev-session.js'
import {AppEvent} from '../../app-events/app-event-watcher.js'
import {ExtensionInstance} from '../../../../models/extensions/extension-instance.js'
import {outputDebug, outputInfo, outputWarn} from '@shopify/cli-kit/node/output'
import {useConcurrentOutputContext} from '@shopify/cli-kit/node/ui/components'
import {getArrayRejectingUndefined} from '@shopify/cli-kit/common/array'
import {Writable} from 'stream'

export class DevSessionLogger {
  private readonly stdout: Writable

  constructor(stdout: Writable) {
    this.stdout = stdout
  }

  async info(message: string) {
    await this.log(message)
  }

  async warning(message: string) {
    await this.log(message, 'warning')
  }

  async success(message: string) {
    await this.log(message, 'success')
  }

  async debug(message: string) {
    outputDebug(message, this.stdout)
  }

  async error(message: string, prefix?: string) {
    await this.log(`❌ Error`, prefix, 'error')
    await this.log(`└  ${message}`, prefix, 'error')
  }

  async logUserErrors(errors: UserError[] | Error | string, extensions: ExtensionInstance[]) {
    if (typeof errors === 'string') {
      await this.error(errors)
    } else if (errors instanceof Error) {
      await this.error(errors.message)
    } else {
      const mappedErrors = errors.map((error) => {
        const on = error.on ? (error.on[0] as {user_identifier: unknown}) : undefined
        const extension = extensions.find((ext) => ext.uid === on?.user_identifier)
        return {error: error.message, prefix: extension?.handle ?? 'app-preview'}
      })
      await this.logMultipleErrors(mappedErrors)
    }
  }

  async logExtensionEvents(event: AppEvent) {
    const appConfigEvents = event.extensionEvents.filter((eve) => eve.extension.isAppConfigExtension)
    const nonAppConfigEvents = event.extensionEvents.filter((eve) => !eve.extension.isAppConfigExtension)

    if (appConfigEvents.length) {
      const outputPrefix = 'app-config'
      const message = `App config updated`
      await this.log(message, outputPrefix)
    }

    // For each (non app config) extension event, print a message to the terminal
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    nonAppConfigEvents.forEach(async (eve) => {
      const outputPrefix = eve.extension.handle
      const message = `Extension ${eve.type}`
      await this.log(message, outputPrefix)
    })
  }

  /**
   * Display update messages from extensions after a dev session update.
   * This function collects and displays update messages from all extensions.
   */
  async logExtensionUpdateMessages(event?: AppEvent) {
    if (!event) return
    const extensionEvents = event.extensionEvents ?? []
    const messages = getArrayRejectingUndefined(
      await Promise.all(
        extensionEvents.map(async (eve) => {
          const message = await eve.extension.getDevSessionUpdateMessage()
          return message ? message : undefined
        }),
      ),
    )

    const logPromises = messages.map((message) => this.log(`└  ${message}`, 'app-preview'))
    await Promise.all(logPromises)
  }

  async logMultipleErrors(errors: {error: string; prefix: string}[]) {
    await this.log(`❌ Error`, 'app-preview', 'error')
    const messages = errors.map((error) => {
      return this.log(`└  ${error.error}`, error.prefix, 'error')
    })
    await Promise.all(messages)
  }

  // Helper function to print to terminal using output context with stripAnsi disabled.
  private async log(message: string, prefix?: string, type: 'info' | 'warning' | 'success' | 'error' = 'info') {
    await useConcurrentOutputContext({outputPrefix: prefix ?? 'app-preview', stripAnsi: false}, () => {
      switch (type) {
        case 'warning':
          outputWarn(message, this.stdout)
          break
        case 'success':
          outputInfo(`✅ ${message}`, this.stdout)
          break
        case 'error':
          outputInfo(`🔴 ${message}`, this.stdout)
          break
        default:
          outputInfo(message, this.stdout)
      }
    })
  }
}
