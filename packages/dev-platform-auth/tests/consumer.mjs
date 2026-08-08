import {PACKAGE_NAME} from '../dist/index.js'

if (PACKAGE_NAME !== '@shopify/dev-platform-auth') {
  throw new Error(`Unexpected package name: ${PACKAGE_NAME}`)
}
