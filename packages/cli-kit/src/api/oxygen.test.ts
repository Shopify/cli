import * as oxygenApi from './oxygen.js'
import {buildHeaders} from './common.js'
import {graphqlClient} from '../http/graphql.js'
import {shopifyFetch, formData} from '../http.js'
import {test, vi, describe, beforeEach, expect} from 'vitest'
import {GraphQLClient} from 'graphql-request'
import {Response} from 'node-fetch'

vi.mock('../http/graphql.js')
vi.mock('../http.js')
vi.mock('./common.js', async () => {
  const module: any = await vi.importActual('./common.js')
  return {
    ...module,
    buildHeaders: vi.fn(),
  }
})

const mockedResult = 'OK'
const mockedToken = 'token'
const oxygenAddress = 'oxygen-dms.shopifycloud.com'

let client: GraphQLClient
beforeEach(() => {
  client = {
    request: vi.fn(),
  } as any
  vi.mocked(graphqlClient).mockResolvedValue(client)
})

describe('oxygen-api', () => {
  test('calls the graphql client once', async () => {
    vi.mocked(client.request).mockResolvedValue(mockedResult)

    await oxygenApi.request(oxygenAddress, 'query', mockedToken, {some: 'variables'})

    expect(client.request).toHaveBeenCalledOnce()
  })

  test('request is called with the correct parameters', async () => {
    const headers = {'custom-header': mockedToken}
    vi.mocked(client.request).mockResolvedValue(mockedResult)
    vi.mocked(client.request).mockResolvedValue(headers)

    await oxygenApi.request(oxygenAddress, 'query', mockedToken, {variables: 'variables'})

    expect(client.request).toHaveBeenLastCalledWith('query', {variables: 'variables'})
  })

  test('buildHeaders is called with the deployment token', async () => {
    vi.mocked(client.request).mockResolvedValue(mockedResult)

    await oxygenApi.request(oxygenAddress, 'query', mockedToken, {})

    expect(buildHeaders).toHaveBeenCalledWith(mockedToken)
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
