import {functionInfoJsonOutputSchema, type FunctionInfoResult, type FunctionTargeting} from './info-types.js'
import {outputContent, outputResult, outputToken} from '@shopify/cli-kit/node/output'
import {renderInfo, type AlertCustomSection, type InlineToken} from '@shopify/cli-kit/node/ui'

type FunctionInfoOutputFormat = 'json' | 'text'

export function presentFunctionInfoResult(result: FunctionInfoResult, format: FunctionInfoOutputFormat): void {
  if (format === 'json') {
    outputResult(encodeFunctionInfoJson(result))
    return
  }

  renderInfo({customSections: buildTextFormatSections(result)})
}

export function encodeFunctionInfoJson(result: FunctionInfoResult): string {
  return JSON.stringify(functionInfoJsonOutputSchema.schema.parse(result), null, 2)
}

export function buildConfigurationSection(result: FunctionInfoResult): AlertCustomSection {
  return {
    title: 'CONFIGURATION\n',
    body: {
      tabularData: [
        ['Handle', result.handle ?? 'N/A'],
        ['Name', result.name],
        ['API Version', result.apiVersion ?? 'N/A'],
      ],
      firstColumnSubdued: true,
    },
  }
}

export function buildTargetingSection(targeting: Record<string, FunctionTargeting>): AlertCustomSection | undefined {
  if (Object.keys(targeting).length === 0) return undefined

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
    body: {tabularData: targetingData},
  }
}

export function buildBuildSection(result: FunctionInfoResult): AlertCustomSection {
  return {
    title: '\nBUILD\n',
    body: {
      tabularData: [
        ['Schema Path', {filePath: result.schemaPath ?? 'N/A'}],
        ['Wasm Path', {filePath: result.wasmPath}],
      ],
      firstColumnSubdued: true,
    },
  }
}

function buildFunctionRunnerSection(functionRunnerPath: string): AlertCustomSection {
  return {
    title: '\nFUNCTION RUNNER\n',
    body: {
      tabularData: [['Path', {filePath: functionRunnerPath}]],
      firstColumnSubdued: true,
    },
  }
}

export function buildTextFormatSections(result: FunctionInfoResult): AlertCustomSection[] {
  const sections = [buildConfigurationSection(result)]
  const targetingSection = buildTargetingSection(result.targeting)

  if (targetingSection) sections.push(targetingSection)

  sections.push(buildBuildSection(result), buildFunctionRunnerSection(result.functionRunnerPath))
  return sections
}
