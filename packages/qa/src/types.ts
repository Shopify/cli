import type {Ctx} from './context.js'

/**
 * How a QA-doc item is handled by the runner:
 * - auto:      executed by the runner.
 * - manual:    requires a human (browser/visual checks) — reported as skipped.
 * - delegated: owned by another team per the QA doc (Theme section).
 */
export type StepKind = 'auto' | 'manual' | 'delegated'

export type StepStatus = 'pass' | 'fail' | 'skipped' | 'blocked'

export interface StepDef {
  /** Stable id, e.g. "apps.init" */
  id: string
  /** The QA-doc wording for this item (shown verbatim in the summary). */
  doc: string
  kind: StepKind
  /** For manual/delegated steps: why the runner skips it. */
  reason?: string
  /**
   * When true, this step runs even if a previous step in the section failed.
   * Defaults to false: a failure blocks the remaining auto steps in the section.
   */
  independent?: boolean
  run?: (ctx: Ctx) => Promise<string | void>
}

export interface SectionDef {
  /** QA-doc section title, e.g. "Apps". */
  title: string
  steps: StepDef[]
}

export interface StepResult {
  id: string
  doc: string
  kind: StepKind
  status: StepStatus
  durationMs: number
  /** Short human note (e.g. observed version, skip reason). */
  note?: string
  /** Error tail for failures. */
  error?: string
}

export interface SectionResult {
  title: string
  steps: StepResult[]
}

export interface QAReport {
  startedAt: string
  finishedAt: string
  cliVersion: string
  cliTarget: string
  os: string
  sections: SectionResult[]
}
