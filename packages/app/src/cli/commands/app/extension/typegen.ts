import {appFlags} from '../../../flags.js'
import {buildGraphqlTypesForUIExtension} from '../../../services/function/build.js'
import {inExtensionContext} from '../../../services/function/common.js'
import AppCommand from '../../../utilities/app-command.js'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import {renderSuccess} from '@shopify/cli-kit/node/ui'

export default class ExtensionTypegen extends AppCommand {
  static summary = 'Generate GraphQL types for an extension.'

  // TODO: that site don't exist yet
  static descriptionWithMarkdown = `Creates GraphQL types based on your [input query](https://shopify.dev/docs/apps/extensions/input-output#input) for a function written in JavaScript.`

  static description = this.descriptionWithoutMarkdown()

  static flags = {
    ...globalFlags,
    ...appFlags,
  }

  public async run() {
    const {flags} = await this.parse(ExtensionTypegen)
    const app = await inExtensionContext({
      path: flags.path,
      apiKey: flags['client-id'],
      reset: flags.reset,
      userProvidedConfigName: flags.config,
      callback: async (app, _, extension) => {
        await buildGraphqlTypesForUIExtension(extension, {stdout: process.stdout, stderr: process.stderr, app})
        renderSuccess({headline: 'GraphQL types generated successfully.'})
        return app
      },
    })
    return {app}
  }
}
