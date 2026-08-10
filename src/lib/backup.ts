/**
 * JSON export / import — the only v1 backup, so it's validated carefully.
 * A backup is a plain, versioned envelope wrapping every store's rows. The
 * repository owns the actual DB read/write; these helpers build and validate
 * the envelope (pure, unit-tested).
 */

export const BACKUP_APP_ID = 'onemorerep';
export const BACKUP_SCHEMA_VERSION = 1;

export interface BackupFile {
  app: string;
  schema_version: number;
  exported_at: string;
  data: Record<string, unknown[]>;
}

/** Build a backup envelope from per-store row arrays. */
export function buildBackup(
  data: Record<string, unknown[]>,
  exportedAt: string,
): BackupFile {
  return {
    app: BACKUP_APP_ID,
    schema_version: BACKUP_SCHEMA_VERSION,
    exported_at: exportedAt,
    data,
  };
}

export class BackupValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BackupValidationError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Validate an untrusted parsed object as a backup. Throws
 * {@link BackupValidationError} with a human message on any problem. Returns a
 * normalized {@link BackupFile} on success.
 *
 * `knownStores` are the store names the app understands; every store present
 * in `data` must map to an array, and any known store may be absent (treated
 * as empty on import). Unknown extra store keys are rejected so a mismatched
 * file can't silently drop data.
 */
export function validateBackup(raw: unknown, knownStores: readonly string[]): BackupFile {
  if (!isRecord(raw)) {
    throw new BackupValidationError('Not a valid backup file (expected a JSON object).');
  }
  if (raw.app !== BACKUP_APP_ID) {
    throw new BackupValidationError('This file is not a OneMoreRep backup.');
  }
  if (typeof raw.schema_version !== 'number' || !Number.isInteger(raw.schema_version)) {
    throw new BackupValidationError('Backup is missing a valid schema version.');
  }
  if (raw.schema_version > BACKUP_SCHEMA_VERSION) {
    throw new BackupValidationError(
      `Backup was made by a newer version (schema ${raw.schema_version}). Update the app first.`,
    );
  }
  if (!isRecord(raw.data)) {
    throw new BackupValidationError('Backup is missing its data section.');
  }

  const known = new Set(knownStores);
  const data: Record<string, unknown[]> = {};
  for (const [store, rows] of Object.entries(raw.data)) {
    if (!known.has(store)) {
      throw new BackupValidationError(`Backup contains an unknown data table: "${store}".`);
    }
    if (!Array.isArray(rows)) {
      throw new BackupValidationError(`Data table "${store}" is not a list.`);
    }
    data[store] = rows;
  }

  return {
    app: BACKUP_APP_ID,
    schema_version: raw.schema_version,
    exported_at: typeof raw.exported_at === 'string' ? raw.exported_at : '',
    data,
  };
}

/** Parse a JSON string and validate it as a backup. */
export function parseBackup(text: string, knownStores: readonly string[]): BackupFile {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new BackupValidationError('File is not valid JSON.');
  }
  return validateBackup(parsed, knownStores);
}

/** Count total rows across all stores (for a friendly import/export summary). */
export function countRows(backup: BackupFile): number {
  return Object.values(backup.data).reduce((sum, rows) => sum + rows.length, 0);
}
