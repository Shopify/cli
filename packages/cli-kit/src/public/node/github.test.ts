import {
  getLatestGitHubRelease,
  parseGitHubRepositoryURL,
  GithubRelease,
  parseGitHubRepositoryReference,
  downloadGitHubRelease,
  downloadGitHubFile,
} from './github.js'
import {fetch, downloadFile} from './http.js'
import {AbortError} from './error.js'
import {testWithTempDir} from './testing/test-with-temp-dir.js'
import {joinPath} from './path.js'
import {readFile} from './fs.js'
import {isExecutable} from 'is-executable'
import {describe, expect, test, vi} from 'vitest'
import {Response} from 'node-fetch'

vi.mock('./http.js')

describe('getLatestGitHubRelease', () => {
  test('delegates to fetch', async () => {
    // Given
    const user = 'shopify'
    const repo = 'hydrogen'
    const allReleases = createMockRelease(3)
    const response = new Response(JSON.stringify(allReleases), undefined)

    vi.mocked(fetch).mockResolvedValue(response)

    // When
    const latest = await getLatestGitHubRelease(user, repo)

    // Then
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(`https://api.github.com/repos/${user}/${repo}/releases`)
    await expect(latest).toMatchObject(allReleases[0]!)
  })

  test('calls the filter function', async () => {
    // Given
    const filter = vi.fn()
    const user = 'shopify'
    const repo = 'hydrogen'
    const allReleases = createMockRelease(4)
    const response = new Response(JSON.stringify(allReleases), undefined)

    vi.mocked(fetch).mockResolvedValue(response)

    // When
    const latest = await getLatestGitHubRelease(user, repo, {filter})

    // Then
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(`https://api.github.com/repos/${user}/${repo}/releases`)
    await expect(filter).toHaveBeenCalledTimes(4)
  })
})

describe('parseGitHubRepositoryURL', () => {
  ;[
    'Shopify/hydrogen-app',
    'github:Shopify/hydrogen-app',
    'git@github.com:Shopify/hydrogen-app',
    'https://github.com/Shopify/hydrogen-app',
  ].forEach((url) => {
    test(url, async () => {
      const latest = parseGitHubRepositoryURL(url)
      await expect(latest.valueOrAbort()).toMatchObject({
        site: 'github.com',
        user: 'Shopify',
        name: 'hydrogen-app',
        subDirectory: undefined,
        ssh: 'git@github.com:Shopify/hydrogen-app',
      })
    })
  })

  test('supports sub directories', async () => {
    // Given
    const url = 'git@github.com:Shopify/hydrogen/examples/template-hydrogen-default'

    // When
    const latest = parseGitHubRepositoryURL(url)

    // Then
    await expect(latest.valueOrAbort()).toMatchObject({
      site: 'github.com',
      user: 'Shopify',
      name: 'hydrogen',
      subDirectory: 'examples/template-hydrogen-default',
      ssh: 'git@github.com:Shopify/hydrogen',
    })
  })

  test('supports branches with #', async () => {
    // Given
    const url = 'git@github.com:Shopify/hydrogen/examples/template-hydrogen-default#someBranch'

    // When
    const latest = parseGitHubRepositoryURL(url)

    // Then
    await expect(latest.valueOrAbort()).toMatchObject({
      site: 'github.com',
      user: 'Shopify',
      name: 'hydrogen',
      ref: 'someBranch',
      subDirectory: 'examples/template-hydrogen-default',
      ssh: 'git@github.com:Shopify/hydrogen',
    })
  })
})

describe('parseGitHubRepositoryReference', () => {
  test('parses a repository reference', async () => {
    // Given
    const url = 'https://github.com/Shopify/foo'

    // When
    const repoUrl = parseGitHubRepositoryReference(url)

    // Then
    await expect(repoUrl).toMatchObject({
      baseURL: 'https://github.com/Shopify/foo',
      branch: undefined,
      filePath: undefined,
    })
  })

  test('parses a repository reference with a branch', async () => {
    // Given
    const url = 'https://github.com/Shopify/foo#main'

    // When
    const repoUrl = parseGitHubRepositoryReference(url)

    // Then
    await expect(repoUrl).toMatchObject({
      baseURL: 'https://github.com/Shopify/foo',
      branch: 'main',
      filePath: undefined,
    })
  })

  test('parses a repository reference with a branch and path', async () => {
    // Given
    const url = 'https://github.com/Shopify/foo/bar/baz#main'

    // When
    const repoUrl = parseGitHubRepositoryReference(url)

    // Then
    await expect(repoUrl).toMatchObject({
      baseURL: 'https://github.com/Shopify/foo',
      branch: 'main',
      filePath: 'bar/baz',
    })
  })
})

function createMockRelease(size = 1, mocks: Partial<GithubRelease> = {}): GithubRelease[] {
  return Array.from({length: size}, (_, index) => ({
    id: index,
    tag_name: 'v1.0.0',
    tarball_url: '',
    assets: [],
    body: '',
    draft: false,
    prerelease: false,
    created_at: '',
    published_at: '',
    url: '',
    name: '',
    ...mocks,
  }))
}

