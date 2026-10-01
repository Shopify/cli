const {RuleTester} = require('oxlint/plugins-dev')
const {rules} = require('./oxlint')

const tester = new RuleTester({languageOptions: {sourceType: 'module', parserOptions: {lang: 'ts'}}})

tester.run('naming-convention', rules['naming-convention'], {
  valid: [
    {code: 'interface Widget {}', options: [{selector: 'typeLike', format: ['PascalCase']}]},
    {
      code: 'type Element<TValues> = TValues extends ReadonlyArray<infer Value> ? Value : never',
      options: [{selector: 'typeParameter', format: ['PascalCase'], prefix: ['T']}],
    },
    {
      code: 'type Widget<T1, _TValue> = T1',
      options: [{selector: 'typeParameter', format: ['PascalCase'], prefix: ['T']}],
    },
    {code: 'const data = {"some_property": 1}', options: [{selector: 'objectLiteralProperty', format: null}]},
  ],
  invalid: [
    {code: 'interface widget {}', options: [{selector: 'typeLike', format: ['PascalCase']}], errors: 1},
    {
      code: 'interface Widget<Value> {}',
      options: [{selector: 'typeParameter', format: ['PascalCase'], prefix: ['T']}],
      errors: 1,
    },
    {
      code: 'interface IWidget {}',
      options: [{selector: 'interface', format: ['PascalCase'], custom: {regex: '^I[A-Z]', match: false}}],
      errors: 1,
    },
  ],
})

tester.run('member-ordering', rules['member-ordering'], {
  valid: [
    {code: 'class Widget { static count = 0; run() {} }', options: [{default: ['static-field', 'method']}]},
    {
      code: 'class Widget { run() {} execute = () => {} }',
      options: [{default: ['public-instance-field', 'public-instance-method']}],
    },
    {
      code: 'interface Widget { run(): void; count: number }',
      options: [{default: ['public-instance-field', 'public-instance-method']}],
    },
    {
      code: 'abstract class Widget { abstract run(): void; count = 0 }',
      options: [{default: ['public-instance-field', 'public-instance-method']}],
    },
  ],
  invalid: [
    {code: 'class Widget { run() {} static count = 0 }', options: [{default: ['static-field', 'method']}], errors: 1},
  ],
})

tester.run('id-length', rules['id-length'], {
  valid: [
    {code: 'type Widget<T> = T', options: [{min: 2}]},
    {code: "import {z} from 'zod'", options: [{min: 2}]},
    {code: 'const x = 1', options: [{min: 2, exceptions: ['x']}]},
  ],
  invalid: [{code: 'const a = 1', options: [{min: 2}], errors: 1}],
})

tester.run('import-order', rules['import-order'], {
  valid: [
    {
      code: "import local from './local';\nimport {readFile} from 'node:fs';",
      options: [{groups: ['sibling', 'builtin']}],
    },
  ],
  invalid: [
    {
      code: "import {readFile} from 'node:fs';\nimport local from './local';",
      options: [{groups: ['sibling', 'builtin']}],
      errors: 1,
      output: "import local from './local';\nimport {readFile} from 'node:fs';",
    },
  ],
})

tester.run('no-catch-all', rules['no-catch-all'], {
  valid: ['try { run() } catch (error) { throw error }', 'try { run() } catch (error) { if (error) throw error }'],
  invalid: [{code: 'try { run() } catch (error) { log(error) }', errors: 1}],
})

tester.run('restricted-syntax', rules['restricted-syntax'], {
  valid: [
    {code: "const message = 'Retry'", options: [{selector: 'Literal[value=/do not/]', message: 'Use contractions'}]},
  ],
  invalid: [
    {
      code: "const message = 'do not retry'",
      options: [{selector: 'Literal[value=/do not/]', message: 'Use contractions'}],
      errors: 1,
    },
  ],
})

