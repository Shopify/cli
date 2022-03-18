import Command from '../../../../core/Command'
import {transform, addImportSpecifier, addImportStatement, wrapJsxChildren} from '@shopify/ast-utilities/javascript'

export async function addShopifyProvider(this: Command) {
  const {fs} = this

  if (await fs.hasFile('src/App.server.jsx')) {
    await fs.write(
      'src/App.server.jsx',
      await transform(
        await fs.read('src/App.server.jsx'),
        addImportSpecifier('@shopify/hydrogen', 'ShopifyServerProvider'),
        addImportStatement(`import shopifyConfig from '../shopify.config';`),

        wrapJsxChildren(
          `<ShopifyServerProvider shopifyConfig={shopifyConfig} {...serverState}></ShopifyServerProvider>`,
          'Suspense',
        ),
      ),
    )
  }
}
