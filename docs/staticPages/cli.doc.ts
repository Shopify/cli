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
    // {
    //   type: 'Generic',
    //   anchorLink: 'help',
    //   sectionContent:
    //     'Lists the available commands and describes what they do.\nYou can also use it in a command to get more information about that command like flags and arguments.',
    //   title: 'help',
    //   codeblock: {
    //     title: 'terminal',
    //     tabs: [
    //       {
    //         code: 'examples/help.example.sh',
    //         language: 'bash',
    //       },
    //     ],
    //   },
    // },
    // {
    //   type: 'Generic',
    //   anchorLink: 'version',
    //   sectionContent: 'Shows the version of Shopify CLI currently installed.',
    //   title: 'version',
    //   codeblock: {
    //     title: 'terminal',
    //     tabs: [
    //       {
    //         code: 'examples/version.example.sh',
    //         language: 'bash',
    //       },
    //     ],
    //   },
    // },
    {
      type: 'Generic',
      anchorLink: 'upgrade',
      sectionContent:
        'We recommend to always use the latest version of the CLI if possible, run `version` to check the current version and if there are any update available and `upgrade` to install the latest CLI version.',
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
    //     {
    //       type: 'Generic',
    //       anchorLink: 'autocorrect',
    //       sectionContent: `Enables or disables command autocorrection. By default, autocorrect is off.

    // When autocorrection is enabled, Shopify CLI automatically runs a corrected version of your command if a correction is available.

    // When autocorrection is disabled, you need to confirm that you want to run corrections for mistyped commands.
    // | Command   |      Description      |
    // |----------|:-------------:|
    // | \`on\` |  	Enable autocorrect. |
    // | \`off\` |  	Disable autocorrect. |
    // | \`status\` |  	Check whether autocorrect is enabled or disabled. |
    // `,
    //       title: 'autocorrect',
    //       codeblock: {
    //         title: 'terminal',
    //         tabs: [
    //           {
    //             code: 'examples/autocorrect.example.sh',
    //             language: 'bash',
    //           },
    //         ],
    //       },
    //     },
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
