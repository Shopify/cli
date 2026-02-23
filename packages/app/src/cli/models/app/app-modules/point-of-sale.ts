import {AppModule, EncodeContext} from '../app-module.js'
import {BaseSchemaWithoutHandle} from '../../extensions/schemas.js'
import {zod} from '@shopify/cli-kit/node/schema'

const PosTomlSchema = BaseSchemaWithoutHandle.extend({
  pos: zod
    .object({
      embedded: zod.boolean().optional(),
    })
    .optional(),
})

type PosToml = zod.infer<typeof PosTomlSchema>

interface PosContract {
  embedded?: boolean
}

class PointOfSaleModule extends AppModule<PosToml, PosContract> {
  constructor() {
    super({identifier: 'point_of_sale', uidStrategy: 'single', tomlKeys: ['pos']})
  }

  async encode(toml: PosToml, _context: EncodeContext) {
    if (!toml.pos) return {}
    return {embedded: toml.pos.embedded}
  }

  decode(contract: PosContract) {
    return {pos: {embedded: contract.embedded}} as PosToml
  }
}

export const pointOfSaleModule = new PointOfSaleModule()
