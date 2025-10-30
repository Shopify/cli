import {ExtensionInstance} from '../../models/extensions/extension-instance.js'
import {outputContent, outputToken} from '@shopify/cli-kit/node/output'
import {InlineToken, AlertCustomSection} from '@shopify/cli-kit/node/ui'

export type Format = 'json' | 'text'

export interface FunctionInfoOptions {
  format: Format
  functionRunnerPath: string
  schemaPath?: string
}

interface FunctionConfiguration {
  handle?: string
  name?: string
  api_version?: string
  targeting?: {
    target: string
    input_query?: string
    export?: string
  }[]
}

export function functionInfo(
  ourFunction: ExtensionInstance,
  options: FunctionInfoOptions,
): string | AlertCustomSection[] {
  const {format, functionRunnerPath, schemaPath} = options
  const config = ourFunction.configuration as FunctionConfiguration

  // Build targeting data structure
  const targeting: {[key: string]: {inputQueryPath?: string; export?: string}} = {}
  config.targeting?.forEach((target) => {
    if (target.target) {
      targeting[target.target] = {
        ...(target.input_query && {inputQueryPath: `${ourFunction.directory}/${target.input_query}`}),
        ...(target.export && {export: target.export}),
      }
    }
  })

  if (format === 'json') {
    return JSON.stringify(
      {
        handle: config.handle,
        name: ourFunction.name,
        apiVersion: config.api_version,
        targeting,
        schemaPath,
        wasmPath: ourFunction.outputPath,
        functionRunnerPath,
      },
      null,
      2,
    )
  } else {
    const sections: AlertCustomSection[] = [
      {
        title: 'CONFIGURATION\n',
        body: {
          tabularData: [
            ['Handle', config.handle ?? 'N/A'],
            ['Name', ourFunction.name ?? 'N/A'],
            ['API Version', config.api_version ?? 'N/A'],
          ],
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
          tabularData: [['Path', {filePath: functionRunnerPath}]],
          firstColumnSubdued: true,
        },
      },
    )

    return sections
  }
}
