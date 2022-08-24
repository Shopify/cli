import {build as viteBuild} from 'vite'
import {ui, environment, error as kitError, file, path, output} from '@shopify/cli-kit'

type Target = 'node' | 'client' | 'worker'

interface DevOptions {
  directory: string
  targets: {[key in Target]: boolean | string}
  base?: string
}

async function build({directory, targets, base}: DevOptions) {
  const commonConfig = {base, root: directory}

  const tasks: ui.ListrTask[] = Object.entries(targets)
    .filter(([_, value]) => value)
    .map(([key, value]) => {
      return {
        title: `Building ${key} code`,
        task: async (_, task) => {
          if (key === 'worker') {
            process.env.WORKER = 'true'
          }
          try {
            await viteBuild({
              ...commonConfig,
              build: {
                outDir: `dist/${key}`,
                ssr: typeof value === 'string' ? value : undefined,
                manifest: key === 'client',
              },
            })
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
          } catch (error: any) {
            const hasTailwindConfig =
              (await file.read(path.join(directory, 'tailwind.config.js'))) ||
              (await file.read(path.join(directory, 'tailwind.config.ts')))

            if (
              // eslint-disable-next-line no-restricted-syntax
              error.message === "Cannot read properties of undefined (reading 'config')" &&
              directory !== process.cwd() &&
              hasTailwindConfig
            ) {
              const tailwindError = new kitError.Abort(
                output.content`Running ${output.token.genericShellCommand(
                  'shopify hydrogen build',
                )} using a ${output.token.genericShellCommand(
                  `--path`,
                )} flag is not supported for projects using Tailwind.css.`,
              )
              throw tailwindError
            }

            const abortError = new kitError.Abort(error.message)
            abortError.stack = error.stack
            throw abortError
          }

          task.title = `Built ${key} code`
        },
      }
    })

  const list = ui.newListr(tasks, {rendererSilent: environment.local.isUnitTest()})

  await list.run()
}

export default build
