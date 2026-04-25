import type * as SQLite from 'expo-sqlite';

import { LOCAL_INDEX_STATEMENTS, getCreateTableStatements } from './localSchema';

export async function runLocalMigrations(database: SQLite.SQLiteDatabase) {
  await database.execAsync('pragma foreign_keys = on');

  for (const statement of getCreateTableStatements()) {
    await database.execAsync(statement);
  }

  for (const statement of LOCAL_INDEX_STATEMENTS) {
    await database.execAsync(statement);
  }
}
