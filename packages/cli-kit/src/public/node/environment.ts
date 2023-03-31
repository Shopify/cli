/**
 * It returns the environment variables of the environment
 * where the Node process is running.
 *
 * This function exists to prevent the access of the process
 * global variable which is discouraged via the no-process-env
 * ESLint rule.
 *
 * @returns Current process environment variables.
 */
export function getEnvironmentVariables(): NodeJS.ProcessEnv {
  return process.env
}
