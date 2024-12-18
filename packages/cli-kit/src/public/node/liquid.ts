import {
  mkdir,
  readFile,
  copyFile,
  chmod,
  isDirectory,
  writeFile,
  fileHasExecutablePermissions,
  glob,
  fileExists,
  matchGlob,
} from './fs.js'
import {joinPath, dirname, relativePath} from './path.js'
import {outputContent, outputToken, outputDebug} from '../../public/node/output.js'
import {Liquid} from 'liquidjs'

/**
 * Renders a template using the Liquid template engine.
 *
 * @param templateContent - Template content.
 * @param data - Data to feed the template engine.
 * @returns Rendered template.
 */
export function renderLiquidTemplate(templateContent: string, data: object): Promise<string> {
  const engine = new Liquid()
  return engine.render(engine.parse(templateContent), data)
}

/**
 * Given a directory, it traverses the files and directories recursively
 * and replaces variables in directory and file names, and files' content
 * using the Liquid template engine.
 * Files indicate that they are liquid template by using the .liquid extension.
 *
 * @param from - Directory that contains the template.
 * @param to - Output directory.
 * @param data - Data to feed the template engine.
 */
export async function recursiveLiquidTemplateCopy(from: string, to: string, data: object): Promise<void> {
  outputDebug(outputContent`Copying template from directory ${outputToken.path(from)} to ${outputToken.path(to)}`)
  const templateFiles: string[] = await glob(joinPath(from, '**/*'), {dot: true})

  const bypassPaths = joinPath(from, '.cli-liquid-bypass')
  let bypassPatterns: string[] = []
  if (await fileExists(bypassPaths)) {
    bypassPatterns = (await readFile(bypassPaths)).split('\n').filter((line) => line.trim().length > 0)
  }

  const sortedTemplateFiles = templateFiles
    .map((path) => path.split('/'))
    .sort((lhs, rhs) => (lhs.length < rhs.length ? 1 : -1))
    .map((components) => components.join('/'))
  await Promise.all(
    sortedTemplateFiles.map(async (templateItemPath) => {
      const outputPath = await renderLiquidTemplate(joinPath(to, relativePath(from, templateItemPath)), data)
      const bypass = bypassPatterns.some((pattern) => {
        const path = relativePath(from, templateItemPath)
        const cleanPattern = pattern.replace(/^\.\//, '')

        return matchGlob(path, cleanPattern) || path.startsWith(cleanPattern)
      })

      if (await isDirectory(templateItemPath)) {
        await mkdir(outputPath)
      } else if (templateItemPath.endsWith('.liquid') && !bypass) {
        await mkdir(dirname(outputPath))
        const content = await readFile(templateItemPath)
        const contentOutput = await renderLiquidTemplate(content, data)
        const isExecutable = await fileHasExecutablePermissions(templateItemPath)
        const outputPathWithoutLiquid = outputPath.replace('.liquid', '')
        await copyFile(templateItemPath, outputPathWithoutLiquid)
        await writeFile(outputPathWithoutLiquid, contentOutput)
        if (isExecutable) {
          await chmod(outputPathWithoutLiquid, 0o755)
        }
      } else if (templateItemPath.endsWith('.raw')) {
        const outputPathWithoutRaw = outputPath.replace('.raw', '')
        await copyFile(templateItemPath, outputPathWithoutRaw)
      } else {
        await copyFile(templateItemPath, outputPath)
      }
    }),
  )
}
