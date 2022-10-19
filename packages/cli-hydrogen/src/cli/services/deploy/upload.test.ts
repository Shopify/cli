import {GraphQLError, ReqDeployConfig} from './types.js'
import {createDeployment, healthCheck, uploadDeployment} from './upload.js'
import {TooManyRequestsError, UnrecoverableError} from './error.js'
import {CreateDeploymentQuery} from './graphql/create_deployment.js'
import {beforeEach, describe, it, expect, vi} from 'vitest'
import {http, api, file} from '@shopify/cli-kit'
import {zip} from '@shopify/cli-kit/node/archiver'
import {ClientError} from 'graphql-request'
import {createReadStream} from 'node:fs'

const defaultConfig: ReqDeployConfig = {
  deploymentToken: '123',
  oxygenAddress: 'unit.test',
  healthCheck: false,
  assumeYes: false,
  path: '/unit/test',
  pathToBuild: '',
  commitMessage: 'commitMessage',
  commitAuthor: 'commitAuthor',
  commitSha: 'commitSha',
  timestamp: 'timestamp',
  commitRef: 'commitRef',
}

beforeEach(() => {
  vi.mock('@shopify/cli-kit')
  vi.mock('@shopify/cli-kit/node/archiver')
  vi.mock('node:fs')
})

describe('createDeploymentStep()', () => {
  it('makes a call to Oxygen to create the deployment', async () => {
    const deploymentResponse = {
      createDeployment: {
        deploymentID: 'gid://shopify/OxygenDeployment/g8e2k49rt',
        assetBaseURL: 'https://cdn.shopify.com/oxygen/1/1/g8e2k49rt/',
        error: null,
      },
    }

    const mockedResponse = vi.fn().mockResolvedValue(deploymentResponse)
    const mockedRequest = vi.fn().mockResolvedValue(mockedResponse)
    vi.mocked(api.oxygen.request).mockImplementation(mockedRequest)
    const cfg = {
      ...defaultConfig,
      commitRef: 'ref/branch',
      commitAuthor: 'Unit Test',
      commitSha: 'abcd1234',
      commitMessage: 'message',
      timestamp: '1999-01-01',
    }

    await createDeployment(cfg)

    expect(mockedRequest).toHaveBeenCalledOnce()
    expect(mockedRequest).toHaveBeenCalledWith(
      defaultConfig.oxygenAddress,
      CreateDeploymentQuery,
      defaultConfig.deploymentToken,
      {
        input: {
          branch: 'ref/branch',
          commitAuthor: 'Unit Test',
          commitHash: 'abcd1234',
          commitMessage: 'message',
          commitTimestamp: '1999-01-01',
        },
      },
    )
  })

  describe('failure', () => {
    it('throws a rate limit error if we are getting ratelimited', async () => {
      const graphQLError = new ClientError({status: 429}, {query: ''})
      vi.mocked(api.oxygen.request).mockRejectedValueOnce(graphQLError)

      await expect(() => {
        return createDeployment(defaultConfig)
      }).rejects.toThrowError(TooManyRequestsError())
    })

    it('throws if we are getting a non-200 status code', async () => {
      const graphQLError = new ClientError({status: 500}, {query: ''})
      vi.mocked(api.oxygen.request).mockRejectedValueOnce(graphQLError)

      await expect(() => {
        return createDeployment(defaultConfig)
      }).rejects.toThrowError('GraphQL Error (Code: 500)')
    })

    it('throws a generic error if we are getting a user error', async () => {
      const oxygenResponse = {
        createDeployment: {
          deploymentID: '',
          assetBaseURL: '',
          error: {
            unrecoverable: false,
            code: 'SomeGenericError',
            debugInfo: 'Some generic error message',
          },
        },
      }
      vi.mocked(api.oxygen.request).mockResolvedValue(oxygenResponse)

      await expect(() => {
        return createDeployment(defaultConfig)
      }).rejects.toThrowError('Some generic error message')
    })

    it('throws an unrecoverable exception if we get an unrecoverable error', async () => {
      const errMsg = 'Some generic error message'
      const oxygenResponse = {
        createDeployment: {
          deploymentID: '',
          assetBaseURL: '',
          error: {
            unrecoverable: true,
            code: 'SomeGenericError',
            debugInfo: errMsg,
          },
        },
      }
      vi.mocked(api.oxygen.request).mockResolvedValue(oxygenResponse)

      await expect(() => {
        return createDeployment(defaultConfig)
      }).rejects.toThrowError(UnrecoverableError(errMsg))
    })
  })
})

