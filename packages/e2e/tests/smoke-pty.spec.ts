import {cliFixture as test} from '../setup/cli.js'
import {expect} from '@playwright/test'

test.describe('PTY smoke test', () => {
  test('shopify version runs via PTY', async ({cli}) => {
    const proc = await cli.spawn(['version'])
    const code = await proc.waitForExit()
    expect(code, `shopify version (PTY) failed. Output:\n${proc.getOutput()}`).toBe(0)
    expect(proc.getOutput()).toMatch(/\d+\.\d+\.\d+/)
  })

  test('stops a process while another caller waits for its exit', async ({cli}) => {
    const proc = await cli.spawn(['version'])
    const exiting = proc.waitForExit()
    await cli.stopAll()
    await expect(exiting).resolves.toEqual(expect.any(Number))
  })
})
