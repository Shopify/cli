import {installAppNPMDependencies} from './dependencies'
import {App} from '../models/app/app'
import {describe, expect, test, vi} from 'vitest'
import {dependency} from '@shopify/cli-kit'

vi.mock('@shopify/cli-kit')

describe('installAppNPMDependencies', () => {
  test('installs dependencies recursively', async () => {
    // Given
    const app: App = {
      configuration: {
        name: 'App',
        scopes: '',
      },
      dependencyManager: 'yarn',
      directory: '/tmp/project',
      extensions: {
        ui: [],
        function: [],
        theme: [],
      },
      webs: [],
      configurationPath: '/tmp/project/shopify.app.toml',
    }
    vi.mocked(dependency)

    // When
    await installAppNPMDependencies(app)

    // Then
    expect(dependency.installNPMDependenciesRecursively).toHaveBeenCalledWith({
      dependencyManager: 'yarn',
      directory: '/tmp/project',
    })
  })
})
