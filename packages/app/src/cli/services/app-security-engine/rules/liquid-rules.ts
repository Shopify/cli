import {SourceCodeType, toLiquidHTMLAST, visit} from '@shopify/theme-check-node'
import type {Issue} from '../types.js'
import type {SourceFile} from './types.js'
import type {LiquidHtmlNode} from '@shopify/theme-check-node'

type LiquidVariableOutput = Extract<LiquidHtmlNode, {type: 'LiquidVariableOutput'}>
type AttributeNode = Extract<LiquidHtmlNode, {type: `Attr${string}`}>
type LiquidVariableMarkup = Exclude<LiquidVariableOutput['markup'], string>
type LiquidFilterArgument = LiquidVariableMarkup['filters'][number]['args'][number]

interface LiquidScanResult {
  issues: Issue[]
  parserFailures: string[]
}

/** Parse each theme-extension file once and run isolated public AST visitors. */
export function scanLiquidSecurity(files: SourceFile[]): LiquidScanResult {
  const issues: Issue[] = []
  const parserFailures: string[] = []
  for (const file of files) {
    if (!file.content || !['.liquid', '.html'].includes(file.ext)) continue
    let ast: ReturnType<typeof toLiquidHTMLAST>
    try {
      ast = toLiquidHTMLAST(file.content)
      // Parser failures are coverage gaps and are handed to the agent tier.
      // eslint-disable-next-line no-catch-all/no-catch-all
    } catch {
      parserFailures.push(file.path)
      continue
    }
    if (ast instanceof Error) {
      parserFailures.push(file.path)
      continue
    }
    // In an app block, `block.settings` is described by the file's own schema, but `section.settings` belongs to
    // the host theme section, so only app block files can exempt settings.
    const schemaSettings = APP_BLOCK_FILE.test(file.path) ? extractSchemaSettings(file.content) : undefined
    issues.push(...visit<SourceCodeType.LiquidHtml, Issue>(ast, liquidUnsafeRenderVisitor(file, schemaSettings)))
    issues.push(...visit<SourceCodeType.LiquidHtml, Issue>(ast, liquidExecutableContextVisitor(file)))
  }
  return {issues, parserFailures}
}

interface SchemaSetting {
  type?: unknown
  options?: unknown
}

