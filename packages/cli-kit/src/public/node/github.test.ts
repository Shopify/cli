import {
  getLatestGitHubRelease,
  parseGitHubRepositoryURL,
  GithubRelease,
  parseGitHubRepositoryReference,
} from './github.js'
import {fetch} from './http.js'
import {Response} from 'node-fetch'
import {describe, expect, test, vi} from 'vitest'

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
