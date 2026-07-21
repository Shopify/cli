import {renderReportSpec} from './render.js'
import {expect, test, vi} from 'vitest'
import type {Spec} from '@json-render/core'

const reportSpec: Spec = {
  root: 'report',
  elements: {
    report: {
      type: 'Box',
      props: {},
      children: ['heading', 'grossSales', 'salesByChannel'],
    },
    heading: {
      type: 'Heading',
      props: {text: 'Store performance', level: 'h1'},
    },
    grossSales: {
      type: 'KeyValue',
      props: {label: 'Gross sales', value: '$123.45'},
    },
    salesByChannel: {
      type: 'Table',
      props: {
        columns: [
          {header: 'Channel', key: 'channel'},
          {header: 'Sales', key: 'sales'},
        ],
        rows: [{channel: 'Online Store', sales: '$100.00'}],
      },
    },
  },
}

test('renders a static report through the production fake-stdin path without hanging', async () => {
  const outputChunks: string[] = []
  const stdoutWrite = vi.spyOn(process.stdout, 'write').mockImplementation((chunk, encoding, callback) => {
    outputChunks.push(typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8'))
    const writeCallback = typeof encoding === 'function' ? encoding : callback
    // Ink's unmount() writes an empty-string barrier and resolves waitUntilExit() from that write's
    // callback, but only wires up the real resolver once waitUntilExit() itself has been called. A
    // real stream always defers write callbacks past the current synchronous turn, which gives
    // waitUntilExit() time to run first; firing this callback synchronously races that and hangs
    // forever, so defer it the same way a real Writable would.
    if (writeCallback) queueMicrotask(writeCallback)
    return true
  })

  try {
    await expect(renderReportSpec(reportSpec)).resolves.toBeUndefined()
  } finally {
    stdoutWrite.mockRestore()
  }

  const output = outputChunks.join('')
  expect(output).toContain('Store performance')
  expect(output).toContain('Gross sales')
  expect(output).toContain('$123.45')
  expect(output).toContain('Channel')
  expect(output).toContain('Online Store')
})
