import {getDeployConfig} from './config.js'
import {describe, it, expect} from 'vitest'
import {file, git} from '@shopify/cli-kit'

const deploymentToken = 'abcdefg'
const dmsAddress = 'https://integration.test'

describe('getDeployConfig', () => {
  it('throws if outside git directory', async () => {
    await file.inTemporaryDirectory(async (tmpDir) => {
      await expect(getDeployConfig({deploymentToken, dmsAddress, path: tmpDir})).rejects.toThrow(
        git.OutsideGitDirectoryError(),
      )
    })
  })
  it('throws if no commit', async () => {
    await file.inTemporaryDirectory(async (tmpDir) => {
      await git.initializeRepository(tmpDir)
      await expect(getDeployConfig({deploymentToken, dmsAddress, path: tmpDir})).rejects.toThrow(git.NoCommitError())
    })
  })
  it('extract basic information from git', async () => {
    const authorName = 'integration test'
    const authorEmail = 'integration@test.com'
    const commitMessage = 'integration test message'

    await file.inTemporaryDirectory(async (tmpDir) => {
      await git.initializeRepository(tmpDir)
      await file.touch(`${tmpDir}/integration.txt`)
      const commitSha = await git.commitAll(commitMessage, {
        directory: tmpDir,
        author: `${authorName} <${authorEmail}>`,
      })
      const config = await getDeployConfig({deploymentToken, dmsAddress, path: tmpDir})

      expect(config.commitAuthor).toBe(authorName)
      expect(config.commitMessage).toBe(commitMessage)
      expect(config.commitRef).toBe('refs/heads/master')
      expect(config.commitSha).toBe(commitSha)
      expect(config.deploymentToken).toBe(deploymentToken)
      expect(config.dmsAddress).toBe(dmsAddress)
      expect(config.path).toBe(tmpDir)
      expect(new Date(config.timestamp).getTime()).toBeLessThan(new Date().getTime())
    })
  })
})
