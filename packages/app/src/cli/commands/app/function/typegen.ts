import {chooseFunction, functionFlags} from '../../../services/function/common.js'
import {buildGraphqlTypes} from '../../../services/function/build.js'
import {appFlags} from '../../../flags.js'
import AppUnlinkedCommand, {AppUnlinkedCommandOutput} from '../../../utilities/app-unlinked-command.js'
import {localAppContext} from '../../../services/app-context.js'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import {renderSuccess} from '@shopify/cli-kit/node/ui'

export default class FunctionTypegen extends AppUnlinkedCommand {
  static summary = 'Generate GraphQL types for a JavaScript function.'

  static descriptionWithMarkdown = `Creates GraphQL types based on your [input query](https://shopify.dev/docs/apps/functions/input-output#input) for a function written in JavaScript.`

  static description = this.descriptionWithoutMarkdown()

  static flags = {
    ...globalFlags,
    ...appFlags,
    ...functionFlags,
  }

  public async run(): Promise<AppUnlinkedCommandOutput> {
    const {flags} = await this.parse(FunctionTypegen)

    const app = await localAppContext({
      directory: flags.path,
      userProvidedConfigName: flags.config,
    })

    const ourFunction = await chooseFunction(app, flags.path)

    await buildGraphqlTypes(ourFunction)
    renderSuccess({headline: 'GraphQL types generated successfully.'})

    return {app}
  }
}
