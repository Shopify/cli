import {createCodeExcerpts, MAX_EXCERPT_LINE_LENGTH} from './code-excerpt.js'
import {expect, test, vi} from 'vitest'

const source = `${Array.from({length: 20}, (_, index) => `line ${index + 1}`).join('\r\n')}\r\n`
const excerptLine = (line: number) => ({line, text: `line ${line}`})

test.each([
  {line: 5, expected: [3, 4, 5, 6, 7]},
  {line: 1, expected: [1, 2, 3]},
  {line: 20, expected: [18, 19, 20]},
  {line: 21, expected: undefined},
  {line: undefined, expected: undefined},
])('captures the available lines around line $line, without CRLF endings', ({line, expected}) => {
  const excerpts = createCodeExcerpts(() => source)

  expect(excerpts.finding('app/orders.ts', line, 'CREDENTIAL_LOG_LEAKAGE')).toEqual(expected?.map(excerptLine))
})

test.each(['config/settings.yml', 'Dockerfile', 'scripts/deploy.sh'])(
  'captures only the cited line of the sensitive non-source file %s',
  (file) => {
    expect(createCodeExcerpts(() => source).finding(file, 5, 'CREDENTIAL_LOG_LEAKAGE')).toEqual([excerptLine(5)])
  },
)

test('captures only the cited line of a committed secret in source code', () => {
  expect(createCodeExcerpts(() => source).finding('app/orders.ts', 5, 'COMMITTED_SECRET')).toEqual([excerptLine(5)])
})

test.each([
  ['an empty file', '', undefined],
  ['one empty line', '\n', [{line: 1, text: ''}]],
  ['an unreadable file', undefined, undefined],
] as const)('captures %s', (_description, text, expected) => {
  const excerpts = createCodeExcerpts(() => text)

  expect(excerpts.finding('app/orders.ts', 1, 'CREDENTIAL_LOG_LEAKAGE')).toEqual(expected)
  expect(excerpts.evidence('app/orders.ts', 1)).toEqual(expected)
})

test('captures evidence lines alone and reads each file once across findings and evidence', () => {
  const readCitedFile = vi.fn(() => source)
  const excerpts = createCodeExcerpts(readCitedFile)

  expect(excerpts.finding('app/orders.ts', 5, 'CREDENTIAL_LOG_LEAKAGE')).toHaveLength(5)
  expect(excerpts.evidence('app/orders.ts', 7)).toEqual([excerptLine(7)])
  expect(excerpts.evidence('app/orders.ts', undefined)).toBeUndefined()
  expect(excerpts.evidence('app/orders.ts', 21)).toBeUndefined()
  expect(readCitedFile.mock.calls).toEqual([['app/orders.ts']])
})

test(`cuts a line after ${MAX_EXCERPT_LINE_LENGTH} code points, without splitting a character`, () => {
  const lock = '\u{1F512}'
  const padding = 'x'.repeat(MAX_EXCERPT_LINE_LENGTH - 1)
  const excerpts = createCodeExcerpts(() => `${padding}${lock}${lock}tail\n${padding}${lock}\n`)

  expect(excerpts.finding('app/long.ts', 1, 'CREDENTIAL_LOG_LEAKAGE')).toEqual([
    {line: 1, text: `${padding}${lock}…`},
    {line: 2, text: `${padding}${lock}`},
  ])
})

const UNKNOWN_SECRET = 'hunter2xyz'

test.each([
  ['a typed TypeScript declaration', 'app/settings.ts', `const password: string = "${UNKNOWN_SECRET}"`],
  ['a typed Python declaration', 'app/settings.py', `password: str = "${UNKNOWN_SECRET}"`],
  ['a typed Go variable', 'app/settings.go', `var password string = "${UNKNOWN_SECRET}"`],
  ['a PHP hash rocket', 'app/settings.php', `'password' => '${UNKNOWN_SECRET}',`],
  ['a Ruby hash rocket', 'app/settings.rb', `"api_key" => "${UNKNOWN_SECRET}",`],
  ['a comparison', 'app/auth.ts', `if (req.headers.token === "${UNKNOWN_SECRET}") {`],
  ['a bracket assignment', 'app/settings.ts', `config["password"] = "${UNKNOWN_SECRET}"`],
  ['a ||= assignment', 'app/settings.rb', `@password ||= "${UNKNOWN_SECRET}"`],
  ['a ??= assignment', 'app/settings.ts', `options.token ??= "${UNKNOWN_SECRET}"`],
  ['a fallback value', 'app/settings.ts', `const key = process.env.TOKEN || "${UNKNOWN_SECRET}"`],
  ['a setter call', 'app/settings.ts', `client.setPassword("${UNKNOWN_SECRET}")`],
  ['a quoted key with a hyphen', 'app/settings.ts', `const headers = {"secret-key": "${UNKNOWN_SECRET}"}`],
  ['a connection string', 'app/db.ts', `const dsn = "Server=db;Password=${UNKNOWN_SECRET};"`],
])('redacts the string that %s gives to a name that holds a secret', (_shape, file, line) => {
  const excerpt = createCodeExcerpts(() => line).finding(file, 1, 'CREDENTIAL_LOG_LEAKAGE')

  expect(excerpt).toHaveLength(1)
  expect(excerpt![0]!.text).not.toContain(UNKNOWN_SECRET)
  expect(excerpt![0]!.text).toContain('[REDACTED:')
})

test.each([
  'import {authenticate} from "../shopify.server"',
  'response.headers.set("X-Shopify-Access-Token", session.accessToken)',
  'logger.info("issued", token)',
  'const orders = await prisma.order.findMany({where: {status: "open"}})',
])('keeps the strings of %s, which no name that holds a secret precedes', (line) => {
  expect(createCodeExcerpts(() => line).finding('app/orders.ts', 1, 'CREDENTIAL_LOG_LEAKAGE')).toEqual([
    {line: 1, text: line},
  ])
})
