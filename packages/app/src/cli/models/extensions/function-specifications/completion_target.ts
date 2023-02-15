import {createFunctionSpecification} from '../functions.js'

const spec = createFunctionSpecification({
  identifier: 'completion_target',
  externalIdentifier: 'completion_target',
  externalName: 'Function - Completion Target',
  gated: false,
  registrationLimit: 1,
  templatePath: (lang) => `checkout/${lang}/completion-target/bundles`,
})

export default spec
