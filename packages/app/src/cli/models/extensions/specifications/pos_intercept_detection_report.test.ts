import {detectPosIntercepts} from './pos_intercept_detection.js'
import {detectPosInterceptsSimple} from './pos_intercept_detection_simple.js'
import {mkdtempSync, mkdirSync, writeFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join, dirname} from 'node:path'
import {test} from 'vitest'

// ---------------------------------------------------------------------------
// RUNNABLE REPORT (not an assertion suite — it prints and exits 0).
//
// Shows the SIMPLE vs COMPLEX POS intercept detectors side-by-side over a
// curated set of samples that tell the story, including cases where the COMPLEX
// detector ALSO fails (its shallow data-flow has real limits).
//
// RUN:
//   cd packages/app && ../../node_modules/.bin/vitest run \
//     src/cli/models/extensions/specifications/pos_intercept_detection_report.test.ts
//
// Optional: run against a real file instead of the built-in samples:
//   REPORT_PATH=/abs/path/to/entry.ts ../../node_modules/.bin/vitest run \
//     src/cli/models/extensions/specifications/pos_intercept_detection_report.test.ts
// ---------------------------------------------------------------------------

interface Sample {
  name: string
  label: string
  /** entry filename within the sample dir. */
  entry: string
  /** filename -> source content (verbatim, printed in the report). */
  files: {[filename: string]: string}
}

const CB = '() => {}'

const SAMPLES: Sample[] = [
  {
    name: 'plain direct call',
    label: 'BOTH RESOLVE',
    entry: 'index.ts',
    files: {
      'index.ts': `declare const shopify: {intercept: (e: string, cb: () => void) => void}\nshopify.intercept('beforecheckout', ${CB})\n`,
    },
  },
  {
    name: 'same-file destructure',
    label: 'simple WARNS, complex RESOLVES',
    entry: 'index.ts',
    files: {
      'index.ts': `declare const shopify: {intercept: (e: string, cb: () => void) => void}\nconst {intercept} = shopify\nintercept('beforediscount', ${CB})\n`,
    },
  },
  {
    name: 'object alias then member call',
    label: 'simple WARNS, complex RESOLVES',
    entry: 'index.ts',
    files: {
      'index.ts': `declare const shopify: {intercept: (e: string, cb: () => void) => void}\nconst s = shopify\ns.intercept('beforeexchange', ${CB})\n`,
    },
  },
  {
    name: 'cross-file re-exported reference',
    label: 'simple WARNS, complex RESOLVES',
    entry: 'index.ts',
    files: {
      'dep.ts': `declare const shopify: {intercept: (e: string, cb: () => void) => void}\nexport const block = shopify.intercept\n`,
      'index.ts': `import {block} from './dep.js'\nblock('beforecancel', ${CB})\n`,
    },
  },
  {
    name: 'alias chain const a = shopify; const b = a',
    label: 'simple WARNS (chain closed), complex RESOLVES',
    entry: 'index.ts',
    files: {
      'index.ts': `declare const shopify: {intercept: (e: string, cb: () => void) => void}\nconst a = shopify\nconst b = a\nb.intercept('beforecapture', ${CB})\n`,
    },
  },
  {
    name: 'dynamic event argument (variable)',
    label: 'BOTH UNRESOLVED (dynamic) — simple WARNS',
    entry: 'index.ts',
    files: {
      'index.ts': `declare const shopify: {intercept: (e: string, cb: () => void) => void}\nconst evt = 'beforetax'\nshopify.intercept(evt, ${CB})\n`,
    },
  },
  {
    name: 'const-folded event name const E = "..."; intercept(E, cb)',
    label: 'COMPLEX ALSO FAILS (no constant folding) — simple WARNS',
    entry: 'index.ts',
    files: {
      'index.ts': `declare const shopify: {intercept: (e: string, cb: () => void) => void}\nconst E = 'beforeshipping'\nshopify.intercept(E, ${CB})\n`,
    },
  },
  {
    name: 'higher-order passing register(shopify.intercept)',
    label: 'COMPLEX ALSO FAILS (silent miss on HOF) — simple WARNS',
    entry: 'index.ts',
    files: {
      'index.ts': `declare const shopify: {intercept: (e: string, cb: () => void) => void}\nfunction register(fn: typeof shopify.intercept) {\n  fn('beforepayment', ${CB})\n}\nregister(shopify.intercept)\n`,
    },
  },
  {
    name: 'stored in object then called const m = { i: shopify.intercept }',
    label: 'COMPLEX ALSO FAILS (silent miss via object storage) — simple WARNS',
    entry: 'index.ts',
    files: {
      'index.ts': `declare const shopify: {intercept: (e: string, cb: () => void) => void}\nconst m = {i: shopify.intercept}\nm.i('beforerefund', ${CB})\n`,
    },
  },
]

