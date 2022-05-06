import {bundle} from './deploy/bundle'
import {upload} from './deploy/upload'

import {App} from '../models/app/app'
import {error, path, output, temporary} from '@shopify/cli-kit'

interface DeployOptions {
  /** The app to be built and uploaded */
  app: App
}

export const deploy = async ({app}: DeployOptions) => {
  ensureIdsPresence(app)

  const apiKey = app.configuration.id as string

  output.newline()
  output.info('Pushing your code to Shopify...')

  output.newline()
  output.success(`${app.configuration.name} deploy to Shopify Partners`)

  await temporary.directory(async (tmpDir) => {
    const bundlePath = path.join(tmpDir, `${app.configuration.name}.zip`)
    await bundle({app, bundlePath})
    await upload({apiKey, bundlePath})

    output.newline()
    output.info('Summary')
    app.extensions.ui.forEach((extension) => {
      output.info(
        output.content`${output.token.magenta('✔')} ${path.basename(
          extension.directory,
        )} is deployed to Shopify but not yet live`,
      )
    })
  })
}

/**
 * Given an app, it makes sures all of its blocks have an id that's necessary
 * for the platform to map the bundle artifact to the block on the platform.
 * @param app {App} The application whose ids' presence will be checked.
 */
function ensureIdsPresence(app: App) {
  const configurationFilesWithoutId = app.extensions.ui
    .filter((uiExtension) => uiExtension.configuration.id === undefined)
    .map((uiExtension) => uiExtension.configuration.path)
  if (!app.configuration.id) {
    configurationFilesWithoutId.push(app.configuration.path)
  }
  if (configurationFilesWithoutId.length !== 0) {
    const filesSequenceString = configurationFilesWithoutId.map((filePath) => path.relativize(filePath)).join(', ')
    const tryNext = 'Dev the project to populate the ids in the configuration files.'
    throw new error.Abort(
      `The following configuration files are missing the id attribute: ${filesSequenceString}`,
      tryNext,
    )
  }
}
