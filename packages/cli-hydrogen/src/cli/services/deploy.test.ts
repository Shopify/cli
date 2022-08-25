import {deployToOxygen} from './deploy.js'
import {createDeployment, healthCheck, uploadDeployment} from './deploy/deployer.js'
import buildService from './build.js'
import {validateProject, fillDeployConfig} from './deploy/config.js'
import {DeployConfig, ReqDeployConfig} from './deploy/types.js'
import {describe, beforeEach, it, vi, expect} from 'vitest'

const deployConfig: DeployConfig = {
  deploymentToken: 'token',
  dmsAddress: 'unit.test',
  healthCheck: true,
  path: '/unit/test',
}

const reqDeployConfig: ReqDeployConfig = {
  ...deployConfig,
  commitMessage: 'commitMessage',
  commitAuthor: 'commitAuthor',
  commitSha: 'commitSha',
  timestamp: 'timestamp',
  commitRef: 'commitRef',
}

const mockedValidateProject = vi.fn()
const mockedFillDeployConfig = vi.fn()
const mockedCreateDeployment = vi.fn()
const mockedBuildervice = vi.fn()
const mockedUploadDeployment = vi.fn()
const mockedHealthCheck = vi.fn()

beforeEach(() => {
  vi.mock('./deploy/config.js')
  vi.mocked(validateProject).mockImplementation(mockedValidateProject)
  vi.mocked(fillDeployConfig).mockImplementation(mockedFillDeployConfig)
  vi.mock('./deploy/deployer.js')
  vi.mocked(createDeployment).mockImplementation(mockedCreateDeployment)
  vi.mocked(uploadDeployment).mockImplementation(mockedUploadDeployment)
  vi.mocked(healthCheck).mockImplementation(mockedHealthCheck)
  vi.mock('./build.js')
  vi.mocked(buildService).mockImplementation(mockedBuildervice)
})

describe('deployToOxygen()', () => {
  it('sequentially calls each step', async () => {
    mockedFillDeployConfig.mockResolvedValue(reqDeployConfig)
    mockedCreateDeployment.mockResolvedValue({deploymentID: 'deploymentID', assetBaseURL: 'assetBaseURL'})
    mockedBuildervice.mockResolvedValue([])
    mockedUploadDeployment.mockResolvedValue('previewURL')

    await deployToOxygen(deployConfig)

    expect(mockedValidateProject).toHaveBeenCalledOnce()
    expect(mockedValidateProject).toHaveBeenCalledWith(deployConfig)

    expect(mockedFillDeployConfig).toHaveBeenCalledOnce()
    expect(mockedFillDeployConfig).toHaveBeenCalledWith(deployConfig)

    expect(mockedCreateDeployment).toHaveBeenCalledOnce()
    expect(mockedCreateDeployment).toHaveBeenCalledWith(reqDeployConfig)

    expect(mockedBuildervice).toHaveBeenCalledOnce()
    expect(mockedBuildervice).toHaveBeenCalledWith({
      directory: deployConfig.path,
      targets: {
        client: true,
        worker: '@shopify/hydrogen/platforms/worker',
        node: false,
      },
      assetBaseURL: 'assetBaseURL',
      returnTasks: true,
    })

    expect(mockedUploadDeployment).toHaveBeenCalledOnce()
    expect(mockedUploadDeployment).toHaveBeenCalledWith(reqDeployConfig, 'deploymentID')

    expect(mockedHealthCheck).toHaveBeenCalledOnce()
    expect(mockedHealthCheck).toHaveBeenCalledWith('previewURL')
  })

  it('retries on error for healthCheck, uploadDeployment and createDeployment', async () => {
    mockedFillDeployConfig.mockResolvedValue(reqDeployConfig)
    mockedCreateDeployment
      .mockRejectedValueOnce(new Error())
      .mockResolvedValue({deploymentID: 'deploymentID', assetBaseURL: 'assetBaseURL'})
    mockedBuildervice.mockResolvedValue([])
    mockedUploadDeployment.mockRejectedValueOnce(new Error()).mockResolvedValue('previewURL')
    mockedHealthCheck.mockRejectedValueOnce(new Error()).mockRejectedValueOnce(new Error())

    await deployToOxygen(deployConfig)

    expect(mockedCreateDeployment).toHaveBeenCalledTimes(2)
    expect(mockedUploadDeployment).toHaveBeenCalledTimes(2)
    expect(mockedHealthCheck).toHaveBeenCalledTimes(3)
  })

  it('skips healthCheck', async () => {
    mockedFillDeployConfig.mockResolvedValue({...reqDeployConfig, healthCheck: false})
    mockedCreateDeployment.mockResolvedValue({deploymentID: 'deploymentID', assetBaseURL: 'assetBaseURL'})
    mockedBuildervice.mockResolvedValue([])

    await deployToOxygen(deployConfig)

    expect(mockedHealthCheck).not.toHaveBeenCalled()
  })
})
