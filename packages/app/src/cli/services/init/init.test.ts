import init, {ensurePnpmWorkspaceFile} from './init.js'
import link from '../app/config/link.js'
import {linkedAppContext} from '../app-context.js'
import {loadConfigForAppCreation} from '../../models/app/loader.js'
import {
  testAppLinked,
  testDeveloperPlatformClient,
  testOrganization,
  testOrganizationApp,
  testProject,
} from '../../models/app/app.test-data.js'
import {describe, expect, test, vi} from 'vitest'
import {fileExists, inTemporaryDirectory, writeFile, readFile} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {downloadGitRepository} from '@shopify/cli-kit/node/git'
import {installNodeModules} from '@shopify/cli-kit/node/node-package-manager'
import {runWithCommandEventsForCommand} from '@shopify/cli-kit/node/command-events'
import {withCapturedStandardStreams} from '@shopify/cli-kit/node/testing/output'

vi.mock('../app/config/link.js')
vi.mock('../app-context.js')
vi.mock('../../models/app/loader.js')
vi.mock('@shopify/cli-kit/node/git')
vi.mock('@shopify/cli-kit/node/local-storage')
vi.mock('@shopify/cli-kit/node/node-package-manager', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@shopify/cli-kit/node/node-package-manager')>()
  return {...actual, installNodeModules: vi.fn()}
})
vi.mock('@shopify/cli-kit/node/context/local', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@shopify/cli-kit/node/context/local')>()
  return {...actual, isShopify: vi.fn().mockResolvedValue(false)}
})

test.each(['new', 'existing'] as const)(
  'returns the created project and the %s remote app without final output',
  async (selection) => {
    await inTemporaryDirectory(async (directory) => {
      const projectDirectory = joinPath(directory, 'my-app')
      const app = testAppLinked({
        directory: projectDirectory,
        configPath: joinPath(projectDirectory, 'shopify.app.toml'),
      })
      const remoteApp = testOrganizationApp({title: 'My app', id: 'gid://shopify/App/42'})
      const organization = testOrganization()
      const developerPlatformClient = testDeveloperPlatformClient()
      vi.mocked(developerPlatformClient.createApp).mockResolvedValue(remoteApp)
      vi.mocked(loadConfigForAppCreation).mockResolvedValue(app.creationDefaultOptions())
      vi.mocked(linkedAppContext).mockResolvedValue({
        app,
        remoteApp,
        organization,
        developerPlatformClient,
        specifications: [],
        project: testProject(),
        activeConfig: {} as never,
      })
      vi.mocked(downloadGitRepository).mockImplementation(async ({destination}) => {
        await writeFile(joinPath(destination, 'package.json'), '{}')
        await writeFile(joinPath(destination, 'shopify.app.toml.liquid'), 'name = "{{ app_name }}"')
      })

      await withCapturedStandardStreams(async ({stdout, stderr}) => {
        const result = await runWithCommandEventsForCommand(['--json'], () =>
          init({
            name: 'My app',
            selectedAppOrNameResult:
              selection === 'new'
                ? {result: 'new', name: 'My app', org: organization}
                : {result: 'existing', app: remoteApp},
            directory,
            template: 'https://github.com/Shopify/shopify-app-template-extension-only#main',
            packageManager: 'npm',
            local: false,
            useGlobalCLI: true,
            developerPlatformClient,
            postCloneActions: {removeLockfilesFromGitignore: true},
          }),
        )

        expect(result).toEqual({
          app,
          remoteApp,
          projectName: 'my-app',
          packageManager: 'npm',
          template: 'https://github.com/Shopify/shopify-app-template-extension-only#main',
        })
        expect(stdout()).toBe('')
        expect(stderr()).not.toContain('is ready for you to build!')
        const events = stderr()
          .trim()
          .split('\n')
          .map((line) => JSON.parse(line))
        expect(events).toEqual(
          expect.arrayContaining([expect.objectContaining({type: 'progress', status: 'completed'})]),
        )
      })
      await expect(readFile(app.configPath)).resolves.toBe('name = "My app"')
      expect(installNodeModules).toHaveBeenCalledWith(expect.objectContaining({directory: projectDirectory}))
      expect(link).toHaveBeenCalledWith(
        expect.objectContaining({apiKey: remoteApp.apiKey, directory: projectDirectory}),
        false,
      )
      expect(developerPlatformClient.createApp).toHaveBeenCalledTimes(selection === 'new' ? 1 : 0)
      await expect(fileExists(projectDirectory)).resolves.toBe(true)
    })
  },
)

describe('ensurePnpmWorkspaceFile', () => {
  test('generates file when template has none', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      await ensurePnpmWorkspaceFile(tmpDir, ['extensions/*'])

      const content = await readFile(joinPath(tmpDir, 'pnpm-workspace.yaml'))
      expect(content).toBe("packages:\n - 'extensions/*'")
    })
  })

  test('does not overwrite existing file from template', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const templateContent = `packages:\n  - 'extensions/*'\nallowBuilds:\n  esbuild: true\n`
      await writeFile(joinPath(tmpDir, 'pnpm-workspace.yaml'), templateContent)

      await ensurePnpmWorkspaceFile(tmpDir, ['extensions/*'])

      const content = await readFile(joinPath(tmpDir, 'pnpm-workspace.yaml'))
      expect(content).toBe(templateContent)
    })
  })
})
