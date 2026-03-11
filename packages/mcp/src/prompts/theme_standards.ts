import {readFileSync, readdirSync} from 'fs'
import {join, dirname} from 'path'
import {fileURLToPath} from 'url'

import {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js'

const SKILL_DIR = join(dirname(fileURLToPath(import.meta.url)), 'skills', 'liquid-theme-standards')

function readSkillFile(): string {
  return readFileSync(join(SKILL_DIR, 'SKILL.md'), 'utf-8')
}

function readReferenceFiles(): Array<{name: string; content: string}> {
  const refsDir = join(SKILL_DIR, 'references')
  return readdirSync(refsDir)
    .filter((f) => f.endsWith('.md'))
    .sort()
    .map((name) => ({name, content: readFileSync(join(refsDir, name), 'utf-8')}))
}

export function handleThemeStandardsSkill(): {content: Array<{type: 'text'; text: string}>} {
  console.error('[tool_call] shopify_theme_standards')
  const skill = readSkillFile()
  const refs = readReferenceFiles()
  const text = [skill, ...refs.map((r) => `# Reference: ${r.name}\n\n${r.content}`)].join('\n\n---\n\n')
  return {content: [{type: 'text', text}]}
}

export function registerThemeStandardsTool(server: McpServer) {
  server.tool(
    'shopify_theme_standards',
    'CSS, JS, and HTML standards for Shopify Liquid themes. Call this tool to get coding standards and best practices.',
    () => handleThemeStandardsSkill(),
  )
}
