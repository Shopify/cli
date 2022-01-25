import {
  isDebug,
  isRelease,
  partnersApiEnvironment,
  adminApiEnvironment,
  storefrontRendererApiEnvironment,
  identityEnvironment,
} from './environment';
import {Environment} from './network/service';

describe('isDebug', () => {
  it('returns true when SHOPIFY_CONFIG is debug', () => {
    // Given
    const env = {SHOPIFY_CONFIG: 'debug'};

    // When
    const got = isDebug(env);

    // Then
    expect(got).toBe(true);
  });
});

describe('isRelease', () => {
  it("returns true when SHOPIFY_CONFIG isn't defined", () => {
    // Given
    const env = {};

    // When
    const got = isRelease(env);

    // Then
    expect(got).toBe(true);
  });
});

describe('partnersApiEnvironment', () => {
  it('returns local when the environment variable points to the local environment', () => {
    // Given
    const env = {SHOPIFY_PARTNERS_API_ENV: 'local'};

    // When
    const got = partnersApiEnvironment(env);

    // Then
    expect(got).toBe(Environment.Local);
  });

  it('returns Spin when the environment variable points to the spin environment', () => {
    // Given
    const env = {SHOPIFY_PARTNERS_API_ENV: 'spin'};

    // When
    const got = partnersApiEnvironment(env);

    // Then
    expect(got).toBe(Environment.Spin);
  });

  it('returns Production when the environment variable points to the production environment', () => {
    // Given
    const env = {SHOPIFY_PARTNERS_API_ENV: 'production'};

    // When
    const got = partnersApiEnvironment(env);

    // Then
    expect(got).toBe(Environment.Production);
  });

  it("returns Production when the environment variable doesn't exist", () => {
    // Given
    const env = {};

    // When
    const got = partnersApiEnvironment(env);

    // Then
    expect(got).toBe(Environment.Production);
  });
});

describe('adminApiEnvironment', () => {
  it('returns local when the environment variable points to the local environment', () => {
    // Given
    const env = {SHOPIFY_ADMIN_API_ENV: 'local'};

    // When
    const got = adminApiEnvironment(env);

    // Then
    expect(got).toBe(Environment.Local);
  });

  it('returns Spin when the environment variable points to the spin environment', () => {
    // Given
    const env = {SHOPIFY_ADMIN_API_ENV: 'spin'};

    // When
    const got = adminApiEnvironment(env);

    // Then
    expect(got).toBe(Environment.Spin);
  });

  it('returns Production when the environment variable points to the production environment', () => {
    // Given
    const env = {SHOPIFY_ADMIN_API_ENV: 'production'};

    // When
    const got = adminApiEnvironment(env);

    // Then
    expect(got).toBe(Environment.Production);
  });

  it("returns Production when the environment variable doesn't exist", () => {
    // Given
    const env = {};

    // When
    const got = adminApiEnvironment(env);

    // Then
    expect(got).toBe(Environment.Production);
  });
});

describe('storefrontRendererApiEnvironment', () => {
  it('returns local when the environment variable points to the local environment', () => {
    // Given
    const env = {SHOPIFY_STOREFRONT_RENDERER_API_ENV: 'local'};

    // When
    const got = storefrontRendererApiEnvironment(env);

    // Then
    expect(got).toBe(Environment.Local);
  });

  it('returns Spin when the environment variable points to the spin environment', () => {
    // Given
    const env = {SHOPIFY_STOREFRONT_RENDERER_API_ENV: 'spin'};

    // When
    const got = storefrontRendererApiEnvironment(env);

    // Then
    expect(got).toBe(Environment.Spin);
  });

  it('returns Production when the environment variable points to the production environment', () => {
    // Given
    const env = {SHOPIFY_STOREFRONT_RENDERER_API_ENV: 'production'};

    // When
    const got = storefrontRendererApiEnvironment(env);

    // Then
    expect(got).toBe(Environment.Production);
  });

  it("returns Production when the environment variable doesn't exist", () => {
    // Given
    const env = {};

    // When
    const got = storefrontRendererApiEnvironment(env);

    // Then
    expect(got).toBe(Environment.Production);
  });
});

describe('identityEnvironment', () => {
  it('returns local when the environment variable points to the local environment', () => {
    // Given
    const env = {SHOPIFY_IDENTITY_ENV: 'local'};

    // When
    const got = identityEnvironment(env);

    // Then
    expect(got).toBe(Environment.Local);
  });

  it('returns Spin when the environment variable points to the spin environment', () => {
    // Given
    const env = {SHOPIFY_IDENTITY_ENV: 'spin'};

    // When
    const got = identityEnvironment(env);

    // Then
    expect(got).toBe(Environment.Spin);
  });

  it('returns Production when the environment variable points to the production environment', () => {
    // Given
    const env = {SHOPIFY_IDENTITY_ENV: 'production'};

    // When
    const got = identityEnvironment(env);

    // Then
    expect(got).toBe(Environment.Production);
  });

  it("returns Production when the environment variable doesn't exist", () => {
    // Given
    const env = {};

    // When
    const got = identityEnvironment(env);

    // Then
    expect(got).toBe(Environment.Production);
  });
});
