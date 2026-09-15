import { describe, expect, it } from 'vitest';
import { buildDataSourceOptions } from './database.config.js';

describe('buildDataSourceOptions', () => {
  it('returns postgres options with schema sync disabled', () => {
    const options = buildDataSourceOptions({
      host: 'localhost',
      port: 5432,
      username: 'eventia',
      password: 'secret',
      database: 'eventia',
    });

    expect(options.type).toBe('postgres');
    expect(options.synchronize).toBe(false);
    expect(options.entities).toEqual([]);
  });
});