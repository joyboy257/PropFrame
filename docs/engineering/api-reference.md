# API Reference

> Status: In progress. Endpoints listed as implemented.

---

## Authentication

All protected endpoints require a JWT in a `Authorization: Bearer <token>` header. Tokens are obtained via magic link login.

---

## Projects

### List projects
`GET /api/projects`

### Create project
`POST /api/projects`
```json
{ "name": "123 Main St" }
```

### Get project
`GET /api/projects/:id`

### Delete project
`DELETE /api/projects/:id`

---

## Photos

### List photos
`GET /api/projects/:projectId/photos`

### Upload — get presigned URL
`POST /api/upload/presign`
```json
{ "projectId": "uuid", "filename": "living-room.jpg", "contentType": "image/jpeg" }
```
Response:
```json
{ "url": "https://...", "key": "photo/userId/timestamp-living-room.jpg" }
```

### Confirm upload
`POST /api/upload/confirm`
```json
{ "projectId": "uuid", "key": "photo/userId/...", "filename": "living-room.jpg" }
```

---

## Clips

### Generate clip
`POST /api/clips/generate`
```json
{
  "projectId": "uuid",
  "photoId": "uuid",
  "motionStyle": "push-in",
  "resolution": "720p",
  "duration": 5.0,
  "customPrompt": "sunlit modern interior"
}
```
Response:
```json
{ "id": "uuid", "status": "queued", "cost": 1 }
```

### Get clip status
`GET /api/clips/:id`
```json
{ "id": "uuid", "status": "done", "publicUrl": "https://...", "errorMessage": null }
```

### Download clip
`GET /api/clips/:id/download` — redirects to R2 public URL.

---

## Billing

### Get balance
`GET /api/billing/balance`
```json
{ "credits": 1000 }
```

### Create checkout session
`POST /api/billing/checkout`
```json
{ "credits": 25000, "successUrl": "https://...", "cancelUrl": "https://..." }
```
Response:
```json
{ "url": "https://checkout.stripe.com/..." }
```

### List transactions
`GET /api/billing/transactions`

---

## Webhooks

### Stripe
`POST /api/webhooks/stripe` — handles `checkout.session.completed` and grants credits.

---

## Error format

All errors return:
```json
{ "error": "description of what went wrong" }
```

| Status | Meaning |
|---|---|
| 400 | Bad request — invalid input |
| 401 | Unauthorized — missing or invalid JWT |
| 403 | Forbidden — valid JWT but not the resource owner |
| 404 | Not found |
| 429 | Rate limited |
| 500 | Internal error |
