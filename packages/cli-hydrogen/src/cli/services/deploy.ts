import {git, error, path} from '@shopify/cli-kit'

interface DeployConfig {
  deploymentToken: string
  dmsAddress: string
  commitMessage?: string
  commitAuthor?: string
  commitSha?: string
  commitRef?: string
  timestamp?: string
  repository?: string
}
type ReqDeployConfig = Required<DeployConfig>

export async function deployToOxygen(_config: DeployConfig) {
  const config = await getGitData(_config)

  console.log('Config:\n', config)
}

const getGitData = async (config: DeployConfig): Promise<ReqDeployConfig> => {
  git.ensurePresentOrAbort()
  git.ensureInsideGitDirectory()
  const simpleGit = git.factory()

  const getLatestCommit = async () => {
    try {
      const latestLog = await simpleGit.log({
        maxCount: 1,
      })
      if (!latestLog.latest) throw new error.Abort('Could not find latest commit')
      return latestLog.latest
    } catch {
      throw new error.Abort('Must have at least 1 commit to deploy')
    }
  }

  const getRepository = async () => {
    // git config --get remote.origin.url
    const remoteUrl = await simpleGit.getConfig('remote.origin.url', 'local')
    if (remoteUrl.value) {
      const urlObj = new URL(remoteUrl.value)
      const parsedPath = path.parse(urlObj.pathname)
      return `${parsedPath.dir}/${parsedPath.name}`
    }

    const projectPath = await simpleGit.revparse('--show-toplevel')
    return path.basename(projectPath)
  }

  const [latestCommit, repository] = await Promise.all([getLatestCommit(), getRepository()])

  return {
    deploymentToken: config.deploymentToken,
    dmsAddress: config.dmsAddress,
    commitMessage: config.commitMessage ?? latestCommit.message,
    commitAuthor: config.commitAuthor ?? latestCommit.author_name,
    commitSha: latestCommit.hash,
    commitRef: latestCommit.refs,
    timestamp: latestCommit.date,
    repository,
  }
}

/**
  const projectDirectory = path.join(environment.local.homeDirectory(), 'src/github.com/shopify/oxygenctl')
  const executablePath = path.join(projectDirectory, 'bin', 'oxygenctl')

  const dmsAddress = '4761-2604-4080-1361-8370-85e6-7e97-9896-5afd.ngrok.io'
  const workerDir = '/Users/ben/src/github.com/Shopify/hydrogen/examples/api-routes/dist/worker'
  const assetsDir = '/Users/ben/src/github.com/Shopify/hydrogen/examples/api-routes/dist/client'

  output.info('Deploying to Oxygen...')

  await system.exec(
    executablePath,
    ['deploy', `--dms-address=${dmsAddress}`, `--worker-dir=${workerDir}`, `--assets-dir=${assetsDir}`],
    {
      stdout: process.stdout,
      stderr: process.stderr,
      env: {
        ...process.env,
        OXYGEN_BUILD_COMMAND: ':',
        OXYGEN_COMMIT_MESSAGE: 'My beautiful commit message, first line',
        OXYGEN_COMMIT_TIMESTAMP: '2019-05-15T15:20:41Z',
        OXYGEN_DEPLOYMENT_TOKEN: 'DEPLOYMENT_TOKEN',
        OXYGEN_WORKFLOW_ID: '123456778888888888888',
        GITHUB_REPOSITORY: 'tempor1s/hydrogen',
        GITHUB_REF: 'refs/heads/main',
        GITHUB_SHA: 'ee99c6785db49b0c9512c57b4ff73bf354d5087a',
        GITHUB_ACTOR: 'tempor1s',
      },
    },
  )
 */
