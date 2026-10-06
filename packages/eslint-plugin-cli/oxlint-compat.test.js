const {RuleTester} = require('oxlint/plugins-dev')

const {rules} = require('./oxlint-compat')

const ruleTester = new RuleTester({languageOptions: {sourceType: 'module'}, filename: '/repo/fixture.ts'})

ruleTester.run('naming-convention', rules['typescript-eslint-naming-convention'], {
  valid: [
    {
      filename: '/repo/fixture.ts',
      code: 'interface Widget {}',
      options: [{selector: 'typeLike', format: ['PascalCase']}],
    },
    {
      filename: '/repo/fixture.ts',
      code: '/* eslint-disable @typescript-eslint/naming-convention */\ninterface widget {}',
      options: [{selector: 'typeLike', format: ['PascalCase']}],
    },
  ],
  invalid: [
    {
      filename: '/repo/fixture.ts',
      code: 'interface widget {}',
      options: [{selector: 'typeLike', format: ['PascalCase']}],
      errors: [{messageId: 'doesNotMatchFormat'}],
    },
    {
      filename: '/repo/fixture.ts',
      code: 'interface Widget<TValue> {}',
      options: [{selector: 'typeParameter', format: ['PascalCase'], prefix: ['U']}],
      errors: [{messageId: 'missingAffix'}],
    },
  ],
})

ruleTester.run('member-ordering', rules['typescript-eslint-member-ordering'], {
  valid: [
    {
      filename: '/repo/fixture.ts',
      code: 'class Widget { static count = 0; run() {} }',
      options: [{default: ['static-field', 'method']}],
    },
  ],
  invalid: [
    {
      filename: '/repo/fixture.ts',
      code: 'class Widget { run() {} static count = 0 }',
      options: [{default: ['static-field', 'method']}],
      errors: [{messageId: 'incorrectGroupOrder'}],
    },
  ],
})

ruleTester.run('id-length', rules['id-length'], {
  valid: [
    {filename: '/repo/fixture.ts', code: 'type Widget<T> = T', options: [{min: 2}]},
    {filename: '/repo/fixture.ts', code: 'const x = 1', options: [{min: 2, exceptions: ['x']}]},
    {filename: '/repo/fixture.ts', code: '/* eslint-disable id-length */\nconst a = 1', options: [{min: 2}]},
  ],
  invalid: [
    {filename: '/repo/fixture.ts', code: 'const a = 1', options: [{min: 2}], errors: [{messageId: 'tooShort'}]},
  ],
})

ruleTester.run('restricted-syntax', rules['no-restricted-syntax'], {
  valid: [
    {
      filename: '/repo/fixture.ts',
      code: "const message = 'Try again'",
      options: [{selector: 'Literal[value=/do not/]', message: 'Use contractions'}],
    },
    {
      filename: '/repo/fixture.ts',
      code: "// eslint-disable-next-line no-restricted-syntax\nconst message = 'do not retry'",
      options: [{selector: 'Literal[value=/do not/]', message: 'Use contractions'}],
    },
  ],
  invalid: [
    {
      filename: '/repo/fixture.ts',
      code: "const message = 'do not retry'",
      options: [{selector: 'Literal[value=/do not/]', message: 'Use contractions'}],
      errors: [{message: 'Use contractions'}],
    },
  ],
})

ruleTester.run('public-jsdoc', rules['jsdoc-require-param'], {
  valid: ['/** @param value - The value. */\nexport function read(value) { return value }'],
  invalid: [
    {
      filename: '/repo/fixture.ts',
      code: '/** Read a value. */\nexport function read(value) { return value }',
      errors: [{message: 'Missing JSDoc @param "value" declaration.'}],
      output: '/**\n * Read a value.\n * @param value\n */\nexport function read(value) { return value }',
    },
  ],
})

test('checks module boundaries, deprecated imports, assertions, and unused directives with Oxlint', () => {
  const {mkdtempSync, mkdirSync, writeFileSync, rmSync, symlinkSync} = require('node:fs')
  const {tmpdir} = require('node:os')
  const {join, resolve} = require('node:path')
  const {spawnSync} = require('node:child_process')
  const workspace = mkdtempSync(join(tmpdir(), 'cli-oxlint-rules-'))
  const repository = resolve(__dirname, '../..')
  try {
    symlinkSync(join(repository, 'node_modules'), join(workspace, 'node_modules'), 'junction')
    writeFileSync(join(workspace, 'nx.json'), '{}')
    writeFileSync(join(workspace, 'package.json'), JSON.stringify({name: 'lint-fixtures', private: true}))
    writeFileSync(
      join(workspace, 'tsconfig.json'),
      JSON.stringify({compilerOptions: {strict: true}, include: ['packages/**/*.ts']}),
    )
    for (const name of ['app', 'kit']) {
      mkdirSync(join(workspace, 'packages', name, 'src'), {recursive: true})
      writeFileSync(
        join(workspace, 'packages', name, 'project.json'),
        JSON.stringify({name, root: `packages/${name}`, projectType: 'library'}),
      )
    }
    writeFileSync(
      join(workspace, 'packages/kit/src/index.ts'),
      '/** @deprecated Use another function. */\nexport function oldFunction() {}',
    )
    writeFileSync(
      join(workspace, 'packages/app/src/index.ts'),
      "import {oldFunction} from '../../kit/src/index'\nconst value: string = 'value'\noldFunction()\nexport const result = value as string\n// eslint-disable-next-line compat/no-restricted-syntax\nexport const message = 'retry'",
    )
    writeFileSync(
      join(workspace, 'oxlint.json'),
      JSON.stringify({
        categories: {correctness: 'off'},
        jsPlugins: [{name: 'compat', specifier: join(__dirname, 'oxlint-compat.js')}],
        rules: {
          'compat/nx-enforce-module-boundaries': 'error',
          'compat/import-x-no-deprecated': 'error',
          'compat/typescript-eslint-no-unnecessary-type-assertion': 'error',
          'compat/no-restricted-syntax': ['error', {selector: 'Literal[value=/do not/]', message: 'Use contractions'}],
        },
      }),
    )
    const graph = spawnSync(process.execPath, [require.resolve('nx/bin/nx.js'), 'graph', '--file', 'graph.json'], {
      cwd: workspace,
      encoding: 'utf8',
      env: {...process.env, NX_DAEMON: 'false'},
    })
    expect(graph.status, graph.stdout + graph.stderr).toBe(0)
    const lint = spawnSync(
      process.execPath,
      [
        join(repository, 'node_modules/oxlint/bin/oxlint'),
        '--config',
        'oxlint.json',
        '--format',
        'json',
        '--report-unused-disable-directives',
        'packages/app/src/index.ts',
      ],
      {cwd: workspace, encoding: 'utf8', env: {...process.env, NX_DAEMON: 'false'}},
    )
    expect(lint.status).toBe(1)
    const diagnostics = JSON.parse(lint.stdout).diagnostics
    expect(diagnostics.map((diagnostic) => diagnostic.code)).toEqual(
      expect.arrayContaining([
        'compat(nx-enforce-module-boundaries)',
        'compat(import-x-no-deprecated)',
        'compat(typescript-eslint-no-unnecessary-type-assertion)',
      ]),
    )
    expect(diagnostics.some((diagnostic) => diagnostic.message.includes('Unused eslint-disable directive'))).toBe(true)
  } finally {
    rmSync(workspace, {recursive: true, force: true})
  }
}, 30000)
