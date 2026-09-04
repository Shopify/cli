import type {Issue} from '../types.js'
import type {SourceFile} from './types.js'

const ACTIVE_RESPONSE_TYPE = /(?:application\/liquid|text\/liquid|text\/html|application\/x-liquid)/i
const REQUEST_SOURCE =
  /(?:req|request)\.(?:query|params|body)|(?:searchParams|formData)\.get\s*\(|await\s+(?:req|request)\.(?:text|json|formData)\s*\(/
const RESPONSE_SINK = /(?:new\s+Response|Response\.json|res\.(?:send|end|write)|return\s+[`"'])/

export function scanAppProxyLiquidInjection(files: SourceFile[]): Issue[] {
  const issues: Issue[] = []
  for (const file of files) {
    if (!file.content || !['.js', '.ts', '.jsx', '.tsx'].includes(file.ext)) continue
    const source = stripComments(file.content)
    if (!ACTIVE_RESPONSE_TYPE.test(source) || !REQUEST_SOURCE.test(source) || !RESPONSE_SINK.test(source)) continue

    const requestBindings = new Set<string>()
    const bindingPattern = /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*([^;\n]+)/g
    let binding = bindingPattern.exec(source)
    while (binding) {
      if (binding[1] && binding[2] && REQUEST_SOURCE.test(binding[2])) requestBindings.add(binding[1])
      binding = bindingPattern.exec(source)
    }
    const directFlow = new RegExp(
      `(?:new\\s+Response|res\\.(?:send|end|write))\\s*\\([\\s\\S]{0,500}(?:${
        [...requestBindings].map(escapeRegExp).join('|') || 'request\\.(?:query|params|body)|searchParams\\.get'
      })`,
    ).exec(source)
    if (!directFlow) continue
    issues.push({
      id: 'APP_PROXY_LIQUID_INJECTION',
      severity: 'high',
      points: -20,
      title: 'App proxy Liquid injection risk',
      message: 'Request-controlled data flows into an active Liquid or HTML app-proxy response.',
      location: {file: file.path, line: source.slice(0, directFlow.index).split('\n').length},
      fix: {
        automated: false,
        description: 'Return inert JSON, or render only trusted templates with context-appropriate escaping.',
        guide: 'https://shopify.dev/docs/apps/online-store/app-proxies',
      },
    })
  }
  return issues
}

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, ' ')).replace(/\/\/[^\n]*/g, '')
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
