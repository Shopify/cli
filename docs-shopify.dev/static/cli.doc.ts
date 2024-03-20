import {LandingTemplateSchema} from '@shopify/generate-docs'

const data: LandingTemplateSchema = {
  title: 'Shopify CLI',
  description:
    'Shopify CLI is a command-line interface tool that helps you build Shopify apps and themes. It quickly generates Shopify apps, themes, and custom storefronts. You can also use it to automate many common development tasks.',
  id: 'Shopify CLI',
  image: '/assets/landing-pages/templated-apis/web-pixels-api/landing-page.png',
  darkImage: '/assets/landing-pages/templated-apis/web-pixels-api/landing-page.png',
  sections: [
    {
      type: 'Generic',
      anchorLink: 'requirements',
      title: 'Requirements',
      sectionContent:
        '- Node.js version 18.12.0 or higher\n- Ruby version 2.7.2 or higher (Only for theme commands)\n- Git version 2.28.0 or higher',
    },
    {
      type: 'Generic',
      anchorLink: 'installation',
      title: 'Installation',
      sectionContent:
        'This installs Shopify CLI globally, so you can run shopify commands from any directory. Find out more about the available commands by running `shopify` in your terminal.\n\nFor app development you can also install the CLI locally to your project, find out more about that [Here](/docs/apps/getting-started/installation).',
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
      anchorLink: 'Commands',
      title: 'Commands',
      sectionContent: `
Shopify CLI groups commands into topics and this is the syntax to run them: \`shopify [topic] [command]\`.
Check out the [Commands](/docs/api/shopify-cli/commands) section to see the list of commands available for each topic.

Or run the \`help\` command to get this information right in your terminal
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
        'We recommend to always use the latest version of the CLI if possible, run `version` to check the current version and if there are any updates available. Then run the same install command to upgrade to the latest CLI version.',
      title: 'Upgrade your CLI',
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
      type: 'Generic',
      anchorLink: 'reporting',
      title: 'Usage reporting',
      sectionContent: `Anonymous usage statistics are collected by default. To opt out, you can use the environment variable \`SHOPIFY_CLI_NO_ANALYTICS=1\`.`,
    },
    {
      type: 'Generic',
      anchorLink: 'contributing',
      title: 'Contributing to Shopify CLI',
      sectionContent: `Shopify CLI is open source. [Learn how to contribute](https://github.com/Shopify/cli/wiki/Contributors:-Introduction) to our GitHub repository.`,
    },
    {
      type: 'Generic',
      anchorLink: 'help',
      title: 'Where to get help',
      sectionContent: `
- [Open a GitHub issue](https://github.com/shopify/cli/issues) - To report bugs or request new features, open an issue in the Shopify CLI repository.
- [Shopify Community Forums](https://community.shopify.com/?shpxid=f84767ac-02DB-40B4-E6CB-AAF9AB7659DA) - Visit our forums to connect with the community and learn more about Shopify CLI development.
`,
    },
    {
      type: 'Resource',
      anchorLink: 'fakeAnchorLink',
      title: 'Resources',
      resources: [
        {
          name: 'Start building a theme',
          subtitle: 'Learn how to set up your theme development environment and create a new theme',
          url: '/docs/themes/getting-started/create',
          type: 'component',
        },
        {
          name: 'Create an app',
          subtitle: 'Learn how to set up your app development environment and start building',
          url: '/docs/apps/getting-started/create',
          type: 'tutorial',
        },
      ],
    },
  ],
}

export default data
