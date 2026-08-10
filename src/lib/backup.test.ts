import { describe, expect, it } from 'vitest';
import {
  BACKUP_APP_ID,
  BACKUP_SCHEMA_VERSION,
  BackupValidationError,
  buildBackup,
  countRows,
  parseBackup,
  validateBackup,
} from './backup';

const STORES = ['users', 'settings', 'exercises'];

describe('buildBackup', () => {
  it('wraps data in a versioned envelope', () => {
    const b = buildBackup({ users: [{ id: '1' }], settings: [], exercises: [] }, '2026-08-10T00:00:00Z');
    expect(b.app).toBe(BACKUP_APP_ID);
    expect(b.schema_version).toBe(BACKUP_SCHEMA_VERSION);
    expect(b.exported_at).toBe('2026-08-10T00:00:00Z');
    expect(countRows(b)).toBe(1);
  });
});

describe('validateBackup', () => {
  const good = buildBackup({ users: [{ id: '1' }], exercises: [] }, '2026-08-10T00:00:00Z');

  it('accepts a well-formed backup', () => {
    expect(() => validateBackup(good, STORES)).not.toThrow();
  });

  it('rejects non-objects', () => {
    expect(() => validateBackup(null, STORES)).toThrow(BackupValidationError);
    expect(() => validateBackup(42, STORES)).toThrow(BackupValidationError);
  });

  it('rejects a foreign app id', () => {
    expect(() => validateBackup({ ...good, app: 'other' }, STORES)).toThrow(/not a OneMoreRep/);
  });

  it('rejects a newer schema version', () => {
    expect(() => validateBackup({ ...good, schema_version: 99 }, STORES)).toThrow(/newer version/);
  });

  it('rejects unknown data tables (never silently drops data)', () => {
    const bad = buildBackup({ mystery: [{ id: '1' }] }, '2026-08-10T00:00:00Z');
    expect(() => validateBackup(bad, STORES)).toThrow(/unknown data table/);
  });

  it('rejects a non-array table', () => {
    const bad = { ...good, data: { users: { not: 'an array' } } };
    expect(() => validateBackup(bad, STORES)).toThrow(/not a list/);
  });
});

describe('parseBackup', () => {
  it('parses valid JSON text', () => {
    const text = JSON.stringify(buildBackup({ users: [] }, '2026-08-10T00:00:00Z'));
    expect(parseBackup(text, STORES).app).toBe(BACKUP_APP_ID);
  });

  it('rejects invalid JSON', () => {
    expect(() => parseBackup('{not json', STORES)).toThrow(/not valid JSON/);
  });
});
