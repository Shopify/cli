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
- [Node.js](https://nodejs.org/en/download/) version 18.16.0 or higher
- [Git](https://git-scm.com/downloads) version 2.28.0 or higher

Only for theme commands:
- [Ruby](https://www.ruby-lang.org/en/) version 2.7.2 or higher

Only for theme commands on Windows:
- Ruby+Devkit 3.0, installed using [RubyInstaller for Windows](https://rubyinstaller.org/downloads/) (select the MSYS2 component and the MSYS2 base installation option)

If you're using Linux and themes, then follow the instructions on the side to install the required dependencies. Otherwise, you can continue to the [installation](#installation) step.
`,
      codeblock: {
        title: 'Install requirements for themes on Linux',
        tabs: [
          {
            title: 'apt',
            code: 'examples/requirements.apt.example.sh',
            language: 'bash',
          },
          {
            title: 'yum',
            code: 'examples/requirements.yum.example.sh',
            language: 'bash',
          },
        ],
      },
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
      anchorLink: 'Commands',
      title: 'Commands',
      sectionContent: `
Shopify CLI groups commands into topics. The command syntax is: \`shopify [topic] [command]\`.
Refer to the commands sections in the sidebar for the lists of available commands for each topic.

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
- [Shopify Community Forums](https://community.shopify.com/) - Visit our forums to connect with the community and learn more about Shopify CLI development.
- [Open a GitHub issue](https://github.com/shopify/cli/issues) - To report bugs or request new features, open an issue in the Shopify CLI repository.
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
