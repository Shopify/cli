/**
 * It returns the environment variables of the environment
 * where the Node process is running.
 *
 * This function exists to prevent the access of the process
 * global variable which is discouraged via the no-process-env
 * ESLint rule.
 */
export function getEnvironmentVariables(): NodeJS.ProcessEnv {
  // eslint-disable-next-line no-process-env
  return {...process.env}
}

/**
 * It sets an environment variable in the current process.
 * @param name - The name of the environment variable.
 * @param value - The value.
 */
export function setEnvironmentVariable(name: string, value: string) {
  // eslint-disable-next-line no-process-env
  process.env[name] = value
}
