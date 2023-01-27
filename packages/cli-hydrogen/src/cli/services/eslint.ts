import {HydrogenApp} from '../models/hydrogen.js'
import {genericConfigurationFileNames} from '../constants.js'
import {
  addNPMDependenciesWithoutVersionIfNeeded,
  findUpAndReadPackageJson,
  writePackageJSON,
} from '@shopify/cli-kit/node/node-package-manager'
import {addRecommendedExtensions, isVSCode} from '@shopify/cli-kit/node/vscode'
import {writeFile, fileExists, removeFile, fileContentPrettyFormat} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {AbortError} from '@shopify/cli-kit/node/error'
import {renderTasks, Task} from '@shopify/cli-kit/node/ui'

interface AddESlintOptions {
  app: HydrogenApp
  force: boolean
  install: boolean
}

export async function addESLint({app, force, install}: AddESlintOptions) {
  const vscode = await isVSCode(app.directory)

  const tasks: Task[] = [
    {
      title: 'Installing additional dependencies',
      skip: () => !install,
      task: async () => {
        const requiredDependencies = ['eslint', 'eslint-plugin-hydrogen', 'prettier', '@shopify/prettier-config']
        await addNPMDependenciesWithoutVersionIfNeeded(requiredDependencies, {
          packageManager: app.packageManager,
          type: 'prod',
          directory: app.directory,
        })
      },
    },

    {
      title: 'Adding ESLint configuration',
      task: async () => {
        const eslintConfigPath = joinPath(app.directory, genericConfigurationFileNames.eslint)

        if (await fileExists(eslintConfigPath)) {
          if (force) {
            await removeFile(eslintConfigPath)
          } else {
            throw new AbortError('ESLint config already exists.', 'Use --force to override existing config.')
          }
        }

        const extended = [`'plugin:hydrogen/recommended'`]

        if (app.language === 'TypeScript') {
          extended.push(`'plugin:hydrogen/typescript'`)
        }

        const eslintConfig = await fileContentPrettyFormat(
          ['module.exports = {', 'extends: [', `${extended.join(',')}`, ' ],', ' };'].join('\n'),
          {path: genericConfigurationFileNames.eslint},
        )

        await writeFile(eslintConfigPath, eslintConfig)
      },
    },
    {
      title: 'Updating package.json',
      task: async () => {
        const packageJSON = (await findUpAndReadPackageJson(app.directory)).content
        packageJSON.scripts = packageJSON.scripts || {}
        packageJSON.scripts.lint = `eslint --ext .js,.ts,.jsx,.tsx src/`

        packageJSON.prettier = '@shopify/prettier-config'

        await writePackageJSON(app.directory, packageJSON)
      },
    },
    {
      title: 'Adding editor plugin recommendations',
      skip: () => !vscode,
      task: async () => {
        await addRecommendedExtensions(app.directory, ['dbaeumer.vscode-eslint'])
      },
    },
  ]
  await renderTasks(tasks)
}
