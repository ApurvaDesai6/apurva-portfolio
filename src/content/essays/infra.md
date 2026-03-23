---
title: "Architecting apurvad.xyz: A Systematic Review and Optimization"
description: "A full architecture audit of a multi-tier AWS deployment, cost optimization from $59/mo to $2/mo, and the engineering decisions behind each tradeoff."
publishDate: 2026-03-15
tags: ["AWS", "Engineering"]
---

I built this site's infrastructure from scratch on AWS as a hands-on learning lab. Over time it evolved from a deliberately over-engineered multi-tier deployment into a lean, production-optimized static architecture. This post walks through the original design, the audit that identified what needed to change, the optimization process, and the reasoning behind every tradeoff.

## The original architecture

The initial stack was designed to exercise as many AWS services as possible in a realistic configuration:

**Traffic path:** Client → Route 53 → CloudFront (with ACM TLS termination) → AWS WAF → Application Load Balancer → EC2 (nginx) in a private subnet within a custom VPC.

**Failover path:** CloudFront origin group with primary ALB origin and secondary S3 static bucket for automatic failover if the EC2/ALB path became unhealthy.

**Compute:** Single t2.micro (Amazon Linux 2023) running nginx, managed exclusively through SSM Session Manager. No SSH keys, no port 22 in the security group. IMDSv2 enforced with `HttpTokens=required` to prevent SSRF-based credential theft via the metadata service.

**Networking:** Custom VPC (`vpc-0db4a175a225bcf71`) with public and private subnets across two AZs. The EC2 instance sat in a private subnet with no direct internet access. Outbound traffic routed through a NAT Gateway (`nat-081f5e98db91ed480`) in the public subnet. An Internet Gateway on the public subnet route table served the ALB. Security groups enforced least-privilege: the ALB SG allowed inbound 80/443 from `0.0.0.0/0`, and the EC2 SG allowed inbound 80 only from the ALB SG. No other inbound paths existed.

**DNS:** Route 53 hosted zone (`Z099153621G9JWKOVT92M`) with all seven routing policies configured across subdomains as a reference implementation: simple, failover (with health checks), geolocation (US/France/India/China/South Africa/default), latency-based (us-east-1/eu-west-1/ap-southeast-2/ap-south-1), weighted (1% canary / 99% primary), IP-based (CIDR collection for Canada), and geoproximity (with bias controls). The apex domain used a simple A record, while each subdomain demonstrated a different policy.

**Security layers:**
1. CloudFront + AWS Shield Standard for volumetric DDoS absorption across 450+ edge locations
2. AWS WAF WebACL with AWSManagedRulesCommonRuleSet (SQL injection, XSS, path traversal) and rate limiting at 2,000 requests per 5 minutes per IP
3. ACM-managed wildcard certificate (`*.apurvad.xyz`) with TLS 1.2+ enforcement and ECDHE cipher suites for perfect forward secrecy
4. VPC network isolation with private subnet placement, NAT Gateway for egress-only internet, and stateful security groups restricting traffic to ALB-to-EC2 on port 80
5. EC2 instance hardening: IMDSv2, SSM-only access (no SSH), IAM instance profile with least-privilege policies, automated patch management via Systems Manager

**Observability:** CloudWatch metrics on EC2 (CPU, network), ALB (request count, target response time, healthy host count), and custom alarms with SNS notification for unhealthy targets.

**Monthly cost:** EC2 ~$8, ALB ~$16, NAT Gateway ~$32, Route 53 + CloudFront + S3 ~$3. Total: **~$59/month**.

## The audit

I approached the audit the same way I'd approach a customer's architecture review: start with the workload requirements, then evaluate whether each component is justified.

**Workload profile:** Static HTML/CSS/JS portfolio site. No server-side rendering, no database, no user authentication, no dynamic content. Read-heavy, write-never (content changes only on deployment). Traffic: low, bursty (spikes when shared on LinkedIn or in job applications), geographically distributed.

With that profile established, several components immediately stood out:

### Finding 1: NAT Gateway ($32/mo) is unjustified

