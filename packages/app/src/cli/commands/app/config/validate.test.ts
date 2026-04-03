import Validate from './validate.js'
import {linkedAppContext} from '../../../services/app-context.js'
import {validateApp} from '../../../services/validate.js'
import {testAppLinked} from '../../../models/app/app.test-data.js'
import {Project} from '../../../models/project/project.js'
import {selectActiveConfig} from '../../../models/project/active-config.js'
import {errorsForConfig} from '../../../models/project/config-selection.js'
import {outputResult} from '@shopify/cli-kit/node/output'
import {TomlFile, TomlFileError} from '@shopify/cli-kit/node/toml/toml-file'
import {describe, expect, test, vi} from 'vitest'

vi.mock('../../../services/app-context.js')
vi.mock('../../../services/validate.js')
vi.mock('../../../models/project/project.js')
vi.mock('../../../models/project/active-config.js')
vi.mock('../../../models/project/config-selection.js')
vi.mock('@shopify/cli-kit/node/output', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@shopify/cli-kit/node/output')>()
  return {...actual, outputResult: vi.fn()}
})
vi.mock('@shopify/cli-kit/node/ui')

function mockHealthyProject() {
  vi.mocked(Project.load).mockResolvedValue({errors: []} as unknown as Project)
  vi.mocked(selectActiveConfig).mockResolvedValue({file: new TomlFile('shopify.app.toml', {})} as any)
  vi.mocked(errorsForConfig).mockReturnValue([])
}

describe('app config validate command', () => {
  test('calls validateApp with json: false by default', async () => {
    const app = testAppLinked()
    mockHealthyProject()
    vi.mocked(linkedAppContext).mockResolvedValue({app} as Awaited<ReturnType<typeof linkedAppContext>>)
    vi.mocked(validateApp).mockResolvedValue()

    await Validate.run([], import.meta.url)

    expect(validateApp).toHaveBeenCalledWith(app, {json: false})
  })

  test('calls validateApp with json: true when --json flag is passed', async () => {
    const app = testAppLinked()
    mockHealthyProject()
    vi.mocked(linkedAppContext).mockResolvedValue({app} as Awaited<ReturnType<typeof linkedAppContext>>)
    vi.mocked(validateApp).mockResolvedValue()

    await Validate.run(['--json'], import.meta.url)

    expect(validateApp).toHaveBeenCalledWith(app, {json: true})
  })

  test('calls validateApp with json: true when -j flag is passed', async () => {
    const app = testAppLinked()
    mockHealthyProject()
    vi.mocked(linkedAppContext).mockResolvedValue({app} as Awaited<ReturnType<typeof linkedAppContext>>)
    vi.mocked(validateApp).mockResolvedValue()

    await Validate.run(['-j'], import.meta.url)

    expect(validateApp).toHaveBeenCalledWith(app, {json: true})
  })

  test('outputs JSON issues when active config has TOML parse errors', async () => {
    vi.mocked(Project.load).mockResolvedValue({errors: []} as unknown as Project)
    vi.mocked(selectActiveConfig).mockResolvedValue({file: new TomlFile('shopify.app.toml', {})} as any)
    vi.mocked(errorsForConfig).mockReturnValue([
      new TomlFileError('toml-parse-error', {
        path: '/app/shopify.app.toml',
        message: 'Unexpected character at row 1, col 5',
      }),
    ])

    await expect(Validate.run(['--json'], import.meta.url)).rejects.toThrow()

    expect(outputResult).toHaveBeenCalledWith(expect.stringContaining('"valid": false'))
    expect(linkedAppContext).not.toHaveBeenCalled()
  })
})
