import {currentProcessIsGlobal, inferPackageManagerForGlobalCLI} from './is-global.js'
import {packageManagerFromUserAgent} from './node-package-manager.js'
import {cliInstallCommand, cliInstallCommandAsArray} from './upgrade.js'
import {vi, describe, test, expect} from 'vitest'

vi.mock('./is-global.js')
vi.mock('./node-package-manager.js')

function asCommandString(command: string | string[], name: string): string {
  if (name === 'cliInstallCommandAsArray') {
    if (!Array.isArray(command)) {
      throw new Error('Expected array but got string')
    }
    return command.join(' ')
  } else {
    return command as string
  }
}

;[
  {name: 'cliInstallCommand', func: cliInstallCommand},
  {name: 'cliInstallCommandAsArray', func: cliInstallCommandAsArray},
].forEach(({name, func}) => {
  describe(name, () => {
    test('says to install globally via npm if the current process is globally installed and no package manager is provided', () => {
      // Given
      vi.mocked(currentProcessIsGlobal).mockReturnValue(true)
      vi.mocked(packageManagerFromUserAgent).mockReturnValue('unknown')
      vi.mocked(inferPackageManagerForGlobalCLI).mockReturnValue('unknown')

      // When
      const got = asCommandString(func(), name)

      // Then
      expect(got).toMatchInlineSnapshot(`
      "npm install -g @shopify/cli@latest"
    `)
    })

    test('says to install globally via yarn if the current process is globally installed and yarn is the global package manager', () => {
      // Given
      vi.mocked(currentProcessIsGlobal).mockReturnValue(true)
      vi.mocked(packageManagerFromUserAgent).mockReturnValue('unknown')
      vi.mocked(inferPackageManagerForGlobalCLI).mockReturnValue('yarn')

      // When
      const got = asCommandString(func(), name)

      // Then
      expect(got).toMatchInlineSnapshot(`
      "yarn global add @shopify/cli@latest"
    `)
    })

    test('says to install globally via npm if the current process is globally installed and npm is the global package manager', () => {
      // Given
      vi.mocked(currentProcessIsGlobal).mockReturnValue(true)
      vi.mocked(packageManagerFromUserAgent).mockReturnValue('unknown')
      vi.mocked(inferPackageManagerForGlobalCLI).mockReturnValue('npm')

      // When
      const got = asCommandString(func(), name)

      // Then
      expect(got).toMatchInlineSnapshot(`
      "npm install -g @shopify/cli@latest"
    `)
    })

    test('says to install globally via pnpm if the current process is globally installed and pnpm is the global package manager', () => {
      // Given
      vi.mocked(currentProcessIsGlobal).mockReturnValue(true)
      vi.mocked(packageManagerFromUserAgent).mockReturnValue('unknown')
      vi.mocked(inferPackageManagerForGlobalCLI).mockReturnValue('pnpm')

      // When
      const got = asCommandString(func(), name)

      // Then
      expect(got).toMatchInlineSnapshot(`
      "pnpm add -g @shopify/cli@latest"
    `)
    })

    test('says to install locally via npm if the current process is locally installed and no package manager is provided', () => {
      // Given
      vi.mocked(currentProcessIsGlobal).mockReturnValue(false)
      vi.mocked(packageManagerFromUserAgent).mockReturnValue('unknown')
      vi.mocked(inferPackageManagerForGlobalCLI).mockReturnValue('unknown')

      // When
      const got = asCommandString(func(), name)

      // Then
      expect(got).toMatchInlineSnapshot(`
      "npm install @shopify/cli@latest"
    `)
    })

    test('says to install locally via yarn if the current process is locally installed and yarn is the global package manager', () => {
      // Given
      vi.mocked(currentProcessIsGlobal).mockReturnValue(false)
      vi.mocked(packageManagerFromUserAgent).mockReturnValue('unknown')
      vi.mocked(inferPackageManagerForGlobalCLI).mockReturnValue('yarn')

      // When
      const got = asCommandString(func(), name)

      // Then
      expect(got).toMatchInlineSnapshot(`
      "yarn add @shopify/cli@latest"
    `)
    })

    test('says to install locally via npm if the current process is locally installed and npm is the global package manager', () => {
      // Given
      vi.mocked(currentProcessIsGlobal).mockReturnValue(false)
      vi.mocked(packageManagerFromUserAgent).mockReturnValue('unknown')
      vi.mocked(inferPackageManagerForGlobalCLI).mockReturnValue('npm')

      // When
      const got = asCommandString(func(), name)

      // Then
      expect(got).toMatchInlineSnapshot(`
      "npm install @shopify/cli@latest"
    `)
    })

    test('says to install locally via pnpm if the current process is locally installed and pnpm is the global package manager', () => {
      // Given
      vi.mocked(currentProcessIsGlobal).mockReturnValue(false)
      vi.mocked(packageManagerFromUserAgent).mockReturnValue('unknown')
      vi.mocked(inferPackageManagerForGlobalCLI).mockReturnValue('pnpm')

      // When
      const got = asCommandString(func(), name)

      // Then
      expect(got).toMatchInlineSnapshot(`
      "pnpm add @shopify/cli@latest"
    `)
    })
  })
})
