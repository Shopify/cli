import {resolveFramework} from './framework.js'
import {inTemporaryDirectory, writeFile} from './fs.js'
import {joinPath} from './path.js'
import {describe, expect, test} from 'vitest'

describe('frontFrameworkUsed', () => {
  test('return rails when match every detectors', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const gemFilePath = joinPath(tmpDir, 'Gemfile')
      const gemFile = 'gem "rails"'
      await writeFile(gemFilePath, gemFile)

      // When
      const got = await resolveFramework(tmpDir)

      // Then
      expect(got).toEqual('rails')
    })
  })
  test('return next when match every detectors', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const packageJsonPath = joinPath(tmpDir, 'package.json')
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
  test('return remix when match every detectors', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const packageJsonPath = joinPath(tmpDir, 'package.json')
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
  test('return flask when match every detectors', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const pipFilePath = joinPath(tmpDir, 'Pipfile')
      const pipFile = 'flask'
      await writeFile(pipFilePath, pipFile)

      // When
      const got = await resolveFramework(tmpDir)

      // Then
      expect(got).toEqual('flask')
    })
  })
  test('return laravel when match every detectors', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const composerFilePath = joinPath(tmpDir, 'composer.json')
      const composerFile = {require: {'laravel/framework': '1.2.3'}}
      await writeFile(composerFilePath, JSON.stringify(composerFile))

      // When
      const got = await resolveFramework(tmpDir)

      // Then
      expect(got).toEqual('laravel')
    })
  })
  test('return symfony when match every detectors', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const composerFilePath = joinPath(tmpDir, 'composer.json')
      const composerFile = {require: {'symfony/requirement': '1.2.3'}}
      await writeFile(composerFilePath, JSON.stringify(composerFile))

      // When
      const got = await resolveFramework(tmpDir)

      // Then
      expect(got).toEqual('symfony')
    })
  })
  test('return unkonw when no configuration file is present', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // When
      const got = await resolveFramework(tmpDir)

      // Then
      expect(got).toEqual('unknown')
    })
  })
  test('return unkonw when unsupported dependency', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const packageJsonPath = joinPath(tmpDir, 'package.json')
      const packageJson = {
        dependencies: {unsupported: '1.2.3'},
      }

      // When
      const got = await resolveFramework(tmpDir)

      // Then
      expect(got).toEqual('unknown')
    })
  })
  test('return unkonw when not every detector is present', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const packageJsonPath = joinPath(tmpDir, 'package.json')
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
