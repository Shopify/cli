import {ThemeExtension} from '../../models/app/extensions.js'
import {glob} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'

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
]

export async function themeExtensionFiles(themeExtension: ThemeExtension): Promise<string[]> {
  return glob(joinPath(themeExtension.directory, '*/*'), {
    ignore: ignoredFilePatterns.map((pattern) => joinPath(themeExtension.directory, '*', pattern)),
  })
}
