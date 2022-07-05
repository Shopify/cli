import {runCLI} from '@shopify/cli-kit/node/cli'
import {file, path} from '@shopify/cli-kit'

async function runShopifyCLI() {
  await runCLI({
    moduleURL: import.meta.url,
    logFilename: 'shopify.cli.log',
    projectType: await projectType(),
  })
}

async function projectType(): Promise<string | undefined> {
  try {
    let projectType = ''
    await path.findUp(
      async (directory: string): Promise<string | undefined> => {
        const appPath = path.join(directory, 'shopify.app.toml')
        if (await file.exists(appPath)) {
          projectType = 'app'
          return appPath
        }
        const hydrogenPath = path.join(directory, 'hydrogen.config.js')
        if (await file.exists(hydrogenPath)) {
          projectType = 'hydrogen'
          return hydrogenPath
        }
      },
      {
        cwd: projectRoot(),
        type: 'file',
      },
    )
    if (projectType) return projectType
    // eslint-disable-next-line no-catch-all/no-catch-all, no-empty
  } catch (err) {}
}

function projectRoot(): string {
  let subPath = ''
  process.argv.slice(3).forEach((arg: string) => {
    if (arg.match(/^--path=/)) subPath = arg.slice(7)
  })

  // Use an absolute path if provided, otherwise treat as relative
  if (subPath?.match(/^\//)) return subPath

  return path.join(process.cwd(), subPath)
}

export default runShopifyCLI
