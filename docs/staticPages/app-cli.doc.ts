import {LandingTemplateSchema} from '@shopify/generate-docs'

const data: LandingTemplateSchema = {
  title: 'Apps Overview',
  description: `Shopify CLI is a command-line interface tool that helps you build Shopify apps. It quickly generates Shopify apps and generates app extensions. You can also use it to automate many common development tasks.

This documentation explains how to use Shopify CLI for app development. To learn how to use Shopify CLI for other tasks, refer to the following documentation:

  - [Shopify CLI for themes](/docs/api/shopify-cli/v3/theme-cli)
  - [Shopify CLI for Hydrogen storefronts](/docs/custom-storefronts/hydrogen/cli)
  `,
  id: 'app-cli',
  sections: [
    {
      type: 'Generic',
      anchorLink: 'features',
      title: 'Features',
      sectionContent: `Shopify CLI accelerates your app development process with the following features:

- Creates new apps using app templates
- Generates app extensions in your app
- Creates app records in the Partner Dashboard
- Builds your app and extensions, and creates a tunnel to let you preview your work in a development store
- Deploys your app extensions
- Lets you search the Shopify.dev docs`,
    },
    {
      type: 'Generic',
      anchorLink: 'requirements',
      title: 'Requirements',
      sectionContent: `
- You've installed [Node.js](https://nodejs.org/en/download/) 18.12.0 or higher.
- You've installed a Node.js package manager: either npm, Yarn 1.x, or pnpm.
- You've installed Git 2.28.0 or higher.
- You're using the latest version of Chrome or Firefox.
      `,
    },
    {
      type: 'Generic',
      anchorLink: 'getting-started',
      title: 'Getting started',
      sectionContent: `When building a Shopify App you can choose between two different workflows:
- **Shopify CLI installed globally in your system**

  You'll be able to run shopify commands from any directory and the CLI dependencies won't interfere with your app dependencies.

- **Shopify CLI as a project dependency**

  You'll be able to run shopify commands from your project directory and the CLI dependencies will be installed in your project's \`node_modules\` directory. You'll have more control on which CLI version each of your apps use.

If you have an existing app that wasn't built using Shopify CLI, you can migrate your app to Shopify CLI for a fully integrated development experience. If you don't want a complete migration, then you can make your app compatible with Shopify CLI to access a limited set of features, such as local app configuration.

Refer to the following tutorials for additional details about creating an app that works with Shopify CLI, or to learn how to work on an existing app that uses Shopify CLI 3.0 or higher:`,
      codeblock: {
        title: '',
        tabs: [
          {
            title: 'Global CLI',
            code: 'examples/app-create.global.example.sh',
            language: 'bash',
          },
          {
            title: 'CLI as a project dependency',
            code: 'examples/app-create.local.example.sh',
            language: 'bash',
          },
        ],
      },
    },
    {
      type: 'Generic',
      anchorLink: 'commands',
      title: 'Command reference',
      sectionContent: `Refer to the [Shopify CLI app command reference](/docs/api/shopify-cli/commands) to explore the commands available to build apps with Shopify CLI.      `,
    },
    {
      type: 'Resource',
      anchorLink: 'resources',
      title: 'Resources',
      resources: [
        {
          name: 'Create an app',
          subtitle: 'Learn how to set up your app development environment and start building',
          url: '/docs/themes/getting-started/create',
          type: 'component',
        },
        {
          name: 'Build an app',
          subtitle:
            'After creating your app, follow this in-depth tutorial to learn how to add features to your app using Shopify templates, tools and libraries',
          url: '/docs/apps/getting-started/build-qr-code-app',
          type: 'tutorial',
        },
        {
          name: 'Work on an existing app',
          subtitle: 'Learn how to set up your development environment to collaborate on an app with others',
          url: '/docs/apps/getting-started/build-qr-code-app',
          type: 'tutorial',
        },
      ],
    },
  ],
}

export default data
