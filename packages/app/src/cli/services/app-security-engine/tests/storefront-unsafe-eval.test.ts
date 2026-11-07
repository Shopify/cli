import {scanStorefrontUnsafeEval} from '../rules/storefront-unsafe-eval.js'
import {describe, expect, test} from 'vitest'

function scan(content: string, ext = '.js') {
  return scanSource(content, ext).issues
}

function scanSource(content: string | undefined, ext = '.js') {
  return scanStorefrontUnsafeEval([
    {path: `extensions/theme/assets/widget${ext}`, absolutePath: `/widget${ext}`, ext, content},
  ])
}

describe('storefront runtime code generation', () => {
  test.each([
    'eval("render()")',
    'window.eval("render()")',
    'globalThis["eval"]("render()")',
    '(0, eval)("render()")',
    'Function("return 1")',
    'new Function("value", "return value")',
    'self.Function("return 1")',
    '(async function() {}).constructor("return 1")',
    '(function*() {}).constructor("yield 1")',
    '(async function*() {}).constructor("yield 1")',
    '(() => {}).constructor("return 1")',
    'Object.getPrototypeOf(async function() {}).constructor("return 1")',
    'Reflect.getPrototypeOf(function*() {}).constructor("yield 1")',
    '(() => {}).constructor.constructor("return 1")',
    'const run = window.eval; run("render()")',
    'const AsyncFunction = (async function() {}).constructor; new AsyncFunction("return 1")',
    'const {eval: run} = window; run("render()")',
    'setTimeout("render()", 1)',
    'window.setInterval("render()", 1)',
    'setTimeout("render(" + value + ")", 1)',
    'const callback = "render()"; setTimeout(callback, 1)',
    ['const output = `result $', '{eval("1")}`'].join(''),
    ['const output = `result $', '{new Function("return 1")()}`'].join(''),
    'eval?.("render()")',
  ])('finds %s', (content) => {
    expect(scan(content)).toHaveLength(1)
  })

  test.each([
    '// eval("render()")\nrender()',
    'const example = \'eval("render()")\'',
    'const example = \'setTimeout("render()", 1)\'',
    'const example = `setInterval("render()", 1)`',
    'const pattern = /eval\\(code\\)/',
    'function renderFunction() { return 1; } renderFunction()',
    'widget.Function(value)',
    'widget . eval(value)',
    'function render(Function) { return Function("value") }',
    'import {eval as run} from "expression-parser"; run("1")',
    'const window = {eval: render}; window.eval("1")',
    'setTimeout(() => render(), 1)',
    'const callback = () => render(); setInterval(callback, 1)',
    'eval(42)',
    'eval()',
  ])('does not flag %s', (content) => {
    expect(scan(content)).toEqual([])
  })

  test.each([
    '{% javascript %}eval("1");{% endjavascript %}',
    '{%- javascript -%}eval("1");{%- endjavascript -%}',
    '<script>eval("1")</script>',
    '<script type="module">eval("1")</script>',
    '<script type="text/javascript">eval("1")</script>',
    '<script type="text/jscript">eval("1")</script>',
    '<script type="text/livescript">eval("1")</script>',
  ])('finds executable Liquid JavaScript: %s', (content) => {
    expect(scan(content, '.liquid')).toHaveLength(1)
  })

  test.each([
    '{% comment %}<script>eval("1")</script>{% endcomment %}',
    '<!-- <script>eval("1")</script> -->',
    '<script type="application/json">{"example":"setTimeout(\'render()\', 1)"}</script>',
    '<script TYPE="text/plain">eval("1")</script>',
    '<script type="text/x-template">eval("1")</script>',
    '<script src="/assets/widget.js">eval("1")</script>',
    '<script src="{{ "widget.js" | asset_url }}">Function("return 1")</script>',
  ])('ignores inert Liquid content: %s', (content) => {
    expect(scan(content, '.liquid')).toEqual([])
  })

  test.each([
    ['.ts', 'const run: typeof eval = eval; run("1")'],
    ['.tsx', 'const view = <div>{eval("1")}</div>'],
    ['.jsx', 'const view = <div>{eval("1")}</div>'],
    ['.mjs', 'export const result = eval("1")'],
    ['.cjs', 'module.exports = eval("1")'],
    ['.mts', 'export const result: unknown = eval("1")'],
    ['.cts', 'const result: unknown = eval("1")'],
  ])('parses %s source', (ext, content) => {
    expect(scan(content, ext)).toHaveLength(1)
  })

  test('resolves aliases in their declaration scope', () => {
    const issues = scan('const run = eval; function render(eval) { run("1"); eval("1") } eval("1")')
    expect(issues).toHaveLength(2)
  })

  test.each([
    'let run = eval; run = custom; run("1")',
    'const run = external; run("1")',
    'const first = second; const second = first; first("1")',
    'eval(code)',
    'setTimeout(callback, 1)',
  ])('leaves ambiguous code for semantic review: %s', (content) => {
    expect(scanSource(content)).toMatchObject({
      issues: [],
      unresolvedReasonCode: 'agent_investigation_required',
    })
  })

  test('retains both findings on a minified line', () => {
    expect(scan('eval("1");eval("2")').map((issue) => issue.location)).toEqual([
      {file: 'extensions/theme/assets/widget.js', line: 1, column: 1},
      {file: 'extensions/theme/assets/widget.js', line: 1, column: 11},
    ])
  })

  test('reports original Liquid locations across scripts and Unicode', () => {
    const source =
      '<p>🌎</p>\n<script>eval("1")</script>\n{% javascript %}\n  Function("return 1")\n{% endjavascript %}'
    expect(scan(source, '.liquid').map((issue) => issue.location)).toEqual([
      {file: 'extensions/theme/assets/widget.liquid', line: 2, column: 9},
      {file: 'extensions/theme/assets/widget.liquid', line: 4, column: 3},
    ])
  })

  test('reports an ambiguous argument at its original Liquid line', () => {
    expect(scanSource('<p>text</p>\n<script>\neval(code)\n</script>', '.liquid').unresolvedReason).toContain(
      'widget.liquid:3: eval argument needs review',
    )
  })

  test.each([
    ['.js', 'eval('],
    ['.liquid', '<script>eval("1")'],
    ['.liquid', '{% javascript %}eval("1")'],
    ['.html', '<script>eval("1")</script foo>'],
    ['.html', '<script>eval("1")</script/>'],
  ])('leaves unparsable %s source unresolved', (ext, content) => {
    expect(scanSource(content, ext)).toMatchObject({
      issues: [],
      unresolvedReasonCode: 'agent_investigation_required',
      unresolvedReason: expect.stringContaining('could not be parsed'),
    })
  })

  test('leaves a Liquid-dependent script type unresolved', () => {
    expect(scanSource('<script type="{{ script_type }}">eval("1")</script>', '.liquid')).toMatchObject({
      issues: [],
      unresolvedReason: expect.stringContaining('dynamic script type needs review'),
    })
  })

  test.each(['new eval("1")', 'new window.setTimeout("1", 1)'])('ignores non-constructible %s', (content) => {
    expect(scan(content)).toEqual([])
  })

  test('does not mark unreadable source as inspected', () => {
    expect(scanSource(undefined)).toMatchObject({
      issues: [],
      inspectedFiles: [],
      unresolvedReason: expect.stringContaining('source was not readable'),
    })
  })

  test.each(['eval("1")', 'render()', ''])('requires production review even after parsing %s', (content) => {
    expect(scanSource(content)).toMatchObject({
      inspectedFiles: ['extensions/theme/assets/widget.js'],
      unresolvedReasonCode: 'agent_investigation_required',
    })
  })
})
