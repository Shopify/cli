import type {Issue} from '../types.js'
import type {SourceFile} from './types.js'

const JAVASCRIPT_EXTENSIONS = new Set(['.js', '.jsx', '.mjs', '.cjs', '.ts', '.tsx', '.mts', '.cts'])
const CSP_FRAME_ANCESTORS_DIRECTIVE = /\bContent-Security-Policy\b[^\r\n]{0,300}?\bframe-ancestors\b([^;\r\n]*)/gi
const CLEARLY_PERMISSIVE_SOURCE = /(^|\s)\*(?=\s|["'`;,}]|$)|https?:\/\/\*\.myshopify\.com/i

export function scanStaticFrameAncestors(files: SourceFile[]): Issue[] {
  const issues: Issue[] = []
  for (const file of files) {
    if (!file.content || !JAVASCRIPT_EXTENSIONS.has(file.ext)) continue
    const source = stripCommentsOnly(file.content)
    CSP_FRAME_ANCESTORS_DIRECTIVE.lastIndex = 0
    let directive = CSP_FRAME_ANCESTORS_DIRECTIVE.exec(source)
    while (directive) {
      if (CLEARLY_PERMISSIVE_SOURCE.test(directive[1] ?? '')) {
        issues.push({
          id: 'STATIC_FRAME_ANCESTORS',
          severity: 'high',
          points: -12,
          title: 'Embedded app frame-ancestors uses a wildcard',
          message: 'A literal frame-ancestors directive allows arbitrary or wildcard embedding origins.',
          location: {file: file.path, line: source.slice(0, directive.index).split('\n').length},
          fix: {
            automated: false,
            description: 'Restrict frame-ancestors to Shopify Admin and the authenticated shop origin.',
            guide: 'https://shopify.dev/docs/apps/build/security/set-up-iframe-protection',
          },
        })
      }
      directive = CSP_FRAME_ANCESTORS_DIRECTIVE.exec(source)
    }
  }
  return issues
}
function stripCommentsOnly(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, ' '))
    .replace(/(^|\s)\/\/[^\n]*/g, '$1')
}
