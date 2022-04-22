import {build as viteBuild} from 'vite'
import {ui} from '@shopify/cli-kit'

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
          process.env.WORKER = key === 'worker' ? 'true' : undefined
          await viteBuild({
            ...commonConfig,
            build: {
              outDir: `dist/${key}`,
              ssr: typeof value === 'string' ? value : undefined,
              manifest: key === 'client',
            },
          })

          task.title = `Built ${key} code`
        },
      }
    })

  const list = new ui.Listr(tasks)

  await list.run()
}

export default build
