import type {Issue} from '../types.js'
import type {SourceFile} from './types.js'

const JAVASCRIPT_EXTENSIONS = new Set(['.js', '.jsx', '.mjs', '.cjs', '.ts', '.tsx', '.mts', '.cts'])
const SCRIPT_TAG_CREATION_PATTERN = [
  /\bscriptTagCreate\b|\bscriptTagUpdate\b/,
  /\bnew\s+[\w.]*\bScriptTag\s*\(/,
  /\b(?:post|put)\b[^\n]{0,120}script_tags/i,
]

export function scanDeprecatedScriptTagApi(files: SourceFile[]): Issue[] {
  const issues: Issue[] = []
  for (const file of files) {
    if (!file.content || !JAVASCRIPT_EXTENSIONS.has(file.ext)) continue
    const content = stripComments(file.content)
    for (const pattern of SCRIPT_TAG_CREATION_PATTERN) {
      const match = pattern.exec(content)
      if (!match) continue
      issues.push({
        id: 'DEPRECATED_SCRIPT_TAG_SCOPE',
        severity: 'medium',
        points: -10,
        title: 'Deprecated ScriptTag capability',
        message:
          'This code uses the deprecated ScriptTag API. Remotely hosted storefront JavaScript can be silently replaced outside extension review and versioning.',
        location: {file: file.path, line: lineAt(content, match.index)},
        fix: {
          automated: false,
          description: 'Migrate storefront UI to a theme app extension or analytics to a web pixel.',
          guide: 'https://shopify.dev/docs/apps/build/online-store/theme-app-extensions',
        },
      })
      break
    }
  }
  return issues
}

function stripComments(content: string): string {
  return content.replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, ' ')).replace(/\/\/[^\n]*/g, '')
}

function lineAt(content: string, index: number): number {
  return content.slice(0, index).split('\n').length
}
