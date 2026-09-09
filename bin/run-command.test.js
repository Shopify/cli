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

test('rejects instead of crashing when the command does not exist', async () => {
  await assert.rejects(runCommand('definitely-not-a-real-binary', []), /could not be run/)
})

test('passes input to the command on stdin', async () => {
  const output = await runCommand(process.execPath, ['-e', 'process.stdin.pipe(process.stdout)'], {
    printOutput: false,
    input: 'piped input',
  })

  assert.equal(output, 'piped input')
})
