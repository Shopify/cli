import {functionFlags} from '../../../services/function/common.js'
import {load as loadApp} from '../../../models/app/loader.js'
import {loadExtensionsSpecifications} from '../../../models/extensions/specifications.js'
import {AppInterface} from '../../../models/app/app.js'
import Command from '@shopify/cli-kit/node/base-command'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import {Flags} from '@oclif/core'
import {joinPath} from '@shopify/cli-kit/node/path'
import {AbortError} from '@shopify/cli-kit/node/error.js'

export default class Workspaces extends Command {
  static description = 'Run a Function locally for testing.'

  static flags = {
    ...globalFlags,
    ...functionFlags,
    json: Flags.boolean({
      char: 'j',
      hidden: false,
      description: 'Log the run result as a JSON object.',
      env: 'SHOPIFY_FLAG_JSON',
    }),
  }

  public async run() {
    const {flags} = await this.parse(Workspaces)
    const specifications = await loadExtensionsSpecifications(this.config)
    const app: AppInterface = await loadApp({specifications, directory: flags.path, mode: 'report'})

    if (app.usesWorkspaces) return
    if (app.configuration.extensionDirectories !== undefined) {
      throw new AbortError(
        'App uses extensionDirectories, which are incompatible with workspaces',
        'Move your extensions under the /extensions directory and run `shopify app migrate workspaces`',
      )
    }

    // copilot: update the app package.json to support workspaces
    const packageJsonPath = joinPath(flags.path, 'package.json')

    // copilot: create a package.json file in the extension directory
    app.extensions.ui.forEach((extension) => {
      const extensionPath = extension.directory
      const packageJsonPath = joinPath(extensionPath, 'package.json')
      const dependencies = extension.dependency
        ? {[extension.dependency.name]: extension.dependency.version}
        : undefined
      const packageJson = {
        name: extension.configuration.name,
        version: '1.0.0',
        description: '',
        main: 'index.js',
        scripts: {
          test: 'echo "Error: no test specified" && exit 1',
        },
        dependencies,
        keywords: [],
      }
    })
  }
}
