export type LocalStore = {
  id: string;
  ownerId: string;
  name: string;
  currencyCode: string;
  timezone: string;
  updatedAt: string;
};

export type LocalInventoryItem = {
  id: string;
  storeId: string;
  name: string;
  aliases: string[];
  unit: string;
  price: number;
  currentStock: number;
  lowStockThreshold: number;
  updatedAt: string;
};