describe('downloadGitHubRelease', () => {
  const repo = 'testuser/testrepo'
  const version = 'v1.0.0'
  const asset = 'test-asset'

  testWithTempDir('successfully downloads the release asset', async ({tempDir}) => {
    // GIVEN
    const downloadContent = 'hello'
    const content = Buffer.from(downloadContent)
    const mockResponse = {
      ok: true,
      arrayBuffer: vi.fn().mockResolvedValue(content),
    }
    vi.mocked(fetch).mockResolvedValue(mockResponse as any)

    const binary = process.platform === 'win32' ? 'test-asset.exe' : 'test-asset'
    const targetPath = joinPath(tempDir, 'downloads', binary)

    // WHEN
    await downloadGitHubRelease(repo, version, asset, targetPath)

    // THEN
    expect(fetch).toHaveBeenCalledWith(
      `https://github.com/${repo}/releases/download/${version}/${asset}`,
      undefined,
      'slow-request',
    )

    const downloadedContent = await readFile(targetPath)
    expect(downloadedContent).toEqual(downloadContent)

    const downloadIsExecutable = await isExecutable(targetPath)
    expect(downloadIsExecutable).toBeTruthy()
  })

  testWithTempDir('throws an AbortError when the network is down', async ({tempDir}) => {
    // GIVEN
    vi.mocked(downloadFile).mockRejectedValue(new Error('Network error'))
    const targetPath = joinPath(tempDir, 'downloads', 'example')

    // WHEN
    const result = downloadGitHubRelease(repo, version, asset, targetPath)

    // THEN
    await expect(result).rejects.toThrow(AbortError)
  })

  testWithTempDir('throws an AbortError when the response is not ok', async ({tempDir}) => {
    // GIVEN
    vi.mocked(downloadFile).mockRejectedValue(new Error('Not Found'))
    const targetPath = joinPath(tempDir, 'downloads', 'example')

    // WHEN
    const result = downloadGitHubRelease(repo, version, asset, targetPath)

    // THEN
    await expect(result).rejects.toThrow(AbortError)
  })
})

describe('downloadGitHubFile', () => {
  const repo = 'testuser/testrepo'
  const tag = 'v1.0.0'
  const asset = 'test-asset'

  testWithTempDir('successfully downloads the file', async ({tempDir}) => {
    // GIVEN
    const downloadContent = 'hello'
    const content = Buffer.from(downloadContent)
    const mockResponse = {
      ok: true,
      arrayBuffer: vi.fn().mockResolvedValue(content),
    }
    vi.mocked(fetch).mockResolvedValue(mockResponse as any)
    const targetPath = joinPath(tempDir, 'downloads', asset)

    // WHEN
    await downloadGitHubFile(repo, tag, asset, targetPath)

    // THEN
    expect(fetch).toHaveBeenCalledWith(
      `https://raw.githubusercontent.com/${repo}/refs/tags/${tag}/${asset}`,
      undefined,
      'slow-request',
    )

    const downloadedContent = await readFile(targetPath)
    await expect(readFile(targetPath)).resolves.toEqual(downloadContent)
  })

  testWithTempDir('calls options.onError if the network is down', async ({tempDir}) => {
    // GIVEN
    const message = 'Network error'
    vi.mocked(fetch).mockRejectedValue(new Error(message))
    const targetPath = joinPath(tempDir, 'downloads', asset)
    const onError = vi.fn()

    // WHEN
    await downloadGitHubFile(repo, tag, asset, targetPath, {onError})

    // THEN
    expect(onError).toHaveBeenCalledWith(
      `Failed to download test-asset: ${message}`,
      `https://raw.githubusercontent.com/${repo}/refs/tags/${tag}/${asset}`,
    )
  })

  testWithTempDir('throws an AbortError if the network is down and options.onError is undefined', async ({tempDir}) => {
    // GIVEN
    vi.mocked(downloadFile).mockRejectedValue(new Error('Network error'))
    const targetPath = joinPath(tempDir, 'downloads', asset)

    // WHEN
    const result = downloadGitHubFile(repo, tag, asset, targetPath)

    // THEN
    await expect(result).rejects.toThrow(AbortError)
  })

  testWithTempDir('calls options.onError if the response is not ok', async ({tempDir}) => {
    // GIVEN
    const response = {ok: false, status: 404, statusText: 'Not Found'} as Response
    vi.mocked(fetch).mockResolvedValue(response)
    const targetPath = joinPath(tempDir, 'downloads', asset)
    const onError = vi.fn()

    // WHEN
    await downloadGitHubFile(repo, tag, asset, targetPath, {onError})

    // THEN
    expect(onError).toHaveBeenCalledWith(
      `Failed to download test-asset: ${response.status} ${response.statusText}`,
      `https://raw.githubusercontent.com/${repo}/refs/tags/${tag}/${asset}`,
    )
  })

  testWithTempDir(
    'throws an AbortError if the response is not ok and options.onError is undefined',
    async ({tempDir}) => {
      // GIVEN
      const response = {ok: false, status: 404, statusText: 'Not Found'} as Response
      vi.mocked(fetch).mockResolvedValue(response)
      const targetPath = joinPath(tempDir, 'downloads', asset)

      // WHEN
      const result = downloadGitHubFile(repo, tag, asset, targetPath)

      // THEN
      await expect(result).rejects.toThrow(AbortError)
    },
  )
})
