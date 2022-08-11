import {build as viteBuild} from 'vite'
import {ui, environment, error as kitError} from '@shopify/cli-kit'

type Target = 'node' | 'client' | 'worker'

interface DevOptions {
  directory: string
  targets: {[key in Target]: boolean | string}
  base?: string
  assetBaseURL?: string
}

async function build({directory, targets, base, assetBaseURL}: DevOptions) {
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
            })
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
          } catch (error: any) {
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
