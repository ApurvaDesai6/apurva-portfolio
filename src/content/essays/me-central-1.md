---
title: "The me-central-1 Incident"
description: "A technical retrospective on infrastructure resilience during the March 2026 physical AWS data center failure in the UAE."
publishDate: 2026-03-10
tags: ["AWS", "Engineering", "Incident", "Disaster Recovery"]
---

On March 1st, 2026, the alerts started flooding in across every team at AWS. Iranian retaliatory drone and missile strikes had hit the me-central-1 (UAE/Dubai) data centers. Physical objects struck the facility causing sparks, fire, and complete power loss including backup generators. This wasn't a software failure. It was a physical infrastructure disaster.

While I wasn't on the direct incident response team, the fallout landed squarely on my desk. Customers needed to migrate their VPC configurations, WAF rules, security groups, and networking stacks out of the affected region, and they needed guidance on how to do it fast. I spent the following weeks helping enterprise customers rebuild their network infrastructure in alternate regions and implement failover mechanisms they should have had in place before the event.

## Timeline

**March 1, 14:30 UTC.** First impact detected. mec1-az2 and mec1-az3 went offline immediately. Fire department responded and cut all power including backup generators for safety.

**March 1, 15:45 UTC.** mec1-az1 also affected due to facility damage. me-south-1 (Bahrain) experiencing degraded connectivity from regional network disruption.

**March 1, 16:00 UTC.** AWS public statement: recovery to take at least a day, requires repair of facilities, cooling and power systems, coordination with local authorities.

**March 2, 08:00 UTC.** Facility repairs begin. Data extraction from impaired AZs not possible. Recovery must come from pre-existing cross-region backups.

What made this uniquely challenging wasn't just the scale. It was the nature of the failure. When both the control plane AND data plane go down simultaneously, your recovery options become severely constrained. The fundamental lesson: you can only recover from what existed before the event.

Customers running multi-AZ workloads were not impacted. Single-AZ customers faced total loss unless they had cross-region backups. Multi-AZ architecture isn't optional. It's the difference between "not impacted" and "total loss."

## What I Worked On

My role was focused on the networking and security side of the migration. Customers needed to recreate their VPC architectures, WAF WebACLs, security groups, NACLs, and Route 53 configurations in target regions. Many had complex multi-tier VPC designs with dozens of security group rules, custom WAF rule sets, and intricate routing tables that couldn't just be copy-pasted across regions.

The control plane (AWS APIs, console) was completely unavailable for the affected AZs. The data plane (running EC2 instances, active RDS connections) was also down due to physical infrastructure failure. This meant no API access, no snapshot creation, no emergency backups.

Every customer conversation followed this pattern:

```
Do you have cross-region AMIs/snapshots?
├── YES → Migrate now to alternate region
│   ├── Check service quotas in target region
│   ├── Request limit increases if needed
│   └── Begin restoration process
└── NO → Wait for facility recovery
    ├── Prepare for potential data loss
    └── Plan multi-AZ architecture going forward
```

The customers with existing cross-region backups could migrate immediately. Those without had to wait and hope their data survived the physical damage.

One of the biggest surprises was how service quotas became a migration blocker. Customers trying to restore hundreds of EC2 instances hit default limits in target regions. I found myself submitting quota increase requests at 2 AM, explaining the emergency situation to the service teams.

## Migration Patterns

### EC2

```bash
# Copy AMI to target region
aws ec2 copy-image \
    --source-region me-central-1 \
    --source-image-id ami-12345678 \
    --name "emergency-restore-$(date +%Y%m%d)" \
    --region eu-west-1

# Copy EBS snapshots
aws ec2 copy-snapshot \
    --source-region me-central-1 \
    --source-snapshot-id snap-12345678 \
    --region eu-west-1
```

For customers with AWS MGN agents already installed, we could perform live migrations, but only if the data plane was still accessible. For most affected instances, it wasn't.

### RDS

Cross-region read replicas were the fastest recovery path: promote to primary. For customers without replicas, we used automated snapshots copied to target regions.

```bash
# Copy DB snapshot to target region
aws rds copy-db-snapshot \
    --source-db-snapshot-identifier mydb-snapshot-20260301 \
    --target-db-snapshot-identifier mydb-emergency-restore \
    --source-region me-central-1 \
    --target-region eu-west-1

# Restore from copied snapshot
aws rds restore-db-instance-from-db-snapshot \
    --db-instance-identifier mydb-restored \
    --db-snapshot-identifier mydb-emergency-restore
```

