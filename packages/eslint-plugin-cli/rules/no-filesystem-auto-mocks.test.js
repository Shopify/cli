const {RuleTester} = require('eslint')
const typescriptParser = require('@typescript-eslint/parser')

const rule = require('./no-filesystem-auto-mocks')

const ruleTester = new RuleTester({languageOptions: {parser: typescriptParser}})
const filename = '/repo/services/widgets.test.ts'

ruleTester.run('no-filesystem-auto-mocks', rule, {
  valid: [
    {filename, code: 'vi.mock("./service")'},
    {filename, code: 'vi.mock("../fs.js")'},
    {filename, code: 'import {vi as v} from "vitest"; v.mock("fs")'},
    {filename, code: 'import * as vitest from "vitest"; vitest.vi.mock("fs")'},
    {filename, code: 'vi.mock(`fs`)'},
    {filename: '/repo/services/widgets.spec.ts', code: 'vi.mock("fs")'},
    {filename, code: 'vi.mock("fs", async (importOriginal) => ({...await importOriginal()}))'},
    {filename: '/repo/packages/cli-kit/src/public/node/context/local.test.ts', code: 'vi.mock("../fs.js", () => ({}))'},
    {filename: '/repo/packages/cli-kit/src/public/node/context/local.test.ts', code: 'vi.mock("./fs.js")'},
    {
      filename,
      code: 'vi.mock("@shopify/cli-kit/node/fs", () => ({generateRandomNameForSubdirectory: () => "fixture"}))',
    },
    {filename, code: 'const vi = {mock() {}}; vi.mock("node:fs")'},
    {filename, code: 'function check(vi) { vi.mock("node:fs") }'},
    {filename, code: 'import {vi} from "another-library"; vi.mock("node:fs")'},
    {filename, code: 'vi.mock(moduleName)'},
    {filename: '/repo/services/widgets.ts', code: 'vi.mock("node:fs")'},
  ],
  invalid: [
    {filename, code: 'vi.mock("node:fs")', errors: [{messageId: 'filesystemMock'}]},
    {filename, code: 'vi.mock("@shopify/cli-kit/node/fs.js")', errors: [{messageId: 'filesystemMock'}]},
    {filename, code: 'vi.mock("fs/promises.js")', errors: [{messageId: 'filesystemMock'}]},
    {
      filename: '/repo/packages/cli-kit/src/public/node/context/local.test.ts',
      code: 'vi.mock("../fs.js")',
      errors: [{messageId: 'filesystemMock'}],
    },
    {
      filename: '/repo/packages/cli-kit/src/public/node/api/bulk-operations/query.test.ts',
      code: 'vi.mock("../../fs.js")',
      errors: [{messageId: 'filesystemMock'}],
    },
    {
      filename: '/repo/packages/cli-kit/src/public/node/doctor/framework.test.ts',
      code: 'vi.doMock(import("../fs.ts"))',
      errors: [{messageId: 'filesystemMock'}],
    },
    {
      filename: String.raw`C:\repo\packages\cli-kit\src\public\node\doctor\framework.test.ts`,
      code: 'vi.mock("../fs.js")',
      errors: [{messageId: 'filesystemMock'}],
    },
    {filename, code: 'vi.doMock("node:fs/promises")', errors: [{messageId: 'filesystemMock'}]},
    {filename, code: 'vi.mock("fs")', errors: [{messageId: 'filesystemMock'}]},
    {filename, code: 'vi.mock("fs/promises")', errors: [{messageId: 'filesystemMock'}]},
    {filename, code: 'vi.mock("@shopify/cli-kit/node/fs")', errors: [{messageId: 'filesystemMock'}]},
    {filename, code: 'import {vi} from "vitest"; vi.mock("fs")', errors: [{messageId: 'filesystemMock'}]},
    {filename, code: 'vi.mock(import("node:fs"))', errors: [{messageId: 'filesystemMock'}]},
  ],
})
