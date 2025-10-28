import {chooseFunction, functionFlags, getOrGenerateSchemaPath} from '../../../services/function/common.js'
import {functionRunnerBinary, downloadBinary} from '../../../services/function/binaries.js'
import {localAppContext} from '../../../services/app-context.js'
import {appFlags} from '../../../flags.js'
import AppUnlinkedCommand, {AppUnlinkedCommandOutput} from '../../../utilities/app-unlinked-command.js'
import {globalFlags, jsonFlag} from '@shopify/cli-kit/node/cli'
import {outputContent, outputResult, outputToken} from '@shopify/cli-kit/node/output'
import {renderInfo} from '@shopify/cli-kit/node/ui'

export default class FunctionInfo extends AppUnlinkedCommand {
  static summary = 'Get information about the function.'

  static description = 'Returns information about the function.'

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
            functionRunnerPath: functionRunner.path,
            targeting,
            schemaPath,
            wasmPath: ourFunction.outputPath,
          },
          null,
          2,
        ),
      )
    } else {
      const sections: {title: string; body: {list: {items: string[]}}}[] = [
        {
          title: 'FUNCTION RUNNER',
          body: {
            list: {
              items: [outputContent`Path: ${outputToken.path(functionRunner.path)}`.value],
            },
          },
        },
        {
          title: 'FUNCTION BUILD',
          body: {
            list: {
              items: [
                outputContent`Schema Path: ${outputToken.path(schemaPath ?? 'N/A')}`.value,
                outputContent`WASM Path: ${outputToken.path(ourFunction.outputPath)}`.value,
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
        headline: 'FUNCTION INFORMATION.',
        customSections: sections,
      })
    }

    return {app}
  }
}
