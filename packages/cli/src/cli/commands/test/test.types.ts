export interface TestFlags {
  url: string
  'skip-cookies': boolean
  'skip-collection': boolean
  device: string
  'no-color': boolean
  'no-headless': boolean
  verbose: boolean
  locators: string
}
