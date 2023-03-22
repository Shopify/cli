import {findInEnv, findApiKey, requestAppInfo} from './find-app-info.js'
import {selectOrganizationPrompt, selectAppPrompt} from '../../prompts/dev.js'
import {fetchAppFromApiKey, fetchOrganizations, fetchOrgAndApps, FetchResponse} from '../dev/fetch.js'
import {MinimalOrganizationApp} from '../../models/organization.js'
import {beforeEach, describe, expect, it, vi} from 'vitest'
import {readAndParseDotEnv} from '@shopify/cli-kit/node/dot-env'
import {fileExists} from '@shopify/cli-kit/node/fs'
import {basename} from '@shopify/cli-kit/node/path'

const aToken = 'A_TOKEN'
const anApiKey = 'API_KEY'

vi.mock('@shopify/cli-kit/node/fs')
vi.mock('@shopify/cli-kit/node/dot-env')
vi.mock('@shopify/cli-kit/node/path')
vi.mock('../dev/fetch')
vi.mock('../../prompts/dev')

describe('findInEnv', () => {
  it('.env file not available', async () => {
    // Given
    vi.mocked(fileExists).mockResolvedValue(false)

    // When
    const credentials = await findInEnv()

    // Then
    expect(credentials).toEqual({})
  })

  it('dotenv file does not contain secret', async () => {
    // Given
    vi.mocked(fileExists).mockResolvedValue(true)
    vi.mocked(readAndParseDotEnv).mockResolvedValue({path: 'A_PATH', variables: {ANYTHING: 'ELSE'}})

    // When
    const credentials = await findInEnv()

    // Then
    expect(credentials).toEqual({})
  })

  it('dotenv file contains secret', async () => {
    // Given
    vi.mocked(fileExists).mockResolvedValue(true)
    vi.mocked(readAndParseDotEnv).mockResolvedValue({path: 'A_PATH', variables: {SHOPIFY_API_SECRET: 'A_SECRET'}})

    // When
    const credentials = await findInEnv()

    // Then
    expect(credentials).toEqual({clientSecret: 'A_SECRET'})
  })
})

describe('findApiKey', () => {
  const anAppName = 'app-name'
  const anotherAppName = 'another-app'
  const anotherApiKey = 'ANOTHER_API_KEY'
  const anApp = {id: '1', title: anAppName, apiKey: anApiKey}
  const anotherApp = {id: '2', title: anotherAppName, apiKey: anotherApiKey}
  const org = {
    id: '1',
    businessName: 'org1',
    betas: {},
    website: 'http://example.org',
  }

  beforeEach(async () => {
    vi.mocked(fetchOrganizations).mockResolvedValue([org])
    vi.mocked(selectOrganizationPrompt).mockResolvedValue(org)
  })

  it('no apps available', async () => {
    // Given
    vi.mocked(fetchOrgAndApps).mockResolvedValue(buildFetchResponse([]))

    // When
    const apiKey = await findApiKey(aToken)

    // Then
    expect(apiKey).toEqual(undefined)
  })

  it('app guessed from directory', async () => {
    // Given
    vi.mocked(fetchOrgAndApps).mockResolvedValue(buildFetchResponse([anApp]))
    vi.mocked(basename).mockResolvedValue(`folder/${anAppName}`)

    // When
    const apiKey = await findApiKey(aToken)

    // Then
    expect(apiKey).toEqual(anApiKey)
  })

  it('app guessed because there is only one', async () => {
    // Given
    vi.mocked(fetchOrgAndApps).mockResolvedValue(buildFetchResponse([anApp]))
    vi.mocked(basename).mockResolvedValue(`folder/${anotherAppName}`)

    // When
    const apiKey = await findApiKey(aToken)

    // Then
    expect(apiKey).toEqual(anApiKey)
  })

  it('app selected from prompt', async () => {
    // Given
    vi.mocked(fetchOrgAndApps).mockResolvedValue(buildFetchResponse([anApp, anotherApp]))
    vi.mocked(basename).mockResolvedValue(`folder/somewhere-else`)
    vi.mocked(selectAppPrompt).mockResolvedValue(anotherApp.apiKey)

    // When
    const apiKey = await findApiKey(aToken)

    // Then
    expect(selectAppPrompt).toHaveBeenCalledOnce()
    expect(apiKey).toEqual(anotherApp.apiKey)
  })

  function buildFetchResponse(apps: MinimalOrganizationApp[]): FetchResponse {
    const resp: FetchResponse = {organization: org, apps: {pageInfo: {hasNextPage: false}, nodes: apps}, stores: []}

    return resp
  }
})

describe('requestAppInfo', () => {
  it('no app found', async () => {
    // Given
    vi.mocked(fetchAppFromApiKey).mockResolvedValue(undefined)

    // When
    const credentials = await requestAppInfo(aToken, anApiKey)

    // Then
    expect(credentials).toEqual({})
  })

  it('no secrets available', async () => {
    // Given
    vi.mocked(fetchAppFromApiKey).mockResolvedValue({
      id: 'id',
      title: 'title',
      apiKey: anApiKey,
      organizationId: 'orgid',
      apiSecretKeys: [],
      grantedScopes: [],
    })

    // When
    const credentials = await requestAppInfo(aToken, anApiKey)

    // Then
    expect(credentials).toEqual({clientId: 'id', apiKey: anApiKey})
  })

  it('secrets available', async () => {
    // Given
    vi.mocked(fetchAppFromApiKey).mockResolvedValue({
      id: 'id',
      title: 'title',
      apiKey: anApiKey,
      organizationId: 'orgid',
      apiSecretKeys: [{secret: 'SECRET'}],
      grantedScopes: [],
    })

    // When
    const credentials = await requestAppInfo(aToken, anApiKey)

    // Then
    expect(credentials).toEqual({clientId: 'id', apiKey: anApiKey, clientSecret: 'SECRET'})
  })
})
