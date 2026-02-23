/**
 * Events AppModule — no-transform case.
 * Single UID, TOML = contract format, codec is absent.
 * Reverse transform strips server-managed 'identifier' field (handled by codec.decode if needed).
 */

import {AppModule, EncodeContext} from '../app-module.js'
import {BaseSchemaWithoutHandle} from '../../extensions/schemas.js'
import {zod} from '@shopify/cli-kit/node/schema'

// --- TOML shape = Contract shape ---

const EventsTomlSchema = BaseSchemaWithoutHandle.extend({
  events: zod.any().optional(),
})

type EventsToml = zod.infer<typeof EventsTomlSchema>

// --- Contract shape (same as TOML — forward is identity) ---

// For the reverse direction (app config link), the server includes an 'identifier' field
// on each subscription that needs to be stripped. We model this with a codec that only
// does work in the decode direction.

interface EventsContract {
  events?: {
    api_version?: string
    subscription?: {identifier?: string; [key: string]: unknown}[]
  }
}

// --- Module definition ---

class EventsModule extends AppModule<EventsToml, EventsContract> {
  constructor() {
    super({identifier: 'events', uidStrategy: 'single', tomlKeys: ['events']})
  }

  // Forward is identity. Reverse strips 'identifier'.
  // Even though forward is identity, we define encode/decode so decode can strip.
  async encode(toml: EventsToml, _context: EncodeContext) {
    return toml as unknown as EventsContract
  }

  decode(contract: EventsContract) {
    if (!contract.events?.subscription) return contract as unknown as EventsToml

    const cleanedSubscriptions = contract.events.subscription.map((sub) => {
      const {identifier: _, ...rest} = sub
      return rest
    })

    return {
      events: {
        api_version: contract.events.api_version,
        subscription: cleanedSubscriptions,
      },
    } as EventsToml
  }
}

export const eventsModule = new EventsModule()
