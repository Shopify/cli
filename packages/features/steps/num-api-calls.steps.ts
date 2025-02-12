import {Then, Before, After} from '@cucumber/cucumber'
import {strict as assert} from 'assert'

Before({timeout: 60 * 1000}, async function () {
  process.env.SHOPIFY_CLI_ENV = 'production'
  await this.execCLI(['cache', 'clear'])
})

After({timeout: 60 * 1000}, async function () {
  delete process.env.SHOPIFY_CLI_ENV
  await this.execCLI(['cache', 'clear'])
})

Then(/I run shopify version and count API calls/, async function () {
  const {stdout, stderr} = await this.execCLI(['version', '--tracing'])
  this.debugOutput = stderr + '\n' + stdout
})

Then(/shopify version makes (\d+) API calls?/, async function (expectedCalls: string) {
  const apiCalls = (this.debugOutput.match(/\[TRACING\] Request to/g) || []).length

  assert.equal(
    apiCalls,
    parseInt(expectedCalls, 10),
    `Expected ${expectedCalls} API calls but got ${apiCalls}. Requests:\n${this.debugOutput
      .split('\n')
      .filter((line: string) => line.includes('[TRACING] Request to'))
      .join('\n')}`,
  )
})

Then(/shopify version less than or equal to (\d+) API calls/, async function (maxCalls: string) {
  const apiCalls = (this.debugOutput.match(/\[TRACING\] Request to/g) || []).length

  assert.ok(
    apiCalls <= parseInt(maxCalls, 10),
    `Expected less than or equal to ${maxCalls} API calls but got ${apiCalls}. Requests:\n${this.debugOutput
      .split('\n')
      .filter((line: string) => line.includes('[TRACING] Request to'))
      .join('\n')}`,
  )
})
