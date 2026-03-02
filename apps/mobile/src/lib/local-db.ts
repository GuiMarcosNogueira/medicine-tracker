import { openDatabaseAsync } from 'expo-sqlite';
import { Platform } from 'react-native';
import type { SQLiteDatabase } from 'expo-sqlite';
import type { MedicationSearchResult } from '@medstock/shared';

let _db: SQLiteDatabase | null = null;

export async function initLocalDb(): Promise<SQLiteDatabase> {
  if (_db) return _db;

  _db = await openDatabaseAsync('medstock.db');

  await _db.execAsync(`
    CREATE TABLE IF NOT EXISTS medications_cache (
      id   TEXT PRIMARY KEY,
      ean  TEXT,
      product_name       TEXT NOT NULL,
      generic_name       TEXT,
      active_ingredient  TEXT,
      concentration      TEXT,
      pharmaceutical_form TEXT,
      manufacturer       TEXT,
      reference_price    REAL,
      requires_prescription INTEGER NOT NULL DEFAULT 0,
      is_controlled      INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS inventory_cache (
      id           TEXT PRIMARY KEY,
      family_id    TEXT NOT NULL,
      medication_id TEXT,
      custom_name  TEXT,
      expiry_date  TEXT NOT NULL,
      quantity     REAL NOT NULL,
      unit         TEXT NOT NULL,
      lot_number   TEXT,
      location     TEXT,
      added_by     TEXT,
      _pending     INTEGER NOT NULL DEFAULT 1,
      created_at   TEXT NOT NULL
    );
  `);

  // FTS5 is only available on native (WASM SQLite for web lacks FTS5)
  if (Platform.OS !== 'web') {
    const versionRow = await _db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
    const dbVersion = versionRow?.user_version ?? 0;

    if (dbVersion < 2) {
      // v2: expand FTS5 with concentration + pharmaceutical_form
      await _db.execAsync(`
        DROP TRIGGER IF EXISTS meds_ai;
        DROP TRIGGER IF EXISTS meds_ad;
        DROP TRIGGER IF EXISTS meds_au;
        DROP TABLE IF EXISTS medications_fts;
      `);
    }

    await _db.execAsync(`
      CREATE VIRTUAL TABLE IF NOT EXISTS medications_fts USING fts5(
        product_name, generic_name, active_ingredient, concentration,
        pharmaceutical_form, manufacturer,
        content='medications_cache', content_rowid='rowid',
        tokenize='unicode61 remove_diacritics 2'
      );

      CREATE TRIGGER IF NOT EXISTS meds_ai AFTER INSERT ON medications_cache BEGIN
        INSERT INTO medications_fts(rowid, product_name, generic_name, active_ingredient, concentration, pharmaceutical_form, manufacturer)
        VALUES (new.rowid, new.product_name, new.generic_name, new.active_ingredient, new.concentration, new.pharmaceutical_form, new.manufacturer);
      END;

      CREATE TRIGGER IF NOT EXISTS meds_ad AFTER DELETE ON medications_cache BEGIN
        INSERT INTO medications_fts(medications_fts, rowid, product_name, generic_name, active_ingredient, concentration, pharmaceutical_form, manufacturer)
        VALUES ('delete', old.rowid, old.product_name, old.generic_name, old.active_ingredient, old.concentration, old.pharmaceutical_form, old.manufacturer);
      END;

      CREATE TRIGGER IF NOT EXISTS meds_au AFTER UPDATE ON medications_cache BEGIN
        INSERT INTO medications_fts(medications_fts, rowid, product_name, generic_name, active_ingredient, concentration, pharmaceutical_form, manufacturer)
        VALUES ('delete', old.rowid, old.product_name, old.generic_name, old.active_ingredient, old.concentration, old.pharmaceutical_form, old.manufacturer);
        INSERT INTO medications_fts(rowid, product_name, generic_name, active_ingredient, concentration, pharmaceutical_form, manufacturer)
        VALUES (new.rowid, new.product_name, new.generic_name, new.active_ingredient, new.concentration, new.pharmaceutical_form, new.manufacturer);
      END;
    `);

    if (dbVersion < 2) {
      await _db.execAsync(`INSERT INTO medications_fts(medications_fts) VALUES ('rebuild');`);
      await _db.runAsync('PRAGMA user_version = 2');
    }
  }

  return _db;
}

