import {bundle} from './deploy/bundle'
import {upload} from './deploy/upload'

import {ensureDeployEnvironment} from './environment'
import {App} from '../models/app/app'
import {path, output, temporary} from '@shopify/cli-kit'

interface DeployOptions {
  /** The app to be built and uploaded */
  app: App
}

export const deploy = async (options: DeployOptions) => {
  const {app, identifiers} = await ensureDeployEnvironment({app: options.app})
  const apiKey = identifiers.app

  output.newline()
  output.info('Pushing your code to Shopify...')

  output.newline()
  output.success(`${app.name} deployed to Shopify Partners`)

  await temporary.directory(async (tmpDir) => {
    const bundlePath = path.join(tmpDir, `${app.name}.zip`)
    await bundle({app, bundlePath, identifiers})
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
