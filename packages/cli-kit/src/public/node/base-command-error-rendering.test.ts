import BaseCommand from './base-command.js'
import {AbortError} from './error.js'
import {errorHandler} from './error-handler.js'
import {reportAnalyticsEvent} from './analytics.js'
import {outputResult} from './output.js'
import {globalFlags, jsonFlag} from './cli.js'
import {withCapturedStandardStreams} from './testing/output.js'
import {Config, Errors} from '@oclif/core'
import {expect, test, vi} from 'vitest'

vi.mock('./analytics.js', () => ({reportAnalyticsEvent: vi.fn()}))

test.each([false, true])('preserves error reporting and exit handling with a custom renderer=%s', async (custom) => {
  const failure = new AbortError('Command failed')
  class TestCommand extends BaseCommand {
    static flags = {...globalFlags, ...jsonFlag}

    async run() {
      await this.parse(TestCommand)
      throw failure
    }

    execute() {
      return this._run()
    }

    protected async init() {
      return undefined
    }

    protected async handleError(error: Error): Promise<void> {
      if (!custom) return super.handleError(error)
      await errorHandler(error, this.config, async () => outputResult('{"handled":true}'))
    }
  }

  const config = await Config.load({root: __dirname})
  vi.spyOn(Errors, 'handle').mockImplementation(async (error) => {
    throw error
  })
  await withCapturedStandardStreams(async ({stdout, stderr}) => {
    await expect(new TestCommand(['--json'], config).execute()).rejects.toBe(failure)
    expect(JSON.parse(stdout())).toEqual(custom ? {handled: true} : {error: {type: 'abort', message: 'Command failed'}})
    expect(stderr()).toBe('')
  })
  expect(reportAnalyticsEvent).toHaveBeenCalledWith(expect.objectContaining({config, exitMode: 'expected_error'}))
  expect(Errors.handle).toHaveBeenCalledWith(failure)
})
