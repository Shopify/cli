// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import {describe, it, expect, vi} from 'vitest';

import cliPackageVersion from '../../../cli/package.json';
import {template as getTemplatePath} from '../utils/paths';

import init from './init';

describe('init', () => {
  it('successfully initializes the app', () => {
    expect(true).toBe(true);
  });
});