/**
 * Upsert medication search results into the local cache.
 * Called after successful Supabase RPC calls so offline search stays fresh.
 */
export async function cacheMedicationResults(results: MedicationSearchResult[]): Promise<void> {
  const db = await initLocalDb();
  for (const m of results) {
    await db.runAsync(
      `INSERT OR REPLACE INTO medications_cache
       (id, ean, product_name, generic_name, active_ingredient, concentration,
        pharmaceutical_form, manufacturer, reference_price, requires_prescription, is_controlled)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        m.id, m.ean, m.product_name, m.generic_name, m.active_ingredient,
        m.concentration, m.pharmaceutical_form, m.manufacturer, m.reference_price,
        m.requires_prescription ? 1 : 0, m.is_controlled ? 1 : 0,
      ],
    );
  }
}

// SQLite returns numbers for boolean columns; keep them typed as numbers here.
interface MedRow {
  id: string;
  ean: string | null;
  product_name: string;
  generic_name: string | null;
  active_ingredient: string | null;
  concentration: string | null;
  pharmaceutical_form: string | null;
  manufacturer: string | null;
  reference_price: number | null;
  requires_prescription: number;
  is_controlled: number;
}

function rowToResult(row: MedRow): MedicationSearchResult {
  return {
    id: row.id,
    ean: row.ean,
    product_name: row.product_name,
    generic_name: row.generic_name,
    active_ingredient: row.active_ingredient,
    concentration: row.concentration,
    pharmaceutical_form: row.pharmaceutical_form,
    presentation_dosage: null,
    pharma_form_friendly: null,
    quantity_count: null,
    quantity_volume: null,
    atc_code: null,
    atc_description: null,
    manufacturer: row.manufacturer,
    reference_price: row.reference_price,
    requires_prescription: Boolean(row.requires_prescription),
    is_controlled: Boolean(row.is_controlled),
    rank: 0,
  };
}

/**
 * Platform-branched local medication search.
 * - Native: FTS5 with prefix matching and diacritic removal
 * - Web: simple LIKE fallback
 */
export async function localSearchMedications(query: string): Promise<MedicationSearchResult[]> {
  const db = await initLocalDb();

  if (Platform.OS !== 'web') {
    // Sanitize: remove FTS5 special characters, append '*' for prefix match
    const safe = query.replace(/["'*^()]/g, '').trim();
    if (!safe) return [];
    const rows = await db.getAllAsync<MedRow>(
      `SELECT mc.* FROM medications_fts f
       JOIN medications_cache mc ON mc.rowid = f.rowid
       WHERE medications_fts MATCH ?
       LIMIT 20`,
      [`${safe}*`],
    );
    return rows.map(rowToResult);
  }

  const like = `%${query}%`;
  const rows = await db.getAllAsync<MedRow>(
    `SELECT * FROM medications_cache
     WHERE product_name LIKE ? OR active_ingredient LIKE ? OR generic_name LIKE ?
        OR concentration LIKE ? OR pharmaceutical_form LIKE ?
     LIMIT 20`,
    [like, like, like, like, like],
  );
  return rows.map(rowToResult);
}

export interface PendingInventoryItem {
  id: string;
  family_id: string;
  medication_id: string | null;
  custom_name: string | null;
  expiry_date: string;
  quantity: number;
  unit: string;
  lot_number: string | null;
  location: string | null;
  added_by: string | null;
  created_at: string;
}

export async function savePendingItem(item: PendingInventoryItem): Promise<void> {
  const db = await initLocalDb();
  await db.runAsync(
    `INSERT OR REPLACE INTO inventory_cache
     (id, family_id, medication_id, custom_name, expiry_date, quantity, unit,
      lot_number, location, added_by, _pending, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
    [
      item.id, item.family_id, item.medication_id, item.custom_name,
      item.expiry_date, item.quantity, item.unit, item.lot_number,
      item.location, item.added_by, item.created_at,
    ],
  );
}

export async function getPendingItems(): Promise<PendingInventoryItem[]> {
  const db = await initLocalDb();
  return db.getAllAsync<PendingInventoryItem>(
    'SELECT * FROM inventory_cache WHERE _pending = 1 ORDER BY created_at ASC',
    [],
  );
}

export async function deletePendingItem(id: string): Promise<void> {
  const db = await initLocalDb();
  await db.runAsync('DELETE FROM inventory_cache WHERE id = ?', [id]);
}
