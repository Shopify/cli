import SecurityCheck from './check.js'
import SecurityClean from './clean.js'
import SecurityInstructions from './instructions.js'
import SecurityRecord from './record.js'
import SecurityReview from './review.js'
import {appSecurityArtifactPaths} from '../../../services/app-security-artifacts.js'
import {resolveAppSecurityCommands} from '../../../services/app-security-commands.js'
import {
  appSecurityInstructions,
  ClipboardUnavailableError,
  deliverAppSecurityInstructions,
} from '../../../services/app-security-instructions.js'
import {requireResultsDirectory} from '../../../services/app-security-results.js'
import {appSecurityResultsFor} from '../../../services/app-security-results.test-data.js'
import {missingAppConfigurationMessage, resolveAppSecuritySelection} from '../../../services/app-security-selection.js'
import securityCheck from '../../../services/security-check.js'
import {renderSecurityCheckPromptsTip} from '../../../services/security-check/result.js'
import {scanExecution} from '../../../services/security-check.test-data.js'
import securityClean from '../../../services/security-clean.js'
import securityRecord from '../../../services/security-record.js'
import securityReview from '../../../services/security-review.js'
import {AbortError} from '@shopify/cli-kit/node/error'
import {joinPath, resolvePath} from '@shopify/cli-kit/node/path'
import {describeJsonCommand} from '@shopify/cli-kit/node/testing/json-command'
import {expect, vi} from 'vitest'
import type {AppSecurityExecution} from '../../../services/app-security-api.js'
import type {AppSecurityScope, DeterministicFindingsDocument} from '../../../services/app-security-engine/index.js'
import type {AppSecuritySelection} from '../../../services/app-security-selection.js'
import type {SecurityCheckOutcome} from '../../../services/security-check.js'
import type {ReviewedAppSecurityResults} from '../../../services/security-review.js'

// Services are mocked; the real presenters, encoders, and output writers run.
vi.mock('../../../services/security-check.js')
vi.mock('../../../services/security-clean.js')
vi.mock('../../../services/security-record.js')
vi.mock('../../../services/security-review.js')
vi.mock('../../../services/app-security-results.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../services/app-security-results.js')>()),
  requireResultsDirectory: vi.fn(),
}))
vi.mock('../../../services/app-security-selection.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../services/app-security-selection.js')>()),
  resolveAppSecuritySelection: vi.fn(),
}))
// The instructions presenter stays real; these suites must not touch the clipboard.
vi.mock('../../../services/app-security-instructions.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../services/app-security-instructions.js')>()),
  appSecurityInstructions: vi.fn(),
  deliverAppSecurityInstructions: vi.fn(),
}))

const moduleURL = new URL('../../../../../../cli/bin/dev.js', import.meta.url).href

// Real-path selections with native paths in JSON, as in services/security-review/result.test.ts.
const onWindows = process.platform === 'win32'
const appDirectory = onWindows ? 'C:\\apps\\my-app' : '/apps/my-app'
function appPath(relativePath: string): string {
  return onWindows ? `C:\\apps\\my-app\\${relativePath.replaceAll('/', '\\')}` : `/apps/my-app/${relativePath}`
}
const pathFlag = resolvePath(appDirectory)
const args = ['--path', appDirectory]
const selection: AppSecuritySelection = {
  kind: 'config',
  appDirectory,
  appConfigFilePath: `${appDirectory}/shopify.app.toml`,
  configClientId: 'toml-client-id',
}
const selectionOptions = {
  path: pathFlag,
  config: undefined,
  clientId: undefined,
  withoutAppConfig: undefined,
  allowPrompts: false,
}
const paths = appSecurityArtifactPaths(appDirectory, 'shopify.app')
const appJson = {directory: appDirectory, configurationPath: appPath('shopify.app.toml'), clientId: 'toml-client-id'}
const resultsDirectoryJson = appPath('.shopify/app-security/shopify.app')
const noScope: AppSecurityScope = {include_dirs: [], excludes: [], no_git_ignore: false}

