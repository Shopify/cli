import {stripVTControlCharacters} from 'node:util'
import type {CommandFixture} from './fixture.js'

/** Keep report content and paragraphs, without terminal chrome or incidental padding. */
export function normalizeText(output: string, fixture: CommandFixture, files: string[] = []): string {
  let normalized = stripVTControlCharacters(output).replaceAll('│', '')
  // Ink wraps long absolute paths. Match their exact characters across wrapping,
  // rather than hiding the entire path row (which would hide a wrong path too).
  for (const path of [...files.map((file) => fixture.path(file)), fixture.projectPath, fixture.root]) {
    const pattern = [...path].map((character) => character.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s*')
    normalized = normalized.replace(new RegExp(pattern, 'g'), path.replace(fixture.root, '<sandbox>'))
  }
  return normalized
    .replaceAll(process.version, '<node-version>')
    .replaceAll(`${process.platform}-${process.arch}`, '<platform-arch>')
    .split('\n')
    .map((line) => line.trim().replace(/ {2,}/g, ' '))
    .filter((line) => !/^[╭╰]─.*[╮╯]$/.test(line))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function changedPaths(before: Record<string, string>, after: Record<string, string>): string[] {
  return [...new Set([...Object.keys(before), ...Object.keys(after)])]
    .filter((path) => before[path] !== after[path])
    .sort()
}

export function storeRelativePath(fixture: CommandFixture, store: 'app' | 'cli-kit'): string {
  return fixture
    .storePath(store)
    .slice(fixture.root.length + 1)
    .replaceAll('\\', '/')
}
