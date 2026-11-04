import {prepareVariablesErrors} from './prepare-variables.js'
import {testFunctionExtension} from '../../models/app/app.test-data.js'
import {FunctionConfigType} from '../../models/extensions/specifications/function.js'
import {inTemporaryDirectory, mkdir, writeFile} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {describe, expect, test} from 'vitest'

const schema = `
  scalar JSON
  enum Mode { FAST SLOW }
  input Rule { handle: String!, weight: Int }
  type Query { shop: String }
`
const runQuery = 'query Run($handle: String!, $limit: Int = 5, $mode: Mode, $rules: [Rule!], $data: JSON) { shop }'

function config(targeting: FunctionConfigType['targeting']) {
  return {
    name: 'function',
    type: 'function',
    description: '',
    api_version: '2026-07',
    configuration_ui: false,
    build: {wasm_opt: true},
    targeting,
  } as FunctionConfigType
}

const paired = config([
  {target: 'cart.validations.generate.prepare', export: 'cart-validations-generate-prepare'},
  {target: 'cart.validations.generate.run', input_query: 'src/run.graphql', export: 'cart-validations-generate-run'},
])

async function check(files: {[path: string]: string}, configuration = paired) {
  return inTemporaryDirectory(async (dir) => {
    await mkdir(joinPath(dir, 'src'))
    await writeFile(joinPath(dir, 'schema.graphql'), schema)
    await writeFile(joinPath(dir, 'src/run.graphql'), runQuery)
    await Promise.all(Object.entries(files).map(([path, content]) => writeFile(joinPath(dir, 'src', path), content)))
    const fun = await testFunctionExtension({dir, config: configuration, entryPath: joinPath(dir, 'src/index.js')})
    return (await prepareVariablesErrors(fun)).map((error) => error.replace(/^\S+:\d+:\d+ /, ''))
  })
}

const prepare = (body: string) => ({'index.js': `export function cartValidationsGeneratePrepare(input) {\n${body}\n}`})

describe('prepareVariablesErrors', () => {
  test('accepts variables the run query declares', async () => {
    await expect(
      check(
        prepare(`
          const region = String(input.region)
          return {
            variables: {
              handle: region ? \`rule-\${region.toLowerCase()}\` : 'default',
              limit: undefined,
              mode: region === 'eu' ? 'FAST' : null,
              rules: [{handle: 'a', weight: 1}],
              data: JSON.parse(input.data),
            },
          }`),
      ),
    ).resolves.toEqual([])
  })

  test('ignores functions without a prepare target', async () => {
    await expect(
      check({}, config([{target: 'cart.validations.generate.run', input_query: 'src/run.graphql', export: 'run'}])),
    ).resolves.toEqual([])
  })

  test('rejects keys the run query does not declare', async () => {
    await expect(check(prepare(`return {variables: {handel: 'a'}}`))).resolves.toEqual([
      "`variables.handel` isn't declared by src/run.graphql",
      '`variables.handle` is missing, and String! has no default',
    ])
  })

  test('rejects values of the wrong type', async () => {
    await expect(
      check(
        prepare(`return {variables: {handle: 1, limit: 1.5, mode: 'MEDIUM', rules: [{handle: 'a', weight: '1'}]}}`),
      ),
    ).resolves.toEqual([
      '`variables.handle` must be String!, not 1',
      '`variables.limit` must be Int, not 1.5',
      '`variables.mode` must be Mode, not "MEDIUM"',
      '`variables.rules[].weight` must be Int, not "1"',
    ])
    // Each branch is checked on its own, since TypeScript widens 'FAST' and 'MEDIUM' to string and merges the branches
    await expect(
      check(
        prepare(
          `return input.a ? {variables: {handle: 'a', mode: 'FAST'}} : {variables: {handle: 'a', mode: 'MEDIUM'}}`,
        ),
      ),
    ).resolves.toEqual(['`variables.mode` must be Mode, not "MEDIUM"'])
  })

  test('rejects null and undefined where the variable needs a value', async () => {
    await expect(
      check(prepare(`return input.a ? {variables: {handle: null}} : {variables: {handle: undefined}}`)),
    ).resolves.toEqual([
      "`variables.handle` can be null, but String! can't",
      '`variables.handle` can be undefined, but String! has no default',
    ])
    await expect(check(prepare(`return {}`))).resolves.toEqual([
      '`variables` is missing, and Variables! has no default',
    ])
  })

  test('checks what is built, not what the return type declares', async () => {
    await expect(
      check({
        'index.js': `
          /** @returns {{variables: {handle: string}}} */
          export function cartValidationsGeneratePrepare() {
            const variables = {handle: 'a', region: 'eu'}
            return {variables}
          }`,
      }),
    ).resolves.toEqual(["`variables.region` isn't declared by src/run.graphql"])
  })

  test('sees through casts, @ts-ignore and helpers', async () => {
    await expect(
      check({
        'index.js': `
          export function cartValidationsGeneratePrepare(input) {
            // @ts-ignore
            if (input.a) return {variables: /** @type {{handle: string}} */ (JSON.parse(input.raw))}
            return {variables: build()}
          }
          function build() {
            return {handle: 2}
          }`,
      }),
    ).resolves.toEqual([
      "`variables` is typed any, so it can't be checked",
      '`variables.handle` must be String!, not 2',
    ])
  })

  test('rejects variables changed or passed on after they are created', async () => {
    await expect(
      check(
        prepare(`
          const variables = {handle: 'a'}
          variables.limit = 'many'
          tweak(variables)
          return {variables}`),
      ),
    ).resolves.toEqual([
      "`variables` is changed or passed on after it's created, so it can't be checked",
      "`variables` is changed or passed on after it's created, so it can't be checked",
    ])
    await expect(
      check(
        prepare(`
          const base = {handle: 'a'}
          base.handle = 1
          return {variables: {...base}}`),
      ),
    ).resolves.toEqual(["`variables` is changed or passed on after it's created, so it can't be checked"])
  })

  test('ignores what annotations and casts claim', async () => {
    await expect(
      check(
        prepare(`
          const raw = /** @type {{handle: string}} */ (JSON.parse(input.raw))
          const {limit} = /** @type {{limit: number}} */ (JSON.parse(input.raw))
          return {variables: {handle: raw.handle, limit}}`),
      ),
    ).resolves.toEqual([
      "`variables.handle` is typed any, so it can't be checked",
      "`variables.limit` is typed any, so it can't be checked",
    ])
    await expect(
      check({
        'index.js': `export * from './prepare.js'`,
        'prepare.ts': `
          type Variables = {handle: string}
          export function cartValidationsGeneratePrepare(input: {name?: string; mode: string}): {variables: Variables} {
            if (input.mode) return {variables: {handle: input.name!, mode: <'FAST'>input.mode}}
            return {variables: new Map<string, Variables>().get(input.mode)! as Variables}
          }`,
      }),
    ).resolves.toEqual([
      '`variables.handle` can be undefined, but String! has no default',
      '`variables.mode` must be Mode, not string',
      "`variables` is typed any, so it can't be checked",
    ])
  })

  test('follows re-exports', async () => {
    await expect(
      check({
        'index.js': `export * from './prepare.js'`,
        'prepare.js': `export const cartValidationsGeneratePrepare = () => ({variables: {handle: 1}})`,
      }),
    ).resolves.toEqual(['`variables.handle` must be String!, not 1'])
  })

  test('rejects a missing prepare export', async () => {
    await expect(check({'index.js': 'export function other() {}'})).resolves.toEqual([
      'src/index.js has no `cartValidationsGeneratePrepare` function to check',
    ])
  })
})
