import {createFakeStdin} from './fake-stdin.js'
import {reportCatalog} from './catalog.js'
import {reportComponents} from './renderers/index.js'
import {createRenderer} from '@json-render/ink'
import {render} from 'ink'
import React from 'react'
import type {Spec} from '@json-render/core'

const ReportRenderer = createRenderer(reportCatalog, reportComponents)

interface RenderReportSpecOptions {
  stdout?: NodeJS.WriteStream
}

/** Renders a static report spec once, then explicitly tears Ink down so piped output cannot hang. */
export async function renderReportSpec(
  spec: Spec,
  {stdout = process.stdout}: RenderReportSpecOptions = {},
): Promise<void> {
  // json-render installs Ink's input hook even though this catalog is display-only. Always use an
  // inert stdin so terminal and redirected renders have identical, deterministic input behavior.
  const stdin = createFakeStdin()
  const instance = render(<ReportRenderer spec={spec} state={{}} />, {
    stdin,
    stdout,
    exitOnCtrlC: false,
    patchConsole: false,
  })

  try {
    await new Promise<void>((resolve) => {
      setImmediate(resolve)
    })
    instance.unmount()
    await instance.waitUntilExit()
  } finally {
    stdin.destroy()
  }
}