tester.run('no-new-object', rules['no-new-object'], {
  valid: ['const value = {}', 'function read(Object) { return new Object() }'],
  invalid: [
    {code: 'const value = new Object()', errors: 1},
    {code: 'const value = new Object(existing)', errors: 1},
  ],
})

tester.run('public-param-documentation', rules['jsdoc-require-param'], {
  valid: [
    '/** @param value - The value. */\nexport function read(value) { return value }',
    '/** Local helper. */\nfunction read(value) { return value }',
  ],
  invalid: [{code: '/** Read a value. */\nexport function read(value) { return value }', errors: 1}],
})

tester.run('public-return-documentation', rules['jsdoc-require-returns'], {
  valid: [
    '/** @returns The value. */\nexport function read() { return 1 }',
    '/** Do work. */\nexport async function read(): Promise<void> { return new Promise(resolve => resolve()) }',
    '/** Local helper. */\nfunction read() { return 1 }',
  ],
  invalid: [{code: '/** Read a value. */\nexport function read() { return 1 }', errors: 1}],
})

tester.run('public-jsdoc', rules['jsdoc-require-jsdoc'], {
  valid: ['/** Read a value. */\n// Explanation.\nexport function read() { return 1 }'],
  invalid: [{code: 'export function read() { return 1 }', errors: 1}],
})

tester.run('tsdoc-syntax', rules['tsdoc-syntax'], {
  valid: ['/** Read a value.\n * @param value - The value.\n */\nfunction read(value) {}'],
  invalid: [{code: '/** Read a value.\n * @param value The value.\n */\nfunction read(value) {}', errors: 1}],
})

tester.run('no-undef-init', rules['no-undef-init'], {
  valid: ['let value;', 'const value = undefined'],
  invalid: [{code: 'let value = undefined', errors: 1}],
})

tester.run('prefer-global-url', rules['prefer-global-url'], {
  valid: ['const value = new URL("https://example.com")'],
  invalid: [{code: "import {URL} from 'node:url'", errors: 1}],
})

tester.run('unused-imports', rules['unused-imports'], {
  valid: [
    "import {read} from './reader'; read()",
    "import type {Widget} from './reader'; const value: Widget = {}",
    "import './side-effect'",
  ],
  invalid: [{code: "import {read} from './reader'", errors: 1}],
})

tester.run('commonjs-global-leaks', rules['no-implicit-globals'], {
  valid: [{filename: '/repo/example.cjs', code: 'function read() {}', languageOptions: {sourceType: 'commonjs'}}],
  invalid: [{filename: '/repo/example.cjs', code: 'missing = 1', languageOptions: {sourceType: 'commonjs'}, errors: 1}],
})

tester.run('commonjs-redeclarations', rules['no-redeclare'], {
  valid: [{filename: '/repo/example.cjs', code: 'function Object() {}', languageOptions: {sourceType: 'commonjs'}}],
  invalid: [
    {
      filename: '/repo/example.cjs',
      code: 'var value; var value;',
      languageOptions: {sourceType: 'commonjs'},
      errors: 1,
    },
  ],
})

