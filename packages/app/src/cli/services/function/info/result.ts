import {functionInfoJsonOutputSchema, type FunctionInfoResult} from './types.js'
import {outputContent, outputResult, outputToken} from '@shopify/cli-kit/node/output'
import {renderInfo, type InlineToken, type AlertCustomSection} from '@shopify/cli-kit/node/ui'

interface FunctionConfiguration {
  handle?: string
  api_version?: string
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

export function renderFunctionInfoResult(result: FunctionInfoResult, format: 'json' | 'text'): void {
  if (format === 'json') {
    outputResult(functionInfoJsonOutputSchema.encode(result))
    return
  }

  const info = result.function
  const targeting = Object.fromEntries(
    info.targets.map(({target, inputQueryPath, export: functionExport}) => [
      target,
      {inputQueryPath: inputQueryPath ?? undefined, export: functionExport ?? undefined},
    ]),
  )
  const sections = [
    buildConfigurationSection({handle: info.handle ?? undefined, api_version: info.apiVersion ?? undefined}, info.name),
  ]
  const targetingSection = buildTargetingSection(targeting)
  if (targetingSection) sections.push(targetingSection)
  sections.push(buildBuildSection(info.wasmPath, info.schemaPath ?? undefined))
  sections.push(buildFunctionRunnerSection(info.functionRunnerPath))
  renderInfo({customSections: sections})
}
