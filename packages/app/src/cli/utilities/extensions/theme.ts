import {ExtensionInstance} from '../../models/extensions/extension-instance.js'
import {glob, createFileReadStream, fileExistsSync} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {createInterface} from 'readline'

const ignoredFilePatterns = [
  '.git',
  '.hg',
  '.bzr',
  '.svn',
  '_darcs',
  'CVS',
  '.sublime-(project|workspace)',
  '.DS_Store',
  '.sass-cache',
  'Thumbs.db',
  'desktop.ini',
  'config.yml',
  'node_modules',
  '.gitkeep',
  '.shopifyignore',
  '*.toml',
]

export async function themeExtensionFiles(themeExtension: ExtensionInstance): Promise<string[]> {
  const filename = '.shopifyignore'
  const filepath = joinPath(themeExtension.buildDirectory, filename)
  const ignore = ignoredFilePatterns.map((pattern) => joinPath('*', pattern))

  if (fileExistsSync(filepath)) {
    const patterns = await parseIgnoreFile(filepath)
    ignore.push(...patterns)
  }

  return glob('*/*', {
    absolute: true,
    cwd: themeExtension.buildDirectory,
    ignore,
  })
}

/**
 * Parses the ignore file and returns the patterns that should be ignored.
 * @param filepath - Filepath to the ignore file.
 * @returns A promise that resolves with the patterns that should be ignored.
 */
export function parseIgnoreFile(filepath: string): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const patterns: string[] = []

    const readLineInterface = createInterface({
      input: createFileReadStream(filepath),
      crlfDelay: Infinity,
    })

    readLineInterface.on('line', (line: string) => {
      const trimmedLine = line.trim()
      if (trimmedLine.length > 0 && !trimmedLine.startsWith('#')) {
        patterns.push(trimmedLine)
      }
    })

    readLineInterface.on('close', () => {
      resolve(patterns)
    })

    readLineInterface.on('error', (error: Error) => {
      reject(error)
    })
  })
}