// Boxes wrap text and draw borders; compare their text without them.
function boxText(output: string): string {
  return output.replaceAll(/[│╭╮╰╯─]/g, ' ').replace(/\s+/g, ' ')
}

function scannedCheck(execution: AppSecurityExecution = scanExecution): SecurityCheckOutcome {
  return {
    kind: 'scanned',
    selection,
    resultsKey: 'shopify.app',
    commands: resolveAppSecurityCommands(selection, appDirectory, noScope),
    scope: noScope,
    scanDirectories: [{directory: appDirectory, origin: 'app_directory'}],
    execution,
    artifacts: {deterministicFindingsPath: paths.deterministicFindingsPath, agentChecksPath: paths.agentChecksPath},
    blocking: {level: 'none', blockedChecks: 0},
  }
}
const checkCall = {
  directory: pathFlag,
  configName: undefined,
  clientId: undefined,
  withoutAppConfig: false,
  blocking: 'none',
  includeDirs: [],
  excludePatterns: [],
  noGitIgnore: false,
  onSelectionPrompted: renderSecurityCheckPromptsTip,
}
const checkSchema = {
  anyOf: [
    {
      type: 'object',
      required: [
        'status',
        'valid',
        'app',
        'resultsDirectory',
        'deterministicFindingsPath',
        'agentChecksPath',
        'scope',
        'scanDirectories',
        'agentCheckCount',
        'blocking',
      ],
      additionalProperties: false,
      properties: {app: {$ref: '#/definitions/AppSecurityApp'}, blocking: {$ref: '#/definitions/AppSecurityBlocking'}},
    },
    {$ref: '#/definitions/AppSecurityCheckFileList'},
    {type: 'object', required: ['status'], additionalProperties: false},
  ],
}

describeJsonCommand({
  command: SecurityCheck,
  commandId: 'app:security:check',
  moduleURL,
  args,
  expectedResult: {
    status: 'success',
    valid: true,
    app: appJson,
    resultsDirectory: resultsDirectoryJson,
    deterministicFindingsPath: appPath('.shopify/app-security/shopify.app/deterministic-findings.json'),
    agentChecksPath: appPath('.shopify/app-security/shopify.app/agent-checks.json'),
    scope: {includeDirs: [], excludes: [], noGitIgnore: false},
    scanDirectories: [{directory: appDirectory, origin: 'app-directory'}],
    agentCheckCount: 31,
    blocking: {level: 'none', blockedCheckCount: 0},
  },
  expectedSchema: checkSchema,
  setup: () => {
    vi.mocked(securityCheck).mockResolvedValue(scannedCheck())
  },
  assertExecuted: () => {
    expect(securityCheck).toHaveBeenCalledExactlyOnceWith({...checkCall, listFiles: false})
  },
  assertNotExecuted: () => expect(securityCheck).not.toHaveBeenCalled(),
  textOutput: ({stdout, stderr}) => {
    expect(stdout).toBe('')
    expect(boxText(stderr)).toContain('No security issues found.')
    expect(boxText(stderr)).toContain('Config file shopify.app.toml')
  },
  diagnostics: {
    setup: () => {
      vi.mocked(securityCheck).mockResolvedValue(
        scannedCheck({...scanExecution, ignoredScanDirectories: [joinPath(appDirectory, 'vendor')]}),
      )
    },
    expectedEvents: [
      {
        type: 'diagnostic',
        level: 'warning',
        message: expect.stringMatching(
          /vendor is ignored by Git, so only the files Git tracks in it are scanned\.\n\nUse --no-git-ignore to scan everything in it\.$/,
        ),
      },
    ],
  },
  failure: {
    setup: () => {
      const {headline, nextStep} = missingAppConfigurationMessage(appDirectory)
      vi.mocked(securityCheck).mockRejectedValue(new AbortError(headline, nextStep))
    },
    expectedError: {
      error: {
        type: 'abort',
        message: `No app configuration found at or above ${appDirectory}.`,
        tryMessage:
          'Pass `--path` to your app directory, or scan without app configuration with `--without-app-config --client-id <client-id>`.',
      },
    },
    exitCode: 1,
  },
})

