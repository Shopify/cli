import {chooseFunction, functionFlags, getOrGenerateSchemaPath} from '../../../services/function/common.js'
import {functionRunnerBinary, downloadBinary} from '../../../services/function/binaries.js'
import {localAppContext} from '../../../services/app-context.js'
import {appFlags} from '../../../flags.js'
import AppUnlinkedCommand, {AppUnlinkedCommandOutput} from '../../../utilities/app-unlinked-command.js'
import {globalFlags, jsonFlag} from '@shopify/cli-kit/node/cli'
import {outputContent, outputResult, outputToken} from '@shopify/cli-kit/node/output'
import {renderInfo} from '@shopify/cli-kit/node/ui'

export default class FunctionInfo extends AppUnlinkedCommand {
  static summary = 'Print basic information about your function.'

  static descriptionWithMarkdown = `The information returned includes the following:

  - The function handle
  - The function name
  - The function API version
  - The function runner path
  - The schema path
  - The WASM path
  - The targeting configuration`

  static description = this.descriptionWithoutMarkdown()

  static flags = {
    ...globalFlags,
    ...appFlags,
    ...functionFlags,
    ...jsonFlag,
  }

  public async run(): Promise<AppUnlinkedCommandOutput> {
    const {flags} = await this.parse(FunctionInfo)

    const app = await localAppContext({
      directory: flags.path,
      userProvidedConfigName: flags.config,
    })

    const ourFunction = await chooseFunction(app, flags.path)
    const functionRunner = functionRunnerBinary()
    await downloadBinary(functionRunner)

    const targeting: {[key: string]: {inputQueryPath?: string; export?: string}} = {}
    ourFunction?.configuration.targeting?.forEach((target) => {
      if (target.target) {
        targeting[target.target] = {
          ...(target.input_query && {inputQueryPath: `${ourFunction.directory}/${target.input_query}`}),
          ...(target.export && {export: target.export}),
        }
      }
    })

    const schemaPath = await getOrGenerateSchemaPath(
      ourFunction,
      flags.path,
      flags['client-id'],
      flags.reset,
      flags.config,
    )

    if (flags.json) {
      outputResult(
        JSON.stringify(
          {
            handle: ourFunction.configuration.handle,
            name: ourFunction.name,
            apiVersion: ourFunction.configuration.api_version,
            functionRunnerPath: functionRunner.path,
            schemaPath,
            wasmPath: ourFunction.outputPath,
            targeting,
          },
          null,
          2,
        ),
      )
    } else {
      const sections: {title: string; body: {list: {items: string[]}}}[] = [
        {
          title: 'CONFIGURATION',
          body: {
            list: {
              items: [
                outputContent`Handle: ${ourFunction.configuration.handle ?? 'N/A'}`.value,
                outputContent`Name: ${ourFunction.name ?? 'N/A'}`.value,
                outputContent`API Version: ${ourFunction.configuration.api_version ?? 'N/A'}`.value,
              ],
            },
          },
        },
        {
          title: 'FUNCTION RUNNER',
          body: {
            list: {
              items: [outputContent`Path: ${functionRunner.path}`.value],
            },
          },
        },
        {
          title: 'BUILD',
          body: {
            list: {
              items: [
                outputContent`Schema Path: ${outputToken.path(schemaPath ?? 'N/A')}`.value,
                outputContent`Wasm Path: ${outputToken.path(ourFunction.outputPath)}`.value,
              ],
            },
          },
        },
      ]

      if (Object.keys(targeting).length > 0) {
        const targetingItems = Object.entries(targeting).map(([target, config]) => {
          const parts = [outputContent`${outputToken.cyan(target)}`.value]
          if (config.inputQueryPath) {
            parts.push(outputContent`  Input Query Path: ${outputToken.path(config.inputQueryPath)}`.value)
          }
          if (config.export) {
            parts.push(outputContent`  Export: ${config.export}`.value)
          }
          return parts.join('\n')
        })

        sections.push({
          title: 'TARGETING',
          body: {
            list: {
              items: targetingItems,
            },
          },
        })
      }

      renderInfo({
        customSections: sections,
      })
    }

    return {app}
  }
}