### Container Workloads (ECS/EKS)

ECS tasks that were running survived initially, but the control plane was unavailable for management operations.

The most subtle issue we encountered with EKS: IRSA (IAM Roles for Service Accounts) trust policies. When recreating clusters in new regions, customers forgot to update OIDC provider associations, leading to silent AccessDenied failures that took hours to debug.

### Data Plane Fallbacks

When AWS APIs were unavailable, we fell back to traditional data transfer methods:

```bash
# rsync over SSH for file systems
rsync -avz -e "ssh -i key.pem" \
    /data/ ec2-user@target-instance:/data/

# MySQL dump piped to S3
mysqldump --all-databases | \
    aws s3 cp - s3://emergency-backup/mysql-dump-$(date +%Y%m%d).sql
```

## KMS Deep Dive

The most technically interesting challenge was KMS key management during cross-region migration. This is where many customers got stuck.

KMS keys cannot be migrated between regions. Even multi-region keys don't solve this for integrated services like RDS, EBS, and S3 SSE-KMS. Those services treat multi-region keys as single-region keys.

Every encrypted resource required the same pattern: decrypt in source region, re-encrypt with destination region key.

```bash
# Copy encrypted snapshot with new KMS key
aws ec2 copy-snapshot \
    --source-region me-central-1 \
    --source-snapshot-id snap-encrypted-source \
    --target-region eu-west-1 \
    --kms-key-id arn:aws:kms:eu-west-1:123456789012:key/target-key-id \
    --encrypted
```

For S3 objects encrypted with SSE-KMS, S3 Batch Operations handled the decrypt/re-encrypt automatically during CopyObject operations. This was a lifesaver for customers with millions of encrypted objects.

One gotcha worth noting: symmetric imported key material is NOT interoperable between regions, even with identical key material. However, asymmetric and HMAC imported keys ARE interoperable for client-side encryption, just not for integrated AWS services.

## What This Incident Revealed

The shared responsibility model became viscerally clear. AWS is responsible for the facility. Customers are responsible for their DR architecture. No amount of AWS engineering can protect against customer architectural choices during a physical disaster.

Single-AZ deployments aren't cost optimizations. They're DR anti-patterns. This incident made that clear to every customer I worked with.

IAM Identity Center deployed in a single region created authentication failures across organizations. Multi-region replication (launched February 2026) addressed this, but many customers hadn't enabled it yet.

Service quotas in DR regions became hidden blockers during mass migration. SAML federation configured only with us-east-1 endpoints caused federation failures when that wasn't the target region.

## Architecture Recommendations

The customers who recovered fastest shared common traits.

**Multi-AZ as baseline.** Not optional. Not a cost discussion. The baseline for any production workload.

**Cross-region backup automation.** AWS Backup with cross-region copy rules, running daily. Not something you set up during an incident.

**Service-specific resilience.** Aurora Global Database for fast RTO. ECR cross-region replication enabled proactively. ElastiCache Global Datastore for cache workloads. EKS IRSA trust policies documented and OIDC provider update procedures rehearsed.

**DR drills.** The customers who recovered fastest had practiced their DR procedures. Not just documentation. Actual drills. They knew their RTO/RPO numbers because they had measured them, not estimated them.

## Lessons Learned

Three months later, I still think about this incident regularly. It changed how I approach architecture reviews and customer conversations about resilience.

The hardest conversations weren't about technology. They were about explaining to customers that their data might be gone forever. No amount of technical skill can recover from architectural decisions made months earlier.

What struck me most was how the incident revealed the gap between theoretical DR planning and practical implementation. Customers had disaster recovery plans, but they hadn't accounted for service quota limits in target regions, KMS key regional constraints, IAM Identity Center single points of failure, the time required to recreate complex networking configurations, or application dependencies on regional services.

Some data was lost forever. Not because of AWS engineering failures, but because of architectural choices. The incident was a harsh reminder that in the cloud, you can't recover from what you never backed up.

The customers who emerged stronger from this incident didn't just restore their systems. They fundamentally rethought their approach to resilience. Disasters don't just test your backups. They test your assumptions.
