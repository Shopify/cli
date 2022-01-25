import {isDebug} from './environment';

describe('isDebug', () => {
  it('returns true when SHOPIFY_CLI_DEBUG is truthy', () => {
    // Given
    const env = {SHOPIFY_CLI_DEBUG: '1'};

    // When
    const got = isDebug(env);

    // Then
    expect(got).toBe(true);
  });
});
