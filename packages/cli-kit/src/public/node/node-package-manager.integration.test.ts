import {installNPMDependenciesRecursively} from './node-package-manager.js'
import {writeFile, mkdir, inTemporaryDirectory} from './fs.js'
import {joinPath, dirname} from './path.js'
import {exec} from './system.js'
import {describe, test, vi, expect} from 'vitest'

vi.mock('./system.js')

describe('installNPMDependenciesRecursively', () => {
  test(
    'runs install in all the directories containing a package.json',
    async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        // Given
        const rootPackage = joinPath(tmpDir, 'package.json')
        const webPackage = joinPath(tmpDir, 'web/package.json')
        const backendPackage = joinPath(tmpDir, 'web/backend/package.json')

        await mkdir(dirname(webPackage))
        await mkdir(dirname(backendPackage))

        await writeFile(rootPackage, JSON.stringify({}))
        await writeFile(webPackage, JSON.stringify({}))
        await writeFile(backendPackage, JSON.stringify({}))

        // When
        await installNPMDependenciesRecursively({
          directory: tmpDir,
          packageManager: 'pnpm',
        })

        // Then
        const calls = vi.mocked(exec).mock.calls[0] as any
        expect(calls.length).toEqual(3)
        console.log(calls[0])
      })
    },
    {retry: 3},
  )
})
