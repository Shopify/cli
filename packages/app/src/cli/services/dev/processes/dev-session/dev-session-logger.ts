import {UserError} from './dev-session.js'
import {AppEvent, EventType} from '../../app-events/app-event-watcher.js'
import {ExtensionInstance} from '../../../../models/extensions/extension-instance.js'
import {outputToken, outputContent, outputDebug} from '@shopify/cli-kit/node/output'
import {useConcurrentOutputContext} from '@shopify/cli-kit/node/ui/components'
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
    await this.log(outputContent`${outputToken.yellow(message)}`.value)
  }

  async success(message: string) {
    await this.log(outputContent`${outputToken.green(message)}`.value)
  }

  async debug(message: string) {
    outputDebug(message, this.stdout)
  }

  async error(message: string, prefix?: string) {
    const header = outputToken.errorText(`❌ Error`)
    const content = outputToken.errorText(`└  ${message}`)
    await this.log(outputContent`${header}`.value, prefix)
    await this.log(outputContent`${content}`.value, prefix)
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
    const messageArrays = await Promise.all(
      extensionEvents.map(async (eve) => {
        if (eve.type === EventType.Deleted) return []
        const messages = await eve.extension.getDevSessionUpdateMessages()
        return messages?.map((message) => ({message, prefix: eve.extension.handle})) ?? []
      }),
    )
    const messages = messageArrays.flat()

    const logPromises = messages.map((message, index) => {
      const messageContent = outputContent`${outputToken.gray(index === messages.length - 1 ? '└ ' : '│ ')}${
        message.message
      }`.value
      return this.log(messageContent, message.prefix)
    })
    await Promise.all(logPromises)
  }

  async logMultipleErrors(errors: {error: string; prefix: string}[]) {
    const header = outputToken.errorText(`❌ Error`)
    await this.log(outputContent`${header}`.value, 'app-preview')
    const messages = errors.map((error) => {
      const content = outputToken.errorText(`└  ${error.error}`)
      return this.log(outputContent`${content}`.value, error.prefix)
    })
    await Promise.all(messages)
  }

  // Helper function to print to terminal using output context with stripAnsi disabled.
  private async log(message: string, prefix?: string) {
    await useConcurrentOutputContext({outputPrefix: prefix ?? 'app-preview', stripAnsi: false}, () => {
      this.stdout.write(message)
    })
  }
}
