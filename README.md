This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Production deployment (VPS + shared nginx)

This repository includes a production deployment setup for running behind an existing shared reverse proxy.

### Architecture

- The app runs as a Docker container and only exposes internal port `3000`.
- Public ingress and TLS are handled by shared nginx on the VPS.
- The app container joins external Docker network `proxy-network`.

### Files added for deployment

- `Dockerfile`: multi-stage Next.js production image.
- `docker-compose.prod.yml`: app service, restart policy, healthcheck, and external network.
- `deploy/nginx/app.144-91-77-107.sslip.io.conf`: nginx vhost for host-based routing.
- `deploy/vps/deploy.sh`: idempotent VPS deploy script used by CI over SSH.
- `.github/workflows/deploy.yml`: builds/pushes GHCR image and deploys to VPS.
- `.env.production.example`: required runtime environment variables.

### Expected VPS directories and paths

- App directory: `/opt/minicms-app`
- Compose file on VPS: `/opt/minicms-app/docker-compose.yml`
- Env file on VPS: `/opt/minicms-app/.env`
- Persistent app data (SQLite): `/opt/minicms-app/data`
- Nginx config path: `/etc/nginx/sites-available/app.144-91-77-107.sslip.io.conf`
- Enabled nginx symlink: `/etc/nginx/sites-enabled/app.144-91-77-107.sslip.io.conf`

### Required GitHub secrets

- `VPS_HOST`: VPS hostname or IP.
- `VPS_USER`: SSH user with sudo rights.
- `VPS_SSH_KEY`: private SSH key (PEM/OpenSSH format).
- `GHCR_USERNAME`: GitHub username that can read GHCR package.
- `GHCR_TOKEN`: classic PAT with at least `read:packages`.
- `CERTBOT_EMAIL`: email used for Let's Encrypt registration.
- `NEXTAUTH_SECRET`: random secret for NextAuth.
- `APP_GITHUB_ID`: GitHub OAuth app client ID used by NextAuth provider.
- `APP_GITHUB_SECRET`: GitHub OAuth app client secret.

### First deployment checklist

1. Ensure Docker, Docker Compose plugin, nginx, and certbot are installed on VPS.
2. Ensure DNS resolves `app.144-91-77-107.sslip.io` to your VPS.
3. Ensure shared reverse-proxy stack uses Docker network `proxy-network`.
4. Add all GitHub secrets listed above.
5. Push to `main` (or run workflow manually with `workflow_dispatch`).
6. Confirm nginx config exists and is enabled on VPS.
7. Confirm certificate issuance/expansion succeeds in deploy logs.

### Verify deployment

1. Check workflow logs for successful `Build and push image` and `Deploy over SSH` steps.
2. On VPS, verify container health:

```bash
cd /opt/minicms-app
docker compose ps
docker compose logs --tail=100 app
```

3. Verify nginx config and reload state:

```bash
sudo nginx -t
sudo systemctl status nginx
```

4. Verify site endpoint:

```bash
curl -I https://app.144-91-77-107.sslip.io
```

Expected: HTTP `200` (or app-specific redirect), valid TLS cert, and app responses through shared nginx.