const URL_ATTRIBUTE_NAMES = new Set(['href', 'src', 'action', 'formaction', 'poster', 'cite', 'xlink:href'])
const INERT_OPTION_VALUE = /^[A-Za-z0-9\-._~:/?#@!$()*+,;%]*$/
const APP_BLOCK_FILE = /(?:^|[\\/])blocks[\\/][^\\/]+$/

// Extract id -> setting from the file's {% schema %} JSON. Returns undefined
// (fail-closed: no exemption) when the schema is missing, duplicated,
// unparseable, or has duplicate setting ids.
function extractSchemaSettings(content: string): Map<string, SchemaSetting> | undefined {
  const blocks = [...content.matchAll(/\{%-?\s*schema\s*-?%\}([\s\S]*?)\{%-?\s*endschema\s*-?%\}/g)]
  if (blocks.length !== 1) return undefined
  let parsed: unknown
  try {
    parsed = JSON.parse(blocks[0]![1]!.trim())
    // Unparseable schema fails closed: no exemption.
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch {
    return undefined
  }
  if (!parsed || typeof parsed !== 'object') return undefined
  const settings = (parsed as {settings?: unknown}).settings
  if (!Array.isArray(settings)) return undefined
  const byId = new Map<string, SchemaSetting>()
  for (const setting of settings) {
    if (!setting || typeof setting !== 'object') continue
    const id = (setting as {id?: unknown}).id
    if (typeof id !== 'string' || id === '') continue
    if (byId.has(id)) return undefined
    byId.set(id, setting as SchemaSetting)
  }
  return byId
}

function isSchemaExemptSetting(
  node: LiquidVariableOutput,
  schemaSettings: Map<string, SchemaSetting> | undefined,
): boolean {
  if (!schemaSettings || typeof node.markup === 'string') return false
  const {expression, filters} = node.markup
  // Filter arguments are rendered too (for example `default: block.settings.title`), so only literals are allowed.
  if (!filters.every((filter) => filter.args.every(isLiteralFilterArgument))) return false
  const settingId = blockSettingId(expression)
  if (settingId === undefined) return false
  const setting = schemaSettings.get(settingId)
  if (!setting) return false
  if (setting.type === 'checkbox' || setting.type === 'range') return true
  if (setting.type === 'select' || setting.type === 'radio') {
    if (!Array.isArray(setting.options) || setting.options.length === 0) return false
    return setting.options.every((option) => {
      if (!option || typeof option !== 'object') return false
      const value = (option as {value?: unknown}).value
      return typeof value === 'string' && INERT_OPTION_VALUE.test(value)
    })
  }
  return false
}

/** The `<id>` of an exact `block.settings.<id>` lookup, or undefined for any other expression. */
function blockSettingId(expression: LiquidVariableMarkup['expression']): string | undefined {
  if (expression.type !== 'VariableLookup' || expression.name !== 'block' || expression.lookups.length !== 2) {
    return undefined
  }
  const [settings, id] = expression.lookups
  if (settings?.type !== 'String' || settings.value !== 'settings' || id?.type !== 'String') return undefined
  return id.value
}

function isLiteralFilterArgument(argument: LiquidFilterArgument): boolean {
  const value = argument.type === 'NamedArgument' ? argument.value : argument
  return value.type === 'String' || value.type === 'Number' || value.type === 'LiquidLiteral'
}

function liquidUnsafeRenderVisitor(file: SourceFile, schemaSettings?: Map<string, SchemaSetting>) {
  return {
    LiquidVariableOutput(node: LiquidVariableOutput, ancestors: LiquidHtmlNode[]): Issue[] | undefined {
      const expression = outputSource(node)
      if (!/(?:\bmetafields?\b|\b(?:block|section)\.settings\b)/i.test(expression)) return undefined
      const filters = filterNames(node)
      const context = liquidOutputContext(ancestors)
      if (isSafelyRendered(filters, context)) return undefined
      if (
        (context === 'html_text' || (context === 'html_attribute' && !isUrlAttributeContext(ancestors))) &&
        isSchemaExemptSetting(node, schemaSettings)
      )
        return undefined
      return [
        makeLiquidIssue(
          'LIQUID_UNSAFE_RENDER',
          file,
          node.position.start,
          'Unsafe Liquid metafield or setting output',
          'A metafield or merchant-configurable setting is emitted without context-appropriate escaping or serialization. Liquid output is not automatically HTML-escaped.',
          unsafeRenderFix(context),
          'medium',
          -10,
          context,
        ),
      ]
    },
  }
}

function liquidExecutableContextVisitor(file: SourceFile) {
  return {
    LiquidVariableOutput(node: LiquidVariableOutput, ancestors: LiquidHtmlNode[]): Issue[] | undefined {
      const context = liquidOutputContext(ancestors)
      if (context !== 'javascript' && context !== 'executable_attribute') return undefined
      if (context === 'javascript' && filterNames(node).includes('json')) return undefined
      if (isStaticScriptAssetUrl(node, ancestors)) return undefined
      return [
        makeLiquidIssue(
          'UNSAFE_INNERHTML',
          file,
          node.position.start,
          'Unsafe HTML assignment',
          context === 'javascript'
            ? 'Dynamic Liquid output is embedded in JavaScript without JSON serialization.'
            : 'Dynamic Liquid output is embedded in an event handler, srcdoc, or script src attribute. HTML escaping alone does not make executable attributes safe.',
          context === 'javascript'
            ? 'Serialize the value with the json filter and consume it only as JavaScript data.'
            : 'Keep dynamic values out of executable attributes; use a fixed, versioned script asset and event listeners.',
          'high',
          -25,
          context,
        ),
      ]
    },
  }
}

type LiquidOutputContext = 'html_text' | 'html_attribute' | 'javascript' | 'executable_attribute'

function isSafelyRendered(filters: string[], context: LiquidOutputContext): boolean {
  if (context === 'javascript') return filters.includes('json')
  if (context === 'html_attribute') return filters.some((filter) => ['escape', 'escape_once'].includes(filter))
  if (context === 'executable_attribute') return false
  return filters.some((filter) => ['escape', 'escape_once', 'metafield_tag'].includes(filter))
}

function unsafeRenderFix(context: LiquidOutputContext): string {
  if (context === 'javascript') return 'Serialize JavaScript data with json and consume it as data.'
  if (context === 'executable_attribute')
    return "Don't place merchant-controlled Liquid output in event handlers, srcdoc, or script src attributes."
  return 'Use escape/escape_once for HTML text or attributes, or metafield_tag for supported rich content in HTML text.'
}

function liquidOutputContext(ancestors: LiquidHtmlNode[]): LiquidOutputContext {
  const script = ancestors.find((ancestor) => ancestor.type === 'HtmlRawNode' && ancestor.name === 'script')
  const attribute = ancestors.find((ancestor): ancestor is AttributeNode => ancestor.type.startsWith('Attr'))
  if (!attribute) return script ? 'javascript' : 'html_text'

  const name = attributeName(attribute)
  if (/^on/i.test(name) || name.toLowerCase() === 'srcdoc') return 'executable_attribute'
  if (name.toLowerCase() === 'src' && script) return 'executable_attribute'
  return 'html_attribute'
}

function isUrlAttributeContext(ancestors: LiquidHtmlNode[]): boolean {
  const attribute = ancestors.find((ancestor): ancestor is AttributeNode => ancestor.type.startsWith('Attr'))
  if (!attribute) return false
  return URL_ATTRIBUTE_NAMES.has(attributeName(attribute).toLowerCase())
}

function attributeName(attribute: AttributeNode): string {
  if (!('name' in attribute) || !Array.isArray(attribute.name)) return ''
  return attribute.name.map((part) => ('value' in part && typeof part.value === 'string' ? part.value : '')).join('')
}

function isStaticScriptAssetUrl(node: LiquidVariableOutput, ancestors: LiquidHtmlNode[]): boolean {
  const script = ancestors.find((ancestor) => ancestor.type === 'HtmlRawNode' && ancestor.name === 'script')
  const attribute = ancestors.find((ancestor): ancestor is AttributeNode => ancestor.type.startsWith('Attr'))
  if (!script || !attribute || attributeName(attribute).toLowerCase() !== 'src') return false

  return /^(['"])(?:\\.|(?!\1)[^\\\n])+\1\s*\|\s*asset_url\s*$/.test(outputSource(node).trim())
}

function outputSource(node: LiquidVariableOutput): string {
  return typeof node.markup === 'string' ? node.markup : node.markup.rawSource
}

function filterNames(node: LiquidVariableOutput): string[] {
  return typeof node.markup === 'string' ? [] : node.markup.filters.map((filter) => filter.name)
}

function makeLiquidIssue(
  id: string,
  file: SourceFile,
  offset: number,
  title: string,
  message: string,
  fix: string,
  severity: Issue['severity'],
  points: number,
  context: LiquidOutputContext,
): Issue {
  const lineStart = file.content!.lastIndexOf('\n', Math.max(0, offset - 1)) + 1
  return {
    id,
    pattern_id: `liquid-${context}`,
    severity,
    points,
    title,
    message,
    location: {
      file: file.path,
      line: file.content!.slice(0, offset).split('\n').length,
      column: offset - lineStart + 1,
    },
    snippet: file
      .content!.slice(
        offset,
        file.content!.indexOf('\n', offset) === -1 ? undefined : file.content!.indexOf('\n', offset),
      )
      .trim(),
    fix: {automated: false, description: fix},
  }
}
