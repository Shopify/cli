import SkillInstall, {skillsCommandForPackageManager} from './install.js'
import {inferPackageManager} from '@shopify/cli-kit/node/node-package-manager'
import {exec} from '@shopify/cli-kit/node/system'
import {describe, expect, test, vi} from 'vitest'

vi.mock('@shopify/cli-kit/node/node-package-manager')
vi.mock('@shopify/cli-kit/node/system')

describe('skill install', () => {
  test('infers the package manager', async () => {
    const skillArguments = ['add', 'Shopify/cli', '--skill', 'shopify', '--global', '--yes']
    vi.mocked(inferPackageManager).mockReturnValue('pnpm')

    await SkillInstall.run([], import.meta.url)

    expect(inferPackageManager).toHaveBeenCalledWith(undefined)
    expect(exec).toHaveBeenCalledWith('pnpx', ['skills@latest', ...skillArguments], {stdio: 'inherit'})
  })

  test('uses the selected package manager', async () => {
    vi.mocked(inferPackageManager).mockReturnValue('bun')

    await SkillInstall.run(['--package-manager', 'bun'], import.meta.url)

    expect(inferPackageManager).toHaveBeenCalledWith('bun')
    expect(exec).toHaveBeenCalledWith(
      'bunx',
      ['skills@latest', 'add', 'Shopify/cli', '--skill', 'shopify', '--global', '--yes'],
      {stdio: 'inherit'},
    )
  })

  test.each([
    ['npm', 'npx', ['--yes', 'skills@latest']],
    ['pnpm', 'pnpx', ['skills@latest']],
    ['yarn', 'yarn', ['dlx', 'skills@latest']],
    ['bun', 'bunx', ['skills@latest']],
    ['homebrew', 'npx', ['--yes', 'skills@latest']],
    ['unknown', 'npx', ['--yes', 'skills@latest']],
  ] as const)('maps %s to %s', (packageManager, command, args) => {
    expect(skillsCommandForPackageManager(packageManager)).toEqual({command, args})
  })
})
