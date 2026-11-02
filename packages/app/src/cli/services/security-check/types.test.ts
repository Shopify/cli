import {appSecurityCheckJsonOutputSchema} from './types.js'
import {describe, expect, test} from 'vitest'

const onWindows = process.platform === 'win32'
const appDirectory = onWindows ? 'C:\\apps\\my-app' : '/apps/my-app'
const resultsDirectory = onWindows
  ? 'C:\\apps\\my-app\\.shopify\\app-security\\shopify.app'
  : '/apps/my-app/.shopify/app-security/shopify.app'
const app = {
  directory: appDirectory,
  configurationPath: onWindows ? 'C:\\apps\\my-app\\shopify.app.toml' : '/apps/my-app/shopify.app.toml',
  clientId: 'toml-client-id',
}
const scope = {includeDirs: ['../backend'], excludes: ['**/generated'], noGitIgnore: false}
const scanDirectories = [
  {directory: appDirectory, origin: 'app-directory'},
  {directory: onWindows ? 'C:\\apps\\backend' : '/apps/backend', origin: 'include-dir'},
]
const scan = {
  status: 'success',
  valid: true,
  app,
  resultsDirectory,
  deterministicFindingsPath: onWindows
    ? `${resultsDirectory}\\deterministic-findings.json`
    : `${resultsDirectory}/deterministic-findings.json`,
  agentChecksPath: onWindows ? `${resultsDirectory}\\agent-checks.json` : `${resultsDirectory}/agent-checks.json`,
  scope,
  scanDirectories,
  agentCheckCount: 31,
  blocking: {level: 'none', blockedCheckCount: 0},
}
const fileList = {
  status: 'success',
  app,
  scope,
  scanDirectories,
  files: [{path: onWindows ? 'C:\\apps\\backend\\server.ts' : '/apps/backend/server.ts'}],
}

describe('appSecurityCheckJsonOutputSchema', () => {
  test.each([
    ['a scan without instructions', scan],
    ['a scan with instructions', {...scan, instructions: {content: '# Instructions', copied: true}}],
    ['a scan that fails --blocking', {...scan, valid: false, blocking: {level: 'high', blockedCheckCount: 2}}],
    [
      'a scan without app configuration',
      {...scan, app: {directory: appDirectory, configurationPath: null, clientId: 'a'}},
    ],
    ['the listed files', fileList],
    ['no listed files', {...fileList, files: []}],
    ['a cancellation', {status: 'cancelled'}],
  ])('accepts %s', (_description, value) => {
    expect(appSecurityCheckJsonOutputSchema.validate(value)).toStrictEqual(value)
  })

  test.each([
    ['an extra field', {...scan, findings: []}],
    ['a missing field', {...scan, agentChecksPath: undefined}],
    ['null instructions', {...scan, instructions: null}],
    ['empty instructions', {...scan, instructions: {content: '', copied: false}}],
    ['a relative findings path', {...scan, deterministicFindingsPath: 'deterministic-findings.json'}],
    ['a negative agent check count', {...scan, agentCheckCount: -1}],
    ['a fractional blocked check count', {...scan, blocking: {level: 'high', blockedCheckCount: 0.5}}],
    [
      'a stored scan directory origin',
      {...scan, scanDirectories: [{directory: appDirectory, origin: 'app_directory'}]},
    ],
    ['a stored scope', {...scan, scope: {include_dirs: [], excludes: [], no_git_ignore: false}}],
    ['listed files with the scan fields', {...fileList, valid: true}],
    ['a relative listed file', {...fileList, files: [{path: 'app/routes/index.ts'}]}],
    ['a listed file as a string', {...fileList, files: ['/apps/my-app/shopify.app.toml']}],
    ['a cancellation with a reason', {status: 'cancelled', reason: 'declined'}],
    ['another status', {...scan, status: 'skipped'}],
  ])('rejects %s', (_description, value) => {
    expect(() => appSecurityCheckJsonOutputSchema.validate(value)).toThrow()
  })
})