function writeSample(sample: Sample): string {
  const dir = mkdtempSync(join(tmpdir(), 'pos-intercept-report-'))
  for (const [filename, content] of Object.entries(sample.files)) {
    const filePath = join(dir, filename)
    mkdirSync(dirname(filePath), {recursive: true})
    writeFileSync(filePath, content)
  }
  return join(dir, sample.entry)
}

const list = (items: string[]) => (items.length ? `[${items.join(', ')}]` : '[]')

function indent(text: string): string {
  return text
    .replace(/\n+$/, '')
    .split('\n')
    .map((line) => `    ${line}`)
    .join('\n')
}

async function reportOne(sourceLabel: string, entryPath: string, printedSource?: string): Promise<void> {
  const [simple, complex] = await Promise.all([detectPosInterceptsSimple(entryPath), detectPosIntercepts(entryPath)])

  const simpleWarns = simple.warnings.map((warning) => `${warning.kind}: ${warning.message.split('.')[0]}`)
  const complexUnresolved = complex.unresolved.map((entry) => entry.unresolvedReason ?? entry.argText)

  // Verdict.
  const simpleStr = simple.events.length
    ? `resolved ${list(simple.events)}`
    : simpleWarns.length
      ? `WARN(${simple.warnings.map((warning) => warning.kind).join(', ')})`
      : 'nothing'
  const complexStr = complex.events.length
    ? `resolved ${list(complex.events)}`
    : complexUnresolved.length
      ? `unresolved(${complexUnresolved.length})`
      : 'NOTHING — silent miss'
  const complexFailed = complex.events.length === 0
  const verdict = `${complexFailed && complexUnresolved.length === 0 ? '⚠ COMPLEX ALSO FAILS — ' : ''}simple ${simpleStr}  |  complex ${complexStr}`

  const lines: string[] = []
  lines.push('═'.repeat(72))
  lines.push(sourceLabel)
  lines.push('─'.repeat(72))
  if (printedSource !== undefined) {
    lines.push('SOURCE:')
    lines.push(indent(printedSource))
    lines.push('')
  }
  lines.push(`SIMPLE   events=${list(simple.events)}`)
  if (simpleWarns.length) simpleWarns.forEach((warning) => lines.push(`         warn  ${warning}`))
  lines.push(`COMPLEX  events=${list(complex.events)}`)
  if (complexUnresolved.length) complexUnresolved.forEach((reason) => lines.push(`         unresolved  ${reason}`))
  lines.push(`VERDICT  ${verdict}`)
  // eslint-disable-next-line no-console
  console.log(lines.join('\n'))
}

test('POS intercept detector report (simple vs complex)', async () => {
  const overridePath = process.env.REPORT_PATH
  // eslint-disable-next-line no-console
  console.log(`\n\nPOS INTERCEPT DETECTOR REPORT — simple (safe-simplest) vs complex (alias-resolving)\n`)

  if (overridePath) {
    // eslint-disable-next-line no-console
    console.log(`Running against REPORT_PATH=${overridePath}\n`)
    await reportOne(`FILE: ${overridePath}`, overridePath)
  } else {
    for (let index = 0; index < SAMPLES.length; index++) {
      const sample = SAMPLES[index]!
      const entryPath = writeSample(sample)
      const combinedSource = Object.entries(sample.files)
        .map(([filename, content]) => `// ── ${filename} ──\n${content}`)
        .join('\n')
      // eslint-disable-next-line no-await-in-loop
      await reportOne(`SAMPLE ${index + 1}: ${sample.name}   [${sample.label}]`, entryPath, combinedSource)
    }
  }
  // eslint-disable-next-line no-console
  console.log(`\n${'═'.repeat(72)}\nLEGEND: "silent miss" = a real intercept('event', cb) call the detector\nreturned NOTHING for (not even unresolved). The safe-simplest detector never\nsilently misses — it warns and tells the developer to declare it in TOML.\n`)
})
