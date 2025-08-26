export const isDevServerEnvironment = process.env.USING_DEV === '1'

export function assertCompatibleEnvironment() {
  if (!isDevServerEnvironment) {
    throw new Error('DevServer is not supported in this environment')
  }
}
