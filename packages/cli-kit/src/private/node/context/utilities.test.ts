import {getCIMetadata, isSet} from './utilities.js'
import {describe, expect, test} from 'vitest'

describe('isSet', () => {
  test('returns false for undefined', () => {
    expect(isSet(undefined)).toBe(false)
  })

  test('returns false for an empty string', () => {
    expect(isSet('')).toBe(false)
  })

  test('returns false for a whitespace-only string', () => {
    expect(isSet('   ')).toBe(false)
  })

  test('returns true for a non-empty string', () => {
    expect(isSet('value')).toBe(true)
  })

  test('returns true for "0"', () => {
    expect(isSet('0')).toBe(true)
  })
})

describe('getCIMetadata', () => {
  test('maps CircleCI environment variables', () => {
    // Given
    const envs = {
      CIRCLE_USERNAME: 'circle-actor',
      CIRCLE_BRANCH: 'main',
      CIRCLE_BUILD_NUM: '42',
      CIRCLE_SHA1: 'abcdef',
      CIRCLE_WORKFLOW_ID: 'workflow-1',
      CIRCLE_BUILD_URL: 'https://circleci.com/build/42',
    }

    // When
    const got = getCIMetadata('circleci', envs)

    // Then
    expect(got).toEqual({
      actor: 'circle-actor',
      branch: 'main',
      build: '42',
      commitSha: 'abcdef',
      run: 'workflow-1',
      url: 'https://circleci.com/build/42',
    })
  })

  test('maps GitLab environment variables', () => {
    // Given
    const envs = {
      GITLAB_USER_LOGIN: 'gitlab-actor',
      CI_COMMIT_REF_NAME: 'main',
      CI_PIPELINE_ID: '99',
      CI_COMMIT_SHA: 'abcdef',
      CI_COMMIT_MESSAGE: 'Fix the thing',
      CI_RUNNER_ID: 'runner-7',
      CI_PIPELINE_URL: 'https://gitlab.com/org/repo/-/pipelines/99',
    }

    // When
    const got = getCIMetadata('gitlab', envs)

    // Then
    expect(got).toEqual({
      actor: 'gitlab-actor',
      branch: 'main',
      build: '99',
      commitSha: 'abcdef',
      commitMessage: 'Fix the thing',
      run: 'runner-7',
      url: 'https://gitlab.com/org/repo/-/pipelines/99',
    })
  })

  test('maps Buildkite environment variables', () => {
    // Given
    const envs = {
      BUILDKITE_BRANCH: 'main',
      BUILDKITE_BUILD_NUMBER: '7',
      BUILDKITE_COMMIT: 'abcdef',
      BUILDKITE_MESSAGE: 'Fix the thing',
      BUILDKITE_BUILD_URL: 'https://buildkite.com/org/pipeline/builds/7',
    }

    // When
    const got = getCIMetadata('buildkite', envs)

    // Then
    expect(got).toEqual({
      branch: 'main',
      build: '7',
      commitSha: 'abcdef',
      commitMessage: 'Fix the thing',
      run: '7',
      url: 'https://buildkite.com/org/pipeline/builds/7',
    })
  })

  test('returns an empty object for an unknown CI vendor', () => {
    // Given
    const envs = {CIRCLE_BRANCH: 'main', BUILDKITE_BRANCH: 'main'}

    // When
    const got = getCIMetadata('unknown', envs)

    // Then
    expect(got).toEqual({})
  })

  test('leaves unset fields undefined instead of stringifying them', () => {
    // Given
    const envs = {CIRCLE_BRANCH: 'main'}

    // When
    const got = getCIMetadata('circleci', envs)

    // Then
    expect(got).toEqual({
      actor: undefined,
      branch: 'main',
      build: undefined,
      commitSha: undefined,
      run: undefined,
      url: undefined,
    })
  })
})
