const DISABLE_EXPERIMENTS_ENV_VARS = [
  "SHOPIFY_DEV_TOOLS_DISABLE_EXPERIMENTS",
  "SHOPIFY_DEV_MCP_DISABLE_EXPERIMENTS",
] as const;

const CI_ENV_VARS = [
  "CI",
  "CONTINUOUS_INTEGRATION",
  "GITHUB_ACTIONS",
  "BUILDKITE",
  "JENKINS_URL",
  "CIRCLECI",
  "GITLAB_CI",
  "TRAVIS",
] as const;

export type OptOutResult =
  | { optedOut: false }
  | { optedOut: true; reason: string };

function envFlagEnabled(value: string | undefined): boolean {
  return value === "1" || value?.toLowerCase() === "true";
}

export function detectOptOut(
  env: NodeJS.ProcessEnv = process.env,
): OptOutResult {
  for (const name of DISABLE_EXPERIMENTS_ENV_VARS) {
    if (envFlagEnabled(env[name])) {
      return {
        optedOut: true,
        reason: `${name} set`,
      };
    }
  }

  if (env.DO_NOT_TRACK === "1") {
    return { optedOut: true, reason: "DO_NOT_TRACK=1" };
  }

  if (env.DNT === "1") {
    return { optedOut: true, reason: "DNT=1" };
  }

  for (const name of CI_ENV_VARS) {
    if (env[name]) {
      return { optedOut: true, reason: `CI detected (${name})` };
    }
  }

  return { optedOut: false };
}
