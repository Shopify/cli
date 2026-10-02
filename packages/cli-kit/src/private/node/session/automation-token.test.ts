import {automationTokenVariable, automationTokenVariablesProblem} from './automation-token.js'
import {environmentVariables} from '../constants.js'
import {describe, expect, test} from 'vitest'

const ORGANIZATION = environmentVariables.organizationAutomationToken
const APP = environmentVariables.appAutomationToken
const PARTNERS = environmentVariables.partnersToken

describe('automationTokenVariable', () => {
  test.each([
    {name: 'no automation token variable', env: {}, expected: undefined},
    {name: 'the organization variable', env: {[ORGANIZATION]: 'org-token'}, expected: ORGANIZATION},
    {name: 'the app variable', env: {[APP]: 'app-token'}, expected: APP},
    {name: 'the Partners variable', env: {[PARTNERS]: 'partners-token'}, expected: PARTNERS},
    {name: 'the app variable over the Partners variable', env: {[APP]: 'a', [PARTNERS]: 'p'}, expected: APP},
    {name: 'an empty app variable over the Partners variable', env: {[APP]: '', [PARTNERS]: 'p'}, expected: APP},
    {name: 'the organization variable over the others', env: {[ORGANIZATION]: 'o', [APP]: 'a'}, expected: ORGANIZATION},
  ])('selects $name', ({env, expected}) => {
    expect(automationTokenVariable(env)).toBe(expected)
  })
})

describe('automationTokenVariablesProblem', () => {
  test.each([
    {name: 'no automation token variable', env: {}},
    {name: 'only the organization variable', env: {[ORGANIZATION]: 'org-token'}},
    {name: 'only the app variable', env: {[APP]: 'app-token'}},
    {name: 'only the Partners variable', env: {[PARTNERS]: 'partners-token'}},
    {name: 'both legacy variables', env: {[APP]: 'app-token', [PARTNERS]: 'partners-token'}},
    {name: 'an empty Partners variable behind the app variable', env: {[APP]: 'app-token', [PARTNERS]: ''}},
  ])('accepts $name', ({env}) => {
    expect(automationTokenVariablesProblem(env)).toBeUndefined()
  })

  test.each([
    {
      name: 'the organization variable with the app variable',
      env: {[ORGANIZATION]: 'org-token', [APP]: 'app-token'},
      message: `${ORGANIZATION} can't be set together with ${APP}.`,
    },
    {
      name: 'the organization variable with the Partners variable',
      env: {[ORGANIZATION]: 'org-token', [PARTNERS]: 'partners-token'},
      message: `${ORGANIZATION} can't be set together with ${PARTNERS}.`,
    },
    {
      name: 'the organization variable with both legacy variables',
      env: {[ORGANIZATION]: 'org-token', [APP]: 'app-token', [PARTNERS]: 'partners-token'},
      message: `${ORGANIZATION} can't be set together with ${APP} or ${PARTNERS}.`,
    },
    {
      name: 'the organization variable with an empty app variable',
      env: {[ORGANIZATION]: 'org-token', [APP]: ''},
      message: `${ORGANIZATION} can't be set together with ${APP}.`,
    },
    {name: 'an empty organization variable', env: {[ORGANIZATION]: ''}, message: `${ORGANIZATION} is set but empty.`},
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
