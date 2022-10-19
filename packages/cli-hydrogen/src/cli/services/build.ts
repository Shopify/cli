import {build as viteBuild} from 'vite'
import {ui, environment, error as kitError} from '@shopify/cli-kit'

type Target = 'node' | 'client' | 'worker'

interface DevOptions {
  directory: string
  targets: {[key in Target]: boolean | string}
  base?: string
  assetBaseURL?: string
  verbose?: boolean
}

export function buildTaskList({directory, targets, base, assetBaseURL, verbose}: DevOptions): ui.ListrTask[] {
  const commonConfig = {base, root: directory}

  return Object.entries(targets)
    .filter(([_, value]) => value)
    .map(([key, value]) => ({
      title: `Building ${key} code`,
      task: async (_, task) => {
        if (key === 'worker') {
          process.env.WORKER = 'true'
        }
        if (assetBaseURL) {
          process.env.HYDROGEN_ASSET_BASE_URL = assetBaseURL
        }

        try {
          await viteBuild({
            ...commonConfig,
            build: {
              outDir: `dist/${key}`,
              ssr: typeof value === 'string' ? value : undefined,
              manifest: key === 'client',
            },
            logLevel: verbose ? 'info' : 'silent',
          })
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (error: any) {
          const abortError = new kitError.Abort(error.message)
          abortError.stack = error.stack
          throw abortError
        }

        task.title = `Built ${key} code`
      },
    }))
}

export async function build(options: DevOptions) {
  const tasks = await buildTaskList(options)

  const list = ui.newListr(tasks, {rendererSilent: environment.local.isUnitTest()})

  await list.run()
}
