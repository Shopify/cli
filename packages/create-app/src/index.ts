import {run, flush, settings} from '@oclif/core'
import {error as kitError, environment} from '@shopify/cli-kit'

function runCreateApp() {
  const initIndex = process.argv.findIndex((arg) => arg.includes('init'))
  if (initIndex === -1) {
    const initIndex =
      process.argv.findIndex(
        (arg) => arg.includes('bin/create-app') || arg.includes('bin/dev') || arg.includes('bin/run'),
      ) + 1
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
      return kitMapper(error).then((error: Error) => {
        kitHandle(error)
      })
    })
}

export default runCreateApp
