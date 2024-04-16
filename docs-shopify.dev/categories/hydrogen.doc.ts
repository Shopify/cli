import {CategoryTemplateSchema} from '@shopify/generate-docs'

const data: CategoryTemplateSchema = {
  // Name of the category
  category: 'hydrogen',
  sections: [
    {
      // The generic section is the most flexible content section for landing pages and can be used for everything except the first and last sections.
      // Type id for the generic section.
      type: 'Generic',
      // Anchor link for the section.
      anchorLink: 'hydrogen',
      // The title of the section.
      title: 'Shopify CLI hydrogen commands',
      // Content for the section.
      sectionContent: 'This is the list of commands that you can use to work with Shopify custom storefronts.',
    },
  ],
}

export default data
