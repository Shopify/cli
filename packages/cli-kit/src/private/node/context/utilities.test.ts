import {isSet, getCIMetadata, type Metadata} from './utilities.js'
import {describe, expect, test} from 'vitest'

describe('isSet', () => {
  test('returns true for non-empty string', () => {
    expect(isSet('value')).toBe(true)
  })

  test('returns true for string with spaces and content', () => {
    expect(isSet('  value  ')).toBe(true)
  })

  test('returns false for undefined', () => {
    expect(isSet(undefined)).toBe(false)
  })

  test('returns false for empty string', () => {
    expect(isSet('')).toBe(false)
  })

  test('returns false for string with only whitespace', () => {
    expect(isSet('   ')).toBe(false)
  })

  test('returns false for string with tabs and spaces', () => {
    expect(isSet('\t \n ')).toBe(false)
  })

  test('returns true for string with zero', () => {
    expect(isSet('0')).toBe(true)
  })

  test('returns true for string with single character', () => {
    expect(isSet('a')).toBe(true)
  })
})

describe('getCIMetadata', () => {
  test('returns bitbucket metadata when envName is bitbucket', () => {
    const envs = {
      BITBUCKET_BRANCH: 'main',
      BITBUCKET_BUILD_NUMBER: '123',
      BITBUCKET_COMMIT: 'abc123',
      BITBUCKET_WORKSPACE: 'myworkspace',
      BITBUCKET_REPO_SLUG: 'myrepo',
    }

    const result = getCIMetadata('bitbucket', envs)
    const expected: Metadata = {
      branch: 'main',
      build: '123',
      commitSha: 'abc123',
      run: '123',
      url: 'https://bitbucket.org/myworkspace/myrepo/pipelines/results/123',
    }

    expect(result).toEqual(expected)
  })

  test('returns circleci metadata when envName is circleci', () => {
    const envs = {
      CIRCLE_USERNAME: 'user123',
      CIRCLE_BRANCH: 'feature-branch',
      CIRCLE_BUILD_NUM: '456',
      CIRCLE_SHA1: 'def456',
      CIRCLE_WORKFLOW_ID: 'workflow-789',
      CIRCLE_BUILD_URL: 'https://circleci.com/build/456',
    }

    const result = getCIMetadata('circleci', envs)
    const expected: Metadata = {
      actor: 'user123',
      branch: 'feature-branch',
      build: '456',
      commitSha: 'def456',
      run: 'workflow-789',
      url: 'https://circleci.com/build/456',
    }

    expect(result).toEqual(expected)
  })

  test('returns github metadata when envName is github', () => {
    const envs = {
      GITHUB_ACTOR: 'octocat',
      GITHUB_RUN_ATTEMPT: '2',
      GITHUB_REF_NAME: 'main',
      GITHUB_RUN_ID: '789',
      GITHUB_SHA: 'ghi789',
      GITHUB_RUN_NUMBER: '10',
      GITHUB_SERVER_URL: 'https://github.com',
      GITHUB_REPOSITORY: 'owner/repo',
    }

    const result = getCIMetadata('github', envs)
    const expected: Metadata = {
      actor: 'octocat',
      attempt: '2',
      branch: 'main',
      build: '789',
      commitSha: 'ghi789',
      run: '789',
      runNumber: '10',
      url: 'https://github.com/owner/repo/actions/runs/789',
    }

    expect(result).toEqual(expected)
  })

  test('returns gitlab metadata when envName is gitlab', () => {
    const envs = {
      GITLAB_USER_LOGIN: 'gitlab-user',
      CI_COMMIT_REF_NAME: 'develop',
      CI_PIPELINE_ID: '321',
      CI_COMMIT_SHA: 'jkl321',
      CI_COMMIT_MESSAGE: 'Fix bug',
      CI_RUNNER_ID: 'runner-456',
      CI_PIPELINE_URL: 'https://gitlab.com/pipelines/321',
    }

    const result = getCIMetadata('gitlab', envs)
    const expected: Metadata = {
      actor: 'gitlab-user',
      branch: 'develop',
      build: '321',
      commitSha: 'jkl321',
      commitMessage: 'Fix bug',
      run: 'runner-456',
      url: 'https://gitlab.com/pipelines/321',
    }

    expect(result).toEqual(expected)
  })

  test('returns buildkite metadata when envName is buildkite', () => {
    const envs = {
      BUILDKITE_BRANCH: 'release',
      BUILDKITE_BUILD_NUMBER: '654',
      BUILDKITE_COMMIT: 'mno654',
      BUILDKITE_MESSAGE: 'Release v1.0',
      BUILDKITE_BUILD_URL: 'https://buildkite.com/builds/654',
    }

    const result = getCIMetadata('buildkite', envs)
    const expected: Metadata = {
      branch: 'release',
      build: '654',
      commitSha: 'mno654',
      commitMessage: 'Release v1.0',
      run: '654',
      url: 'https://buildkite.com/builds/654',
    }

    expect(result).toEqual(expected)
  })

  test('returns empty object for unknown CI environment', () => {
    const envs = {
      SOME_OTHER_VAR: 'value',
    }

    const result = getCIMetadata('unknown-ci', envs)
    expect(result).toEqual({})
  })

  test('returns partial metadata when some environment variables are missing', () => {
    const envs = {
      GITHUB_ACTOR: 'octocat',
      GITHUB_REF_NAME: 'main',
      // Missing other GitHub env vars
    }

    const result = getCIMetadata('github', envs)
    const expected: Metadata = {
      actor: 'octocat',
      attempt: undefined,
      branch: 'main',
      build: undefined,
      commitSha: undefined,
      run: undefined,
      runNumber: undefined,
      url: `undefined/undefined/actions/runs/undefined`,
    }

    expect(result).toEqual(expected)
  })

  test('handles empty environment object', () => {
    const result = getCIMetadata('github', {})
    const expected: Metadata = {
      actor: undefined,
      attempt: undefined,
      branch: undefined,
      build: undefined,
      commitSha: undefined,
      run: undefined,
      runNumber: undefined,
      url: `undefined/undefined/actions/runs/undefined`,
    }

    expect(result).toEqual(expected)
  })

  test('handles bitbucket with missing workspace or repo slug', () => {
    const envs = {
      BITBUCKET_BRANCH: 'main',
      BITBUCKET_BUILD_NUMBER: '123',
      // Missing BITBUCKET_WORKSPACE and BITBUCKET_REPO_SLUG
    }

    const result = getCIMetadata('bitbucket', envs)
    expect(result.url).toBe('https://bitbucket.org/undefined/undefined/pipelines/results/123')
  })
})
