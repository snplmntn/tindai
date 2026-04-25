import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { app } from '../app';
import { getSupabaseAdminClient } from '../config/supabase';
import {
  archiveInventoryItemForOwner,
  createInventoryItemForOwner,
  getInventoryItemForOwner,
  listInventoryItemsForOwner,
  updateInventoryItemForOwner,
} from '../models/inventory.model';

vi.mock('../config/supabase', () => ({
  getSupabaseAdminClient: vi.fn(),
}));

vi.mock('../models/inventory.model', () => ({
  listInventoryItemsForOwner: vi.fn(),
  getInventoryItemForOwner: vi.fn(),
  createInventoryItemForOwner: vi.fn(),
  updateInventoryItemForOwner: vi.fn(),
  archiveInventoryItemForOwner: vi.fn(),
  InventoryModelError: class InventoryModelError extends Error {
    status: number;

    constructor(status: number, message: string) {
      super(message);
      this.status = status;
    }
  },
}));

const mockedGetSupabaseAdminClient = vi.mocked(getSupabaseAdminClient);
const mockedListInventoryItemsForOwner = vi.mocked(listInventoryItemsForOwner);
const mockedGetInventoryItemForOwner = vi.mocked(getInventoryItemForOwner);
const mockedCreateInventoryItemForOwner = vi.mocked(createInventoryItemForOwner);
const mockedUpdateInventoryItemForOwner = vi.mocked(updateInventoryItemForOwner);
const mockedArchiveInventoryItemForOwner = vi.mocked(archiveInventoryItemForOwner);

function mockAuthenticatedUser() {
  mockedGetSupabaseAdminClient.mockReturnValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: {
          user: {
            id: 'user-123',
            email: 'owner@tindai.app',
            app_metadata: {},
            user_metadata: {},
          },
        },
        error: null,
      }),
    },
  } as never);
}

const itemFixture = {
  id: 'item-1',
  name: 'Coke Mismo',
  aliases: ['coke', 'coke mismo'],
  unit: 'pcs',
  cost: 14,
  price: 20,
  currentStock: 4,
  lowStockThreshold: 5,
  updatedAt: '2026-04-25T00:00:00.000Z',
  isLowStock: true,
};

describe('Inventory routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lists inventory items for the authenticated owner', async () => {
    mockAuthenticatedUser();
    mockedListInventoryItemsForOwner.mockResolvedValue([itemFixture]);

    const response = await request(app)
      .get('/api/v1/inventory/items')
      .set('Authorization', 'Bearer valid-token')
      .query({
        search: 'coke',
        sort: 'stock_asc',
        lowStockOnly: 'true',
      })
      .expect(200);

    expect(mockedListInventoryItemsForOwner).toHaveBeenCalledWith('user-123', {
      lowStockOnly: true,
      search: 'coke',
      sort: 'stock_asc',
    });
    expect(response.body).toEqual({
      items: [itemFixture],
    });
  });

  it('returns 400 when create payload includes current stock fields', async () => {
    mockAuthenticatedUser();

    const response = await request(app)
      .post('/api/v1/inventory/items')
      .set('Authorization', 'Bearer valid-token')
      .send({
        name: 'Coke Mismo',
        price: 20,
        currentStock: 4,
      })
      .expect(400);

    expect(response.body).toEqual({
      message: 'Stock values must go through the normal sync flow.',
    });
  });

  it('returns item detail for the authenticated owner', async () => {
    mockAuthenticatedUser();
    mockedGetInventoryItemForOwner.mockResolvedValue(itemFixture);

    const response = await request(app)
      .get('/api/v1/inventory/items/item-1')
      .set('Authorization', 'Bearer valid-token')
      .expect(200);

    expect(mockedGetInventoryItemForOwner).toHaveBeenCalledWith('user-123', 'item-1');
    expect(response.body).toEqual({
      item: itemFixture,
    });
  });

  it('creates metadata-only inventory items', async () => {
    mockAuthenticatedUser();
    mockedCreateInventoryItemForOwner.mockResolvedValue(itemFixture);

    const response = await request(app)
      .post('/api/v1/inventory/items')
      .set('Authorization', 'Bearer valid-token')
      .send({
        name: 'Coke Mismo',
        aliases: ['coke'],
        price: 20,
      })
      .expect(201);

    expect(mockedCreateInventoryItemForOwner).toHaveBeenCalledWith('user-123', {
      aliases: ['coke'],
      name: 'Coke Mismo',
      price: 20,
    });
    expect(response.body).toEqual({
      item: itemFixture,
    });
  });

  it('updates metadata-only inventory fields', async () => {
    mockAuthenticatedUser();
    mockedUpdateInventoryItemForOwner.mockResolvedValue({
      ...itemFixture,
      price: 22,
    });

    const response = await request(app)
      .patch('/api/v1/inventory/items/item-1')
      .set('Authorization', 'Bearer valid-token')
      .send({
        price: 22,
      })
      .expect(200);

    expect(mockedUpdateInventoryItemForOwner).toHaveBeenCalledWith('user-123', 'item-1', {
      price: 22,
    });
    expect(response.body).toEqual({
      item: {
        ...itemFixture,
        price: 22,
      },
    });
  });

  it('archives inventory items for the authenticated owner', async () => {
    mockAuthenticatedUser();
    mockedArchiveInventoryItemForOwner.mockResolvedValue(itemFixture);

    const response = await request(app)
      .post('/api/v1/inventory/items/item-1/archive')
      .set('Authorization', 'Bearer valid-token')
      .expect(200);

    expect(mockedArchiveInventoryItemForOwner).toHaveBeenCalledWith('user-123', 'item-1');
    expect(response.body).toEqual({
      item: itemFixture,
    });
  });
});