describeJsonCommand({
  command: SecurityClean,
  commandId: 'app:security:clean',
  moduleURL,
  args,
  expectedResult: {status: 'success', changed: true, app: appJson, resultsDirectories: [resultsDirectoryJson]},
  expectedSchema: {
    type: 'object',
    required: ['status', 'changed', 'app', 'resultsDirectories'],
    additionalProperties: false,
  },
  setup: () => {
    vi.mocked(resolveAppSecuritySelection).mockResolvedValue(selection)
    vi.mocked(requireResultsDirectory).mockResolvedValue(undefined)
    vi.mocked(securityClean).mockResolvedValue({removed: [paths.resultsDirectory]})
  },
  assertExecuted: () => {
    expect(resolveAppSecuritySelection).toHaveBeenCalledExactlyOnceWith(selectionOptions)
    expect(requireResultsDirectory).toHaveBeenCalledExactlyOnceWith(selection, pathFlag)
    expect(securityClean).toHaveBeenCalledExactlyOnceWith({all: false, selection})
  },
  assertNotExecuted: () => {
    expect(resolveAppSecuritySelection).not.toHaveBeenCalled()
    expect(requireResultsDirectory).not.toHaveBeenCalled()
    expect(securityClean).not.toHaveBeenCalled()
  },
  textOutput: ({stdout, stderr}) => {
    expect(stdout).toBe('')
    expect(boxText(stderr)).toContain('App security check results removed.')
  },
  failure: {
    setup: () => {
      vi.mocked(securityClean).mockRejectedValue(
        new AbortError(
          `Could not remove the app security check results at ${paths.resultsDirectory}.`,
          'EACCES: permission denied',
        ),
      )
    },
    expectedError: {
      error: {
        type: 'abort',
        message: `Could not remove the app security check results at ${paths.resultsDirectory}.`,
        tryMessage: 'EACCES: permission denied',
      },
    },
    exitCode: 1,
  },
})

const instructions = '# App security check instructions'

describeJsonCommand({
  command: SecurityInstructions,
  commandId: 'app:security:instructions',
  moduleURL,
  args: [...args, '--copy'],
  expectedResult: {
    status: 'success',
    app: appJson,
    resultsDirectory: resultsDirectoryJson,
    instructions: {content: instructions, copied: true},
  },
  expectedSchema: {
    anyOf: [
      {
        type: 'object',
        required: ['status', 'app', 'resultsDirectory', 'instructions'],
        additionalProperties: false,
      },
      {$ref: '#/definitions/AppSecurityInstructionsFile'},
    ],
  },
  setup: () => {
    vi.mocked(resolveAppSecuritySelection).mockResolvedValue(selection)
    vi.mocked(appSecurityInstructions).mockReturnValue(instructions)
    vi.mocked(deliverAppSecurityInstructions).mockResolvedValue(undefined)
  },
  assertExecuted: () => {
    expect(resolveAppSecuritySelection).toHaveBeenCalledExactlyOnceWith(selectionOptions)
    expect(appSecurityInstructions).toHaveBeenCalledExactlyOnceWith({
      appDirectory,
      resultsKey: 'shopify.app',
      commands: resolveAppSecurityCommands(selection, pathFlag),
    })
    expect(deliverAppSecurityInstructions).toHaveBeenCalledExactlyOnceWith(instructions, {
      copy: true,
      writePath: undefined,
    })
  },
  assertNotExecuted: () => {
    expect(resolveAppSecuritySelection).not.toHaveBeenCalled()
    expect(appSecurityInstructions).not.toHaveBeenCalled()
    expect(deliverAppSecurityInstructions).not.toHaveBeenCalled()
  },
  textOutput: ({stdout, stderr}) => {
    expect(stdout).toBe('')
    expect(stderr).toContain('Copied app security check instructions to the clipboard')
  },
  failure: {
    setup: () => {
      vi.mocked(deliverAppSecurityInstructions).mockRejectedValue(
        new ClipboardUnavailableError(new Error('Command failed with ENOENT: pbcopy')),
      )
    },
    expectedError: {
      error: {
        type: 'abort',
        message:
          "Couldn't copy the app security check instructions to the clipboard: Command failed with ENOENT: pbcopy",
        code: 'clipboard-unavailable',
        nextSteps: [
          'Run the command without --copy to print the instructions, or with --write <file> to write them to a file.',
        ],
      },
    },
    exitCode: 1,
  },
})

