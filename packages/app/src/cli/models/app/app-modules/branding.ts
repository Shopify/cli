/**
 * Branding AppModule — simplest case.
 * Single UID, declarative rename (handle ↔ app_handle), no shared keys.
 */

import {AppModule, EncodeContext} from '../app-module.js'
import {BaseSchemaWithoutHandle} from '../../extensions/schemas.js'
import {zod} from '@shopify/cli-kit/node/schema'

// --- TOML shape ---

const BrandingTomlSchema = BaseSchemaWithoutHandle.extend({
  name: zod.string({required_error: 'String is required'}).max(30, {message: 'String must be less than 30 characters'}),
  handle: zod
    .string({required_error: 'String is required'})
    .max(256, {message: 'String must be less than 256 characters long'})
    .refine((value) => value && /^\w*(?!-)[_a-z0-9-]+(?<!-)$/.test(value), {
      message: "String can't contain special characters",
    })
    .optional(),
})

type BrandingToml = zod.infer<typeof BrandingTomlSchema>

// --- Contract shape ---

interface BrandingContract {
  name: string
  app_handle?: string
}

// --- Module definition ---

class BrandingModule extends AppModule<BrandingToml, BrandingContract> {
  constructor() {
    super({identifier: 'branding', uidStrategy: 'single', tomlKeys: ['name', 'handle']})
  }

  async encode(toml: BrandingToml, _context: EncodeContext) {
    return {
      name: toml.name,
      app_handle: toml.handle,
    }
  }

  decode(contract: BrandingContract) {
    return {
      name: contract.name,
      handle: contract.app_handle,
    } as BrandingToml
  }
}

export const brandingModule = new BrandingModule()