describe('uploadDeploymentStep()', async () => {
  describe('success', async () => {
    it('makes a call to Oxygen to upload the deployment files', async () => {
      const deploymentId = '123'
      vi.mocked(createReadStream)
      const mockedZip = vi.fn()
      vi.mocked(zip).mockImplementation(mockedZip)
      const mockedFormDataAppend = vi.fn()
      const formData = {append: mockedFormDataAppend, getHeaders: vi.fn()}
      vi.mocked<any>(http.formData).mockReturnValue(formData)
      const previewURL = 'https://preview.url'
      const oxygenResponse = {
        data: {
          uploadDeployment: {
            deployment: {
              previewURL,
            },
            error: null,
          },
        },
      }
      const mockedUploadDeployment = vi
        .fn()
        .mockResolvedValue({json: vi.fn().mockResolvedValue(oxygenResponse), status: 200})
      vi.mocked<any>(api.oxygen.uploadDeploymentFile).mockImplementation(mockedUploadDeployment)
      const tmpDir = 'tmp/dir'
      vi.mocked<any>(file.inTemporaryDirectory).mockImplementation(async (runner: (tmpDir: string) => Promise<void>) =>
        runner(tmpDir),
      )

      const result = await uploadDeployment(
        {...defaultConfig, path: 'unit/test', oxygenAddress: 'oxygen.address'},
        deploymentId,
      )

      expect(result).toBe(previewURL)
      expect(mockedFormDataAppend).toHaveBeenCalledTimes(3)
      expect(mockedZip).toHaveBeenCalledWith(`unit/test/dist`, `${tmpDir}/dist.zip`)
      expect(api.oxygen.uploadDeploymentFile).toHaveBeenCalledWith('oxygen.address', '123', formData)
    })
  })

  describe('failure', async () => {
    beforeEach(() => {
      vi.mocked(createReadStream)
      vi.mocked<any>(zip).mockImplementation(vi.fn())
      vi.mocked<any>(http.formData).mockReturnValue({append: vi.fn(), getHeaders: vi.fn()})
      vi.mocked<any>(file.inTemporaryDirectory).mockImplementation(async (runner: (tmpDir: string) => Promise<void>) =>
        runner('tmp/dir'),
      )
    })

    it('throws an exception if Oxygen returns a non-200 status code', async () => {
      const oxygenResponse: GraphQLError = {
        message: 'invalid schema',
        locations: {
          line: 1,
          column: 1,
        },
      }
      const mockedUploadDeployment = vi
        .fn()
        .mockResolvedValue({json: vi.fn().mockResolvedValue(oxygenResponse), status: 500})
      vi.mocked<any>(api.oxygen.uploadDeploymentFile).mockImplementation(mockedUploadDeployment)
      const tmpDir = 'tmp/dir'
      vi.mocked<any>(file.inTemporaryDirectory).mockImplementation(async (runner: (tmpDir: string) => Promise<void>) =>
        runner(tmpDir),
      )

      await expect(() => {
        return uploadDeployment({...defaultConfig, path: 'unit/test'}, '123')
      }).rejects.toThrowError('Failed to upload deployment')
    })

    it('throws an exception if Oxygen returns a user error', async () => {
      const oxygenResponse = {
        data: {
          uploadDeployment: {
            deployment: {
              previewURL: '',
            },
            error: {
              code: 'GenericError',
              unrecoverable: false,
              debugInfo: 'dunno what happened',
            },
          },
        },
      }
      const mockedUploadDeployment = vi
        .fn()
        .mockResolvedValue({json: vi.fn().mockResolvedValue(oxygenResponse), status: 200})
      vi.mocked<any>(api.oxygen.uploadDeploymentFile).mockImplementation(mockedUploadDeployment)

      await expect(() => {
        return uploadDeployment({...defaultConfig, path: 'unit/test'}, '123')
      }).rejects.toThrowError('dunno what happened')
    })

    it('throws an ratelimit exception if being ratelimited by Oxygen', async () => {
      const mockedUploadDeployment = vi
        .fn()
        .mockResolvedValue({json: vi.fn().mockResolvedValue('Too Many Requests'), status: 429})
      vi.mocked<any>(api.oxygen.uploadDeploymentFile).mockImplementation(mockedUploadDeployment)

      await expect(() => {
        return uploadDeployment({...defaultConfig, path: 'unit/test'}, '123')
      }).rejects.toThrowError(TooManyRequestsError())
    })

    it('throws an unrecoverable exception if we receive an unrecoverable user error', async () => {
      const oxygenResponse = {
        data: {
          uploadDeployment: {
            deployment: {
              previewURL: '',
            },
            error: {
              code: 'UnrecoverableError',
              unrecoverable: true,
              debugInfo: 'dunno what happened',
            },
          },
        },
      }
      const mockedUploadDeployment = vi
        .fn()
        .mockResolvedValue({json: vi.fn().mockResolvedValue(oxygenResponse), status: 200})
      vi.mocked<any>(api.oxygen.uploadDeploymentFile).mockImplementation(mockedUploadDeployment)

      await expect(() => {
        return uploadDeployment({...defaultConfig, path: 'unit/test'}, '123')
      }).rejects.toThrowError('Unrecoverable: dunno what happened')
    })
  })
})

describe('healthCheck()', () => {
  it('succeeds on https status 200', async () => {
    const pingUrl = 'https://unit.test'
    const fetch = vi.fn().mockResolvedValueOnce({status: 200})
    vi.mocked(http.fetch).mockImplementation(fetch)

    const result = await healthCheck(pingUrl)

    expect(result).toBeUndefined()
    expect(fetch).toHaveBeenCalledWith(`${pingUrl}/__health`, {method: 'GET'})
  })

  it('throws on any other https status', async () => {
    const pingUrl = 'https://unit.test'
    const fetch = vi.fn().mockResolvedValueOnce({status: 404})
    vi.mocked(http.fetch).mockImplementation(fetch)

    await expect(() => healthCheck(pingUrl)).rejects.toThrowError()
    expect(fetch).toHaveBeenCalledWith(`${pingUrl}/__health`, {method: 'GET'})
  })
})
