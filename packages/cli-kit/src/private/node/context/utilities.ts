/**
 * Returns whether an environment variable value represents a truthy value.
 */
export function isTruthy(variable: string | undefined): boolean {
  if (!variable) {
    return false
  }
  return ['1', 'true', 'TRUE', 'yes', 'YES'].includes(variable)
}

/**
 * Returns whether an environment variable has been set and is non-empty
 */
export function isSet(variable: string | undefined): boolean {
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
        actor: envs.BITBUCKET_COMMIT_AUTHOR,
        branch: envs.BITBUCKET_BRANCH,
        build: envs.BITBUCKET_BUILD_NUMBER,
        commitSha: envs.BITBUCKET_COMMIT,
        run: envs.BITBUCKET_BUILD_NUMBER,
        url: envs.BITBUCKET_BUILD_URL,
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
        branch: envs.GITHUB_REF_NAME,
        build: envs.GITHUB_RUN_ID,
        commitMessage: envs.GITHUB_COMMIT_MESSAGE,
        commitSha: envs.GITHUB_SHA,
        run: envs.GITHUB_RUN_ID,
        url: `${envs.GITHUB_SERVER_URL}${envs.GITHUB_REPOSITORY}/actions/runs/${envs.GITHUB_RUN_ID}`,
      }
    case 'gitlab':
      return {
        actor: envs.GITLAB_USER_LOGIN,
        branch: envs.CI_COMMIT_REF_NAME,
        build: envs.CI_PIPELINE_ID,
        commitSha: envs.CI_COMMIT_SHA,
        commitMessage: envs.CI_COMMIT_MESSAGE,
        run: envs.CI_RUNNER_ID,
        url: envs.CI_PROJECT_URL,
      }
    default:
      return {}
  }
}

export interface Metadata {
  actor?: string
  branch?: string
  build?: string
  commitMessage?: string
  commitSha?: string
  run?: string
  url?: string
}
