# External API

This app exposes image upload, listing, and delete APIs for external callers.
Browser admin sessions still use the existing login cookie. External callers
should use a bearer token.

## Configuration

Add these values to `.env` on the server:

```env
EXTERNAL_API_TOKEN=replace-with-a-long-random-token
API_CORS_ORIGINS=https://your-client.example.com
```

`EXTERNAL_API_TOKEN` enables external API access. Use a long random secret and
send it in the `Authorization` header.

`API_CORS_ORIGINS` controls browser cross-origin access. Leave it empty to
disable CORS. Set it to `*` to allow all origins, or use a comma-separated
allowlist:

```env
API_CORS_ORIGINS=https://a.example.com,https://b.example.com
```

After changing `.env`, restart the server.

## Authentication

All image APIs require one of these authentication methods:

- Existing admin login cookie from `/api/auth/login`
- External bearer token:

```http
Authorization: Bearer replace-with-a-long-random-token
```

Invalid or missing credentials return:

```json
{
  "error": "Authentication required"
}
```

## Upload Image

```http
POST /api/upload
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

Form fields:

- `file`: image file. Required.
- `useHashName`: `true` or `false`. Optional. When `true`, stores the upload
  with a generated name.

Allowed image types:

- `image/jpeg`
- `image/png`
- `image/gif`
- `image/webp`
- `image/svg+xml`

Example:

```bash
curl -X POST "https://your-domain.example.com/api/upload" \
  -H "Authorization: Bearer $EXTERNAL_API_TOKEN" \
  -F "file=@./image.webp" \
  -F "useHashName=true"
```

Success response:

```json
{
  "success": true,
  "data": {
    "key": "2026-05-19/example.webp",
    "url": "https://cdn.example.com/2026-05-19/example.webp",
    "size": 12345,
    "mimeType": "image/webp",
    "uploadedAt": "2026-05-19T08:00:00.000Z"
  }
}
```

## List Images

```http
GET /api/images
Authorization: Bearer <token>
```

Query parameters:

- `limit`: number of images to return. Optional. Default `60`, maximum `100`.
- `cursor`: pagination cursor from the previous response. Optional.
- `prefix`: object key prefix filter. Optional.

Example:

```bash
curl "https://your-domain.example.com/api/images?limit=60&prefix=2026-05-19/" \
  -H "Authorization: Bearer $EXTERNAL_API_TOKEN"
```

Success response:

```json
{
  "success": true,
  "data": [
    {
      "key": "2026-05-19/example.webp",
      "url": "https://cdn.example.com/2026-05-19/example.webp",
      "size": 12345,
      "mimeType": "image/webp",
      "uploadedAt": "2026-05-19T08:00:00.000Z"
    }
  ],
  "pagination": {
    "nextCursor": "cursor-value",
    "hasMore": true
  }
}
```

To fetch the next page, pass `pagination.nextCursor` back as `cursor`.

## Delete Images

```http
DELETE /api/images
Authorization: Bearer <token>
Content-Type: application/json
```

Request body, single image:

```json
{
  "key": "2026-05-19/example.webp"
}
```

Request body, multiple images:

```json
{
  "keys": [
    "2026-05-19/example.webp",
    "2026-05-19/another.webp"
  ]
}
```

Example:

```bash
curl -X DELETE "https://your-domain.example.com/api/images" \
  -H "Authorization: Bearer $EXTERNAL_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"key":"2026-05-19/example.webp"}'
```

Success response:

```json
{
  "success": true,
  "deleted": [
    "2026-05-19/example.webp"
  ],
  "failed": []
}
```

Partial failure response:

```json
{
  "success": false,
  "deleted": [
    "2026-05-19/example.webp"
  ],
  "failed": [
    {
      "key": "2026-05-19/missing.webp",
      "error": "Delete failed"
    }
  ]
}
```

## CORS Preflight

When `API_CORS_ORIGINS` allows the request origin, the API responds to browser
preflight requests:

```http
OPTIONS /api/images
OPTIONS /api/upload
```

Allowed methods:

```text
GET, POST, DELETE, OPTIONS
```

Allowed headers:

```text
Authorization, Content-Type
```

## Error Statuses

- `400`: invalid input, missing file, unsupported file type, missing delete key.
- `401`: missing or invalid authentication.
- `405`: unsupported HTTP method.
- `500`: server, R2, or configuration error.
