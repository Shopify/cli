import {run, flush, settings, Errors} from '@oclif/core'
import {error as kitError, environment} from '@shopify/cli-kit'

function runCreateApp() {
  const initIndex = process.argv.findIndex((arg) => arg.includes('init'))
  if (initIndex === -1) {
    const initIndex =
      process.argv.findIndex(
        (arg) =>
          arg.includes('bin/create-app') ||
          arg.includes('bin/dev') ||
          arg.includes('bin/run'),
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
      const oclifHandle = Errors.handle
      const kitHandle = kitError.handler
      // eslint-disable-next-line promise/no-nesting
      return kitHandle(error).then(oclifHandle)
    })
}

export default runCreateApp
