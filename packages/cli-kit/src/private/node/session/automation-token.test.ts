import {
  automationTokenAuthMethod,
  automationTokenVariable,
  automationTokenVariablesProblem,
} from './automation-token.js'
import {environmentVariables} from '../constants.js'
import {describe, expect, test} from 'vitest'

const SERVICE_ACCOUNT = environmentVariables.serviceAccountToken
const APP = environmentVariables.appAutomationToken
const PARTNERS = environmentVariables.partnersToken

describe('automationTokenVariable', () => {
  test.each([
    {name: 'no automation token variable', env: {}, expected: undefined},
    {
      name: 'the service account variable',
      env: {[SERVICE_ACCOUNT]: 'service-account-token'},
      expected: SERVICE_ACCOUNT,
    },
    {name: 'the app variable', env: {[APP]: 'app-token'}, expected: APP},
    {name: 'the Partners variable', env: {[PARTNERS]: 'partners-token'}, expected: PARTNERS},
    {name: 'the app variable over the Partners variable', env: {[APP]: 'a', [PARTNERS]: 'p'}, expected: APP},
    {name: 'an empty app variable over the Partners variable', env: {[APP]: '', [PARTNERS]: 'p'}, expected: APP},
    {
      name: 'the service account variable over the others',
      env: {[SERVICE_ACCOUNT]: 'o', [APP]: 'a'},
      expected: SERVICE_ACCOUNT,
    },
  ])('selects $name', ({env, expected}) => {
    expect(automationTokenVariable(env)).toBe(expected)
  })
})

describe('automationTokenAuthMethod', () => {
  test.each([
    {name: 'the service account variable', env: {[SERVICE_ACCOUNT]: 's'}, expected: 'service_account_token'},
    {name: 'the app variable', env: {[APP]: 'a'}, expected: 'partners_token'},
    {name: 'the Partners variable', env: {[PARTNERS]: 'p'}, expected: 'partners_token'},
    {
      name: 'the service account variable over another one',
      env: {[SERVICE_ACCOUNT]: 's', [APP]: 'a'},
      expected: 'service_account_token',
    },
  ])('reports $expected for $name', ({env, expected}) => {
    expect(automationTokenAuthMethod(env)).toBe(expected)
  })
})

describe('automationTokenVariablesProblem', () => {
  test.each([
    {name: 'no automation token variable', env: {}},
    {name: 'only the service account variable', env: {[SERVICE_ACCOUNT]: 'service-account-token'}},
    {name: 'only the app variable', env: {[APP]: 'app-token'}},
    {name: 'only the Partners variable', env: {[PARTNERS]: 'partners-token'}},
    {name: 'both legacy variables', env: {[APP]: 'app-token', [PARTNERS]: 'partners-token'}},
    {name: 'an empty Partners variable behind the app variable', env: {[APP]: 'app-token', [PARTNERS]: ''}},
  ])('accepts $name', ({env}) => {
    expect(automationTokenVariablesProblem(env)).toBeUndefined()
  })

  test.each([
    {
      name: 'the service account variable with the app variable',
      env: {[SERVICE_ACCOUNT]: 'service-account-token', [APP]: 'app-token'},
      message: `${SERVICE_ACCOUNT} can't be set together with ${APP}.`,
    },
    {
      name: 'the service account variable with the Partners variable',
      env: {[SERVICE_ACCOUNT]: 'service-account-token', [PARTNERS]: 'partners-token'},
      message: `${SERVICE_ACCOUNT} can't be set together with ${PARTNERS}.`,
    },
    {
      name: 'the service account variable with both legacy variables',
      env: {[SERVICE_ACCOUNT]: 'service-account-token', [APP]: 'app-token', [PARTNERS]: 'partners-token'},
      message: `${SERVICE_ACCOUNT} can't be set together with ${APP} or ${PARTNERS}.`,
    },
    {
      name: 'the service account variable with an empty app variable',
      env: {[SERVICE_ACCOUNT]: 'service-account-token', [APP]: ''},
      message: `${SERVICE_ACCOUNT} can't be set together with ${APP}.`,
    },
    {
      name: 'an empty service account variable',
      env: {[SERVICE_ACCOUNT]: ''},
      message: `${SERVICE_ACCOUNT} is set but empty.`,
    },
    {name: 'an empty app variable', env: {[APP]: ''}, message: `${APP} is set but empty.`},
    {
      name: 'an empty app variable, even when the Partners variable has a value',
      env: {[APP]: '', [PARTNERS]: 'partners-token'},
      message: `${APP} is set but empty.`,
    },
    {name: 'an empty Partners variable', env: {[PARTNERS]: ''}, message: `${PARTNERS} is set but empty.`},
  ])('rejects $name', ({env, message}) => {
    expect(automationTokenVariablesProblem(env)?.message).toBe(message)
  })
})
