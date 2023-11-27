import {LocalTheme} from '@shopify/cli-kit/node/themes/models/index'
import {glob} from '@shopify/cli-kit/node/fs'

const DEFAULT_IGNORE_PATTERNS = [
  '**/.git',
  '**/.vscode',
  '**/.hg',
  '**/.bzr',
  '**/.svn',
  '**/_darcs',
  '**/CVS',
  '**/*.sublime-(project|workspace)',
  '**/.DS_Store',
  '**/.sass-cache',
  '**/Thumbs.db',
  '**/desktop.ini',
  '**/config.yml',
  '**/node_modules/',
  '.prettierrc.json',
]

const THEME_DIRECTORY_PATTERNS = [
  'assets/**/*.*',
  'config/**/*.json',
  'layout/**/*.liquid',
  'locales/**/*.json',
  'sections/**/*.{liquid,json}',
  'snippets/**/*.liquid',
  'templates/**/*.{liquid,json}',
  'templates/customers/**/*.{liquid,json}',
]

export async function loadLocalTheme(root: string, ignore: string[] = []): Promise<LocalTheme> {
  const filesPaths = await glob(THEME_DIRECTORY_PATTERNS, {
    cwd: root,
    deep: 3,
    ignore: [...ignore, ...DEFAULT_IGNORE_PATTERNS],
  })

  // filesPaths.forEach(async (path) => {
  //   // eslint-disable-next-line no-console
  //   console.log(path, '>', await checksum(root, path))
  // })

  // const file = filesPaths.at(0)!

  // const file = 'sections/footer-group.json'

  // // eslint-disable-next-line no-console
  // console.log('--------------------------------')

  // // eslint-disable-next-line no-console
  // console.log('local >>> ', file, await checksum(root, file))

  // const filesContents = await Promise.all(filesPaths.map((path) => readFile(path)))

  // const files = new Map(
  //   filesPaths.map((key) => {
  //     return [
  //       key,
  //       {
  //         key,
  //         checksum: '1',
  //       },
  //     ]
  //   }),
  // )

  // // eslint-disable-next-line no-console
  // console.log(files)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return {root, files: {} as any}
}

// function checksum(filePath)

function isLiquid(path: string) {
  return path.endsWith('.liquid')
}

function isLiquidCss(path: string) {
  return path.endsWith('.css.liquid')
}

function isJson(path: string) {
  return path.endsWith('.json')
}

function isTemplate(path: string) {
  return path.startsWith('templates/')
}
