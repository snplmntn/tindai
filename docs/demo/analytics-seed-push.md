# Analytics Seed Push Guide

Use this payload to create enough verified transactions for the analytics tabs:

- Payload: [`docs/demo/analytics-seed-payload.json`](/Users/antoniod.castilloiii/Desktop/tindai/docs/demo/analytics-seed-payload.json)
- Endpoint: `POST /api/v1/verify-transactions`

## 1) Push seed transactions

```bash
curl -X POST "$API_BASE_URL/api/v1/verify-transactions" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  --data-binary @docs/demo/analytics-seed-payload.json
```

Expected response shape:

```json
{
  "storeId": "your-store-id",
  "results": [
    {
      "clientMutationId": "analytics-seed-20260425-001",
      "status": "synced"
    }
  ]
}
```

## 2) Fetch analytics summary

```bash
curl -X GET "$API_BASE_URL/api/v1/analytics/summary" \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

## Notes

- The sync endpoint is idempotent per `clientMutationId`, so this exact payload is meant for one-time seeding.
- If you need to seed again in the same store, change the `clientMutationId` prefix (for example, `analytics-seed-20260426-*`) before re-pushing.
