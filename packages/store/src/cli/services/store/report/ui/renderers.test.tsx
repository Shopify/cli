import {renderReportSpec} from './render.js'
import {BadgeRenderer} from './renderers/badge.js'
import {CalloutRenderer, LeftBarBox} from './renderers/callout.js'
import {ListItemRenderer} from './renderers/list-item.js'
import {SparklineRenderer} from './renderers/sparkline.js'
import {expect, test, vi} from 'vitest'
import type {Spec} from '@json-render/core'
import type {ComponentRenderProps} from '@json-render/ink'

/**
 * Reuses the exact fake-stdout-write pattern from `render.test.tsx`: Ink's `unmount()` resolves
 * `waitUntilExit()` from a write callback that is only wired up once `waitUntilExit()` has been
 * called, so the callback must be deferred past the current synchronous turn (as a real stream
 * would) or the two race and the render hangs.
 */
async function captureReportOutput(spec: Spec): Promise<string> {
  const chunks: string[] = []
  const stdoutWrite = vi.spyOn(process.stdout, 'write').mockImplementation((chunk, encoding, callback) => {
    chunks.push(typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8'))
    const writeCallback = typeof encoding === 'function' ? encoding : callback
    if (writeCallback) queueMicrotask(writeCallback)
    return true
  })

  try {
    await renderReportSpec(spec)
  } finally {
    stdoutWrite.mockRestore()
  }

  return chunks.join('')
}

test('Divider insets its title into the rule instead of centering it', async () => {
  const spec: Spec = {
    root: 'divider',
    elements: {
      divider: {type: 'Divider', props: {title: 'Section'}},
    },
  }

  const output = await captureReportOutput(spec)

  expect(output).toContain('── Section ')
})

test('Table renders no border, a dash separator, and a 2-space column gap', async () => {
  const spec: Spec = {
    root: 'table',
    elements: {
      table: {
        type: 'Table',
        props: {
          columns: [
            {header: 'A', key: 'colA'},
            {header: 'B', key: 'colB'},
          ],
          rows: [{colA: '1', colB: '2'}],
        },
      },
    },
  }

  const output = await captureReportOutput(spec)

  expect(output).toContain('A  B')
  expect(output).toContain('─  ─')
  expect(output).toContain('1  2')
  for (const borderChar of ['┌', '┐', '└', '┘', '│']) {
    expect(output).not.toContain(borderChar)
  }
})

test('List renders a plain bullet with a 2-space indent, matching cli-kit', async () => {
  const spec: Spec = {
    root: 'list',
    elements: {
      list: {type: 'List', props: {items: ['Item one']}},
    },
  }

  const output = await captureReportOutput(spec)

  expect(output).toContain('  • Item one')
})

/**
 * Colors are stripped from captured stdout in this non-TTY test environment, so the left-bar color
 * is verified by inspecting the returned element tree directly instead of rendering to a terminal.
 */
test('Callout colors its left bar by type instead of drawing a full box', () => {
  const element: ComponentRenderProps<{type?: string; title?: string | null; content: string}>['element'] = {
    type: 'Callout',
    props: {type: 'tip', content: 'Body text'},
  }

  const tree = CalloutRenderer({element} as ComponentRenderProps<never>)

  expect(tree.type).toBe(LeftBarBox)
  expect(tree.props.borderColor).toBe('green')

  const box = LeftBarBox(tree.props)
  expect(box.props.borderColor).toBe('green')
  expect(box.props.borderLeft).toBe(true)
  expect(box.props.borderRight).toBe(false)
})

test('Badge brackets its label instead of drawing a filled pill', () => {
  const element: ComponentRenderProps<{label: string; variant?: string | null}>['element'] = {
    type: 'Badge',
    props: {label: 'beta', variant: 'error'},
  }

  const tree = BadgeRenderer({element} as ComponentRenderProps<never>)

  expect(tree.props.children).toEqual(['[', 'beta', ']'])
  expect(tree.props.color).toBe('redBright')
  expect(tree.props.bold).toBe(true)
})

test('Sparkline dims its label', () => {
  const element: ComponentRenderProps<{data: number[]; label?: string | null}>['element'] = {
    type: 'Sparkline',
    props: {data: [1, 2, 3], label: 'Trend'},
  }

  const tree = SparklineRenderer({element} as ComponentRenderProps<never>)

  const labelText = tree!.props.children[0]
  expect(labelText.props.children).toBe('Trend')
  expect(labelText.props.dimColor).toBe(true)
})

test('ListItem bolds its title', () => {
  const element: ComponentRenderProps<{title: string; subtitle?: string | null}>['element'] = {
    type: 'ListItem',
    props: {title: 'Primary', subtitle: 'secondary detail'},
  }

  const tree = ListItemRenderer({element} as ComponentRenderProps<never>)

  const columnBox = tree.props.children[0].props.children[1]
  const titleText = columnBox.props.children[0]
  expect(titleText.props.children).toBe('Primary')
  expect(titleText.props.bold).toBe(true)
})

test('Markdown headings receive a stable React key when mapped', async () => {
  const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
  const spec: Spec = {
    root: 'markdown',
    elements: {
      markdown: {type: 'Markdown', props: {text: '# One\n\n# Two\n'}},
    },
  }

  await captureReportOutput(spec)

  for (const call of consoleError.mock.calls) {
    expect(String(call[0])).not.toContain('key')
  }
  consoleError.mockRestore()
})

test('Markdown fenced code blocks keep a bordered box', async () => {
  const spec: Spec = {
    root: 'markdown',
    elements: {
      markdown: {type: 'Markdown', props: {text: '```\nconst x = 1\n```\n'}},
    },
  }

  const output = await captureReportOutput(spec)

  expect(output).toContain('const x = 1')
  expect(output).toContain('┌')
  expect(output).toContain('└')
})
