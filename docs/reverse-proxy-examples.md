# Reverse Proxy Configuration Examples

When using Readspace with a custom domain, you'll need to configure your reverse proxy to route traffic to the three main services. This guide provides configuration examples for the most popular reverse proxy solutions.

## Service Overview

Readspace consists of three services that need to be exposed:

| Service         | Container Name  | Internal Port | Host Port | Subdomain Example      |
| --------------- | --------------- | ------------- | --------- | ---------------------- |
| Web Application | `readspace_web` | `8042`        | `18042`   | `app.example.com`      |
| API Server      | `readspace_api` | `8008`        | `18008`   | `api.example.com`      |
| Supabase        | `kong`          | `8000`        | `18000`   | `supabase.example.com` |
| Meilisearch     | `meilisearch`   | `7700`        | `7700`    | `search.example.com`   |

### Important: Choosing the Right Port

The port you use depends on where your reverse proxy is running:

**🐳 Reverse Proxy in Docker (same network as Readspace)**

- Use container names with internal ports
- Example: `readspace_web:8042`, `readspace_api:8008`, `kong:8000`
- Common for: Traefik, Caddy in Docker, nginx in Docker

**💻 Reverse Proxy on Host (installed directly on server)**

- Use `localhost` with host ports
- Example: `localhost:18042`, `localhost:18008`, `localhost:18000`
- Common for: nginx via apt/yum, Caddy binary, Apache, nginx Proxy Manager

⚠️ **Using the wrong ports will result in "502 Bad Gateway" or "Connection Refused" errors.**

## Prerequisites

Before configuring your reverse proxy:

