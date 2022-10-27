import {resolveFramework} from './framework.js'
import {inTemporaryDirectory, write as writeFile} from '../../file.js'
import {join as pathJoin} from '../../path.js'
import {describe, expect, it} from 'vitest'

describe('frontFrameworkUsed', () => {
  it('return rails when match every detectors', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const gemFilePath = pathJoin(tmpDir, 'Gemfile')
      const gemFile = 'gem "rails"'
      await writeFile(gemFilePath, gemFile)

      // When
      const got = await resolveFramework(tmpDir)

      // Then
      expect(got).toEqual('rails')
    })
  })
  it('return next when match every detectors', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const packageJsonPath = pathJoin(tmpDir, 'package.json')
      const packageJson = {
        dependencies: {react: '1.2.3', next: '1.2.3'},
      }
      await writeFile(packageJsonPath, JSON.stringify(packageJson))

      // When
      const got = await resolveFramework(tmpDir)

      // Then
      expect(got).toEqual('nextjs')
    })
  })
  it('return remix when match every detectors', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const packageJsonPath = pathJoin(tmpDir, 'package.json')
      const packageJson = {
        dependencies: {'@remix-run/node': '1.2.3', react: '1.2.3'},
      }
      await writeFile(packageJsonPath, JSON.stringify(packageJson))

      // When
      const got = await resolveFramework(tmpDir)

      // Then
      expect(got).toEqual('remix')
    })
  })
  it('return flask when match every detectors', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const pipFilePath = pathJoin(tmpDir, 'Pipfile')
      const pipFile = 'flask'
      await writeFile(pipFilePath, pipFile)

      // When
      const got = await resolveFramework(tmpDir)

      // Then
      expect(got).toEqual('flask')
    })
  })
  it('return laravel when match every detectors', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const composerFilePath = pathJoin(tmpDir, 'composer.json')
      const composerFile = {require: {'laravel/framework': '1.2.3'}}
      await writeFile(composerFilePath, JSON.stringify(composerFile))

      // When
      const got = await resolveFramework(tmpDir)

      // Then
      expect(got).toEqual('laravel')
    })
  })
  it('return symfony when match every detectors', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const composerFilePath = pathJoin(tmpDir, 'composer.json')
      const composerFile = {require: {'symfony/requirement': '1.2.3'}}
      await writeFile(composerFilePath, JSON.stringify(composerFile))

      // When
      const got = await resolveFramework(tmpDir)

      // Then
      expect(got).toEqual('symfony')
    })
  })
  it('return unkonw when no configuration file is present', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // When
      const got = await resolveFramework(tmpDir)

      // Then
      expect(got).toEqual('unknown')
    })
  })
  it('return unkonw when unsupported dependency', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const packageJsonPath = pathJoin(tmpDir, 'package.json')
      const packageJson = {
        dependencies: {unsupported: '1.2.3'},
      }

      // When
      const got = await resolveFramework(tmpDir)

      // Then
      expect(got).toEqual('unknown')
    })
  })
  it('return unkonw when not every detector is present', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const packageJsonPath = pathJoin(tmpDir, 'package.json')
      const packageJson = {
        dependencies: {'@remix-run/node': '1.2.3', 'other-react': '1.2.3'},
      }

      // When
      const got = await resolveFramework(tmpDir)

      // Then
      expect(got).toEqual('unknown')
    })
  })
})
