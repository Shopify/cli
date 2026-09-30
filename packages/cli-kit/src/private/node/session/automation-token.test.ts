import {getAutomationToken, peekAutomationToken} from './automation-token.js'
import {environmentVariables} from '../constants.js'
import {describe, expect, test} from 'vitest'

const APP = environmentVariables.appAutomationToken
const PARTNERS = environmentVariables.partnersToken

const cases = [
  {name: 'no automation token variable', env: {}, expected: undefined},
  {name: 'only the app variable', env: {[APP]: 'app-token'}, expected: {value: 'app-token', source: 'app'}},
  {
    name: 'only the Partners variable',
    env: {[PARTNERS]: 'partners-token'},
    expected: {value: 'partners-token', source: 'partners'},
  },
  {
    name: 'both variables, preferring the app variable',
    env: {[APP]: 'app-token', [PARTNERS]: 'partners-token'},
    expected: {value: 'app-token', source: 'app'},
  },
  {name: 'an empty app variable', env: {[APP]: ''}, expected: undefined},
  {
    name: 'an empty app variable, which still hides the Partners variable',
    env: {[APP]: '', [PARTNERS]: 'partners-token'},
    expected: undefined,
  },
  {name: 'an empty Partners variable', env: {[PARTNERS]: ''}, expected: undefined},
]

describe('peekAutomationToken', () => {
  test.each(cases)('reads $name', ({env, expected}) => {
    expect(peekAutomationToken(env)).toEqual(expected)
  })
})

describe('getAutomationToken', () => {
  test.each(cases)('selects $name', ({env, expected}) => {
    expect(getAutomationToken(env)).toEqual(expected)
  })
})
