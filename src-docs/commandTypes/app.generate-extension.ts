export interface appGenerateExtension {
  /**
   * The name of yout extension
   */
  name?: string

  /**
   * The extension template. Refer to [supported extensions](/docs/apps/tools/cli/commands#supported-extensions).
   */
  template?: string

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
   *Choose the flavor of the template that you want to start with.

The flavors that are available depend on the extension you're generating. For example:

- UI extensions support `react`, `vanilla-js`, `typescript-react`, and `typescript`.

- Shopify Functions support `vanilla-js`, `typescript`, `wasm`, and `rust`.

- Some extensions, such as Shopify Flow actions and triggers, don't have flavor options.
   */
  flavor?: string
}
