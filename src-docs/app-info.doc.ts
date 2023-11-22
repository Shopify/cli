import {ReferenceEntityTemplateSchema} from '@shopify/generate-docs'

const data: ReferenceEntityTemplateSchema = {
  // The title of the page.
  name: 'info',
  // Optional. A description of the reference entity. Can include Markdown.
  description: 'Displays information about your app.',
  overviewPreviewDescription: 'Displays information about your app.',
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
          title: 'app info',
          // The relative file path to the code file. Content will be automatically extracted from that file.
          code: './examples/appInfo.example.sh',
          // Optional. The name of the language of the code.
          language: 'bash',
        },
      ],
      // Optional. The title of the example.
      title: 'app info',
    },
  },
  // Optional. Displays generated TypeScript information, such as prop tables.
  definitions: [
    {
      // Title of the list of definitions.
      title: 'app info flags',
      // Description of the definitions. Can use Markdown.
      description: 'The following flags are available for the `app info` command:',
      // Name of the TypeScript type this entity uses.
      type: 'appInfo',
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
