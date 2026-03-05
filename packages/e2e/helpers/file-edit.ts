import * as fs from 'fs'

/**
 * Appends text to a file. Useful for triggering hot reload by modifying source files.
 */
export function appendToFile(filePath: string, text: string): void {
  fs.appendFileSync(filePath, text)
}

/**
 * Replaces text in a file. Useful for modifying source files to trigger hot reload.
 */
export function replaceInFile(filePath: string, search: string | RegExp, replacement: string): void {
  const content = fs.readFileSync(filePath, 'utf-8')
  const updated = content.replace(search, replacement)
  fs.writeFileSync(filePath, updated)
}