1. ✅ Run `./docker/setup.sh` and select option 2 (Custom domain)
2. ✅ Configure DNS A records pointing your subdomains to your server's IP
3. ✅ Ensure your reverse proxy can access the Docker network or host ports
4. ✅ Have SSL certificates ready (or use automatic provisioning with Let's Encrypt)

---

## Traefik (Docker Labels)

Traefik is popular for Docker-based setups and can automatically discover services using labels.

### Configuration

Add these labels to `docker/docker-compose.yml`:

```yaml
services:
  web:
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.readspace-web.rule=Host(`app.example.com`)"
      - "traefik.http.routers.readspace-web.entrypoints=websecure"
      - "traefik.http.routers.readspace-web.tls.certresolver=letsencrypt"
      - "traefik.http.services.readspace-web.loadbalancer.server.port=8042"

  api:
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.readspace-api.rule=Host(`api.example.com`)"
      - "traefik.http.routers.readspace-api.entrypoints=websecure"
      - "traefik.http.routers.readspace-api.tls.certresolver=letsencrypt"
      - "traefik.http.services.readspace-api.loadbalancer.server.port=8008"

  meilisearch:
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.readspace-search.rule=Host(`search.example.com`)"
      - "traefik.http.routers.readspace-search.entrypoints=websecure"
      - "traefik.http.routers.readspace-search.tls.certresolver=letsencrypt"
      - "traefik.http.services.readspace-search.loadbalancer.server.port=7700"
```

For Supabase, add labels to the `kong` service in `docker/supabase/docker-compose.yml`:

```yaml
services:
  kong:
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.readspace-supabase.rule=Host(`supabase.example.com`)"
      - "traefik.http.routers.readspace-supabase.entrypoints=websecure"
      - "traefik.http.routers.readspace-supabase.tls.certresolver=letsencrypt"
      - "traefik.http.services.readspace-supabase.loadbalancer.server.port=8000"
```

**Note**: Replace `letsencrypt` with your Traefik certificate resolver name.

---

## nginx Proxy Manager (NPM)

nginx Proxy Manager provides a web UI for managing reverse proxy configurations, making it ideal for users who prefer a graphical interface.

### Configuration Steps

1. **Log into nginx Proxy Manager** (usually at `http://your-server:81`)

2. **Add three Proxy Hosts**:

   **Proxy Host 1 - Web Application**
   - Domain Names: `app.example.com`
   - Scheme: `http`
   - Forward Hostname/IP: `readspace_web` (or `localhost` if NPM is on host)
   - Forward Port: `8042`
   - Enable: ☑ Websockets Support
   - SSL Tab: ☑ Request a new SSL Certificate (Let's Encrypt)

   **Proxy Host 2 - API Server**
   - Domain Names: `api.example.com`
   - Scheme: `http`
   - Forward Hostname/IP: `readspace_api` (or `localhost`)
   - Forward Port: `8008`
   - Enable: ☑ Websockets Support
   - SSL Tab: ☑ Request a new SSL Certificate

   **Proxy Host 3 - Supabase**
   - Domain Names: `supabase.example.com`
   - Scheme: `http`
   - Forward Hostname/IP: `kong` (or `localhost`)
   - Forward Port: `8000`
   - Enable: ☑ Websockets Support
   - SSL Tab: ☑ Request a new SSL Certificate

   **Proxy Host 4 - Meilisearch**
   - Domain Names: `search.example.com`
   - Scheme: `http`
   - Forward Hostname/IP: `meilisearch` (or `localhost`)
   - Forward Port: `7700`
   - Enable: ☑ Websockets Support
   - SSL Tab: ☑ Request a new SSL Certificate

3. **Save** each configuration

**Network Setup**: If NPM is running in Docker, ensure it's in the same network as Readspace:

```yaml
networks:
  default:
    name: readspace_shared_net
    external: true
```

---

## Caddy

Caddy is known for its simple configuration syntax and automatic HTTPS.

### Configuration

Create or edit your `Caddyfile`:

```caddyfile
# Web Application
app.example.com {
    reverse_proxy readspace_web:8042
    encode gzip
}

# API Server
api.example.com {
    reverse_proxy readspace_api:8008
    encode gzip
}

# Supabase
supabase.example.com {
    reverse_proxy kong:8000
    encode gzip
}

# Meilisearch
search.example.com {
    reverse_proxy meilisearch:7700
    encode gzip
}
```

If Caddy is running on the host (not in Docker), use localhost with **host ports**:

```caddyfile
app.example.com {
    reverse_proxy localhost:18042
}

api.example.com {
    reverse_proxy localhost:18008
}

supabase.example.com {
    reverse_proxy localhost:18000
}

search.example.com {
    reverse_proxy localhost:7700
}
```

**Start Caddy**:

```bash
caddy run --config Caddyfile
```

Caddy will automatically obtain SSL certificates from Let's Encrypt.

---

## nginx (Manual Configuration)

For users who prefer traditional nginx configuration files.

### Configuration

Create three server blocks in `/etc/nginx/sites-available/` or add to your main `nginx.conf`:

```nginx
# Web Application
server {
    listen 443 ssl http2;
    server_name app.example.com;

    ssl_certificate /path/to/fullchain.pem;
    ssl_certificate_key /path/to/privkey.pem;

    location / {
        # Use localhost:18042 if nginx is on host
        # Use readspace_web:8042 if nginx is in Docker network
        proxy_pass http://localhost:18042;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # WebSocket support
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}

# API Server
server {
    listen 443 ssl http2;
    server_name api.example.com;

    ssl_certificate /path/to/fullchain.pem;
    ssl_certificate_key /path/to/privkey.pem;

    location / {
        # Use localhost:18008 if nginx is on host
        # Use readspace_api:8008 if nginx is in Docker network
        proxy_pass http://localhost:18008;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# Supabase
server {
    listen 443 ssl http2;
    server_name supabase.example.com;

    ssl_certificate /path/to/fullchain.pem;
    ssl_certificate_key /path/to/privkey.pem;

    location / {
        # Use localhost:18000 if nginx is on host
        # Use kong:8000 if nginx is in Docker network
        proxy_pass http://localhost:18000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# Meilisearch
server {
    listen 443 ssl http2;
    server_name search.example.com;

    ssl_certificate /path/to/fullchain.pem;
    ssl_certificate_key /path/to/privkey.pem;

    location / {
        # Use localhost:7700 if nginx is on host
        # Use meilisearch:7700 if nginx is in Docker network
        proxy_pass http://localhost:7700;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# HTTP to HTTPS redirect
server {
    listen 80;
    server_name app.example.com api.example.com supabase.example.com search.example.com;
    return 301 https://$host$request_uri;
}
```

**Enable and reload nginx**:

```bash
sudo ln -s /etc/nginx/sites-available/readspace.conf /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

**SSL Certificates**: Use [Certbot](https://certbot.eff.org/) to obtain Let's Encrypt certificates:

```bash
sudo certbot --nginx -d app.example.com -d api.example.com -d supabase.example.com
```

## Additional Resources

- [Traefik Documentation](https://doc.traefik.io/traefik/)
- [nginx Proxy Manager](https://nginxproxymanager.com/guide/)
- [Caddy Documentation](https://caddyserver.com/docs/)
- [nginx Reverse Proxy Guide](https://docs.nginx.com/nginx/admin-guide/web-server/reverse-proxy/)
- [Cloudflare Tunnel Docs](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/)
