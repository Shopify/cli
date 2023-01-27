import {HydrogenApp} from '../models/hydrogen.js'
import {genericConfigurationFileNames} from '../constants.js'
import {ui} from '@shopify/cli-kit'
import {
  addNPMDependenciesWithoutVersionIfNeeded,
  findUpAndReadPackageJson,
  writePackageJSON,
} from '@shopify/cli-kit/node/node-package-manager'
import {addRecommendedExtensions, isVSCode} from '@shopify/cli-kit/node/vscode'
import {isUnitTest} from '@shopify/cli-kit/node/environment/local'
import {writeFile, fileExists, removeFile, fileContentPrettyFormat} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {AbortError} from '@shopify/cli-kit/node/error'
import stream from 'stream'

interface AddESlintOptions {
  app: HydrogenApp
  force: boolean
  install: boolean
}

export async function addESLint({app, force, install}: AddESlintOptions) {
  const list = ui.newListr(
    [
      {
        title: 'Installing dependencies',
        skip: () => !install,
        task: async (_, task) => {
          const requiredDependencies = ['eslint', 'eslint-plugin-hydrogen', 'prettier', '@shopify/prettier-config']
          await addNPMDependenciesWithoutVersionIfNeeded(requiredDependencies, {
            packageManager: app.packageManager,
            type: 'prod',
            directory: app.directory,
            stderr: new stream.Writable({
              write(chunk, encoding, next) {
                task.output = chunk.toString()
                next()
              },
            }),
            stdout: new stream.Writable({
              write(chunk, encoding, next) {
                task.output = chunk.toString()
                next()
              },
            }),
          })
          task.title = 'Dependencies installed'
        },
      },

      {
        title: 'Adding ESLint configuration',
        task: async (_, task) => {
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

          task.title = 'ESLint configuration added'
        },
      },
      {
        title: 'Updating package.json',
        task: async (_, task) => {
          const packageJSON = (await findUpAndReadPackageJson(app.directory)).content
          packageJSON.scripts = packageJSON.scripts || {}
          packageJSON.scripts.lint = `eslint --ext .js,.ts,.jsx,.tsx src/`

          packageJSON.prettier = '@shopify/prettier-config'

          await writePackageJSON(app.directory, packageJSON)

          task.title = 'Package.json updated'
        },
      },
      {
        title: 'Adding editor plugin recommendations',
        skip: async () => !(await isVSCode(app.directory)),
        task: async (_, task) => {
          await addRecommendedExtensions(app.directory, ['dbaeumer.vscode-eslint'])
          task.title = 'Editor plugin recommendations added'
        },
      },
    ],
    {rendererSilent: isUnitTest()},
  )
  await list.run()
}
