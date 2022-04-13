import {build} from 'vite'
import {ui, output} from '@shopify/cli-kit'

interface DevOptions {
  directory: string
  target: 'worker' | 'node'
  base?: string
}

async function dev({directory, target, base}: DevOptions) {
  const commonConfig = {base}

  const serverBuild = {
    title: `Building ${target} code`,
    task: async () => {
      await build({
        ...commonConfig,
        root: directory,
        build: {
          outDir: 'dist/server',
          ssr: `@shopify/hydrogen/platforms/node`,
        },
      })
    },
  }
  const workerBuild = {
    title: `Building ${target} code`,
    task: async () => {
      process.env.WORKER = 'true'

      await build({
        ...commonConfig,
        root: directory,
        build: {
          outDir: 'dist/worker',
          ssr: `@shopify/hydrogen/platforms/worker-event`,
        },
      })
    },
  }

  const list = new ui.Listr(
    [
      {
        title: `Building client code`,
        task: async () => {
          await build({
            ...commonConfig,
            root: directory,
            build: {
              outDir: 'dist/client',
              manifest: true,
            },
          })
        },
      },
      target === 'worker' ? workerBuild : serverBuild,
    ],
    {concurrent: false},
  )

  await list.run()

  output.info(output.content`
    ${target} build completed successfully! ✨
  `)
}

export default dev
