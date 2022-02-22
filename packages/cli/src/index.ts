// CLI
import {run, settings, flush, Errors} from '@oclif/core'
import Bugsnag from '@bugsnag/js'
import {error as kitError, environment} from '@shopify/cli-kit'

function runCLI() {
  if (environment.local.isDebug()) {
    settings.debug = true
  } else {
    Bugsnag.start({apiKey: '9e1e6889176fd0c795d5c659225e0fae', logger: null})
  }

  run(undefined, import.meta.url)
    .then(flush)
    .catch((error: Error): Promise<void | Error> => {
      const bugsnagHandle = new Promise<Error>((resolve) => {
        Bugsnag.notify(error, undefined, resolve)
        resolve(error)
      })
      const oclifHandle = Errors.handle
      const kitHandle = kitError.handler
      // eslint-disable-next-line promise/no-nesting
      return bugsnagHandle.then(kitHandle).then(oclifHandle)
    })
}

export default runCLI
