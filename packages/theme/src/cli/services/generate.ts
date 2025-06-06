import {downloadGitRepository} from '@shopify/cli-kit/node/git'
import {
  inTemporaryDirectory,
  copyFile,
  fileExistsSync,
  glob,
  readFile,
  readdir,
  writeFile,
} from '@shopify/cli-kit/node/fs'
import {renderError, renderInfo, renderSelectPrompt, renderSuccess, renderTasks} from '@shopify/cli-kit/node/ui'
import {parseJSON} from '@shopify/theme-check-node'
import {deepMergeObjects} from '@shopify/cli-kit/common/object'

export async function installComponent(path: string) {
  return inTemporaryDirectory(async (tempDir) => {
    await renderTasks([
      {
        title: `Fetching Shopify components`,
        task: async () => {
          await downloadGitRepository({
            repoUrl: 'https://github.com/alok-test-org/theme-components',
            destination: tempDir,
          })
        },
      },
    ])

    const components = await readdir(`${tempDir}/library`)

    const name = await renderSelectPrompt({
      message: 'Shopify component to generate',
      choices: components.map((component) => ({label: component, value: component})),
    })

    const componentDir = `${tempDir}/library/${name}`

    if (!fileExistsSync(componentDir)) {
      return renderError({
        body: [`The component '${name}' does not exist.`],
      })
    }

    const paths = (await glob(`${tempDir}/library/${name}/**/*`)).filter((path) => !path.endsWith('README.md')).sort()

    renderInfo({
      body: `Added the following files to your theme\n\n${paths
        .map((path) => `- ${path.replace(`${tempDir}/library/${name}/`, '')}`)
        .join('\n')
        .trim()}`,
    })

    // Just override files in this folder
    await Promise.all(
      ['assets', 'snippets', 'blocks', 'sections'].map((folder) => {
        if (!fileExistsSync(`${componentDir}/${folder}`)) return

        return copyFile(`${componentDir}/${folder}`, `${path}/${folder}`)
      }),
    )

    // Files that need to be merged
    const localeFilesToCopy = await readdir(`${componentDir}/locales`)
    const filesToMerge = []

    for (const localeFilename of localeFilesToCopy) {
      const existingLocaleFilePath = `${path}/locales/${localeFilename}`

      const prom = readFile(`${componentDir}/locales/${localeFilename}`).then((content) => {
        if (fileExistsSync(existingLocaleFilePath)) {
          return readFile(existingLocaleFilePath).then((existingContent) => {
            return writeFile(
              existingLocaleFilePath,
              JSON.stringify(
                deepMergeObjects(parseJSON(existingContent, undefined, false), parseJSON(content, undefined, false)),
                null,
                2,
              ),
            )
          })
        } else {
          return writeFile(existingLocaleFilePath, content)
        }
      })

      filesToMerge.push(prom)
    }
    await Promise.all(filesToMerge)

    // We only use the readme for success message
    if (fileExistsSync(`${componentDir}/README.md`)) {
      const readme = await readFile(`${componentDir}/README.md`)

      renderSuccess({
        body: [`Successfully downloaded and installed the '${name}' component.`, readme ? `\n\n${readme}` : ''],
      })
    }
  })
}
