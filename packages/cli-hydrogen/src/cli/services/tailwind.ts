import {HydrogenApp} from '../models/hydrogen.js'
import {ui} from '@shopify/cli-kit'
import {addNPMDependenciesWithoutVersionIfNeeded} from '@shopify/cli-kit/node/node-package-manager'
import {addRecommendedExtensions} from '@shopify/cli-kit/node/vscode'
import {exec} from '@shopify/cli-kit/node/system'
import {writeFile, fileExists, removeFile, fileContentPrettyFormat, readFile} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {AbortError} from '@shopify/cli-kit/node/error'
import stream from 'stream'

interface AddTailwindOptions {
  app: HydrogenApp
  force: boolean
  directory: string
  install: boolean
}

const tailwindImports = [
  "@import 'tailwindcss/base';",
  "@import 'tailwindcss/components';",
  "@import 'tailwindcss/utilities';",
]

const tailwindImportsExist = (indexCSS: string) =>
  tailwindImports.map((el) => new RegExp(el)).every((tailwindDirective) => tailwindDirective.test(indexCSS))

export async function addTailwind({app, force, install, directory}: AddTailwindOptions) {
  const list = ui.newListr([
    {
      title: 'Installing dependencies',
      skip: () => !install,
      task: async (_, task) => {
        const requiredDependencies = ['postcss', 'postcss-loader', 'tailwindcss', 'autoprefixer']
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
      title: 'Adding PostCSS configuration',
      task: async (_, task) => {
        const postCSSConfiguration = joinPath(directory, 'postcss.config.js')

        if (await fileExists(postCSSConfiguration)) {
          if (force) {
            await removeFile(postCSSConfiguration)
          } else {
            throw new AbortError('PostCSS config already exists.\nUse --force to override existing config.')
          }
        }

        const postCSSConfig = await fileContentPrettyFormat(
          ['module.exports = {', 'plugins: {', 'tailwindcss: {},', 'autoprefixer: {},', '},', ' };'].join('\n'),
          {path: 'postcss.config.js'},
        )

        await writeFile(postCSSConfiguration, postCSSConfig)

        task.title = 'PostCSS configuration added'
      },
    },

    {
      title: 'Initializing Tailwind CSS...',
      task: async (_, task) => {
        const tailwindConfigurationPath = joinPath(directory, 'tailwind.config.js')

        if (await fileExists(tailwindConfigurationPath)) {
          if (force) {
            await removeFile(tailwindConfigurationPath)
          } else {
            throw new AbortError('Tailwind config already exists.\nUse --force to override existing config.')
          }
        }

        await exec(app.packageManager, ['tailwindcss', 'init', tailwindConfigurationPath], {
          cwd: directory,
        })

        await replace(
          'content: []',
          "content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}']",
          tailwindConfigurationPath,
        )

        task.title = 'Tailwind configuration added'
      },
    },
    {
      title: 'Importing Tailwind CSS in index.css',
      task: async (_ctx, task) => {
        const indexCSSPath = joinPath(directory, 'src', 'index.css')
        const indexCSS = await readFile(indexCSSPath)

        if (tailwindImportsExist(indexCSS)) {
          task.skip('Imports already exist in index.css')
        } else {
          const newIndexCSS = tailwindImports.join('\n') + indexCSS

          await writeFile(indexCSSPath, newIndexCSS)
        }

        task.title = 'Tailwind imports added'
      },
    },
    {
      title: 'Adding editor plugin recommendations',
      task: async (_, task) => {
        await addRecommendedExtensions(directory, ['csstools.postcss', 'bradlc.vscode-tailwindcss'])
        task.title = 'Editor plugin recommendations added'
      },
    },
  ])
  await list.run()
}

async function replace(find: string | RegExp, replace: string, filepath: string) {
  const original = await readFile(filepath)
  const modified = original.replace(find, replace)
  await writeFile(filepath, modified)
}
