import {ExtensionInstance} from '../../models/extensions/extension-instance.js'
import {outputContent, outputToken} from '@shopify/cli-kit/node/output'
import {InlineToken, AlertCustomSection} from '@shopify/cli-kit/node/ui'

type Format = 'json' | 'text'

interface FunctionInfoOptions {
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

export function buildTargetingData(
  config: FunctionConfiguration,
  functionDirectory: string,
): {[key: string]: {inputQueryPath?: string; export?: string}} {
  const targeting: {[key: string]: {inputQueryPath?: string; export?: string}} = {}
  config.targeting?.forEach((target) => {
    if (target.target) {
      targeting[target.target] = {
        ...(target.input_query && {inputQueryPath: `${functionDirectory}/${target.input_query}`}),
        ...(target.export && {export: target.export}),
      }
    }
  })
  return targeting
}

export function formatAsJson(
  ourFunction: ExtensionInstance,
  config: FunctionConfiguration,
  targeting: {[key: string]: {inputQueryPath?: string; export?: string}},
  functionRunnerPath: string,
  schemaPath?: string,
): string {
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
}

export function buildConfigurationSection(config: FunctionConfiguration, functionName: string): AlertCustomSection {
  return {
    title: 'CONFIGURATION\n',
    body: {
      tabularData: [
        ['Handle', config.handle ?? 'N/A'],
        ['Name', functionName ?? 'N/A'],
        ['API Version', config.api_version ?? 'N/A'],
      ],
      firstColumnSubdued: true,
    },
  }
}

export function buildTargetingSection(targeting: {
  [key: string]: {inputQueryPath?: string; export?: string}
}): AlertCustomSection | null {
  if (Object.keys(targeting).length === 0) {
    return null
  }

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

  return {
    title: '\nTARGETING\n',
    body: {
      tabularData: targetingData,
    },
  }
}

export function buildBuildSection(wasmPath: string, schemaPath?: string): AlertCustomSection {
  return {
    title: '\nBUILD\n',
    body: {
      tabularData: [
        ['Schema Path', {filePath: schemaPath ?? 'N/A'}],
        ['Wasm Path', {filePath: wasmPath}],
      ],
      firstColumnSubdued: true,
    },
  }
}

export function buildFunctionRunnerSection(functionRunnerPath: string): AlertCustomSection {
  return {
    title: '\nFUNCTION RUNNER\n',
    body: {
      tabularData: [['Path', {filePath: functionRunnerPath}]],
      firstColumnSubdued: true,
    },
  }
}

export function buildTextFormatSections(
  ourFunction: ExtensionInstance,
  config: FunctionConfiguration,
  targeting: {[key: string]: {inputQueryPath?: string; export?: string}},
  functionRunnerPath: string,
  schemaPath?: string,
): AlertCustomSection[] {
  const sections: AlertCustomSection[] = [buildConfigurationSection(config, ourFunction.name)]

  const targetingSection = buildTargetingSection(targeting)
  if (targetingSection) {
    sections.push(targetingSection)
  }

  sections.push(buildBuildSection(ourFunction.outputPath, schemaPath), buildFunctionRunnerSection(functionRunnerPath))

  return sections
}

export function functionInfo(
  ourFunction: ExtensionInstance,
  options: FunctionInfoOptions,
): string | AlertCustomSection[] {
  const {format, functionRunnerPath, schemaPath} = options
  const config = ourFunction.configuration as FunctionConfiguration

  const targeting = buildTargetingData(config, ourFunction.directory)

  if (format === 'json') {
    return formatAsJson(ourFunction, config, targeting, functionRunnerPath, schemaPath)
  }

  return buildTextFormatSections(ourFunction, config, targeting, functionRunnerPath, schemaPath)
}
