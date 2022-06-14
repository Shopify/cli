import {fetch} from './http'
import {getLatestRelease, parseRepoUrl, GithubRelease, parseGithubRepoUrl} from './github'
import {Response} from 'node-fetch'
import {describe, expect, it, vi} from 'vitest'

vi.mock('./http')

describe('getLatestRelease', () => {
  it('delegates to fetch', async () => {
    // Given
    const user = 'shopify'
    const repo = 'hydrogen'
    const allReleases = createMockRelease(3)
    const response = new Response(JSON.stringify(allReleases), undefined)

    vi.mocked(fetch).mockResolvedValue(response)

    // When
    const latest = await getLatestRelease(user, repo)

    // Then
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(`https://api.github.com/repos/${user}/${repo}/releases`)
    await expect(latest).toMatchObject(allReleases[0])
  })

  it('calls the filter function', async () => {
    // Given
    const filter = vi.fn()
    const user = 'shopify'
    const repo = 'hydrogen'
    const allReleases = createMockRelease(4)
    const response = new Response(JSON.stringify(allReleases), undefined)

    vi.mocked(fetch).mockResolvedValue(response)

    // When
    const latest = await getLatestRelease(user, repo, {filter})

    // Then
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(`https://api.github.com/repos/${user}/${repo}/releases`)
    await expect(filter).toHaveBeenCalledTimes(4)
  })
})

describe('parseRepoUrl', () => {
  ;[
    'Shopify/hydrogen-app',
    'github:Shopify/hydrogen-app',
    'git@github.com:Shopify/hydrogen-app',
    'https://github.com/Shopify/hydrogen-app',
  ].forEach((url) => {
    it(url, async () => {
      const latest = parseRepoUrl(url)
      await expect(latest).toMatchObject({
        site: 'github.com',
        user: 'Shopify',
        name: 'hydrogen-app',
        ref: 'HEAD',
        subDirectory: undefined,
        ssh: 'git@github.com:Shopify/hydrogen-app',
      })
    })
  })

  it('supports sub directories', async () => {
    // Given
    const url = 'git@github.com:Shopify/hydrogen/examples/template-hydrogen-default'

    // When
    const latest = parseRepoUrl(url)

    // Then
    await expect(latest).toMatchObject({
      site: 'github.com',
      user: 'Shopify',
      name: 'hydrogen',
      ref: 'HEAD',
      subDirectory: 'examples/template-hydrogen-default',
      ssh: 'git@github.com:Shopify/hydrogen',
    })
  })
})

describe('parseGithubRepoUrl', () => {

  it('parses a repository url', async () => {
    // Given
    const url = 'https://github.com/Shopify/foo';

    // When
    const repoUrl = parseGithubRepoUrl(url);

    // Then
    await expect(repoUrl).toMatchObject({
      repoBaseUrl: 'https://github.com/Shopify/foo',
      branch: undefined,
      filePath: undefined
    });
  });

  it('parses a repository url with a branch', async () => {
    // Given
    const url = 'https://github.com/Shopify/foo/tree/main';

    // When
    const repoUrl = parseGithubRepoUrl(url);

    // Then
    await expect(repoUrl).toMatchObject({
      repoBaseUrl: 'https://github.com/Shopify/foo',
      branch: 'main',
      filePath: undefined
    });
  });

  it('parses a repository url with a branch and path', async () => {
    // Given
    const url = 'https://github.com/Shopify/foo/tree/main/bar/baz';

    // When
    const repoUrl = parseGithubRepoUrl(url);

    // Then
    await expect(repoUrl).toMatchObject({
      repoBaseUrl: 'https://github.com/Shopify/foo',
      branch: 'main',
      filePath: 'bar/baz'
    });
  });

  it('throws for a non github URL', async () => {
    // Given
    const url = 'https://NOTgithub.com/Shopify/foo';

    // When
    const parseRepoUrl = () => parseGithubRepoUrl(url);

    // Then
    await expect(parseRepoUrl).toThrow('Only GitHub repository URLs are supported.');
  });

  it('throws for a non URL', async () => {
    // Given
    const url = 'abc';

    // When
    const parseRepoUrl = () => parseGithubRepoUrl(url);

    // Then
    await expect(parseRepoUrl).toThrow('Invalid URL');
  });

});

function createMockRelease(size = 1, mocks: Partial<GithubRelease> = {}): GithubRelease[] {
  return Array.from({length: size}, (_, index) => ({
    id: index,
    // eslint-disable-next-line @typescript-eslint/naming-convention
    tag_name: 'v1.0.0',
    // eslint-disable-next-line @typescript-eslint/naming-convention
    tarball_url: '',
    assets: [],
    body: '',
    draft: false,
    prerelease: false,
    // eslint-disable-next-line @typescript-eslint/naming-convention
    created_at: '',
    // eslint-disable-next-line @typescript-eslint/naming-convention
    published_at: '',
    url: '',
    name: '',
    ...mocks,
  }))
}
