import assert from 'node:assert/strict'
import {test} from 'node:test'

import {runCommand} from './run-command.js'

test('captures command output without printing it when requested', async (context) => {
  const sensitiveOutput = 'sensitive command output'
  const consoleLog = context.mock.method(console, 'log', () => {})

  const output = await runCommand(process.execPath, ['-e', `process.stdout.write('${sensitiveOutput}')`], {
    printOutput: false,
  })

  assert.equal(output, sensitiveOutput)
  assert.equal(consoleLog.mock.callCount(), 0)
})
