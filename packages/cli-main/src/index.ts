// CLI
import {run, settings, flush} from '@oclif/core'
import Bugsnag from '@bugsnag/js'
import {error as kitError, environment, output, semver, store, constants, analytics, toml} from '@shopify/cli-kit'

async function runCLI() {
  await store.initializeCliKitStore()
  output.initiateLogging({filename: 'shopify.cli.log'})
  if (environment.local.isDebug()) {
    settings.debug = true
  } else {
    Bugsnag.start({
      apiKey: '9e1e6889176fd0c795d5c659225e0fae',
      logger: null,
      appVersion: await constants.versions.cliKit(),
      autoTrackSessions: false,
    })
  }

  displayMessageBoard()
    .then(() => {
      run(undefined, import.meta.url)
    })
    .then(flush)
    .catch((error: Error): Promise<void | Error> => {
      if (error instanceof kitError.AbortSilent) {
        process.exit(1)
      }
      const kitMapper = kitError.mapper
      const kitHandle = kitError.handler
      // eslint-disable-next-line promise/no-nesting
      return kitMapper(error)
        .then(reportError)
        .then((error: Error) => {
          return kitHandle(error)
        })
        .then(() => {
          process.exit(1)
        })
    })
}

const reportError = async (errorToReport: Error): Promise<Error> => {
  await analytics.reportEvent({errorMessage: errorToReport.message})

  if (!settings.debug && kitError.shouldReport(errorToReport)) {
    let mappedError: Error
    // eslint-disable-next-line no-prototype-builtins
    if (Object.prototype.isPrototypeOf(errorToReport)) {
      const mappedError = Object.assign(Object.create(errorToReport), {})
      if (mappedError.stack) mappedError.stack = mappedError.stack.replace(new RegExp('file:///', 'g'), '/')
    } else {
      mappedError = errorToReport
    }
    await new Promise((resolve, reject) => {
      Bugsnag.notify(mappedError, undefined, resolve)
    })
  }
  return Promise.resolve(errorToReport)
}

interface Message {
  id: number
  version: string
  content: string
}

const displayMessageBoard = async (): Promise<void> => {
  try {
    const response = await fetch(MESSAGE_BOARD_URL)
    const body = await response.text()
    const messages: Message[] = (toml.decode(body) as {messages: Message[]}).messages
    const currentVersion = await constants.versions.cliKit()
    const relevantMessages = messages.filter((msg) => !msg.version || semver.satisfies(currentVersion, msg.version))
    const latestId = store.cliKitStore().getLatestMessageId()
    let message: Message | undefined
    if (latestId) {
      message = relevantMessages.sort((msg1, msg2) => msg2.id - msg1.id).find((msg) => msg.id > latestId)
    } else {
      message = relevantMessages[0]
    }
    if (message) {
      store.cliKitStore().setLatestMessageId(message.id)
      output.messageBoard(message.content)
    }
    // Catch all errors, as message board failures should never break the CLI.
    // eslint-disable-next-line no-catch-all/no-catch-all, no-empty
  } catch (err) {}
}

export default runCLI
