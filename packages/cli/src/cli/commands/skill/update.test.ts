import SkillUpdate from './update.js'
import {inferPackageManager} from '@shopify/cli-kit/node/node-package-manager'
import {exec} from '@shopify/cli-kit/node/system'
import {describe, expect, test, vi} from 'vitest'

vi.mock('@shopify/cli-kit/node/node-package-manager')
vi.mock('@shopify/cli-kit/node/system')

describe('skill update', () => {
  test('infers the package manager', async () => {
    vi.mocked(inferPackageManager).mockReturnValue('pnpm')

    await SkillUpdate.run([], import.meta.url)

    expect(inferPackageManager).toHaveBeenCalledWith(undefined)
    expect(exec).toHaveBeenCalledWith('pnpx', ['skills@latest', 'update', 'shopify', '--global', '--yes'], {
      stdio: 'inherit',
    })
  })

  test('uses the selected package manager', async () => {
    vi.mocked(inferPackageManager).mockReturnValue('bun')

    await SkillUpdate.run(['--package-manager', 'bun'], import.meta.url)

    expect(inferPackageManager).toHaveBeenCalledWith('bun')
    expect(exec).toHaveBeenCalledWith('bunx', ['skills@latest', 'update', 'shopify', '--global', '--yes'], {
      stdio: 'inherit',
    })
  })
})
