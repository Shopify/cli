export const TESTING_PACKAGE_NAME = '@shopify/dev-platform-auth/testing'

export {authFixtures, fakeClientId, fixtureOrigin} from './fixtures.js'
export type {
  AuthFixture,
  AuthFixtureRequest,
  AuthFixtureResponse,
  FixtureExpected,
  FixtureOperation,
} from './fixtures.js'
export {createFixtureFetch, runFixtureTransport} from './harness.js'
