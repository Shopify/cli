import {cliVersion} from './versions';

describe('cliVersion', () => {
  it('returns the version', async () => {
    // When
    const got = await cliVersion();

    // Then
    expect(got).not.toBe('');
  });
});
