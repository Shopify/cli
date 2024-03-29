// This is an autogenerated file. Don't edit this file manually.
export interface themedev {
  /**
   * The environment to apply to the current command.
   */
  '-e, --environment <value>'?: string

  /**
   * Set which network interface the web server listens on. The default value is 127.0.0.1.
   */
  '--host <value>'?: string

  /**
   * Skip hot reloading any files that match the specified pattern.
   */
  '-x, --ignore <value>'?: string

  /**
   * The live reload mode switches the server behavior when a file is modified:
- hot-reload Hot reloads local changes to CSS and sections (default)
- full-page  Always refreshes the entire page
- off        Deactivate live reload
   */
  '--live-reload <value>'?: string

  /**
   * Disable color output.
   */
  '--no-color'?: ''

  /**
   * Runs the dev command without deleting local files.
   */
  '-n, --nodelete'?: ''

  /**
   * The file path or URL. The file path is to a file that you want updated on idle. The URL path is where you want a webhook posted to report on file changes.
   */
  '--notify <value>'?: string

  /**
   * Hot reload only files that match the specified pattern.
   */
  '-o, --only <value>'?: string

  /**
   * Automatically launch the theme preview in your default web browser.
   */
  '--open'?: ''

  /**
   * Password generated from the Theme Access app.
   */
  '--password <value>'?: string

  /**
   * The path to your theme directory.
   */
  '--path <value>'?: string

  /**
   * Force polling to detect file changes.
   */
  '--poll'?: ''

  /**
   * Local port to serve theme preview from.
   */
  '--port <value>'?: string

  /**
   * Store URL. It can be the store prefix (johns-apparel) or the full myshopify.com URL (johns-apparel.myshopify.com, https://johns-apparel.myshopify.com).
   */
  '-s, --store <value>'?: string

  /**
   * Theme ID or name of the remote theme.
   */
  '-t, --theme <value>'?: string

  /**
   * Synchronize Theme Editor updates in the local theme files.
   */
  '--theme-editor-sync'?: ''

  /**
   * Increase the verbosity of the logs.
   */
  '--verbose'?: ''
}
