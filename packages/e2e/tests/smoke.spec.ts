import {cliFixture as test} from '../setup/cli.js'
import {expect} from '@playwright/test'

test.describe('Smoke test', () => {
  test('shopify version runs successfully', async ({cli}) => {
    const result = await cli.exec(['version'])
    expect(result.exitCode, `shopify version failed:\nstdout: ${result.stdout}\nstderr: ${result.stderr}`).toBe(0)
    expect(result.stdout).toMatch(/\d+\.\d+\.\d+/)
  })
})