describeJsonCommand({
  command: SecurityRecord,
  commandId: 'app:security:record',
  moduleURL,
  args,
  expectedResult: {
    status: 'success',
    app: appJson,
    resultsDirectory: resultsDirectoryJson,
    path: appPath('.shopify/app-security/shopify.app/agent-findings.json'),
    checkCount: 2,
    findingCount: 3,
  },
  expectedSchema: {
    type: 'object',
    required: ['status', 'app', 'resultsDirectory', 'path', 'checkCount', 'findingCount'],
    additionalProperties: false,
  },
  setup: () => {
    vi.mocked(resolveAppSecuritySelection).mockResolvedValue(selection)
    vi.mocked(requireResultsDirectory).mockResolvedValue(undefined)
    vi.mocked(securityRecord).mockResolvedValue({path: paths.agentFindingsPath, checks: 2, findings: 3})
  },
  assertExecuted: () => {
    expect(resolveAppSecuritySelection).toHaveBeenCalledExactlyOnceWith({
      ...selectionOptions,
      validateClientIdFlag: true,
    })
    expect(requireResultsDirectory).toHaveBeenCalledExactlyOnceWith(selection, pathFlag)
    expect(securityRecord).toHaveBeenCalledExactlyOnceWith({selection, path: pathFlag})
  },
  assertNotExecuted: () => {
    expect(resolveAppSecuritySelection).not.toHaveBeenCalled()
    expect(securityRecord).not.toHaveBeenCalled()
  },
  textOutput: ({stdout, stderr}) => {
    expect(stdout).toBe('')
    expect(boxText(stderr)).toContain('Agent findings recorded. Recorded 2 checks and 3 findings in')
  },
  failure: {
    setup: () => {
      const error = new AbortError('No findings document was piped on stdin.')
      error.code = 'findings-document-missing'
      vi.mocked(securityRecord).mockRejectedValue(error)
    },
    expectedError: {
      error: {type: 'abort', message: 'No findings document was piped on stdin.', code: 'findings-document-missing'},
    },
    exitCode: 1,
  },
})

const deterministicFindings: DeterministicFindingsDocument = {
  schema_version: 1,
  source: 'deterministic',
  engine: {name: 'shopify-app-security', version: '4.9.0', ruleset: 'app-security-rules@4.9.0'},
  generated_at: '2026-09-01T10:00:00.250Z',
  detection: {framework: 'none', surface: 'config_only', languages: []},
  coverage: {
    files_scanned: 1,
    files_skipped: [],
    gaps: [],
    scope: noScope,
    scan_directories: [{directory: '.', origin: 'app_directory'}],
  },
  checks: [
    {
      id: 'EOL_API_VERSION',
      version: 2,
      status: 'executed',
      analysis_mode: 'structured_config',
      snapshot: {
        title: 'End-of-life API version',
        severity: 'low',
        description: 'Detects API versions past their support window.',
        guide: 'https://shopify.dev/docs/api/usage/versioning',
        docs_url: 'https://shopify.dev/docs/apps/build/security/app-security-checks/eol-api-version',
        current_version: 2,
      },
      findings: [
        {
          location: {file: 'shopify.app.toml', line: 8},
          message: 'api_version 2024-01 is past its support window.',
          evidence: [],
          fix: {
            automated: false,
            description: 'Update api_version.',
            guide: 'https://shopify.dev/docs/api/usage/versioning',
          },
        },
      ],
    },
  ],
}

