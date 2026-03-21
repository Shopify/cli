import {AbortError} from '@shopify/cli-kit/node/error'
import {fileExists, mkdir, readFile, writeFile} from '@shopify/cli-kit/node/fs'
import {fetch} from '@shopify/cli-kit/node/http'
import {joinPath} from '@shopify/cli-kit/node/path'
import {parseJSON} from '@shopify/theme-check-node'

interface JsConfigFile {
  include?: string[]
  files?: string[]
  [key: string]: unknown
}

const standardEventsDefinitionFile = 'standard-events.d.ts'
const globalTypesFile = 'global.d.ts'
const jsConfigFile = 'jsconfig.json'
const globalTypesComment = '// Add custom global types here\n'
const defaultJsConfigIncludes = ['./**/*.js', './**/*.mjs', './**/*.cjs', './**/*.ts', './**/*.d.ts']
const wiredTypeFiles = [`./${standardEventsDefinitionFile}`, `./${globalTypesFile}`]
const htmlDocumentRE = /^\s*<(?:!doctype\s+html|html)\b/i
const headTagRE = /<head(\s[^>]*)?>/i

export const standardEventsBaseUrl = 'https://standard-events.quick.shopify.io'
export const standardEventsDefinitionsUrl = `${standardEventsBaseUrl}/standard-events.d.ts`
export const standardEventsRuntimeUrl = `${standardEventsBaseUrl}/standard-events.js`
export const standardEventsRuntimeDevUrl = `${standardEventsBaseUrl}/standard-events.dev.js`
export const standardEventsInspectorUrl = `${standardEventsBaseUrl}/events-inspector.js`
export const standardEventsInspectorScriptId = 'shopify-cli-standard-events-inspector'
const standardEventsRuntimeRE = new RegExp(escapeRegExp(standardEventsRuntimeUrl), 'g')

export async function prepareStandardEventsSupport(themeDirectory: string) {
  const assetsDirectory = joinPath(themeDirectory, 'assets')
  const standardEventsDefinitionPath = joinPath(assetsDirectory, standardEventsDefinitionFile)
  const globalTypesPath = joinPath(assetsDirectory, globalTypesFile)
  const jsConfigPath = joinPath(assetsDirectory, jsConfigFile)

  const [hasStandardEventsDefinitions, hasGlobalTypes, hasJsConfig] = await Promise.all([
    fileExists(standardEventsDefinitionPath),
    fileExists(globalTypesPath),
    fileExists(jsConfigPath),
  ])

  const [existingStandardEventsDefinitions, existingJsConfig, standardEventsDefinitionsResult] = await Promise.all([
    hasStandardEventsDefinitions ? readFile(standardEventsDefinitionPath) : undefined,
    hasJsConfig ? readFile(jsConfigPath) : undefined,
    downloadStandardEventsDefinitions().then(
      (content) => ({ok: true as const, content}),
      (error: unknown) => ({ok: false as const, error}),
    ),
    mkdir(assetsDirectory),
  ])

  if (!standardEventsDefinitionsResult.ok && !hasStandardEventsDefinitions) {
    throw standardEventsDefinitionsResult.error
  }

  const nextJsConfig = updateJsConfig(existingJsConfig)
  const nextJsConfigContent = `${JSON.stringify(nextJsConfig, null, 2)}\n`
  const writePromises = []

  if (existingJsConfig !== nextJsConfigContent) {
    writePromises.push(writeFile(jsConfigPath, nextJsConfigContent))
  }

  if (
    standardEventsDefinitionsResult.ok &&
    existingStandardEventsDefinitions !== standardEventsDefinitionsResult.content
  ) {
    writePromises.push(writeFile(standardEventsDefinitionPath, standardEventsDefinitionsResult.content))
  }

  if (!hasGlobalTypes) {
    writePromises.push(writeFile(globalTypesPath, globalTypesComment))
  }

  await Promise.all(writePromises)
}

export function injectStandardEventsInspector(html: string) {
  const patchedHtml = rewriteStandardEventsRuntimeReferences(html)

  if (patchedHtml.includes(standardEventsInspectorScriptId) || patchedHtml.includes(standardEventsInspectorUrl)) {
    return patchedHtml
  }

  return patchedHtml.replace(
    headTagRE,
    (headTag: string) =>
      `${headTag}<script id="${standardEventsInspectorScriptId}" src="${standardEventsInspectorUrl}" defer></script>`,
  )
}

export function rewriteStandardEventsRuntimeReferences(content: string) {
  return content.replace(standardEventsRuntimeRE, standardEventsRuntimeDevUrl)
}

async function downloadStandardEventsDefinitions() {
  const response = await fetch(standardEventsDefinitionsUrl, undefined, 'slow-request')

  if (!response.ok) {
    throw new AbortError(
      'Failed to download standard events definitions.',
      `${response.status} ${response.statusText}`.trim(),
    )
  }

  const content = await response.text()
  const contentType = response.headers.get('content-type') ?? ''

  if (contentType.includes('text/html') || htmlDocumentRE.test(content)) {
    throw new AbortError(
      'Failed to download standard events definitions.',
      `Received HTML instead of TypeScript from ${standardEventsDefinitionsUrl}.`,
    )
  }

  return content.endsWith('\n') ? content : `${content}\n`
}

function updateJsConfig(fileContent?: string) {
  if (!fileContent) {
    return {
      checkJs: false,
      include: defaultJsConfigIncludes,
      files: wiredTypeFiles,
    }
  }

  const parsed = parseJSON(fileContent, null, true) as JsConfigFile | undefined

  if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
    throw new AbortError(`Failed to update assets/${jsConfigFile}.`, 'The existing file is not valid JSON.')
  }

  const jsConfig: JsConfigFile = {...parsed}

  if (jsConfig.files !== undefined) {
    jsConfig.files = appendTypeEntries(jsConfig.files, 'files')
    return jsConfig
  }

  if (jsConfig.include !== undefined) {
    validateTypeEntries(jsConfig.include, 'include')
    jsConfig.files = [...wiredTypeFiles]
    return jsConfig
  }

  jsConfig.include = defaultJsConfigIncludes
  jsConfig.files = [...wiredTypeFiles]
  return jsConfig
}

function appendTypeEntries(entries: unknown, fieldName: 'include' | 'files') {
  validateTypeEntries(entries, fieldName)

  const nextEntries = [...entries]

  for (const entry of wiredTypeFiles) {
    if (!nextEntries.includes(entry)) {
      nextEntries.push(entry)
    }
  }

  return nextEntries
}

function validateTypeEntries(entries: unknown, fieldName: 'include' | 'files'): asserts entries is string[] {
  if (!Array.isArray(entries) || !entries.every((entry) => typeof entry === 'string')) {
    throw new AbortError(`Failed to update assets/${jsConfigFile}.`, `The "${fieldName}" field must be a string array.`)
  }
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
