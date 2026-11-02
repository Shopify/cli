import Validate from './validate.js'
import {linkedAppContext} from '../../../services/app-context.js'
import {validateApp} from '../../../services/validate.js'
import {testAppLinked} from '../../../models/app/app.test-data.js'
import {Project} from '../../../models/project/project.js'
import {selectActiveConfig} from '../../../models/project/active-config.js'
import {errorsForConfig} from '../../../models/project/config-selection.js'
import metadata from '../../../metadata.js'
import {AbortError} from '@shopify/cli-kit/node/error'
import {TomlFile} from '@shopify/cli-kit/node/toml/toml-file'
import {describeJsonCommand} from '@shopify/cli-kit/node/testing/json-command'
import {expect, vi} from 'vitest'
// eslint-disable-next-line no-restricted-imports
import {resolve} from 'node:path'

vi.mock('../../../services/app-context.js')
vi.mock('../../../services/validate.js')
vi.mock('../../../models/project/project.js')
vi.mock('../../../models/project/active-config.js')
vi.mock('../../../models/project/config-selection.js')
vi.mock('../../../metadata.js', () => ({default: {addPublicMetadata: vi.fn()}}))

let app: ReturnType<typeof testAppLinked>

describeJsonCommand({
  command: Validate,
  commandId: 'app:config:validate',
  moduleURL: new URL('../../../../../../cli/bin/dev.js', import.meta.url).href,
  args: [],
  expectedResult: () => ({path: resolve(app.configPath), valid: true, issues: []}),
  expectedSchema: {
    type: 'object',
    required: ['path', 'valid', 'issues'],
    additionalProperties: false,
  },
  setup: () => {
    app = testAppLinked()
    vi.mocked(Project.load).mockResolvedValue({errors: []} as unknown as Project)
    vi.mocked(selectActiveConfig).mockResolvedValue({file: new TomlFile('shopify.app.toml', {})} as Awaited<
      ReturnType<typeof selectActiveConfig>
    >)
    vi.mocked(errorsForConfig).mockReturnValue([])
    vi.mocked(linkedAppContext).mockResolvedValue({app} as Awaited<ReturnType<typeof linkedAppContext>>)
    vi.mocked(validateApp).mockResolvedValue({path: resolve(app.configPath), valid: true, issues: []})
  },
  assertExecuted: (format) => {
    expect(selectActiveConfig).toHaveBeenCalledExactlyOnceWith(expect.anything(), undefined, {
      clientId: undefined,
      skipPrompts: false,
    })
    expect(linkedAppContext).toHaveBeenCalledExactlyOnceWith({
      directory: expect.any(String),
      clientId: undefined,
      forceRelink: false,
      userProvidedConfigName: undefined,
      unsafeTolerateErrors: true,
    })
    expect(validateApp).toHaveBeenCalledExactlyOnceWith(app)
    expect(vi.mocked(metadata.addPublicMetadata).mock.calls.map(([getMetadata]) => getMetadata())).toEqual([
      {cmd_app_validate_json: format === 'json'},
    ])
  },
  assertNotExecuted: () => {
    expect(Project.load).not.toHaveBeenCalled()
    expect(linkedAppContext).not.toHaveBeenCalled()
    expect(validateApp).not.toHaveBeenCalled()
  },
  textOutput: ({stdout, stderr}) => {
    expect(stdout).toBe('')
    expect(stderr).toContain("App configuration 'shopify.app.toml' is valid.")
  },
  failure: {
    setup: () => {
      vi.mocked(validateApp).mockRejectedValue(new AbortError('Cannot validate the app.'))
    },
    expectedError: {error: {type: 'abort', message: 'Cannot validate the app.'}},
    exitCode: 1,
  },
})
