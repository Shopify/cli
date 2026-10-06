import Init from './init.js'
import {
  cloneLatestStableSkeletonTheme,
  cloneRepo,
  cloneRepoAndCheckoutLatestTag,
  promptAIInstruction,
} from '../../services/init.js'
import {renderSelectPrompt, renderTextPrompt} from '@shopify/cli-kit/node/ui'
import {terminalSupportsPrompting} from '@shopify/cli-kit/node/system'
import {generateRandomNameForSubdirectory} from '@shopify/cli-kit/node/fs'
import {Config} from '@oclif/core'
import {afterEach, beforeEach, describe, expect, test, vi} from 'vitest'

vi.mock('../../services/init.js')
vi.mock('@shopify/cli-kit/node/system')
vi.mock('@shopify/cli-kit/node/fs', async () => ({
  ...(await vi.importActual('@shopify/cli-kit/node/fs')),
  generateRandomNameForSubdirectory: vi.fn(),
}))
vi.mock('@shopify/cli-kit/node/ui', async () => ({
  ...(await vi.importActual('@shopify/cli-kit/node/ui')),
  renderSelectPrompt: vi.fn(),
  renderTextPrompt: vi.fn(),
}))

const commandConfig = new Config({root: __dirname})
const stdinIsTTYDescriptor = Object.getOwnPropertyDescriptor(process.stdin, 'isTTY')

async function run(argv: string[], name = 'my-theme') {
  await commandConfig.load()
  await new Init([...(name ? [name] : []), ...argv], commandConfig).run()
}

describe('theme init', () => {
  beforeEach(() => {
    Object.defineProperty(process.stdin, 'isTTY', {configurable: true, value: true})
    vi.mocked(terminalSupportsPrompting).mockReturnValue(true)
    vi.mocked(promptAIInstruction).mockResolvedValue(null)
  })

  afterEach(() => {
    if (stdinIsTTYDescriptor) {
      Object.defineProperty(process.stdin, 'isTTY', stdinIsTTYDescriptor)
    } else {
      Reflect.deleteProperty(process.stdin, 'isTTY')
    }
  })

  test('offers the stable release and upstream Skeleton theme in interactive mode', async () => {
    vi.mocked(renderSelectPrompt).mockResolvedValue('stable')

    await run([])

    expect(renderSelectPrompt).toHaveBeenCalledWith({
      message: 'Which version of Skeleton theme would you like to use?',
      choices: [
        {label: 'Latest stable release', value: 'stable'},
        {label: 'Upstream (new features may not be available on your store)', value: 'upstream'},
      ],
      defaultValue: 'stable',
    })
    expect(cloneLatestStableSkeletonTheme).toHaveBeenCalledOnce()
    expect(cloneRepo).not.toHaveBeenCalled()
  })

  test('clones the upstream Skeleton theme when selected', async () => {
    vi.mocked(renderSelectPrompt).mockResolvedValue('upstream')

    await run([])

    expect(cloneRepo).toHaveBeenCalledWith('https://github.com/Shopify/skeleton-theme.git', expect.any(String))
    expect(cloneLatestStableSkeletonTheme).not.toHaveBeenCalled()
  })

  test('uses the stable release with --latest', async () => {
    await run(['--latest'])

    expect(renderSelectPrompt).not.toHaveBeenCalled()
    expect(cloneLatestStableSkeletonTheme).toHaveBeenCalledOnce()
  })

  test('uses the stable release when stdin is not a TTY', async () => {
    Object.defineProperty(process.stdin, 'isTTY', {configurable: true, value: false})

    await run([])

    expect(renderSelectPrompt).not.toHaveBeenCalled()
    expect(cloneLatestStableSkeletonTheme).toHaveBeenCalledOnce()
  })

  test('uses the stable release when the terminal cannot prompt', async () => {
    vi.mocked(terminalSupportsPrompting).mockReturnValue(false)

    await run([])

    expect(renderSelectPrompt).not.toHaveBeenCalled()
    expect(cloneLatestStableSkeletonTheme).toHaveBeenCalledOnce()
  })

  test('keeps the default branch for an interactive custom repository', async () => {
    await run(['--clone-url=https://github.com/Shopify/dawn.git'])

    expect(renderSelectPrompt).not.toHaveBeenCalled()
    expect(cloneRepo).toHaveBeenCalledWith('https://github.com/Shopify/dawn.git', expect.any(String))
  })

  test('keeps the default branch for a custom repository when stdin is not a TTY', async () => {
    Object.defineProperty(process.stdin, 'isTTY', {configurable: true, value: false})

    await run(['--clone-url=https://github.com/Shopify/dawn.git'])

    expect(cloneRepo).toHaveBeenCalledWith('https://github.com/Shopify/dawn.git', expect.any(String))
    expect(cloneRepoAndCheckoutLatestTag).not.toHaveBeenCalled()
  })

  test('uses the latest tag for a custom repository with --latest', async () => {
    await run(['--clone-url=https://github.com/Shopify/dawn.git', '--latest'])

    expect(cloneRepoAndCheckoutLatestTag).toHaveBeenCalledWith(
      'https://github.com/Shopify/dawn.git',
      expect.any(String),
    )
  })

  test('generates a name without prompting when stdin is not a TTY', async () => {
    Object.defineProperty(process.stdin, 'isTTY', {configurable: true, value: false})
    vi.mocked(generateRandomNameForSubdirectory).mockResolvedValue('new-theme')

    await run([], '')

    expect(renderTextPrompt).not.toHaveBeenCalled()
    expect(cloneLatestStableSkeletonTheme).toHaveBeenCalledWith(expect.stringContaining('new-theme'))
    expect(promptAIInstruction).not.toHaveBeenCalled()
  })
})
