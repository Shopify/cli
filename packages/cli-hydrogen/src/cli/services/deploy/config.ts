import {DeployConfig, ReqDeployConfig} from './types.js'
import {path, git} from '@shopify/cli-kit'

export const getDeployConfig = async (config: DeployConfig): Promise<ReqDeployConfig> => {
  const directory = config.path ? path.resolve(config.path) : process.cwd()

  return path.temporarelyChangeCWD<ReqDeployConfig>(directory, async () => {
    await git.ensurePresentOrAbort()
    await git.ensureInsideGitDirectory()

    const [latestCommit, repository, commitRef] = await Promise.all([
      git.getLatestCommit(),
      getRepository(),
      git.getHeadSymbolicRef(),
    ])

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
  })
}

const getRepository = async () => {
  const remoteRepository = await git.getRemoteRepository()
  if (remoteRepository) return remoteRepository

  const projectPath = await git.factory().revparse('--show-toplevel')
  return path.basename(projectPath)
}