function reviewedResults(): ReviewedAppSecurityResults {
  const results = appSecurityResultsFor(appDirectory, 'shopify.app', {
    deterministic: deterministicFindings,
    agent: null,
  })
  return {
    selection,
    result: {
      resultsDirectory: paths.resultsDirectory,
      sources: results.sources,
      allChecks: results.checks,
      checks: results.checks,
      filter: null,
      scopeDiffers: false,
      blocking: {level: 'none', blockedChecks: 0},
    },
    commands: resolveAppSecurityCommands(selection, pathFlag, noScope),
  }
}

describeJsonCommand({
  command: SecurityReview,
  commandId: 'app:security:review',
  moduleURL,
  args,
  expectedResult: {
    status: 'success',
    valid: true,
    app: appJson,
    resultsDirectory: resultsDirectoryJson,
    resultsFiles: {
      deterministic: {
        path: appPath('.shopify/app-security/shopify.app/deterministic-findings.json'),
        generatedAt: '2026-09-01T10:00:00Z',
        engine: {name: 'shopify-app-security', version: '4.9.0', ruleset: 'app-security-rules@4.9.0'},
        scope: {includeDirs: [], excludes: [], noGitIgnore: false},
      },
      agent: null,
    },
    detection: {framework: 'none', surface: 'config-only', languages: []},
    coverage: {
      filesScanned: 1,
      filesSkipped: [],
      gaps: [],
      scanDirectories: [{directory: appDirectory, origin: 'app-directory'}],
    },
    scopeDiffers: false,
    checks: [
      {
        id: 'EOL_API_VERSION',
        title: 'End-of-life API version',
        severity: 'low',
        description: 'Detects API versions past their support window.',
        guide: 'https://shopify.dev/docs/api/usage/versioning',
        docsUrl: 'https://shopify.dev/docs/apps/build/security/app-security-checks/eol-api-version',
        precedence: 'union',
        appliedPrecedence: 'union',
        status: 'executed',
        bySource: {
          deterministic: {
            version: 2,
            status: 'executed',
            reason: null,
            analysisMode: 'structured-config',
            generatedAt: '2026-09-01T10:00:00Z',
          },
          agent: null,
        },
        findings: [
          {
            source: 'deterministic',
            disposition: 'active',
            location: {filePath: appPath('shopify.app.toml'), line: 8, column: null},
            message: 'api_version 2024-01 is past its support window.',
            snippet: null,
            evidence: [],
            fix: {
              description: 'Update api_version.',
              guide: 'https://shopify.dev/docs/api/usage/versioning',
              automated: false,
            },
          },
        ],
      },
    ],
    blocking: {level: 'none', blockedCheckCount: 0},
  },
  expectedSchema: {
    type: 'object',
    required: [
      'status',
      'valid',
      'app',
      'resultsDirectory',
      'resultsFiles',
      'detection',
      'coverage',
      'scopeDiffers',
      'checks',
      'blocking',
    ],
    additionalProperties: false,
  },
  setup: () => {
    vi.mocked(securityReview).mockResolvedValue(reviewedResults())
  },
  assertExecuted: () => {
    expect(securityReview).toHaveBeenCalledExactlyOnceWith({
      directory: pathFlag,
      configName: undefined,
      clientId: undefined,
      withoutAppConfig: false,
      checkIds: [],
      blocking: 'none',
    })
  },
  assertNotExecuted: () => expect(securityReview).not.toHaveBeenCalled(),
  textOutput: ({stdout, stderr}) => {
    expect(stdout).toBe('')
    expect(boxText(stderr)).toContain('Low · EOL_API_VERSION · End-of-life API version')
    expect(boxText(stderr)).toContain('1 check with findings.')
  },
  failure: {
    setup: () => {
      const error = new AbortError(`No app security check results for shopify.app in ${appDirectory}.`)
      error.code = 'results-directory-not-found'
      vi.mocked(securityReview).mockRejectedValue(error)
    },
    expectedError: {
      error: {
        type: 'abort',
        message: `No app security check results for shopify.app in ${appDirectory}.`,
        code: 'results-directory-not-found',
      },
    },
    exitCode: 1,
  },
})
