import {cliFixture as test} from '../setup/cli.js'
import {expect} from '@playwright/test'

test.describe('PTY smoke test', () => {
  test('shopify version runs via PTY', async ({cli}) => {
    const proc = await cli.spawn(['version'])
    await proc.waitForOutput('3.')
    const code = await proc.waitForExit()
    expect(code).toBe(0)
    expect(proc.getOutput()).toMatch(/\d+\.\d+\.\d+/)
  })
})
