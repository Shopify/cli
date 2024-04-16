import {CategoryTemplateSchema} from '@shopify/generate-docs'

const data: CategoryTemplateSchema = {
  // Name of the category
  category: 'general-commands',
  sections: [
    {
      // The generic section is the most flexible content section for landing pages and can be used for everything except the first and last sections.
      // Type id for the generic section.
      type: 'Generic',
      // Anchor link for the section.
      anchorLink: 'general',
      // The title of the section.
      title: 'Shopify CLI general commands',
      // Content for the section.
      sectionContent: 'These commands are not tied to any specific surface area of Shopify.',
    },
  ],
}

export default data
