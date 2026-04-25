import { ClientTabLayout } from '@/components/ClientTabLayout';

export function InventoryScreen() {
  return (
    <ClientTabLayout
      label="Inventory"
      title="Stay close to stock movement."
      subtitle="Use this view to track stock levels, low-stock items, and recent updates."
      highlights={['64 tracked SKUs ready', '8 items need restock review', '2 warehouse updates landed today']}
    />
  );
}
