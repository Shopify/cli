import {cliFixture as test} from '../setup/cli.js'
import {expect} from '@playwright/test'

test.describe('Smoke test', () => {
  test('shopify version runs successfully', async ({cli}) => {
    const result = await cli.exec(['version'])
    expect(result.exitCode, `shopify version failed:\nstdout: ${result.stdout}\nstderr: ${result.stderr}`).toBe(0)
    expect(result.stdout).toMatch(/\d+\.\d+\.\d+/)
    expect(result.stderr).toBe('')
  })

  test('shopify version outputs JSON', async ({cli}) => {
    const result = await cli.exec(['version', '--json'])

    expect(result.exitCode, result.stderr).toBe(0)
    expect(result.stderr).toBe('')
    expect(JSON.parse(result.stdout)).toEqual({version: expect.stringMatching(/^\d+\.\d+\.\d+/)})
  })

  test('shopify version outputs its JSON schema', async ({cli}) => {
    const result = await cli.exec(['version', '--json-schema'])

    expect(result.exitCode, result.stderr).toBe(0)
    expect(result.stderr).toBe('')
    expect(JSON.parse(result.stdout).definitions.Result).toMatchObject({
      type: 'object',
      properties: {version: {type: 'string'}},
      required: ['version'],
      additionalProperties: false,
    })
  })
})
