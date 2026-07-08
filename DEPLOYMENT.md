# Deployment

## Architecture

```
Browser ──HTTPS──▶ CloudFront ──▶ S3 (React build)
   │
   └──HTTP──▶ EC2 (Nginx ──▶ Docker container: Fastify) ──▶ RDS (Postgres)
```

- **Frontend**: React build synced to S3, served through CloudFront (free HTTPS via the default `*.cloudfront.net` domain — no cert setup needed).
- **Backend**: Fastify containerized with Docker, running on a single EC2 t2/t3.micro. Docker's own `--restart unless-stopped` handles process supervision — no PM2 needed.
- **Database**: RDS Postgres (db.t3.micro) instead of self-hosting on the EC2 box — managed backups/patching.
- **Email**: SES, unchanged.

All four pieces (EC2, RDS, S3, CloudFront) are free-tier eligible for 12 months on a new AWS account.

**Roadmap beyond this**: TLS on the backend (custom domain + Certbot, or route the API through CloudFront as a second origin — see "Known gaps" below); move the same Docker image from EC2 to ECS Fargate once this is proven out; CI/CD instead of manual `docker build`.

---

## Phase 0 — one-time account setup

1. Pick one region and use it for everything below (e.g. `us-east-1`) — RDS, EC2, S3 all need to agree on a region, or nothing can talk to anything.
2. IAM → create yourself an IAM user with **programmatic access** (access key + secret). You'll need this for the AWS CLI later (`aws s3 sync`, etc.) — don't use root account keys. Attach `AdministratorAccess` for now to avoid permission dead-ends while you're building; tighten later.
3. Install the AWS CLI locally, run `aws configure`, paste in that access key/secret + your region.
4. EC2 → Key Pairs → create one, download the `.pem` file, `chmod 400 your-key.pem`. This is what lets you SSH in later — can't launch an instance without it.

## Phase 1 — database

5. RDS → Create database → **PostgreSQL**, template **Free tier**, `db.t3.micro`, storage 20GB (free tier ceiling). Set a master username/password, wait for status to reach **Available**, copy the **endpoint** (looks like `amara-db.xxxxxxxxxx.us-east-1.rds.amazonaws.com`).
   - Security group: create/edit one that allows inbound port `5432` **only from your EC2 instance's security group** (not `0.0.0.0/0`) — you'll attach this after step 6.

## Phase 2 — backend server

6. EC2 → Launch instance → Ubuntu 22.04 LTS, `t2.micro`/`t3.micro`, select the key pair from step 4. Security group: inbound 22 (SSH) + 80 (HTTP).
7. Go back to the RDS security group → allow inbound 5432 from this EC2 instance's security group.
8. SSH in:
   ```bash
   ssh -i your-key.pem ubuntu@<EC2_PUBLIC_IP>
   ```
9. Install Docker, Nginx, git:
   ```bash
   sudo apt update && sudo apt upgrade -y
   sudo apt install -y docker.io nginx git
   sudo usermod -aG docker $USER && newgrp docker
   ```
10. Clone the repo:
    ```bash
    git clone <your-repo-url> /home/ubuntu/amara
    cd /home/ubuntu/amara/back-end
    ```
11. Write `.env` with the RDS endpoint from step 5, plus your OpenAI/SES keys:
    ```bash
    cat > .env <<'EOF'
    DATABASE_URL=postgresql://<rds_user>:<rds_password>@<rds_endpoint>:5432/amara
    OPENAI_API_KEY=sk-...
    SMTP_HOST=email-smtp.us-east-1.amazonaws.com
    SMTP_USER=your_ses_smtp_user
    SMTP_PASS=your_ses_smtp_pass
    SMTP_FROM="Amara <noreply@yourdomain.com>"
    PORT=4000
    EOF
    ```
12. Build the image:
    ```bash
    docker build -t amara-backend .
    ```
13. Run migrations + seed against RDS (one-off containers, loads `DATABASE_URL` from `.env`):
    ```bash
    docker run --rm --env-file .env amara-backend npx prisma migrate deploy
    docker run --rm --env-file .env amara-backend node prisma/seed.js
    ```
14. Start the real container:
    ```bash
    docker run -d --name amara-backend --restart unless-stopped \
      -p 4000:4000 --env-file .env amara-backend
    ```
15. Nginx reverse proxy:
    ```bash
    sudo cp /home/ubuntu/amara/deploy/nginx.conf /etc/nginx/sites-available/amara
    sudo ln -s /etc/nginx/sites-available/amara /etc/nginx/sites-enabled/
    sudo rm -f /etc/nginx/sites-enabled/default
    sudo nginx -t && sudo systemctl reload nginx
    ```
16. Sanity check from your own machine:
    ```bash
    curl http://<EC2_PUBLIC_IP>/health   # should return {"status":"ok",...}
    ```

## Phase 3 — frontend

17. Locally, build with the backend's address baked in:
    ```bash
    cd front-end
    echo "VITE_API_BASE_URL=http://<EC2_PUBLIC_IP>" > .env
    npm install
    npm run build   # outputs to dist/
    ```
18. S3 (leave "Block all public access" **ON** — CloudFront reads via Origin Access Control, not a public bucket policy):
    ```bash
    aws s3 mb s3://your-unique-bucket-name
    aws s3 sync dist/ s3://your-unique-bucket-name --delete
    ```
19. CloudFront → Create distribution → origin = that bucket → **Origin Access Control (recommended)** → let the console auto-apply the generated bucket policy when prompted → default root object `index.html`.
20. Note the distribution's `*.cloudfront.net` domain — that's your live HTTPS frontend URL.

## Phase 4 — verify

21. SES console → verify one email address you control (sandbox mode only sends to verified addresses).
22. Open the CloudFront URL, complete intake, book an appointment, confirm the email arrives.

---

## Known gaps (be upfront about these in an interview)
- **No TLS on the backend** — frontend is HTTPS via CloudFront's default domain, backend is plain HTTP behind Nginx on the EC2 IP. This means the browser is loading an HTTPS page that calls an HTTP API ("mixed content") — accepted for now as a known limitation. Two ways to fix later: buy a domain + Certbot on the EC2 box, or route `/api/*` through the same CloudFront distribution as a second origin (also removes the need for CORS entirely, since frontend+backend would become same-origin).
- CORS is currently wide open (`origin: true` in `back-end/src/index.js`) — fine for a demo, should be locked to the CloudFront domain for real production use.
- No CI/CD — deploys are manual `docker build` + restart on the box, and manual `aws s3 sync` for the frontend.
- Single EC2 instance, no auto-scaling — Docker's restart policy covers crash recovery, not scaling or zero-downtime deploys.
