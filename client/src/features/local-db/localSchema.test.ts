import { describe, expect, it } from 'vitest';

import { LOCAL_SCHEMA_TABLES, getCreateTableStatements } from './localSchema';

describe('local SQLite schema', () => {
  it('creates every PRD local table needed for offline inventory and sync', () => {
    expect(LOCAL_SCHEMA_TABLES).toEqual([
      'app_state',
      'stores',
      'inventory_items',
      'customers',
      'transactions',
      'transaction_items',
      'inventory_movements',
      'utang_entries',
      'sync_events',
      'assistant_interactions',
    ]);
  });

  it('keeps store-scoped tables tied to store_id and syncable mutation ids', () => {
    const schema = getCreateTableStatements().join('\n');

    expect(schema).toContain('mode text not null default \'guest\'');
    expect(schema).toContain('guest_device_id text not null');
    expect(schema).toContain('owner_user_id text not null');
    expect(schema).toContain('client_mutation_id text not null');
    expect(schema).toContain('sync_status text not null');
    expect(schema).toContain('local_parse_json text');
    expect(schema).toContain('gemini_verification_json text');
  });
});
