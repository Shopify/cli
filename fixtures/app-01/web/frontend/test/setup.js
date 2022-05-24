import "@shopify/react-testing/matchers";

import "vi-fetch/setup";
import { mockFetch } from "vi-fetch";

beforeEach(() => {
  mockFetch.clearAll();
});
