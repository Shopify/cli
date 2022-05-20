import {build as viteBuild} from 'vite'
import {ui, environment} from '@shopify/cli-kit'

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

  const list = new ui.Listr(tasks, {rendererSilent: environment.local.isUnitTest()})

  await list.run()
}

export default build
