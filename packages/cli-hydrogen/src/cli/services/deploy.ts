import {DeployConfig, ReqDeployConfig} from './deploy/types.js'
import {createDeployment, healthCheck, uploadDeployment} from './deploy/upload.js'
import {buildTaskList} from './build.js'
import {validateProject, fillDeployConfig} from './deploy/config.js'
import {environment, system, ui} from '@shopify/cli-kit'

interface TaskContext {
  config: ReqDeployConfig
  deploymentID: string
  assetBaseURL: string
  previewURL: string
}

const isUnitTest = environment.local.isUnitTest()

export async function deployToOxygen(_config: DeployConfig) {
  const backoffPolicy = [5, 10, 15, 30, 60]

  await validateProject(_config)

  /* eslint-disable require-atomic-updates */
  const tasks: ui.ListrTask<TaskContext>[] = [
    {
      title: '📝 Getting deployment config',
      task: async (ctx, task) => {
        ctx.config = await fillDeployConfig(_config)
        task.title = '📝 Deployment config parsed'
      },
    },
    {
      title: '✨ Creating a deployment',
      task: async (ctx, task) => {
        const {deploymentID, assetBaseURL} = await createDeployment(ctx.config)
        ctx.assetBaseURL = assetBaseURL
        ctx.deploymentID = deploymentID
        task.title = '✨ Deployment created'
      },
      retry: 2,
    },
    {
      title: '🛠 Building project',
      task: async (ctx, task) => {
        const subTasks = buildTaskList({
          directory: ctx.config.path,
          targets: {
            client: true,
            worker: '@shopify/hydrogen/platforms/worker',
            node: false,
          },
          assetBaseURL: ctx.assetBaseURL,
        })

        return task.newListr(subTasks)
      },
    },
    {
      title: '🚀 Uploading deployment files',
      task: async (ctx, task) => {
        ctx.previewURL = await uploadDeployment(ctx.config, ctx.deploymentID)
        task.output = `Preview URL: ${ctx.previewURL}`
        task.title = '🚀 Files uploaded'
      },
      options: {
        bottomBar: Infinity,
        persistentOutput: true,
      },
      retry: 2,
    },
    {
      title: '📡 Checking deployment health',
      task: async (ctx, task) => {
        const retryCount = task.isRetrying()?.count

        if (retryCount === backoffPolicy.length) {
          task.title =
            "The deployment uploaded but hasn't become reachable within 2 minutes. Check the preview URL to see if deployment succeeded. If it didn't, then try again later."
          return
        }
        if (retryCount && !isUnitTest) await system.sleep(backoffPolicy[retryCount - 1]!)

        await healthCheck(ctx.previewURL)
        task.title = '✅ Deployed and healthy!'
      },
      retry: backoffPolicy.length,
      skip: (ctx) => !ctx.config.healthCheck,
    },
  ]
  /* eslint-enable require-atomic-updates */

  const list = ui.newListr(tasks, {
    concurrent: false,
    rendererOptions: {collapse: false},
    rendererSilent: isUnitTest,
  })

  return list.run()
}
