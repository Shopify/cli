import * as oxygenApi from './oxygen.js'
import {shopifyFetch, formData} from '../../../http.js'
import {buildHeaders} from '../../../private/common/api/headers.js'
import {graphqlRequest} from '../../../private/common/api/graphql.js'
import {test, vi, describe, beforeEach, expect} from 'vitest'
import {Response} from 'node-fetch'

vi.mock('../../../private/common/api/graphql.js')
vi.mock('../../../private/common/api/headers.js')
vi.mock('../../../http.js')

const mockedResult = 'OK'
const mockedToken = 'token'
const oxygenAddress = 'oxygen-dms.shopifycloud.com'

beforeEach(() => {
  vi.mocked(graphqlRequest).mockResolvedValue({})
})

describe('oxygen-api', () => {
  test('calls the graphql client once', async () => {
    vi.mocked(graphqlRequest).mockResolvedValue(mockedResult)

    await oxygenApi.oxygenRequest(oxygenAddress, 'query', mockedToken, {some: 'variables'})

    expect(graphqlRequest).toHaveBeenCalledOnce()
  })

  test('request is called with the correct parameters', async () => {
    const headers = {'custom-header': mockedToken}
    vi.mocked(graphqlRequest).mockResolvedValue(mockedResult)
    vi.mocked(graphqlRequest).mockResolvedValue(headers)

    await oxygenApi.oxygenRequest(oxygenAddress, 'query', mockedToken, {variables: 'variables'})

    expect(graphqlRequest).toHaveBeenLastCalledWith(
      'query',
      'Oxygen',
      'https://oxygen-dms.shopifycloud.com/api/graphql/deploy/v1',
      'token',
      {variables: 'variables'},
    )
  })
})

describe('uploadDeploymentFile', () => {
  test('makes a post request to Oxygen using the provided form data', async () => {
    const responseBody = {
      data: {
        uploadDeployment: {
          deployment: {
            previewURL: 'https://preview.com',
          },
          error: null,
        },
      },
    }
    const headers = {'custom-header': 'header'}
    vi.mocked(buildHeaders).mockResolvedValue(headers)
    const mockedFormData = {append: vi.fn(), getHeaders: vi.fn()}
    vi.mocked<any>(formData).mockReturnValue(mockedFormData)
    const response = new Response(JSON.stringify(responseBody), {status: 200})
    vi.mocked(shopifyFetch).mockResolvedValue(response)

    const gotResponse = await oxygenApi.uploadDeploymentFile(oxygenAddress, mockedToken, mockedFormData as any)
    expect(shopifyFetch).toBeCalledWith(`https://${oxygenAddress}/api/graphql/deploy/v1`, {
      method: 'POST',
      body: mockedFormData,
      headers,
    })

    expect(gotResponse.status).toBe(200)
    expect(await response.json()).toEqual(responseBody)
    expect(buildHeaders).toHaveBeenCalledWith(mockedToken)
  })
})
