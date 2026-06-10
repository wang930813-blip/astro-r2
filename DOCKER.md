# Docker Deployment

Use this when the server OS cannot run Node 20 directly. Docker runs Node 20
inside the container.

## First Deploy

On the server:

```bash
cd /www/wwwroot/astro-r2
git pull
cp .env.example .env
nano .env
docker compose up -d --build
```

If your server uses the older Compose command:

```bash
docker-compose up -d --build
```

The app listens on port `3000` inside the container and `3030` on the server.
Configure Nginx or the BaoTa reverse proxy to:

```text
http://127.0.0.1:3030
```

## Update

```bash
cd /www/wwwroot/astro-r2
git pull
docker compose up -d --build
```

## Logs

```bash
docker logs -f shengzhifile
```

## Stop

```bash
docker compose down
```

## Required `.env`

Keep `.env` on the server. It is not copied into the image.

Required values include:

```env
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=
R2_ENDPOINT=
R2_PUBLIC_URL=
ADMIN_PASSWORD=
EXTERNAL_API_TOKEN=
API_CORS_ORIGINS=
MAX_FILE_SIZE=10485760
```