The NAT Gateway existed so the EC2 instance in the private subnet could reach the internet for package updates and SSM connectivity. At $0.045/hour plus data processing charges, it was the single largest line item, accounting for 54% of the total bill.

For this workload, the private subnet placement was architecturally sound but economically disproportionate. The alternatives:

- **Move EC2 to a public subnet with an EIP.** Eliminates the NAT Gateway entirely. The instance gets a public IP for outbound traffic. Security is maintained through security groups (which are stateful and deny all inbound by default) and IMDSv2. The tradeoff is that the instance has a public IP, which increases the attack surface slightly, but with no open inbound ports beyond what the SG allows, the practical risk is minimal.
- **Use VPC endpoints for SSM and S3.** Interface endpoints for SSM ($0.01/hr per AZ) and a gateway endpoint for S3 (free) would allow the instance to stay in the private subnet while eliminating the NAT Gateway. Cost: ~$7/mo for SSM endpoints vs $32/mo for NAT. This is the right answer for production workloads where private subnet placement is a compliance requirement.
- **Eliminate EC2 entirely.** If the site is static, there's no compute to run. This is the option I ultimately chose.

### Finding 2: ALB ($16/mo) is over-engineered for a single target

The ALB provided health checking, SSL termination (unused since CloudFront handled TLS), and the ability to add targets for horizontal scaling. For a single EC2 instance serving static files, none of these capabilities were being utilized.

CloudFront can origin directly to an EC2 instance's public IP on port 80 using a custom origin. This eliminates the ALB entirely. The tradeoff: you lose ALB health checks and the ability to add instances behind a target group without reconfiguring CloudFront. For a static site, this tradeoff is acceptable. For a dynamic application expecting growth, the ALB would be justified.

### Finding 3: Route 53 ALIAS misconfiguration broke HTTPS

During a configuration change, the apex A record was switched from an ALIAS pointing to CloudFront (`d278jfa5vguq7o.cloudfront.net`) to a simple A record pointing to the EC2 Elastic IP (`184.73.104.42`). This bypassed CloudFront entirely, which meant:

- TLS termination stopped working (nginx had no certificate configured)
- Browsers with cached HSTS headers from CloudFront's `Strict-Transport-Security` response header continued attempting HTTPS connections, which failed
- WAF protections were bypassed
- Edge caching was bypassed
- DDoS protection was reduced to whatever the EC2 instance could absorb

The fix was a single API call to restore the ALIAS record, but the root cause was deeper: there was no monitoring on the CloudFront distribution's request count. A CloudWatch alarm on `Requests` dropping to zero would have caught this immediately.

Additionally, the CloudFront distribution was using the default `*.cloudfront.net` certificate instead of the ACM wildcard certificate. The `ViewerCertificate` configuration had `CloudFrontDefaultCertificate: true` instead of referencing the ACM ARN. This meant even when traffic flowed through CloudFront, browsers saw a certificate mismatch for `apurvad.xyz`.

### Finding 4: t2.micro burstable performance is a risk

The t2.micro instance type uses CPU credits for burst performance. Under sustained load (which could happen during a deployment, a traffic spike, or if the instance was compromised for crypto mining), CPU credits deplete and performance drops to baseline (10% of a vCPU). The t3.micro offers the same price point with unlimited burst mode available, better baseline performance, and Nitro platform benefits.

### Finding 5: No CI/CD pipeline

Deployments were manual: base64-encode files, push via SSM `send-command`, reload nginx. This process was error-prone (the base64 encoding had a ~90KB limit per SSM command), slow, and left no audit trail of what was deployed when. There was no version control on the site content itself.

## The optimized architecture

Based on the audit, I migrated to a fundamentally different architecture that matches the workload:

**New traffic path:** Client → Route 53 (ALIAS) → CloudFront → S3

**What changed:**

