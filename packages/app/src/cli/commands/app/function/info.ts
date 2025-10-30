import {chooseFunction, functionFlags, getOrGenerateSchemaPath} from '../../../services/function/common.js'
import {functionRunnerBinary, downloadBinary} from '../../../services/function/binaries.js'
import {localAppContext} from '../../../services/app-context.js'
import {appFlags} from '../../../flags.js'
import AppUnlinkedCommand, {AppUnlinkedCommandOutput} from '../../../utilities/app-unlinked-command.js'
import {globalFlags, jsonFlag} from '@shopify/cli-kit/node/cli'
import {outputContent, outputResult, outputToken} from '@shopify/cli-kit/node/output'
import {InlineToken, renderInfo} from '@shopify/cli-kit/node/ui'

export default class FunctionInfo extends AppUnlinkedCommand {
  static summary = 'Print basic information about your function.'

  static descriptionWithMarkdown = `The information returned includes the following:

  - The function handle
  - The function name
  - The function API version
  - The targeting configuration
  - The schema path
  - The WASM path
  - The function runner path`

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
            targeting,
            schemaPath,
            wasmPath: ourFunction.outputPath,
            functionRunnerPath: functionRunner.path,
          },
          null,
          2,
        ),
      )
    } else {
      const configData: InlineToken[][] = [
        ['Handle', ourFunction.configuration.handle ?? 'N/A'],
        ['Name', ourFunction.name ?? 'N/A'],
        ['API Version', ourFunction.configuration.api_version ?? 'N/A'],
      ]

      const sections: {title: string; body: {tabularData: InlineToken[][]; firstColumnSubdued?: boolean}}[] = [
        {
          title: 'CONFIGURATION\n',
          body: {
            tabularData: configData,
            firstColumnSubdued: true,
          },
        },
      ]

      if (Object.keys(targeting).length > 0) {
        const targetingData: InlineToken[][] = []
        Object.entries(targeting).forEach(([target, config]) => {
          targetingData.push([outputContent`${outputToken.cyan(target)}`.value, ''])
          if (config.inputQueryPath) {
            targetingData.push([{subdued: '  Input Query Path'}, {filePath: config.inputQueryPath}])
          }
          if (config.export) {
            targetingData.push([{subdued: '  Export'}, config.export])
          }
        })

        sections.push({
          title: '\nTARGETING\n',
          body: {
            tabularData: targetingData,
          },
        })
      }

      sections.push(
        {
          title: '\nBUILD\n',
          body: {
            tabularData: [
              ['Schema Path', {filePath: schemaPath ?? 'N/A'}],
              ['Wasm Path', {filePath: ourFunction.outputPath}],
            ],
            firstColumnSubdued: true,
          },
        },
        {
          title: '\nFUNCTION RUNNER\n',
          body: {
            tabularData: [['Path', {filePath: functionRunner.path}]],
            firstColumnSubdued: true,
          },
        },
      )

      renderInfo({
        customSections: sections,
      })
    }

    return {app}
  }
}
