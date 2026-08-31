import assert from 'node:assert/strict'
import {test} from 'node:test'

import {getGithubToken} from './github-utils.js'

test('does not print a GitHub token sourced from the environment', async () => {
  const token = 'environment-secret'
  const logs = []

  const result = await getGithubToken('shop', {
    environment: {GITHUB_TOKEN_SHOP: token},
    log: (message) => logs.push(message),
  })

  assert.equal(result, token)
  assert.deepEqual(logs, ['Using GitHub token from GITHUB_TOKEN_SHOP'])
  assert.equal(logs.join(' ').includes(token), false)
})

test('captures a GitHub token from dev without printing it', async () => {
  const token = 'dev-secret'
  const logs = []
  const receivedCommands = []

  const result = await getGithubToken('shop', {
    environment: {},
    executeCommand: (...command) => {
      receivedCommands.push(command)
      return Promise.resolve(`${token}\n`)
    },
    log: (message) => logs.push(message),
  })

  assert.equal(result, token)
  assert.deepEqual(receivedCommands, [
    ['/opt/dev/bin/dev', ['github', 'print-auth', '--password'], {printOutput: false}],
  ])
  assert.deepEqual(logs, ['Using GitHub token from dev'])
  assert.equal(logs.join(' ').includes(token), false)
})

test('fails when dev cannot provide a GitHub token', async () => {
  await assert.rejects(
    getGithubToken('shop', {
      environment: {},
      executeCommand: () => Promise.reject(new Error('Authentication failed')),
    }),
    new Error('Failed to fetch a GitHub token from dev. Try running `dev github auth`.'),
  )
})
