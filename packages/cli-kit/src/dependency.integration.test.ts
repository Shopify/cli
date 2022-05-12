import {join as pathJoin, dirname} from './path'
import {write as writeFile, mkdir} from './file'
import {installRecursively, DependencyManager} from './dependency'
import {describe, test} from 'vitest'
import {temporary} from '@shopify/cli-testing'

describe('installRecursively', () => {
  test('runs install in all the directories containing a package.json', async () => {
    await temporary.directory(async (tmpDir) => {
      // Given
      const rootPackage = pathJoin(tmpDir, 'package.json')
      const webPackage = pathJoin(tmpDir, 'web/package.json')
      const backendPackage = pathJoin(tmpDir, 'web/backend/package.json')

      await mkdir(dirname(webPackage))
      await mkdir(dirname(backendPackage))

      await writeFile(rootPackage, JSON.stringify({}))
      await writeFile(webPackage, JSON.stringify({}))
      await writeFile(backendPackage, JSON.stringify({}))

      // When
      await installRecursively({
        directory: tmpDir,
        dependencyManager: DependencyManager.Yarn,
      })
    })
  })
})
