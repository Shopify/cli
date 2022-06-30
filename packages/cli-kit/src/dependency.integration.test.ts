import {join as pathJoin, dirname} from './path.js'
import {write as writeFile, mkdir, inTemporaryDirectory} from './file.js'
import {installNPMDependenciesRecursively} from './dependency.js'
import {describe, expect, test} from 'vitest'

describe('installNPMDependenciesRecursively', () => {
  test('runs install in all the directories containing a package.json', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
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
      await expect(
        installNPMDependenciesRecursively({
          directory: tmpDir,
          dependencyManager: 'yarn',
        }),
      ).resolves.toBe(undefined)
    })
  })
})
