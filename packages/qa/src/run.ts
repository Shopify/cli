/**
 * CLI Pre-release QA flow runner.
 *
 * Executes the QA doc steps that need no human interaction directly against
 * the CLI under test (repo build by default, or QA_CLI_BIN), records one
 * result per QA-doc checklist item and emits a summary that mirrors the doc.
 *
 * Usage: pnpm --filter @shopify/qa qa            (all sections)
 *        QA_ONLY=hydrogen pnpm --filter @shopify/qa qa
 */
import * as path from 'path'
import {createContext} from './context.js'
import {ensurePtySpawnHelperExecutable, exec} from './proc.js'
import {extractVersion} from './steps/prep.js'
import {writeReports} from './report.js'
import {appsSection} from './steps/apps.js'
import {crossOSSection, hydrogenSection} from './steps/hydrogen.js'
import {generalSection, prepSection} from './steps/prep.js'
import {themeSection} from './steps/theme.js'
import type {QAReport, SectionDef, SectionResult, StepResult} from './types.js'

const ALL_SECTIONS: SectionDef[] = [prepSection, generalSection, appsSection, themeSection, hydrogenSection, crossOSSection]

function selectedSections(): SectionDef[] {
  const only = process.env.QA_ONLY
  if (!only) return ALL_SECTIONS
  const wanted = only.split(',').map((part) => part.trim().toLowerCase())
  return ALL_SECTIONS.filter((section) => wanted.some((want) => section.title.toLowerCase().includes(want)))
}

async function main(): Promise<void> {
  ensurePtySpawnHelperExecutable()
  const ctx = createContext()
  const startedAt = new Date().toISOString()
  ctx.log(`CLI under test: ${ctx.cliTarget}`)
  ctx.log(`work dir: ${ctx.workDir}`)

  const sections: SectionResult[] = []
  for (const section of selectedSections()) {
    ctx.log(`── ${section.title} ──`)
    const results: StepResult[] = []
    let chainBroken = false

    for (const step of section.steps) {
      const base = {id: step.id, doc: step.doc, kind: step.kind}
      if (step.kind !== 'auto' || !step.run) {
        results.push({...base, status: 'skipped', durationMs: 0, note: step.reason})
        continue
      }
      if (chainBroken && !step.independent) {
        results.push({...base, status: 'blocked', durationMs: 0, note: 'blocked by an earlier failure'})
        continue
      }
      const start = Date.now()
      try {
        const note = await step.run(ctx)
        results.push({...base, status: 'pass', durationMs: Date.now() - start, note: note ?? undefined})
        ctx.log(`✅ ${step.id}`)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        results.push({...base, status: 'fail', durationMs: Date.now() - start, error: message})
        ctx.log(`❌ ${step.id}: ${message.split('\n')[0]}`)
        if (!step.independent) chainBroken = true
      }
    }
    sections.push({title: section.title, steps: results})
  }

  // Teardown: make sure no interactive process outlives the run.
  for (const proc of ctx.state.ptyProcs) {
    if (!proc.exited) proc.kill()
  }

  let cliVersion = ''
  try {
    const result = await exec(ctx, ['version'], {timeoutMs: 60_000})
    cliVersion = extractVersion(result.stdout)
  } catch {
    // version already reported in the prep section; ignore here.
  }

  const report: QAReport = {
    startedAt,
    finishedAt: new Date().toISOString(),
    cliVersion,
    cliTarget: ctx.cliTarget,
    os: `${process.platform} ${process.arch}`,
    sections,
  }

  const outDir = process.env.QA_REPORT_DIR ?? path.join(process.cwd(), 'qa-report')
  const {markdownPath, jsonPath} = writeReports(report, outDir)
  ctx.log(`report: ${markdownPath} / ${jsonPath}`)

  const failed = sections.some((section) => section.steps.some((step) => step.status === 'fail' || step.status === 'blocked'))
  process.exit(failed ? 1 : 0)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
