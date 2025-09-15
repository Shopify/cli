import {LandingTemplateSchema} from '@shopify/generate-docs'

const data: LandingTemplateSchema = {
  title: 'Shopify CLI',
  description:
    'Shopify CLI is a command-line interface tool that helps you generate and work with Shopify apps, themes and custom storefronts. You can also use it to automate many common development tasks.',
  id: 'Shopify CLI',
  image: '/assets/landing-pages/templated-apis/web-pixels-api/landing-page.png',
  darkImage: '/assets/landing-pages/templated-apis/web-pixels-api/landing-page.png',
  sections: [
    {
      type: 'Generic',
      anchorLink: 'requirements',
      title: 'Requirements',
      sectionContent: `
- [Node.js](https://nodejs.org/en/download/): 20.10 or higher
- A Node.js package manager: [npm](https://www.npmjs.com/get-npm), [Yarn 1.x](https://classic.yarnpkg.com/lang/en/docs/install), or [pnpm](https://pnpm.io/installation).
- [Git](https://git-scm.com/downloads): 2.28.0 or higher
`,
    },
    {
      type: 'Generic',
      anchorLink: 'installation',
      title: 'Installation',
      sectionContent:
        'This installs Shopify CLI globally on your system, so you can run `shopify` commands from any directory. Find out more about the available commands by running `shopify` in your terminal.',
      codeblock: {
        title: '',
        tabs: [
          {
            title: 'npm',
            code: 'examples/install.npm.example.sh',
            language: 'bash',
          },
          {
            title: 'yarn',
            code: 'examples/install.yarn.example.sh',
            language: 'bash',
          },
          {
            title: 'pnpm',
            code: 'examples/install.pnpm.example.sh',
            language: 'bash',
          },
          {
            title: 'homebrew',
            code: 'examples/install.brew.example.sh',
            language: 'bash',
          },
        ],
      },
    },
    {
      type: 'Generic',
      anchorLink: 'commands',
      title: 'Commands',
      sectionContent: `
Shopify CLI groups commands into topics. The command syntax is: \`shopify [topic] [command]\`.
Refer to each topic section in the sidebar for a list of available commands.

Or, run the \`help\` command to get this information right in your terminal.
`,
      codeblock: {
        title: 'terminal',
        tabs: [
          {
            code: 'examples/help.example.sh',
            language: 'bash',
          },
        ],
      },
    },
    {
      type: 'Generic',
      anchorLink: 'upgrade',
      sectionContent:
        'We recommend that you always use the latest version of Shopify CLI if possible. To upgrade, run `version` to check the current version and determine if there are any updates available. Run the [install](#installation) command to upgrade to the latest CLI version.',
      title: 'Upgrade Shopify CLI',
      codeblock: {
        title: 'terminal',
        tabs: [
          {
            code: 'examples/upgrade.example.sh',
            language: 'bash',
          },
        ],
      },
    },
    {
      type: "Generic",
      anchorLink: "network-proxy",
      title: "Network proxy configuration",
      sectionContent: "When working behind a network proxy, you can configure Shopify CLI (version 3.78+) to route connections through it:\n\n1. Set the proxy for HTTP traffic:\n\n   ```bash\n   export SHOPIFY_HTTP_PROXY=http://proxy.com:8080\n   ```\n\n2. Optionally, set a different proxy for HTTPS traffic:\n\n   ```bash\n   export SHOPIFY_HTTPS_PROXY=https://secure-proxy.com:8443\n   ```\n\n   If not specified, the HTTP proxy will be used for all traffic.\n\n3. For authenticated proxies, include credentials in the URL:\n\n   ```bash\n   export SHOPIFY_HTTP_PROXY=http://username:password@proxy.com:8080\n   ```"
    },
    {
      type: 'Generic',
      anchorLink: 'reporting',
      title: 'Usage reporting',
      sectionContent: `Anonymous usage statistics are collected by default. To opt out, you can use the environment variable \`SHOPIFY_CLI_NO_ANALYTICS=1\`.`,
    },
    {
      type: 'Generic',
      anchorLink: 'contribute',
      title: 'Contribute to Shopify CLI',
      sectionContent: `Shopify CLI is open source. [Learn how to contribute](https://github.com/Shopify/cli/wiki/Contributors:-Introduction) to our GitHub repository.`,
    },
    {
      type: 'Generic',
      anchorLink: 'help',
      title: 'Where to get help',
      sectionContent: `
- [Shopify Community Forums](https://community.shopify.dev/c/shopify-cli-libraries/14) - Visit our forums to connect with the community and learn more about Shopify CLI development.
- [Open a GitHub issue](https://github.com/shopify/cli/issues) - To report bugs or request new features, open an issue in the Shopify CLI repository.
`,
    },
    {
      type: 'Resource',
      anchorLink: 'resources',
      title: 'Resources',
      resources: [
        {
          name: 'Start building a theme',
          subtitle: 'Learn how to set up your theme development environment and create a new theme',
          url: '/docs/themes/getting-started/create',
          type: 'component',
        },
        {
          name: 'Start building an app',
          subtitle: 'Learn how to set up your app development environment and start building',
          url: '/docs/apps/getting-started/create',
          type: 'tutorial',
        },
      ],
    },
  ],
}

export default data
