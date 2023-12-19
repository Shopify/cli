import {LandingTemplateSchema} from '@shopify/generate-docs'

const data: LandingTemplateSchema = {
  title: 'Themes Overview',
  description: `This documentation explains how to use Shopify CLI for theme development. To learn how to use Shopify CLI for other tasks, refer to the following documentation:

  - [Shopify CLI for apps](/docs/api/shopify-cli/v3/app-cli)
  - [Shopify CLI for Hydrogen storefronts](/docs/custom-storefronts/hydrogen/cli)

> Tip: You can use Shopify CLI together with the [Shopify GitHub integration](/docs/themes/tools/github) to add version control to themes that you're developing.
  `,
  id: 'theme-cli',
  sections: [
    {
      type: 'Generic',
      anchorLink: 'features',
      title: 'Features',
      sectionContent: `Shopify CLI accelerates your theme development process with the following features:

- Safely preview, test, and share changes to themes using development themes
- Hot reload CSS and section changes, or automatically refresh a page on file change, when previewing a theme
- Initialize a new theme using Dawn as a starting point
- Push and publish themes from the command line
- Work on multiple themes using environments
- Run Theme Check on your theme`,
    },
    {
      type: 'Generic',
      anchorLink: 'development-themes',
      title: 'Development themes',
      sectionContent: `Development themes are temporary, hidden themes that are connected to the Shopify store that you're using for development. When you connect your theme to a store as a development theme, you can use that store's data for local testing.

You can create a development theme using the \`shopify theme dev\` command.

You can use development themes on a Shopify store or a [development store](/docs/themes/tools/development-stores). Development themes don't count toward your theme limit, and are deleted from the store after seven days of inactivity.

Your development theme is deleted when you run \`shopify auth logout\`. If you want a preview link for the theme that can be accessed after you log out, then you should push your development theme to an unpublished theme on your store.

Your development theme can be used to perform the following tasks:

- View changes in real time to a theme that you're developing locally
- Customize and interact with the theme using the Shopify admin [theme editor](/docs/themes/tools/online-editor)
- Share a password-protected preview of the theme with other developers`,
    },
    {
      type: 'Generic',
      anchorLink: 'environments',
      title: 'Environments',
      sectionContent: `Many command configurations, such as the theme and store to be used with the command, are passed using flags. To avoid passing multiple flags with each command, and to easily switch projects or contexts, you can use environments. Environments are sets of command configurations that can be referenced by name using a single --environment flag.

You might want to use environments in the following cases:

- You need to switch between development stores frequently.
- You access multiple stores using Theme Access passwords.
- You want to deploy your project to development, staging, and production instances of your theme.

[Learn how to configure and use environments](/docs/themes/tools/cli/environments)`,
    },
    {
      type: 'Generic',
      anchorLink: 'getting-started',
      title: 'Getting started',
      sectionContent: `Refer to the following tutorials for details about creating or working on a Shopify theme using Shopify CLI:`,
      sectionCard: [
        {
          name: 'Start building a theme',
          subtitle: 'Learn how to set up your theme development environment and create a new theme',
          url: '/docs/themes/getting-started/create',
          type: 'cheatsheet',
        },
        {
          name: 'Customize an existing theme',
          subtitle: 'Learn how to set up your development environment to work on a theme in a Shopify store',
          url: '/docs/themes/getting-started/customize',
          type: 'tutorial',
        },
      ],
    },
    {
      type: 'Generic',
      anchorLink: 'commands',
      title: 'Command reference',
      sectionContent: `Refer to the [Shopify CLI theme command reference](/docs/api/shopify-cli/commands) to explore the commands available to build themes with Shopify CLI.`,
    },
    {
      type: 'Generic',
      anchorLink: 'authentication',
      title: 'Authentication',
      sectionContent: `As a theme developer, you might want to use a Shopify store to test your theme, or to share your theme with stakeholders. You also might need to work on multiple stores, or use a different set of credentials to authenticate with a particular store. Learn about the authentication methods that you can use to work on stores using Shopify CLI, and how to switch between accounts and stores.

You can use the following authentication methods to work on a theme in a Shopify store using Shopify CLI:

- Log in with a Shopify account
- Provide a Theme Access password
- Provide a custom app access token

### Log in with a Shopify account
You can use the following types of Shopify accounts to access the store you want to work on:

- A collaborator account with the Manage themes permission
- A staff account with the Themes permission
- The store owner account
To authenticate with a Shopify account, run a command that requires store access. You'll be prompted to log in.

> Caution: To use a development store or Plus sandbox store with Shopify CLI, you need to be the store owner, or have a staff account on the store. Staff accounts are created automatically the first time you access a development store with your Partner staff account through the Partner Dashboard.

#### Switching between accounts
If you need to switch between accounts, then log out of the current account using the \`shopify auth logout\` command.

The next time you enter a command that requires authentication, you'll be prompted to log in, and can enter a new set of credentials.

### Theme Access password
You can use a Theme Access password to authenticate with the store that you want to work on. Theme Access passwords are generated for a store using the Theme Access app.

To use a Theme Access password, pass the \`--password\` flag with each command that you want to run against the store. If you run a command without the \`--password\` flag, then Shopify CLI attempts to use your Shopify account credentials to run the command.

### Custom app access token
You can use a custom app access token to authenticate with the store that you want to work on.

To authenticate using an access token, pass the \`--password\` flag with each command that you want to run against the store. If you run a command without the \`--password\` flag, then Shopify CLI attempts to use your Shopify account credentials to run the command.

Your custom app needs to have the \`read_themes\` and \`write_themes\` API access scopes. To enable hot reloading, you also need to add the unauthenticated_read_content access scope for Storefront API integration, and pass the tokens as environment variables instead of using the \`--password\` flag.`,
    },
    {
      type: 'Generic',
      anchorLink: 'connecting-store',
      title: 'Connecting to a store',
      sectionContent: `The first time you enter a command that requires you to interact with a Shopify store, pass the \`--store\` flag with the command and specify the store that you want to interact with

The store that you specify is used for future commands until a new store is specified.

If you want to change the store that you're interacting with, pass the \`--store flag\` with your command, specifying the new store that you want to interact with.

To check which store you're using, run \`shopify theme info\``,
      codeblock: {
        title: '',
        tabs: [
          {
            title: 'Terminal',
            code: 'examples/theme-connecting.example.sh',
            language: 'bash',
          },
        ],
      },
    },
    {
      type: 'Generic',
      anchorLink: 'directory',
      title: 'Directory structure',
      sectionContent: `You can run certain theme commands, such as \`shopify theme dev\`, only if the directory you're using matches the default Shopify theme directory structure. This structure represents a buildless theme, or a theme that has already gone through any necessary file transformations. If you use build tools to generate theme files, then you might need to run commands from the directory where the generated files are stored.:`,
      codeblock: {
        title: '',
        tabs: [
          {
            title: 'Shopify theme directory structure',
            code: 'examples/theme-directory.example.sh',
            language: 'bash',
          },
        ],
      },
    },
  ],
}

export default data
