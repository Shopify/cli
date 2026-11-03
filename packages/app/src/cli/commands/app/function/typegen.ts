import {chooseFunction, functionFlags} from '../../../services/function/common.js'
import {generateFunctionTypes} from '../../../services/function/typegen.js'
import {functionTypegenJsonOutputSchema} from '../../../services/function/typegen/types.js'
import {renderFunctionTypegenResult} from '../../../services/function/typegen/result.js'
import {appFlags} from '../../../flags.js'
import AppUnlinkedCommand, {AppUnlinkedCommandOutput} from '../../../utilities/app-unlinked-command.js'
import {localAppContext} from '../../../services/app-context.js'
import {globalFlags, jsonFlag} from '@shopify/cli-kit/node/cli'
import {renderConcurrent} from '@shopify/cli-kit/node/ui'
import {renderCommandEventAsJson, runWithCommandEvents} from '@shopify/cli-kit/node/command-events'
import {Writable} from 'stream'

export default class FunctionTypegen extends AppUnlinkedCommand {
  static jsonOutputSchema = functionTypegenJsonOutputSchema

  static summary = 'Generate GraphQL types for a function.'

  static descriptionWithMarkdown = `Creates GraphQL types based on your [input query](https://shopify.dev/docs/apps/functions/input-output#input) for a function. Supports JavaScript functions out of the box, or any language via the \`build.typegen_command\` configuration.`

  static description = this.descriptionForHelp()

  static flags = {
    ...globalFlags,
    ...appFlags,
    ...functionFlags,
    ...jsonFlag,
  }

  public async run(): Promise<AppUnlinkedCommandOutput> {
    const {flags} = await this.parse(FunctionTypegen)

    const {app} = await localAppContext({
      directory: flags.path,
      userProvidedConfigName: flags.config,
    })

    const ourFunction = await chooseFunction(app, flags.path)

    const execute = async (stdout: Writable, stderr: Writable) => {
      const result = await generateFunctionTypes(ourFunction, {stdout, stderr, app})
      renderFunctionTypegenResult(result, flags.json)
    }
    if (flags.json) {
      await runWithCommandEvents({outputMode: 'json', sink: renderCommandEventAsJson}, () =>
        renderConcurrent({
          processes: [{prefix: ourFunction.localIdentifier, action: execute}],
          showTimestamps: false,
        }),
      )
    } else {
      await execute(process.stdout, process.stderr)
    }

    return {app}
  }
}
