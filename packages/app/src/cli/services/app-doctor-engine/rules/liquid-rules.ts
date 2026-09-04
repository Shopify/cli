import {SourceCodeType, toLiquidHTMLAST, visit} from '@shopify/theme-check-node'
import type {Issue} from '../types.js'
import type {SourceFile} from './types.js'
import type {LiquidHtmlNode} from '@shopify/theme-check-node'

type LiquidVariableOutput = Extract<LiquidHtmlNode, {type: 'LiquidVariableOutput'}>
type AttributeNode = Extract<LiquidHtmlNode, {type: `Attr${string}`}>

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
    issues.push(...visit<SourceCodeType.LiquidHtml, Issue>(ast, liquidUnsafeRenderVisitor(file)))
    issues.push(...visit<SourceCodeType.LiquidHtml, Issue>(ast, liquidExecutableContextVisitor(file)))
  }
  return {issues, parserFailures}
}

function liquidUnsafeRenderVisitor(file: SourceFile) {
  return {
    LiquidVariableOutput(node: LiquidVariableOutput, ancestors: LiquidHtmlNode[]): Issue[] | undefined {
      const expression = outputSource(node)
      if (!/(?:\bmetafields?\b|\b(?:block|section)\.settings\b)/i.test(expression)) return undefined
      const filters = filterNames(node)
      const context = liquidOutputContext(ancestors)
      if (isSafelyRendered(filters, context)) return undefined
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

function attributeName(attribute: AttributeNode): string {
  if (!('name' in attribute) || !Array.isArray(attribute.name)) return ''
  return attribute.name.map((part) => ('value' in part && typeof part.value === 'string' ? part.value : '')).join('')
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
): Issue {
  const lineStart = file.content!.lastIndexOf('\n', Math.max(0, offset - 1)) + 1
  return {
    id,
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
