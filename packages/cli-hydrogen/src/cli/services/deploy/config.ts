import {DeployConfig, ReqDeployConfig} from './types.js'
import {git, path, error} from '@shopify/cli-kit'

const simpleGit = git.factory()

export const getDeployConfig = async (config: DeployConfig): Promise<ReqDeployConfig> => {
  await git.ensurePresentOrAbort()
  await git.ensureInsideGitDirectory()

  const [latestCommit, repository, commitRef] = await Promise.all([getLatestCommit(), getRepository(), getHeadRef()])

  const directory = config.path ? path.resolve(config.path) : process.cwd()

  return {
    deploymentToken: config.deploymentToken,
    dmsAddress: config.dmsAddress,
    commitMessage: config.commitMessage ?? latestCommit.message,
    commitAuthor: config.commitAuthor ?? latestCommit.author_name,
    commitSha: latestCommit.hash,
    commitRef,
    timestamp: latestCommit.date,
    repository,
    path: directory,
  }
}

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
    const repository = `${parsedPath.dir}/${parsedPath.name}`
    return repository.charAt(0) === '/' ? repository.substring(1) : repository
  }

  const projectPath = await simpleGit.revparse('--show-toplevel')
  return path.basename(projectPath)
}

const getHeadRef = async () => {
  const ref = await simpleGit.raw('symbolic-ref', '-q', 'HEAD')

  if (!ref) throw new error.Abort('HEAD is detached, make sure to be on a branch.')

  return ref.trim()
}
