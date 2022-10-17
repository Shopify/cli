import * as output from '../output.js'

export function mockAndCaptureOutput() {
  return {
    output: () => (output.collectedLogs.output ?? []).join('\n'),
    info: () => (output.collectedLogs.info ?? []).join('\n'),
    debug: () => (output.collectedLogs.debug ?? []).join('\n'),
    success: () => (output.collectedLogs.success ?? []).join('\n'),
    completed: () => (output.collectedLogs.completed ?? []).join('\n'),
    warn: () => (output.collectedLogs.warn ?? []).join('\n'),
    error: () => (output.collectedLogs.error ?? []).join('\n'),
    clear: () => {
      output.clearCollectedLogs()
    },
  }
}
