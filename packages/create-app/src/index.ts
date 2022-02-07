import {run, flush, Errors} from '@oclif/core';
import Bugsnag from '@bugsnag/js';
import {error as kitError, environment} from '@shopify/cli-kit';

function runCreateApp() {
  if (!process.argv.includes('init')) {
    process.argv.push('init');
  }

  // Start the CLI
  run(undefined, import.meta.url)
    .then(flush)
    .catch((error: Error): Promise<void | Error> => {
      const oclifHandle = Errors.handle;
      const kitHandle = kitError.handler;
      // eslint-disable-next-line promise/no-nesting
      return kitHandle(error).then(oclifHandle);
    });
}

export default runCreateApp;
