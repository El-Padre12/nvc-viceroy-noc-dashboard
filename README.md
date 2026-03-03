# NOC Dashboard — Student Lab Portal

A simulated datacenter ticket queue for the student lab environment.
Built with React + Vite, served via nginx inside Docker.

---

## What It Does

- Live queue of datacenter tickets (Server Down, Fan Failure, BGP Flap, etc.)
- Each ticket has a Priority (P0–P4), TTL age bar, location, and status
- Claim a ticket → In Progress. Resolve it → Done.
- New tickets auto-spawn every 12 seconds
- Click any row to open a detail panel

---

## Requirements

- Ubuntu 22.04+ server with SSH access
- Docker + Docker Compose installed
- Port 8080 open on the firewall

---

## First Time Setup

### 1. Install Docker
```bash
sudo apt update
sudo apt install -y ca-certificates curl gnupg

sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

sudo usermod -aG docker $USER
newgrp docker
```

### 2. Open the firewall
```bash
sudo ufw allow 8080/tcp
```

### 3. Clone and run
```bash
git clone https://github.com//noc-dashboard.git
cd noc-dashboard
docker compose up -d --build
```

Access it at `http://<server-ip>:8080`

---

## Daily Commands

| Task | Command |
|---|---|
| Start | `docker compose up -d` |
| Stop | `docker compose down` |
| Restart | `docker compose restart` |
| View logs | `docker compose logs -f` |
| Check status | `docker ps` |

---

## Deploying a Code Change

```bash
git pull
docker compose up -d --build
```

That's it. Docker rebuilds the image and restarts the container.

---

## Project Structure

```
noc-dashboard/
├── src/
│   ├── App.jsx           # Everything — all logic and UI lives here
│   └── main.jsx          # React entry point, don't touch this
├── Dockerfile            # Multi-stage: Node builds → nginx serves
├── docker-compose.yml    # Maps port 8080, sets restart policy
├── nginx.conf            # Serves the React app
├── package.json          # Dependencies
└── .gitignore
```

---

## How the Docker Build Works

The Dockerfile has two stages:

1. **Stage 1** — Node 24 installs dependencies and runs `npm run build`, producing a `dist/` folder of static files.
2. **Stage 2** — A tiny nginx image copies only that `dist/` folder and serves it.

No Node.js ends up on the server or in the final image. The container is ~25MB.

---

## Making Code Changes

All UI and logic is in `src/App.jsx`. Edit it locally, push to GitHub, then on the server run `git pull && docker compose up -d --build`.

No Node.js needed on the server — Docker handles the build inside the container.
