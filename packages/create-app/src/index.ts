import {run, flush, settings} from '@oclif/core'
import {error as kitError, environment, output} from '@shopify/cli-kit'

function runCreateApp() {
  output.initiateLogging({filename: 'shopify.create-app.log'})
  const initIndex = process.argv.findIndex((arg) => arg.includes('init'))
  if (initIndex === -1) {
    const initIndex = process.argv.findIndex((arg) => arg.match(/bin(\/|\\)(create-app|dev|run)/)) + 1
    process.argv.splice(initIndex, 0, 'init')
  }

  if (environment.local.isDebug()) {
    settings.debug = true
  }

  // Start the CLI
  run(undefined, import.meta.url)
    .then(flush)
    .catch((error: Error): Promise<void | Error> => {
      const kitMapper = kitError.mapper
      const kitHandle = kitError.handler
      // eslint-disable-next-line promise/no-nesting
      return kitMapper(error)
        .then((error: Error) => {
          return kitHandle(error)
        })
        .then(() => {
          process.exit(1)
        })
    })
}

export default runCreateApp
