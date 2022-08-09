import {deployToOxygen} from './deploy.js'
import {createDeployment, healthCheck, uploadDeployment} from './deploy/upload.js'
import {buildTaskList} from './build.js'
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
const mockedBuildTaskList = vi.fn()
const mockedUploadDeployment = vi.fn()
const mockedHealthCheck = vi.fn()

beforeEach(() => {
  vi.mock('./deploy/config.js')
  vi.mocked(validateProject).mockImplementation(mockedValidateProject)
  vi.mocked(fillDeployConfig).mockImplementation(mockedFillDeployConfig)
  vi.mock('./deploy/upload.js')
  vi.mocked(createDeployment).mockImplementation(mockedCreateDeployment)
  vi.mocked(uploadDeployment).mockImplementation(mockedUploadDeployment)
  vi.mocked(healthCheck).mockImplementation(mockedHealthCheck)
  vi.mock('./build.js')
  vi.mocked(buildTaskList).mockImplementation(mockedBuildTaskList)
})

describe('deployToOxygen()', () => {
  it('sequentially calls each step', async () => {
    mockedFillDeployConfig.mockResolvedValue(reqDeployConfig)
    mockedCreateDeployment.mockResolvedValue({deploymentID: 'deploymentID', assetBaseURL: 'assetBaseURL'})
    mockedBuildTaskList.mockReturnValue([])
    mockedUploadDeployment.mockResolvedValue('previewURL')

    await deployToOxygen(deployConfig)

    expect(mockedValidateProject).toHaveBeenCalledOnce()
    expect(mockedValidateProject).toHaveBeenCalledWith(deployConfig)

    expect(mockedFillDeployConfig).toHaveBeenCalledOnce()
    expect(mockedFillDeployConfig).toHaveBeenCalledWith(deployConfig)

    expect(mockedCreateDeployment).toHaveBeenCalledOnce()
    expect(mockedCreateDeployment).toHaveBeenCalledWith(reqDeployConfig)

    expect(mockedBuildTaskList).toHaveBeenCalledOnce()
    expect(mockedBuildTaskList).toHaveBeenCalledWith({
      directory: deployConfig.path,
      targets: {
        client: true,
        worker: '@shopify/hydrogen/platforms/worker',
        node: false,
      },
      assetBaseURL: 'assetBaseURL',
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
    mockedBuildTaskList.mockReturnValue([])
    mockedUploadDeployment.mockRejectedValueOnce(new Error()).mockResolvedValue('previewURL')
    mockedHealthCheck.mockRejectedValueOnce(new Error()).mockRejectedValueOnce(new Error())

    await deployToOxygen(deployConfig)

    expect(mockedCreateDeployment).toHaveBeenCalledTimes(2)
    expect(mockedUploadDeployment).toHaveBeenCalledTimes(2)
    expect(mockedHealthCheck).toHaveBeenCalledTimes(3)
  })

  describe('when the deploy config has healthCheck set to false', () => {
    it('skips healthCheck', async () => {
      mockedFillDeployConfig.mockResolvedValue({...reqDeployConfig, healthCheck: false})
      mockedCreateDeployment.mockResolvedValue({deploymentID: 'deploymentID', assetBaseURL: 'assetBaseURL'})
      mockedBuildTaskList.mockReturnValue([])

      await deployToOxygen(deployConfig)

      expect(mockedHealthCheck).not.toHaveBeenCalled()
    })
  })
})
