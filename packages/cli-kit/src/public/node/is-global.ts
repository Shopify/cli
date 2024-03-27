/**
 * Returns true if the current process is running in a global context.
 *
 * @param env - The environment to check. Defaults to `process.env`.
 * @returns `true` if the current process is running in a global context.
 */
export function currentProcessIsGlobal(env = process.env): boolean {
  // npm, yarn, pnpm and bun define this if run locally.
  // If undefined, we can assume it's global (But there is no foolproof way to know)
  return env.npm_config_user_agent === undefined
}
