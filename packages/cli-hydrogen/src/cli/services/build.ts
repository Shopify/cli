import {checkLockfileStatus} from './build/check-lockfile.js'
import {build as viteBuild} from 'vite'
import {AbortError} from '@shopify/cli-kit/node/error'
import {renderTasks} from '@shopify/cli-kit/node/ui'

type Target = 'node' | 'client' | 'worker'

interface DevOptions {
  directory: string
  targets: {[key in Target]: boolean | string}
  base?: string
  assetBaseURL?: string
  verbose?: boolean
}

export function buildTaskList({directory, targets, base, assetBaseURL, verbose}: DevOptions) {
  const commonConfig = {base, root: directory}

  return Object.entries(targets)
    .filter(([_, value]) => value)
    .map(([key, value]) => ({
      title: `Building ${key} code`,
      task: async () => {
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
          const abortError = new AbortError(error.message)
          abortError.stack = error.stack
          throw abortError
        }
      },
    }))
}

export async function build(options: DevOptions) {
  await checkLockfileStatus(options.directory)

  const tasks = await buildTaskList(options)

  await renderTasks(tasks)
}
