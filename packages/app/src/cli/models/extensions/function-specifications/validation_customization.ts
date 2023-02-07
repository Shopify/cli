import {createFunctionSpecification} from '../functions.js'

const spec = createFunctionSpecification({
  identifier: 'validation_customization',
  externalIdentifier: 'validation_customization',
  externalName: 'Function - Validation customization',
  gated: false,
  templatePath: (lang) => `merchandising/${lang}/validation-customization/default`,
})

export default spec
