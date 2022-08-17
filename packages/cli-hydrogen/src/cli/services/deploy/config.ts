import {DeployConfig, ReqDeployConfig} from './types.js'
import {path, git} from '@shopify/cli-kit'

export const getDeployConfig = async (config: DeployConfig): Promise<ReqDeployConfig> => {
  const directory = config.path ? path.resolve(config.path) : process.cwd()

  await git.ensurePresentOrAbort()
  await git.ensureInsideGitDirectory(directory)

  const [latestCommit, commitRef] = await Promise.all([
    git.getLatestCommit(directory),
    git.getHeadSymbolicRef(directory),
  ])

  return {
    deploymentToken: config.deploymentToken,
    dmsAddress: config.dmsAddress,
    commitMessage: config.commitMessage ?? latestCommit.message,
    commitAuthor: config.commitAuthor ?? latestCommit.author_name,
    commitSha: latestCommit.hash,
    commitRef,
    timestamp: latestCommit.date,
    path: directory,
  }
}
