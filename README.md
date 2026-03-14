# plik Filer

Self-hosted file sharing web app for exchanging files with clients and customers. Built for creative professionals who need a private, reliable way to send and receive large files without relying on third-party cloud services.

## Features

- **Large file uploads** — Resumable uploads via the [tus protocol](https://tus.io), supporting files up to 100 GB with pause/resume
- **Customer accounts** — Invite customers via unique links, each with their own private file area
- **Folders** — Organize files in subfolders
- **Thumbnails** — Auto-generated previews for images and video files (via ffmpeg)
- **Share links** — Create temporary download links with configurable expiry
- **Admin panel** — Dashboard with stats, manage users/permissions/quotas, browse customer files
- **Authentication** — Password + WebAuthn passkey support
- **Branding** — Custom logo and service name
- **Dark/Light theme** — Auto-detects system preference, user-configurable
- **Multi-language** — Swedish and English (auto-detected from browser)
- **Email** — SMTP integration for invitations and password resets
- **Storage quotas** — Per-user configurable limits

## Tech stack

- [Nuxt 3](https://nuxt.com) (Vue 3 + Nitro server)
- [SQLite](https://sqlite.org) with [Drizzle ORM](https://orm.drizzle.team)
- [tus](https://tus.io) for resumable uploads
- [sharp](https://sharp.pixelplumbing.com) + [ffmpeg](https://ffmpeg.org) for thumbnails
- [Hugeicons](https://hugeicons.com) icon set
- Docker for deployment

## Quick start with Docker Compose

### 1. Create a directory and config

```bash
mkdir plik-filer && cd plik-filer
```

Create a `docker-compose.yml`:

```yaml
services:
  plik-filer:
    image: ghcr.io/einord/plik-filer:latest
    container_name: plik-filer
    restart: unless-stopped
    ports:
      - "3000:3000"
    volumes:
      # User files
      - ./data:/app/data
      # SQLite database
      - ./database:/app/database
    environment:
      - NODE_ENV=production
      # IMPORTANT: Change to a long random secret
      - NUXT_JWT_SECRET=change-this-to-a-random-secret-string
      # Your public URL (used for invitation/reset links)
      - NUXT_ORIGIN=https://files.example.com
```

### 2. Start

```bash
docker compose up -d
```

### 3. First-time setup

Open `http://localhost:3000` (or your domain) and create your admin account.

## Synology NAS deployment

### Using Container Manager

1. Open **Container Manager** on your Synology NAS
2. Go to **Project** → **Create**
3. Set a project name (e.g., `plik-filer`)
4. Choose a path for the project (e.g., `/volume1/docker/plik-filer`)
5. Paste the `docker-compose.yml` content from above, adjusting:
   - Volumes to use Synology paths:
     ```yaml
     volumes:
       - /volume1/docker/plik-filer/data:/app/data
       - /volume1/docker/plik-filer/database:/app/database
     ```
   - Set a proper `NUXT_JWT_SECRET` (generate one with `openssl rand -base64 32`)
   - Set `NUXT_ORIGIN` to your domain
6. Click **Build** / **Deploy**

### Reverse proxy (HTTPS)

plik Filer should be served over HTTPS (required for passkeys). Configure your reverse proxy to forward traffic to port 3000:

**Nginx example:**
```nginx
server {
    listen 443 ssl;
    server_name files.example.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    client_max_body_size 0;  # No upload size limit (handled by the app)

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        # Disable buffering for tus uploads
        proxy_buffering off;
        proxy_request_buffering off;
    }
}
```

> **Important:** Set `client_max_body_size 0;` to disable nginx's upload limit — file size limits are enforced by the app itself.

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `NODE_ENV` | `production` | Set to `production` for deployment |
| `NUXT_JWT_SECRET` | — | **Required.** Secret key for session tokens |
| `NUXT_ORIGIN` | `http://localhost:3000` | Public URL (used in emails and share links) |
| `NUXT_DATA_PATH` | `/app/data` | Path for user file storage |
| `NUXT_DATABASE_PATH` | `/app/database/plik.db` | Path for SQLite database file |
| `NUXT_PUBLIC_APP_NAME` | `plik Filer` | Default app name (can be changed in admin) |

## Development

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Building the Docker image

```bash
# Build for local architecture
docker build -t plik-filer .

# Build for amd64 (e.g., Synology NAS)
docker buildx build --platform linux/amd64 -t plik-filer .
```

## License

Private repository. All rights reserved.
