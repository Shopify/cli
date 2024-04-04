import {buildHeaders, sanitizedHeadersOutput} from './headers.js'
import {CLI_KIT_VERSION} from '../../../public/common/version.js'
import {randomUUID} from '../../../public/node/crypto.js'
import {firstPartyDev, isUnitTest} from '../../../public/node/context/local.js'
import {test, vi, expect, describe, beforeEach} from 'vitest'

vi.mock('../../../public/node/crypto.js')
vi.mock('../../../public/node/context/local.js')
vi.mock('../version')

beforeEach(() => {
  vi.mocked(isUnitTest).mockReturnValue(true)
})

describe('common API methods', () => {
  test('headers are built correctly when firstPartyDev yields true', () => {
    // Given
    vi.mocked(randomUUID).mockReturnValue('random-uuid')
    vi.mocked(firstPartyDev).mockReturnValue(true)
    // When
    const headers = buildHeaders('my-token')

    // Then
    const version = CLI_KIT_VERSION
    expect(headers).toEqual({
      'Content-Type': 'application/json',
      'Keep-Alive': 'timeout=30',
      'X-Shopify-Access-Token': 'Bearer my-token',
      'User-Agent': `Shopify CLI; v=${version}`,
      authorization: 'Bearer my-token',
      'Sec-CH-UA-PLATFORM': process.platform,
      'X-Shopify-Cli-Employee': '1',
    })
  })

  test('when user is not employee, do not include header', () => {
    // Given
    vi.mocked(randomUUID).mockReturnValue('random-uuid')
    vi.mocked(firstPartyDev).mockReturnValue(false)
    // When
    const headers = buildHeaders('my-token')

    // Then
    const version = CLI_KIT_VERSION
    expect(headers).toEqual({
      'Content-Type': 'application/json',
      'Keep-Alive': 'timeout=30',
      'X-Shopify-Access-Token': 'Bearer my-token',
      'User-Agent': `Shopify CLI; v=${version}`,
      authorization: 'Bearer my-token',
      'Sec-CH-UA-PLATFORM': process.platform,
    })
  })

  test.each(['shpat', 'shpua', 'shpca'])(`when custom app token starts with %s, do not prepend 'Bearer'`, (prefix) => {
    // Given
    vi.mocked(randomUUID).mockReturnValue('random-uuid')
    vi.mocked(firstPartyDev).mockReturnValue(false)
    const token = `${prefix}_my_token`
    // When
    const headers = buildHeaders(token)

    // Then
    const version = CLI_KIT_VERSION
    expect(headers).toEqual({
      'Content-Type': 'application/json',
      'Keep-Alive': 'timeout=30',
      'X-Shopify-Access-Token': token,
      'User-Agent': `Shopify CLI; v=${version}`,
      authorization: token,
      'Sec-CH-UA-PLATFORM': process.platform,
    })
  })

  test('sanitizedHeadersOutput removes the headers that include the token', () => {
    // Given
    const headers = {
      'User-Agent': 'useragent',
      'Keep-Alive': 'timeout=30',
      Authorization: 'token',
      authorization: 'token',
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': 'token',
    }

    // When
    const got = sanitizedHeadersOutput(headers)

    // Then
    expect(got).toMatchInlineSnapshot(`
      " - User-Agent: useragent
       - Keep-Alive: timeout=30
       - Content-Type: application/json"
    `)
  })
})