| Component | Before | After | Savings |
|-----------|--------|-------|---------|
| Compute | EC2 t2.micro (nginx) | None (S3 serves objects) | $8/mo |
| Load balancing | ALB with target group | None (CloudFront origins to S3) | $16/mo |
| Networking | NAT Gateway + private subnet | None (S3 is a regional service) | $32/mo |
| CDN | CloudFront → ALB | CloudFront → S3 with OAC | $0 |
| TLS | ACM cert (was misconfigured) | ACM cert (properly attached, SNI, TLS 1.2+) | $0 |
| Deployment | Manual SSM commands | GitHub Actions → `aws s3 sync` → CF invalidation | $0 |
| **Total** | **~$59/mo** | **~$2/mo** | **$57/mo (97%)** |

**S3 configuration:** Bucket `apurvad-xyz-static` with all public access blocked. Access is exclusively through CloudFront using an Origin Access Control (OAC), which is the successor to Origin Access Identity (OAI). The bucket policy allows `s3:GetObject` only when the request comes from the specific CloudFront distribution ARN.

**CloudFront configuration:**
- Origin: S3 bucket with OAC (sigv4 signing)
- Default root object: `index.html`
- Viewer protocol policy: redirect-to-https
- Cache policy: `CachingOptimized` (managed policy) with 86400s default TTL for static assets
- Price class: `PriceClass_100` (US, Canada, Europe) to minimize cost while covering the primary audience
- HTTP/2 and HTTP/3 enabled
- Custom error responses: 403 and 404 map to `/index.html` with 200 status (for client-side routing)
- CloudFront Function on viewer-request to append `/index.html` to directory paths (required because S3 doesn't serve index documents for subdirectory requests through CloudFront OAC)

**CI/CD pipeline:** GitHub Actions workflow triggers on push to `main`. Steps: checkout → Node.js setup → `npm ci` → `npm run build` (Astro static site generator) → `aws s3 sync ./dist s3://apurvad-xyz-static --delete` → `aws cloudfront create-invalidation --paths "/*"`. The IAM user for GitHub Actions has a minimal inline policy: `s3:PutObject`, `s3:DeleteObject`, `s3:ListBucket`, `s3:GetObject` on the bucket, and `cloudfront:CreateInvalidation` on the distribution. No other permissions.

**Resilience:** S3 provides 99.999999999% (11 nines) durability and 99.99% availability. CloudFront adds edge caching across 450+ locations with automatic failover between edge locations. The architecture has no single points of failure that I control. The previous architecture had the EC2 instance as a single point of failure (single AZ, single instance, no auto-scaling group).

## Scaling analysis

The current architecture handles the portfolio workload well, but it's worth thinking through how the design would change at different scales:

**10x traffic (~10K requests/day):** No changes needed. S3 + CloudFront scales automatically. CloudFront cache hit ratio would improve with more traffic, actually reducing origin requests. Cost increase: negligible (maybe $3-4/mo total).

**100x traffic with dynamic content:** This is where the architecture would need to evolve. Options:
- **Lambda@Edge or CloudFront Functions** for lightweight dynamic behavior (A/B testing, personalization, auth)
- **API Gateway + Lambda** for serverless API endpoints
- **ECS Fargate behind ALB** if the application needs persistent server-side state or WebSocket connections
- **DynamoDB** for any data persistence needs

The key principle: start static, add dynamic capabilities only when the workload demands them. Every component you add is a component you have to monitor, secure, patch, and pay for.

**Multi-region with high availability:** CloudFront already provides global edge distribution. For origin redundancy, S3 Cross-Region Replication to a secondary bucket with CloudFront origin failover would provide sub-minute RTO with zero data loss. Route 53 health checks on the CloudFront distribution would handle DNS-level failover if needed, though CloudFront's built-in origin failover is typically sufficient.

## The wine app: a different workload, a different architecture

The wine predictor app (`wine.apurvad.xyz`) was the first project that genuinely needed a server. It's a Next.js application with API routes that call external AI services for wine label analysis and price search. This workload can't be static, so EC2 is justified.

What started as a single app on a t3.small quickly became a consolidation problem. I had four side projects — Wine Predictor, WAF Rule Simulator, AquaSDG (with a Python ML service), and an NCAA bracket predictor — all needing server-side runtimes. Running a separate instance for each would cost $30-40/mo per app. Running them all on one box with Docker Compose and a reverse proxy costs the same as one instance.

## Consolidating side projects: Docker Compose on a single EC2

The current setup runs five containers on a single t3.medium (`i-09f3d4fcaed6d4ecf`, 2 vCPU, 4GB RAM + 4GB swap) behind Caddy as a reverse proxy with automatic Let's Encrypt TLS:

```
                    INTERNET
                       │
            ┌──────────▼──────────┐
            │      Route 53       │
            │    *.apurvad.xyz    │
            └──────────┬──────────┘
                       │
            ┌──────────▼──────────┐
            │    Caddy :80/:443   │
            │  Auto TLS (ACME)    │
            └──┬───┬───┬───┬──────┘
               │   │   │   │
    ┌──────────┘   │   │   └──────────┐
    ▼              ▼   ▼              ▼
┌────────┐  ┌──────────────┐  ┌──────┐  ┌──────┐
│ wafsim │  │  aquasdg-next │  │ wine │  │ ncaa │
│  :3000 │  │    :3000      │  │:3000 │  │:3000 │
└────────┘  └──────┬───────┘  └──────┘  └──────┘
                   │
            ┌──────▼───────┐
            │  aquasdg-ml  │
            │  (FastAPI)   │
            │    :8000     │
            └──────┬───────┘
                   │
            ┌──────▼───────┐
            │ SQLite (vol) │
            └──────────────┘
```

**Caddy** handles subdomain routing and TLS provisioning. The entire config is 16 lines:

```
wafsim.apurvad.xyz  → wafsim:3000
aquasdg.apurvad.xyz → aquasdg-next:3000 (with /api/ml/* → aquasdg-ml:8000)
wine.apurvad.xyz    → wine:3000
ncaa.apurvad.xyz    → ncaa:3000
```

Caddy automatically provisions and renews Let's Encrypt certificates for each subdomain via the ACME HTTP-01 challenge. No certbot cron jobs, no manual certificate management.

**Docker Compose** orchestrates everything. Each Next.js app uses the same generic multi-stage Dockerfile: Bun installs deps, builds the standalone output, and the runtime image is `oven/bun:1-slim` with just the standalone server, static assets, and public directory. The AquaSDG ML service is a separate Python 3.11 container running FastAPI/Uvicorn with the Groundsource parquet dataset (~636MB) baked in.

One thing I had to solve: AquaSDG's Prisma schema defines both a JavaScript and Python client generator. The generic Dockerfile strips the Python generator before running `prisma generate` so the Bun-based build doesn't fail looking for `prisma-client-py`. The ML service's Dockerfile generates the Python client separately.

**Networking:** All containers share a Docker bridge network. Caddy routes external traffic to the right container by hostname. The EC2 security group allows inbound 80/443/22 and all outbound. No ALB, no NAT Gateway — Caddy handles TLS directly on the instance.

**DNS:** Each subdomain is a simple A record pointing to the EC2's Elastic IP (`184.73.104.42`). No CloudFront in front of the project apps — they need server-side rendering and API routes, so edge caching would cause more problems than it solves (POST body size limits, stale SSR pages, WebSocket incompatibility).

**Storage:** AquaSDG uses a shared Docker volume for its SQLite database, mounted into both the Next.js and ML service containers. The db-init service runs Prisma migrations on startup and seeds from the bundled `dev.db` if the volume is empty. For these v1 demos this is fine; production would use RDS.

**Build process:** The initial deployment was done by packaging the project files (minus `node_modules` and `.next`), uploading to S3, pulling onto the EC2, and building Docker images sequentially. Building all four Next.js apps in parallel OOM'd the t3.medium — each Turbopack build peaks at ~1.5GB RSS. Sequential builds with 4GB swap solved it. A `docker builder prune` between builds keeps disk usage manageable on the 30GB EBS volume.

**Deployment workflow:** For updates, I tar the changed project, upload to S3, pull on EC2, rebuild the specific image, and `docker-compose up -d --no-deps <service>` for zero-downtime replacement of just that container. The systemd unit ensures everything comes back up on reboot.

### Cost comparison

| Component | Before (per-app) | After (consolidated) |
|-----------|-------------------|----------------------|
| Compute | t3.small × N apps | 1× t3.medium | 
| TLS | certbot per app | Caddy auto-TLS |
| Load balancing | ALB per app ($16/mo each) | Caddy (free) |
| Networking | NAT Gateway ($32/mo) | Direct internet (EIP) |
| **Monthly cost** | **~$60-100/mo for 4 apps** | **~$34/mo total** |

The t3.medium is $30/mo, EBS is $2.40/mo, EIP is $3.60/mo (when attached to a running instance, free before Feb 2024 pricing change). Route 53 hosted zone is $0.50/mo. Total: **~$37/mo** for four live, interactive web applications with automatic TLS.

### What I'd change for production

This setup works well for v1 demos and portfolio pieces. For actual production traffic:

1. **Replace SQLite with RDS.** SQLite over a shared Docker volume hits `SQLITE_BUSY` under concurrent writes. RDS PostgreSQL with connection pooling via PgBouncer would handle multi-container writes cleanly.
2. **Add a container registry.** Currently images are built on the EC2 itself. Pushing to ECR and pulling pre-built images would make deployments faster and more reproducible.
3. **Health check monitoring.** Caddy's upstream health checks handle container restarts, but there's no external synthetic monitoring. A simple Lambda + CloudWatch Events canary hitting each subdomain every 5 minutes would catch issues Caddy can't see (like DNS misconfigurations or TLS expiry failures).
4. **Horizontal scaling.** If any single app needs more than what one container on a t3.medium can provide, the move would be to ECS Fargate with an ALB. The Docker images are already built for it — the Dockerfiles produce standalone containers with health checks. The AquaSDG DEPLOYMENT.md already has full ECS task definitions, ALB routing rules, and EFS volume configs ready to go.

## Lessons learned

**Cost optimization starts with understanding the workload.** The original $59/mo architecture wasn't wrong, it was mismatched. Every component was correctly configured and secure. But the workload didn't need most of them. The audit framework is simple: for each component, ask "what happens if I remove this?" If the answer is "nothing changes for the user," it's a candidate for removal.

**Consolidation beats multiplication.** Running four separate EC2 instances or four separate ECS services would cost 3-4x more than one Docker Compose stack on a single instance. For low-traffic side projects, the operational simplicity of `docker-compose up -d` on one box is hard to beat. The tradeoff is a single point of failure, but for portfolio demos that's acceptable.

**Caddy is underrated for small deployments.** Automatic HTTPS with zero configuration, subdomain routing in a few lines, and built-in reverse proxy — it replaces nginx + certbot + cron with a single binary and a 16-line config file. For anything that doesn't need CloudFront's edge caching or WAF integration, Caddy is the right tool.

**Defense in depth is still the right model, even for static sites.** The optimized architecture still has multiple security layers: CloudFront TLS termination, OAC-restricted S3 access (no public bucket), minimal IAM permissions for CI/CD, and HTTPS enforcement. The layers are just different from the original.

**ALIAS records and CloudFront certificate configuration are easy to get wrong.** The HTTPS breakage from the Route 53 misconfiguration was invisible to basic monitoring. The lesson: monitor the full request path, not just individual components. A synthetic canary that hits `https://apurvad.xyz` and checks for a 200 with a valid certificate would have caught both the DNS and certificate issues.

**CloudFront Functions are essential for static sites on S3.** Without the URL rewrite function, every directory path returns a 403. This is the single most common gotcha when migrating from nginx/Apache to S3 + CloudFront, and it's not obvious until you click a link and get an XML error page.

**CI/CD changes the economics of deployment.** Manual deployments via SSM were slow and error-prone. GitHub Actions made deployments a `git push`. The time saved per deployment is small, but the reduction in deployment friction means I actually deploy more often, which means the site stays current. The best architecture is the one you can confidently ship changes to.

**Build your Docker images sequentially on memory-constrained instances.** Four parallel Turbopack builds on a 4GB instance will OOM. Sequential builds with swap are slower but reliable. If build speed matters, push to ECR from a CI runner with more resources.
