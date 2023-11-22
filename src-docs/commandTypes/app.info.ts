export interface appInfo {
  /**
   * The path to your app directory
   *
   * @default current working directory
   */
  path?: string

  /**
   * The name of the config to use
   */
  config?: string

  /**
   * Provide more detailed output in the logs.
   */
  verbose?: ''

  /**
   * Disables color output in the logs
   */
  'no-color'?: ''

  /**
   * Output the app info in JSON format
   */
  json?: ''
}
