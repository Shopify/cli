import {findInEnv, findApiKey, requestAppInfo} from './find-app-info.js'
import {selectOrganizationPrompt, selectAppPrompt} from '../../prompts/dev.js'
import {fetchAppFromApiKey, fetchOrganizations, fetchOrgAndApps} from '../dev/fetch.js'
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {readAndParseDotEnv} from '@shopify/cli-kit/node/dot-env'
import {fileExists} from '@shopify/cli-kit/node/fs'
import {basename} from '@shopify/cli-kit/node/path'

const aToken = 'A_TOKEN'
const anApp = 'app-name'
const anApiKey = 'API_KEY'

afterEach(async () => {
  vi.clearAllMocks()
})

describe('findInEnv', () => {
  beforeEach(async () => {
    vi.mock('@shopify/cli-kit/node/fs')
    vi.mock('@shopify/cli-kit/node/dot-env')
  })

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
    vi.mocked(readAndParseDotEnv).mockResolvedValue({variables: {ANYTHING: 'ELSE'}})

    // When
    const credentials = await findInEnv()

    // Then
    expect(credentials).toEqual({})
  })

  it('dotenv file contains secret', async () => {
    // Given
    vi.mocked(fileExists).mockResolvedValue(true)
    vi.mocked(readAndParseDotEnv).mockResolvedValue({variables: {SHOPIFY_API_SECRET: 'A_SECRET'}})

    // When
    const credentials = await findInEnv()

    // Then
    expect(credentials).toEqual({clientSecret: 'A_SECRET'})
  })
})

describe('findApiKey', () => {
  beforeEach(async () => {
    vi.mock('../dev/fetch')
    vi.mock('../../prompts/dev')
    vi.mock('@shopify/cli-kit/node/path')

    vi.mocked(fetchOrganizations).mockResolvedValue({})
    vi.mocked(selectOrganizationPrompt).mockResolvedValue({id: 'id'})
  })

  it('no apps available', async () => {
    // Given
    vi.mocked(fetchOrgAndApps).mockResolvedValue({apps: []})

    // When
    const apiKey = await findApiKey(aToken)

    // Then
    expect(apiKey).toEqual(undefined)
  })

  it('app guessed from directory', async () => {
    // Given
    vi.mocked(fetchOrgAndApps).mockResolvedValue({apps: [{title: anApp, apiKey: anApiKey}]})
    vi.mocked(basename).mockResolvedValue(`folder/${anApp}`)

    // When
    const apiKey = await findApiKey(aToken)

    // Then
    expect(apiKey).toEqual(anApiKey)
  })

  it('app guessed because there is only one', async () => {
    // Given
    vi.mocked(fetchOrgAndApps).mockResolvedValue({apps: [{title: anApp, apiKey: anApiKey}]})
    vi.mocked(basename).mockResolvedValue(`folder/another-app`)

    // When
    const apiKey = await findApiKey(aToken)

    // Then
    expect(apiKey).toEqual(anApiKey)
  })

  it('app selected from prompt', async () => {
    // Given
    const app1 = {title: anApp, apiKey: anApiKey}
    const app2 = {title: 'another-app', apiKey: 'ANOTHER_API_KEY'}
    vi.mocked(fetchOrgAndApps).mockResolvedValue({apps: [app1, app2]})
    vi.mocked(basename).mockResolvedValue(`folder/somewhere-else`)
    vi.mocked(selectAppPrompt).mockResolvedValue(app2.apiKey)

    // When
    const apiKey = await findApiKey(aToken)

    // Then
    expect(selectAppPrompt).toHaveBeenCalledOnce()
    expect(apiKey).toEqual(app2.apiKey)
  })
})

describe('requestAppInfo', () => {
  beforeEach(async () => {
    vi.mock('../dev/fetch')
  })

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
    vi.mocked(fetchAppFromApiKey).mockResolvedValue({id: 'id', apiSecretKeys: []})

    // When
    const credentials = await requestAppInfo(aToken, anApiKey)

    // Then
    expect(credentials).toEqual({clientId: 'id', apiKey: anApiKey})
  })

  it('secrets available', async () => {
    // Given
    vi.mocked(fetchAppFromApiKey).mockResolvedValue({
      id: 'id',
      apiSecretKeys: [{some_secret: 'SECRET1'}, {secret: 'SECRET'}],
    })

    // When
    const credentials = await requestAppInfo(aToken, anApiKey)

    // Then
    expect(credentials).toEqual({clientId: 'id', apiKey: anApiKey, clientSecret: 'SECRET'})
  })
})
