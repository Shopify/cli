import {cliFixture as test} from '../fixtures/cli-process.js'
import {expect} from '@playwright/test'

test.describe('Smoke test @phase1', () => {
  test('shopify version runs successfully', async ({cli}) => {
    const result = await cli.exec(['version'])
    expect(result.exitCode).toBe(0)
    expect(result.stdout).toMatch(/\d+\.\d+\.\d+/)
  })
})
