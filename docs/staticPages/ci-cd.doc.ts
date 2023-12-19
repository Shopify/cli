import {LandingTemplateSchema} from '@shopify/generate-docs'

const data: LandingTemplateSchema = {
  title: 'CI/CD',
  description: `Shopify CLI offers CI/CD support for apps and themes.
- **Apps**: You can deploy any app extensions that you generated using Shopify CLI in a CI/CD pipeline.
- **Themes**: If you have a theme that you want to work with programmatically, then you can integrate Shopify CLI into your CI/CD pipeline to perform actions like pushing, pulling, and publishing a theme.
  `,
  id: 'ci-cd',
  sections: [
    {
      type: 'Generic',
      anchorLink: 'ci-app',
      title: 'Apps',
      sectionContent: `
&nbsp;
### Step 1: Generate variables for deployment

To target the app that you want to deploy to, you need to gather your app's client ID.

1. Navigate to your app directory.
2. Run \`shopify app deploy\`

An env file is generated at the root of your project. It contains the client ID (API key) for your app and the ID of each of the extensions in your app.

&nbsp;
### Step 2: Generate a CLI authentication token
You can create a new CLI authentication token through the Partner Dashboard.

Tokens are managed at the Partner organization level. You can have only two CLI authentication tokens for your Partner organization. If you want to create more than two authentication tokens, then you need to delete an existing authentication token.

#### Generate a CLI authentication token in the Partner Dashboard
- From your Partner Dashboard, navigate to Settings > CLI token, and then click Manage tokens.
- From the Token expiration drop-down list, select an expiration for the token.
- Click Generate token.
- In the Tokens section, click the Copy button to copy the access token to your clipboard.
  This token value will be passed as a parameter in your Shopify CLI automation.

For security reasons, the token is only visible immediately after it's created. If you lose your token, then you need to delete your existing token and then generate a new token.

&nbsp;
### Step 3: Integrate Shopify CLI into your pipeline
After you retrieve your deployment variables and CLI authentication token, you can integrate Shopify CLI into your continuous deployment pipeline using your CI/CD provider.

The CD pipeline step should install Shopify CLI and all of its dependencies.

To push to Shopify programmatically using your CD pipeline step, include the following:

- An environment variable that contains the authentication token that you generated in the Partner Dashboard.
- The client ID for your app.
- A step that installs the Shopify CLI (either globally or as a project dependency).
- Steps that install the other dependencies for your project.
- A step that runs the CLI deploy command with the force flag set.

Where possible, you should protect the authentication token and client ID values by masking them or storing them as secrets.
`,
      codeblock: {
        title: 'CI/CD Examples',
        tabs: [
          {
            title: 'Github Actions',
            code: 'examples/ci-app.github.example.yml',
            language: 'yaml',
          },
          {
            title: 'CircleCI',
            code: 'examples/ci-app.circleci.example.yml',
            language: 'yaml',
          },
        ],
      },
    },
    {
      type: 'Generic',
      anchorLink: 'ci-theme',
      title: 'Themes',
      sectionContent: `
&nbsp;
### Step 1: Get a Theme Access password for the store

For each store that you want to interact with programmatically using Shopify CLI, you need to get a Theme Access password. These are generated using the Theme Access app.

To learn about the requirements for installing and using the Theme Access app, and instructions on how to generate a new password, refer to Manage theme access.

&nbsp;
### Step 2: Generate a CLI authentication token

After you get a Theme Access password for the store, you can integrate Shopify CLI into your continuous deployment pipeline using your CI/CD provider.

The CD pipeline step should install Shopify CLI and all of its dependencies.

To run Shopify CLI theme commands programmatically using your CD pipeline step, include the following:

- Environment variables:

  | Command   |      Required?      |      Value      |
  |----------|:-------------:|:-------------|
  | \`SHOPIFY_FLAG_STORE\` |  	Yes | The store that you want to interact with |
  | \`SHOPIFY_CLI_THEME_TOKEN\` |  	Yes | The Theme Access password that you generated or were given by a merchant. **We recommend to store this as a secret**. |
  | \`SHOPIFY_CLI_TTY\` |  	No | Pass this variable with a value of \`0\` to turn off interactive prompts. You might want to use this variable if your Shopify CLI pipeline step is timing out. |

- A step that sets up Ruby and bundler.
- A step that sets up Node.js.
- A step that installs Shopify CLI globally.
- A step that runs the CLI command that you want to execute.
`,
      codeblock: {
        title: '',
        tabs: [
          {
            title: 'Example (Github Actions)',
            code: 'examples/ci-theme.example.yml',
            language: 'yaml',
          },
        ],
      },
    },
  ],
}

export default data