test('runs independent rules and legacy suppressions without ESLint', () => {
  const {mkdtempSync, mkdirSync, writeFileSync, rmSync} = require('node:fs')
  const {tmpdir} = require('node:os')
  const {join, resolve, dirname} = require('node:path')
  const {spawnSync} = require('node:child_process')
  const workspace = mkdtempSync(join(tmpdir(), 'cli independent oxlint-'))
  try {
    const guard = join(workspace, 'forbid-eslint.cjs')
    writeFileSync(
      guard,
      `
      const Module = require('node:module')
      const load = Module._load
      Module._load = function (specifier, ...args) {
        if (/^(?:eslint(?:\\/|$)|eslint-plugin-|@typescript-eslint\\/|@nx\\/eslint-plugin|@shopify\\/eslint-plugin(?:\\/|$))/.test(specifier)) {
          throw new Error('ESLint dependency loaded: ' + specifier)
        }
        return load.call(this, specifier, ...args)
      }
    `,
    )
    writeFileSync(join(workspace, 'pnpm-workspace.yaml'), 'packages:\n  - packages/*\n')
    for (const name of ['app', 'kit']) {
      const directory = join(workspace, 'packages', name, 'src')
      mkdirSync(directory, {recursive: true})
      writeFileSync(join(workspace, 'packages', name, 'project.json'), JSON.stringify({name}))
      writeFileSync(join(workspace, 'packages', name, 'package.json'), JSON.stringify({name: `@fixture/${name}`}))
      writeFileSync(
        join(directory, 'index.ts'),
        name === 'app'
          ? "import {read} from '../../kit/src/index'\nexport const value = read()"
          : 'export function read() { return 1 }',
      )
    }
    const legacyFile = join(workspace, 'packages', 'app', 'src', 'legacy.ts')
    const legacySource = `/** @param value Description. */
function read(value) { try { run() } catch (error) { log(error) } }
interface widget {}`
    writeFileSync(
      legacyFile,
      `/* eslint-disable compat/typescript-eslint-naming-convention, no-catch-all/no-catch-all, tsdoc/syntax */\n${legacySource}`,
    )
    writeFileSync(
      join(workspace, 'oxlint.json'),
      JSON.stringify({
        jsPlugins: [
          {name: 'cli', specifier: resolve(__dirname, 'oxlint.js')},
          {name: 'compat', specifier: resolve(__dirname, 'oxlint-compat-names.js')},
          {name: 'no-catch-all', specifier: resolve(__dirname, 'oxlint-no-catch-all.js')},
          {name: 'tsdoc', specifier: resolve(__dirname, 'oxlint-tsdoc.js')},
        ],
        categories: {correctness: 'off'},
        rules: {
          'cli/module-boundaries': 'error',
          'compat/typescript-eslint-naming-convention': ['error', {selector: 'typeLike', format: ['PascalCase']}],
          'no-catch-all/no-catch-all': 'error',
          'tsdoc/syntax': 'error',
        },
      }),
    )
    const result = spawnSync(
      process.execPath,
      [
        join(dirname(require.resolve('oxlint/package.json')), 'bin/oxlint'),
        '--config',
        'oxlint.json',
        '--format',
        'json',
        '--deny-warnings',
        '--report-unused-disable-directives',
        'packages',
      ],
      {
        cwd: workspace,
        encoding: 'utf8',
        env: {...process.env, NODE_OPTIONS: `--require "${guard.replaceAll('\\', '/')}"`},
      },
    )
    expect(result.status, result.stdout + result.stderr).toBe(1)
    expect(result.stdout, result.stderr).not.toBe('')
    expect(JSON.parse(result.stdout).diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      'cli(module-boundaries)',
    ])
    writeFileSync(legacyFile, legacySource)
    const unsuppressed = spawnSync(
      process.execPath,
      [
        join(dirname(require.resolve('oxlint/package.json')), 'bin/oxlint'),
        '--config',
        'oxlint.json',
        '--format',
        'json',
        'packages',
      ],
      {
        cwd: workspace,
        encoding: 'utf8',
        env: {...process.env, NODE_OPTIONS: `--require "${guard.replaceAll('\\', '/')}"`},
      },
    )
    expect(unsuppressed.status, unsuppressed.stdout + unsuppressed.stderr).toBe(1)
    expect(unsuppressed.stdout, unsuppressed.stderr).not.toBe('')
    expect(
      JSON.parse(unsuppressed.stdout)
        .diagnostics.map((diagnostic) => diagnostic.code)
        .sort(),
    ).toEqual([
      'cli(module-boundaries)',
      'compat(typescript-eslint-naming-convention)',
      'no-catch-all(no-catch-all)',
      'tsdoc(syntax)',
    ])
  } finally {
    rmSync(workspace, {recursive: true, force: true})
  }
})
