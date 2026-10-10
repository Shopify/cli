import {execUpgradeCommand, upgradeOutputStreams} from './output.js'
import {commandEventOutputSchema, renderCommandEventAsJson, runWithCommandEvents} from '../command-events.js'
import {withCapturedStandardStreams} from '../testing/output.js'
import * as system from '../system.js'
import {expect, test, vi} from 'vitest'

test('uses the original streams for terminal output', () => {
  expect(upgradeOutputStreams()).toEqual({stdout: process.stdout, stderr: process.stderr})
})

test('decodes interleaved UTF-8 chunks independently for stdout and stderr', async () => {
  await withCapturedStandardStreams(({stdout, stderr}) => {
    runWithCommandEvents({outputMode: 'json', sink: renderCommandEventAsJson}, () => {
      const streams = upgradeOutputStreams()
      const stdoutBytes = Buffer.from('café')
      const stderrBytes = Buffer.from('🛍')

      streams.stdout.write(stdoutBytes.subarray(0, 4))
      streams.stderr.write(stderrBytes.subarray(0, 2))
      streams.stdout.write(stdoutBytes.subarray(4))
      streams.stderr.write(stderrBytes.subarray(2))
      streams.stdout.end()
      streams.stderr.end()
    })

    const events = stderr()
      .trim()
      .split('\n')
      .map((line) => commandEventOutputSchema.validate(JSON.parse(line)))
    expect(events).toEqual([
      expect.objectContaining({type: 'diagnostic', message: 'caf'}),
      expect.objectContaining({type: 'diagnostic', message: 'é'}),
      expect.objectContaining({type: 'diagnostic', message: '🛍'}),
    ])
    expect(stdout()).toBe('')
  })
})

test.each(['success', 'failure'])('flushes both decoders after a global upgrade %s', async (outcome) => {
  const error = new Error('Installation failed')
  const exec = vi.spyOn(system, 'exec').mockImplementation(async (_command, _args, options) => {
    if (!options?.stdout || options.stdout === 'inherit' || !options.stderr || options.stderr === 'inherit') {
      throw new Error('Expected diagnostic streams')
    }
    options.stdout.write(Buffer.from([0xc3]))
    options.stderr.write(Buffer.from([0xf0, 0x9f]))
    if (outcome === 'failure') throw error
  })

  await withCapturedStandardStreams(async ({stdout, stderr}) => {
    await runWithCommandEvents({outputMode: 'json', sink: renderCommandEventAsJson}, async () => {
      const upgrade = execUpgradeCommand('npm', ['install'])
      if (outcome === 'failure') await expect(upgrade).rejects.toBe(error)
      else await upgrade
    })

    const events = stderr()
      .trim()
      .split('\n')
      .map((line) => commandEventOutputSchema.validate(JSON.parse(line)))
    expect(events).toEqual([
      expect.objectContaining({type: 'diagnostic', message: '�'}),
      expect.objectContaining({type: 'diagnostic', message: '�'}),
    ])
    expect(stdout()).toBe('')
    expect(exec).toHaveBeenCalledExactlyOnceWith('npm', ['install'], expect.objectContaining({stdin: 'inherit'}))
  })
})

test('preserves inherited terminal streams after a global upgrade', async () => {
  const exec = vi.spyOn(system, 'exec').mockResolvedValue(undefined)
  const stdoutEnd = vi.spyOn(process.stdout, 'end')
  const stderrEnd = vi.spyOn(process.stderr, 'end')

  await execUpgradeCommand('npm', ['install'])

  expect(exec).toHaveBeenCalledExactlyOnceWith('npm', ['install'], {stdio: 'inherit'})
  expect(stdoutEnd).not.toHaveBeenCalled()
  expect(stderrEnd).not.toHaveBeenCalled()
})
