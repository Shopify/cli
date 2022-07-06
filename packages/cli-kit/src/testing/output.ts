import * as output from '../output.js'

export function mockAndCaptureOutput() {
  return {
    output: () => output.collectedLogs.output?.join('\n'),
    info: () => output.collectedLogs.info?.join('\n'),
    debug: () => output.collectedLogs.debug?.join('\n'),
    success: () => output.collectedLogs.success?.join('\n'),
    started: () => output.collectedLogs.started?.join('\n'),
    completed: () => output.collectedLogs.completed?.join('\n'),
    failed: () => output.collectedLogs.failed?.join('\n'),
    warn: () => output.collectedLogs.warn?.join('\n'),
    clear: () => {
      output.clearCollectedLogs()
    },
  }
}
