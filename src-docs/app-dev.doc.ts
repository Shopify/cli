import {ReferenceEntityTemplateSchema} from '@shopify/generate-docs'

const data: ReferenceEntityTemplateSchema = {
  // The title of the page.
  name: 'dev',
  // Optional. A description of the reference entity. Can include Markdown.
  description: `[Builds the app](/docs/apps/tools/cli/commands#build) and lets you preview it on a [development store](/docs/apps/tools/development-stores) or [Plus sandbox store](https://help.shopify.com/partners/dashboard/managing-stores/plus-sandbox-store?shpxid=f75d4b9f-3CE2-4156-F28E-0364F1AF6ABB).

  To preview your app on a development store or Plus sandbox store, Shopify CLI walks you through the following steps. If you've run \`dev\` before, then your settings are saved and some of these steps are skipped. You can reset these configurations using \`dev --reset\` to go through all of them again:

- Associating your project with an app associated with your Partner account or organization, or creating a new app.
- Selecting a development store or Plus sandbox store to use for testing. If you have only one store, then it's selected automatically.
- Installing your app on the store using the provided install link.
- Creating a tunnel between your local environment and the store using Cloudflare.

  You can use your own tunneling software instead, by passing your tunnel URL with the \`--tunnel-url\` flag.
- Updating the app URLs that are set in the Partner Dashboard.

  To avoid overwriting any URLs that are already set, select the No, never option. If you select this option, then you're provided with URLs that you can manually add in the Partner Dashboard so you can preview your app.

- Enabling development store preview for extensions.
- Building and serving your app and app extensions.

If you're using the PHP or Ruby app template, then you need to complete the following steps before you can preview your app for the first time:

- PHP: [Set up your Laravel app](https://github.com/Shopify/shopify-app-template-php#setting-up-your-laravel-app)
- Ruby: [Set up your Rails app](https://github.com/Shopify/shopify-app-template-ruby#setting-up-your-rails-app)

> Caution: To use a development store or Plus sandbox store with Shopify CLI, you need to be the store owner, or have a staff account on the store. Staff accounts are created automatically the first time you access a development store with your Partner staff account through the Partner Dashboard.
  `,
  overviewPreviewDescription: 'Builds the app and lets you preview it on a development or plus sandbox store',
  // Optional. What category the entity is: component, hook, utility, etc.
  type: 'command',
  // Boolean that determines if the entity is a visual component.
  isVisualComponent: false,
  // Optional. The example that appears in the right hand column at the top of the page. Represents the primary use case.
  defaultExample: {
    // The data for the code block.
    codeblock: {
      // Tabs that appear at the top of the code block.
      tabs: [
        {
          // Optional. The title of the tab.
          title: 'app dev',
          // The relative file path to the code file. Content will be automatically extracted from that file.
          code: './examples/appDev.example.sh',
          // Optional. The name of the language of the code.
          language: 'bash',
        },
      ],
      // Optional. The title of the example.
      title: 'dev',
    },
  },
  // Optional. Displays generated TypeScript information, such as prop tables.
  definitions: [
    {
      // Title of the list of definitions.
      title: 'app dev flags',
      // Description of the definitions. Can use Markdown.
      description: 'The following flags are available for the `app info` command:',
      // Name of the TypeScript type this entity uses.
      type: 'appDev',
    },
  ],
  // This determines where in the sidebar the entity will appear.
  category: 'Commands',
  // Optional. The subcategory of the page.
  subCategory: 'app',
  // A section that displays related entities in a grid of cards.
  related: [
    // {
    //   // Name of the related object/entity/link.
    //   name: 'Generate docs package',
    //   subtitle: 'Navigate to',
    //   // Link to the entity you wish to display in card form.
    //   url: '/internal/generate-docs',
    //   // Optional. What category the entity is: component, hook, utility, etc. Determines the icon displayed on the card.
    //   type: 'tutorial',
    // },
  ],
}

export default data
