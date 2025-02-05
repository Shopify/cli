/**
 * Returns whether an environment variable has been set and is non-empty
 */
export function isSet(variable: string | undefined): variable is string {
  if (variable === undefined || variable.trim() === '') {
    return false
  }
  return true
}

/**
 * Returns an object with environment variables from the specified CI environment.
 */
export function getCIMetadata(envName: string, envs: NodeJS.ProcessEnv): Metadata {
  switch (envName) {
    case 'bitbucket':
      return {
        branch: envs.BITBUCKET_BRANCH,
        build: envs.BITBUCKET_BUILD_NUMBER,
        commitSha: envs.BITBUCKET_COMMIT,
        run: envs.BITBUCKET_BUILD_NUMBER,
        url: `https://bitbucket.org/${envs.BITBUCKET_WORKSPACE}/${envs.BITBUCKET_REPO_SLUG}/pipelines/results/${envs.BITBUCKET_BUILD_NUMBER}`,
      }
    case 'circleci':
      return {
        actor: envs.CIRCLE_USERNAME,
        branch: envs.CIRCLE_BRANCH,
        build: envs.CIRCLE_BUILD_NUM,
        commitSha: envs.CIRCLE_SHA1,
        run: envs.CIRCLE_WORKFLOW_ID,
        url: envs.CIRCLE_BUILD_URL,
      }
    case 'github':
      return {
        actor: envs.GITHUB_ACTOR,
        attempt: envs.GITHUB_RUN_ATTEMPT,
        branch: envs.GITHUB_REF_NAME,
        build: envs.GITHUB_RUN_ID,
        commitSha: envs.GITHUB_SHA,
        run: envs.GITHUB_RUN_ID,
        runNumber: envs.GITHUB_RUN_NUMBER,
        url: `${envs.GITHUB_SERVER_URL}/${envs.GITHUB_REPOSITORY}/actions/runs/${envs.GITHUB_RUN_ID}`,
      }
    case 'gitlab':
      return {
        actor: envs.GITLAB_USER_LOGIN,
        branch: envs.CI_COMMIT_REF_NAME,
        build: envs.CI_PIPELINE_ID,
        commitSha: envs.CI_COMMIT_SHA,
        commitMessage: envs.CI_COMMIT_MESSAGE,
        run: envs.CI_RUNNER_ID,
        url: envs.CI_PIPELINE_URL,
      }
    case 'buildkite':
      return {
        branch: envs.BUILDKITE_BRANCH,
        build: envs.BUILDKITE_BUILD_NUMBER,
        commitSha: envs.BUILDKITE_COMMIT,
        commitMessage: envs.BUILDKITE_MESSAGE,
        run: envs.BUILDKITE_BUILD_NUMBER,
        url: envs.BUILDKITE_BUILD_URL,
      }
    default:
      return {}
  }
}

export interface Metadata {
  actor?: string
  attempt?: string
  branch?: string
  build?: string
  commitMessage?: string
  commitSha?: string
  run?: string
  runNumber?: string
  url?: string
}
