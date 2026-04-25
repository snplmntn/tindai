import * as SQLite from 'expo-sqlite';

let databasePromise: Promise<SQLite.SQLiteDatabase> | null = null;

export function getLocalDatabase() {
  if (!databasePromise) {
    databasePromise = SQLite.openDatabaseAsync('tindai.db');
  }

  return databasePromise;
}
