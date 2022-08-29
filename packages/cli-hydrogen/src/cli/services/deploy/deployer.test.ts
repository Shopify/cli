import {ReqDeployConfig} from './types.js'
import {createDeployment, healthCheck, uploadDeployment} from './upload.js'
import {beforeEach, describe, it, expect, vi} from 'vitest'
import {http, api} from '@shopify/cli-kit'
import {zip} from '@shopify/cli-kit/node/archiver'
import {createReadStream} from 'node:fs'

const defaultConfig: ReqDeployConfig = {
  deploymentToken: '123',
  dmsAddress: 'unit.test',
  healthCheck: false,
  path: '/unit/test',
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
  it('calls DMS with proper variables and headers', async () => {
    const headers = {value: 'key'}
    const mockedRequest = vi.fn().mockResolvedValue({createDeployment: 'mock'})
    const mockedGraphqlClient = vi.fn().mockResolvedValue({request: mockedRequest})
    vi.mocked(api.buildHeaders).mockResolvedValue(headers)
    vi.mocked(http.graphqlClient).mockImplementation(mockedGraphqlClient)

    await createDeployment({
      ...defaultConfig,
      commitRef: 'ref/branch',
      commitAuthor: 'Unit Test',
      commitSha: 'abcd1234',
      commitMessage: 'message',
      timestamp: '1999-01-01',
    })

    expect(mockedGraphqlClient).toHaveBeenCalledOnce()
    expect(mockedGraphqlClient).toHaveBeenCalledWith({
      headers,
      service: 'dms',
      url: `https://${defaultConfig.dmsAddress}/api/graphql/deploy/v1`,
    })
    expect(mockedRequest).toHaveBeenCalledOnce()
    expect(mockedRequest.mock.calls[0]?.[1]).toStrictEqual({
      input: {
        branch: 'ref/branch',
        commitAuthor: 'Unit Test',
        commitHash: 'abcd1234',
        commitMessage: 'message',
        commitTimestamp: '1999-01-01',
      },
    })
  })
})

describe('uploadDeploymentStep()', async () => {
  it('calls DMS with proper formData and headers', async () => {
    const deploymentId = '123'
    vi.mocked(createReadStream)
    const mockedZip = vi.fn()
    vi.mocked(zip).mockImplementation(mockedZip)
    const mockedFormDataAppend = vi.fn()
    const formData = {append: mockedFormDataAppend, getHeaders: vi.fn()}
    vi.mocked<any>(http.formData).mockReturnValue(formData)
    const headers = {value: 'key', 'Content-Type': 'key'}
    vi.mocked(api.buildHeaders).mockResolvedValue(headers)
    const previewURL = 'https://preview.url'
    const dmsResponse = {
      data: {
        uploadDeployment: {
          deployment: {
            previewURL,
          },
        },
      },
    }
    const mockedShopifyFetch = vi.fn().mockResolvedValue({json: vi.fn().mockResolvedValue(dmsResponse)})
    vi.mocked<any>(http.shopifyFetch).mockImplementation(mockedShopifyFetch)

    const result = await uploadDeployment(
      {...defaultConfig, path: '/unit/test', dmsAddress: 'dms.address'},
      deploymentId,
    )

    expect(result).toBe(previewURL)
    expect(mockedFormDataAppend).toHaveBeenCalledTimes(3)
    expect(mockedZip).toHaveBeenCalledWith('/unit/test/dist', '/unit/test/dist/dist.zip')
    expect(headers).toStrictEqual({value: 'key'})
    expect(mockedShopifyFetch).toHaveBeenCalledWith('dms', `https://dms.address/api/graphql/deploy/v1`, {
      method: 'POST',
      body: formData,
      headers,
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

    await expect(healthCheck(pingUrl)).rejects.toThrowError()
    expect(fetch).toHaveBeenCalledWith(`${pingUrl}/__health`, {method: 'GET'})
  })
})
