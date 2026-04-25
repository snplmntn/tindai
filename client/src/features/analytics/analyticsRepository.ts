import type * as SQLite from 'expo-sqlite';

import { getLocalDatabase } from '@/features/local-db/database';

import type { AnalyticsSalesRow } from './buildAnalyticsViewModel';

type SalesRowRecord = {
  item_id: string;
  item_name: string;
  unit: string;
  quantity_delta: number;
  unit_price: number;
  line_total: number;
  occurred_at: string;
  is_utang: number;
};

export class AnalyticsRepository {
  constructor(private readonly database: Pick<SQLite.SQLiteDatabase, 'getAllAsync'>) {}

  async listSalesRows(storeId: string): Promise<AnalyticsSalesRow[]> {
    const rows = await this.database.getAllAsync<SalesRowRecord>(
      `select
         ti.item_id,
         i.name as item_name,
         i.unit as unit,
         ti.quantity_delta,
         ti.unit_price,
         ti.line_total,
         t.created_at as occurred_at,
         t.is_utang
       from transaction_items ti
       inner join transactions t on t.id = ti.transaction_id
       inner join inventory_items i on i.id = ti.item_id
       where ti.store_id = ?
         and ti.quantity_delta < 0
       order by t.created_at desc`,
      [storeId],
    );

    return rows.map((row: SalesRowRecord) => ({
      itemId: row.item_id,
      itemName: row.item_name,
      unit: row.unit,
      quantityDelta: Number(row.quantity_delta),
      unitPrice: Number(row.unit_price),
      lineTotal: Number(row.line_total),
      occurredAt: row.occurred_at,
      isUtang: Boolean(row.is_utang),
    }));
  }
}

export async function loadAnalyticsSalesRows(storeId: string) {
  const database = await getLocalDatabase();
  return new AnalyticsRepository(database).listSalesRows(storeId);
}
