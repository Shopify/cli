import buildService from './build.js'
import {git, error, path, output, api, http} from '@shopify/cli-kit'
import {gql} from 'graphql-request'

interface DeployConfig {
  deploymentToken: string
  dmsAddress: string
  commitMessage?: string
  commitAuthor?: string
  commitSha?: string
  commitRef?: string
  timestamp?: string
  repository?: string
  path?: string
}
type ReqDeployConfig = Required<DeployConfig>

export async function deployToOxygen(_config: DeployConfig) {
  const config = await getDeployConfig(_config)
  // eslint-disable-next-line no-console
  console.log('Deployment Config: ', config)

  const {deploymentID, assetBaseURL, error} = await createDeploymentStep(config)

  output.info(`Deployment ID: ${deploymentID}`)
  output.info(`Base Asset URL: ${assetBaseURL}`)
  output.info(`Error Message: ${error?.debugInfo}`)

  await runBuildCommandStep(config, assetBaseURL)

  output.success('Deployment created!')
}

const getDeployConfig = async (config: DeployConfig): Promise<ReqDeployConfig> => {
  await git.ensurePresentOrAbort()
  await git.ensureInsideGitDirectory()
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

const createDeploymentStep = async (config: ReqDeployConfig): Promise<CreateDeploymentResponse> => {
  output.info('✨ Creating a deployment... ')

  const url = `https://${config.dmsAddress}/api/graphql/deploy/v1`
  const headers = await api.common.buildHeaders(config.deploymentToken)
  // need to create a seperate service for "dms" related calls instead of piggybacking on "shopify"
  const client = await http.graphqlClient({
    headers,
    service: 'shopify',
    url,
  })

  // need to make workflowID optional on DMS so we dont need to generate a random one
  const variables = {
    input: {
      repository: config.repository,
      branch: config.commitRef,
      commitHash: config.commitSha,
      commitAuthor: config.commitAuthor,
      commitMessage: config.commitMessage,
      commitTimestamp: config.timestamp,
      workflowID: `${Math.floor(Math.random() * 100000)}`,
    },
  }

  // need to handle errors
  const response: CreateDeploymentQuerySchema = await client.request(CreateDeploymentQuery, variables)
  return response.createDeployment
}

const runBuildCommandStep = async (config: ReqDeployConfig, assetBaseURL: string): Promise<DMSError | null> => {
  output.info('✨ Building the applicaton... ')

  // need to measure duration of build
  // make a temp build directory?
  const targets = {
    client: true,
    worker: '@shopify/hydrogen/platforms/worker',
    node: false,
  }
  const options = {
    client: true,
    target: 'worker',
  }

  // make sure that env is being set for asset_url rewriting
  process.env.OXYGEN_ASSET_URL = assetBaseURL
  await buildService({...options, directory: config.path, targets})

  return null
}

const CreateDeploymentQuery = gql`
  mutation createDeployment($input: CreateDeploymentInput!) {
    createDeployment(input: $input) {
      deploymentID
      assetBaseURL
      error {
        code
        unrecoverable
        debugInfo
      }
    }
  }
`

interface CreateDeploymentQuerySchema {
  createDeployment: CreateDeploymentResponse
}

interface CreateDeploymentResponse {
  deploymentID: string
  assetBaseURL: string
  error: DMSError
}

interface DMSError {
  code: string
  unrecoverable: boolean
  debugInfo: string
}
