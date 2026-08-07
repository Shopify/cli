import type {SectionDef} from '../types.js'

const REASON =
  'QA doc: "No need to run these anymore, themes have their own checklist" — owned by the themes team (#online-store-developer-platforms)'

export const themeSection: SectionDef = {
  title: 'Theme',
  steps: [
    {id: 'theme.init', doc: 'Create a theme: `shopify theme init`', kind: 'delegated', reason: REASON},
    {id: 'theme.check', doc: 'Run `shopify theme check --fail-level crash`', kind: 'delegated', reason: REASON},
    {id: 'theme.package', doc: 'Run `shopify theme package`', kind: 'delegated', reason: REASON},
    {id: 'theme.dev', doc: 'Run `shopify theme dev --store <your_store>` (+ hot reload checks)', kind: 'delegated', reason: REASON},
    {id: 'theme.push', doc: 'Run `shopify theme push`', kind: 'delegated', reason: REASON},
    {id: 'theme.list', doc: 'Run `shopify theme list`', kind: 'delegated', reason: REASON},
  ],
}
