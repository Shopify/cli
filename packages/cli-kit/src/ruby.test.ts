import * as file from './file'
import * as system from './system'
import {execCLI} from './ruby'
import {beforeAll, describe, expect, it, vi} from 'vitest'

beforeAll(() => {
  vi.mock('./file')
  vi.mock('./system')
})

describe('execCLI', () => {
  it('throws an exception when Ruby is not installed', async () => {
    vi.mocked(file.exists).mockResolvedValue(true)
    vi.mocked(system.exec).mockRejectedValue({})

    await expect(execCLI(['args'])).rejects.toThrowError('Ruby environment not found')
  })

  it('throws an exception when Ruby version requirement is not met', async () => {
    const rubyVersion = '2.2.0'
    vi.mocked(file.exists).mockResolvedValue(true)
    vi.mocked(system.exec).mockResolvedValueOnce(mockExecVersion(rubyVersion))

    await expect(execCLI(['args'])).rejects.toThrowError(
      `Ruby version \u001b[33m${rubyVersion}\u001b[39m is not supported`,
    )
  })

  it('throws an exception when RubyGems version requirement is not met', async () => {
    const rubyVersion = '2.4.0'
    const rubyGemsVersion = '2.3.0'
    vi.mocked(file.exists).mockResolvedValue(true)
    vi.mocked(system.exec).mockResolvedValueOnce(mockExecVersion(rubyVersion))
    vi.mocked(system.exec).mockResolvedValueOnce(mockExecVersion(rubyGemsVersion))

    await expect(execCLI(['args'])).rejects.toThrowError(
      `RubyGems version \u001b[33m${rubyGemsVersion}\u001b[39m is not supported`,
    )
  })

  it('throws an exception when Bundler is not installed', async () => {
    const rubyVersion = '2.4.0'
    const rubyGemsVersion = '2.6.0'
    vi.mocked(file.exists).mockResolvedValue(true)
    vi.mocked(system.exec).mockResolvedValueOnce(mockExecVersion(rubyVersion))
    vi.mocked(system.exec).mockResolvedValueOnce(mockExecVersion(rubyGemsVersion))
    vi.mocked(system.exec).mockRejectedValue({})

    await expect(execCLI(['args'])).rejects.toThrowError(`Bundler not found`)
  })

  it('throws an exception when Bundler version requirement is not met', async () => {
    const rubyVersion = '2.4.0'
    const rubyGemsVersion = '2.5.0'
    const bundlerVersion = '2.2.0'
    vi.mocked(file.exists).mockResolvedValue(true)
    vi.mocked(system.exec).mockResolvedValueOnce(mockExecVersion(rubyVersion))
    vi.mocked(system.exec).mockResolvedValueOnce(mockExecVersion(rubyGemsVersion))
    vi.mocked(system.exec).mockResolvedValueOnce(mockExecVersion(bundlerVersion))

    await expect(execCLI(['args'])).rejects.toThrowError(
      `Bundler version \u001b[33m${bundlerVersion}\u001b[39m is not supported`,
    )
  })

  it('throws an exception when creating CLI working directory', async () => {
    const rubyVersion = '2.4.0'
    const rubyGemsVersion = '2.5.0'
    const bundlerVersion = '2.4.0'
    vi.mocked(file.exists).mockResolvedValue(true)
    vi.mocked(system.exec).mockResolvedValueOnce(mockExecVersion(rubyVersion))
    vi.mocked(system.exec).mockResolvedValueOnce(mockExecVersion(rubyGemsVersion))
    vi.mocked(system.exec).mockResolvedValueOnce(mockExecVersion(bundlerVersion))
    vi.mocked(file.mkdir).mockRejectedValue({message: 'Error'})

    await expect(execCLI(['args'])).rejects.toThrowError('Error')
  })
})

function mockExecVersion(version: string) {
  return {
    stdout: version,
    isCanceled: false,
    command: '',
    escapedCommand: '',
    exitCode: 0,
    stderr: '',
    failed: false,
    timedOut: false,
    killed: false,
  }
}
