import * as fs from 'fs'
import type {QAReport, StepResult, StepStatus} from './types.js'

const STATUS_ICON: {[key in StepStatus]: string} = {
  pass: '✅',
  fail: '❌',
  skipped: '⏭️',
  blocked: '🚫',
}

function statusLabel(step: StepResult): string {
  if (step.status === 'skipped' && step.kind === 'manual') return '⏭️ manual'
  if (step.status === 'skipped' && step.kind === 'delegated') return '➡️ delegated'
  return `${STATUS_ICON[step.status]} ${step.status}`
}

function duration(ms: number): string {
  if (ms === 0) return ''
  if (ms < 1000) return `${ms}ms`
  const seconds = Math.round(ms / 1000)
  if (seconds < 60) return `${seconds}s`
  return `${Math.floor(seconds / 60)}m${String(seconds % 60).padStart(2, '0')}s`
}

export function renderMarkdown(report: QAReport): string {
  const lines: string[] = []
  lines.push('# CLI Pre-release QA flow — automated run')
  lines.push('')
  lines.push(`- **CLI under test:** ${report.cliTarget}`)
  lines.push(`- **Version:** ${report.cliVersion || 'unknown'}`)
  lines.push(`- **OS:** ${report.os}`)
  lines.push(`- **Started:** ${report.startedAt} — **finished:** ${report.finishedAt}`)
  lines.push('')

  const all = report.sections.flatMap((section) => section.steps)
  const counts = {
    pass: all.filter((step) => step.status === 'pass').length,
    fail: all.filter((step) => step.status === 'fail').length,
    blocked: all.filter((step) => step.status === 'blocked').length,
    manual: all.filter((step) => step.kind === 'manual').length,
    delegated: all.filter((step) => step.kind === 'delegated').length,
  }
  lines.push(
    `**${counts.pass} passed** · ${counts.fail} failed · ${counts.blocked} blocked · ` +
      `${counts.manual} left to manual QA · ${counts.delegated} delegated`,
  )
  lines.push('')

  for (const section of report.sections) {
    lines.push(`## ${section.title}`)
    lines.push('')
    lines.push('| QA doc step | Result | Time | Notes |')
    lines.push('|---|---|---|---|')
    for (const step of section.steps) {
      const note = step.status === 'fail' ? 'see error details below' : step.note ?? ''
      lines.push(
        `| ${escapeCell(step.doc)} | ${statusLabel(step)} | ${duration(step.durationMs)} | ${escapeCell(note)} |`,
      )
    }
    lines.push('')
    const failures = section.steps.filter((step) => step.status === 'fail')
    for (const failure of failures) {
      lines.push(`<details><summary>❌ <code>${failure.id}</code> — error details</summary>`)
      lines.push('')
      lines.push('```')
      lines.push(failure.error ?? 'no error captured')
      lines.push('```')
      lines.push('</details>')
      lines.push('')
    }
  }

  const manualSteps = all.filter((step) => step.kind === 'manual')
  if (manualSteps.length > 0) {
    lines.push('## Remaining manual checklist')
    lines.push('')
    lines.push('These QA-doc items still need a human (browser/visual checks):')
    lines.push('')
    for (const step of manualSteps) {
      lines.push(`- [ ] ${step.doc}${step.note ? ` _(${step.note})_` : ''}`)
    }
    lines.push('')
  }

  return lines.join('\n')
}

function escapeCell(text: string): string {
  return text.replace(/\|/g, '\\|').replace(/\n/g, ' ')
}

export function writeReports(report: QAReport, outDir: string): {markdownPath: string; jsonPath: string} {
  fs.mkdirSync(outDir, {recursive: true})
  const markdown = renderMarkdown(report)
  const markdownPath = `${outDir}/qa-summary.md`
  const jsonPath = `${outDir}/qa-report.json`
  fs.writeFileSync(markdownPath, markdown)
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2))

  const stepSummary = process.env.GITHUB_STEP_SUMMARY
  if (stepSummary) fs.appendFileSync(stepSummary, `${markdown}\n`)

  return {markdownPath, jsonPath}
}
