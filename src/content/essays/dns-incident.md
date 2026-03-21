---
title: "When DNS Ate the Cloud"
description: "A first-person account of the October 2025 us-east-1 outage. A race condition in DynamoDB's DNS management system took down 70,000+ organizations."
publishDate: 2025-10-25
tags: ["AWS", "Engineering", "Incident"]
---

It was 11:48 PM PDT on October 19th when the first customer calls started coming in. I was on the team that night, and what began as isolated DynamoDB connection errors quickly escalated into something none of us had seen before.

"My DynamoDB calls are timing out," the first customer reported. Then another: "EC2 instances won't launch." Within minutes: "Lambda functions failing," "ECS tasks stuck," "My entire application is down."

The pattern that emerged was both subtle and devastating. Everything in us-east-1 that touched DynamoDB was failing, but each service was failing in its own unique way. Customers were seeing their own infrastructure as the problem when the actual failure was completely invisible to them.

## The Root Cause

The failure originated in DynamoDB's internal automated DNS management system. It was designed with two independent components for high availability:

1. **DNS Planner** monitors load balancer health and creates DNS update plans
2. **DNS Enactor** applies DNS changes via Route 53 API calls

The race condition unfolded in about three minutes:

- **11:48 PM** DNS Enactor #1 experiences unusually high delays while processing a routine DNS update plan
- **11:49 PM** DNS Planner, unaware of Enactor #1's delays, continues creating fresh DNS update plans
- **11:50 PM** DNS Enactor #2 starts processing the newer plans and runs its cleanup process
- **11:51 PM** Enactor #1 finishes its delayed run just as Enactor #2's cleanup deletes the "stale" plan. This removes ALL IP addresses for DynamoDB's regional endpoint.

This wasn't a Route 53 bug. Route 53 faithfully executed what it was told to do. The bug was in the system that told Route 53 what to do. Once the race condition fired, the system was left in an inconsistent state that prevented any further automated DNS updates.

### Why empty DNS records are catastrophic

When a DNS record becomes empty, clients receive NXDOMAIN responses. These get cached for the TTL duration, meaning even after AWS fixed the DNS record, clients that had cached the NXDOMAIN kept failing until their cache expired.

## The Cascade

What made this incident particularly devastating wasn't just the initial DNS failure. It was how that failure cascaded through AWS's interconnected systems.

**DynamoDB DNS fails** → all internal and external traffic to DynamoDB fails DNS resolution.

**EC2 DropletWorkflow Manager (DWFM)** manages leases for physical servers hosting EC2 instances. It depends on DynamoDB. DNS failures caused DWFM state checks to fail.

**DWFM recovery causes congestive collapse.** After DynamoDB recovered at 2:25 AM, DWFM tried to re-establish leases across the entire EC2 fleet simultaneously. The scale meant leases timed out faster than they could be renewed. This required manual intervention and wasn't resolved until 5:28 AM.

**Network Manager backlog.** A massive backlog of delayed network configurations meant newly launched EC2 instances had no network config.

**NLB health check flapping.** Instances failed health checks due to network delays, got removed, then passed subsequent checks and got restored. Services behind NLBs became intermittently available.

**Lambda, ECS, EKS, Fargate.** All depend on EC2 instance launches. All impaired.

## What Customers Saw vs. What Was Actually Happening

The most challenging aspect of this incident was that customers' own monitoring showed their infrastructure as the problem:

| What Customers Saw | Actual Root Cause |
|---|---|
| "My DynamoDB calls are timing out" | DNS NXDOMAIN responses, no IPs to connect to |
| "My EC2 instances won't launch" | DWFM congestive collapse preventing lease acquisition |
| "My Lambda functions are failing" | Underlying EC2 capacity unavailable |
| "My app is down but EC2 shows running" | Network config delays and NLB health check flapping |
| "I fixed it but it's still broken" | DNS negative caching, NXDOMAIN cached until TTL expires |

The hardest part of customer triage was explaining that their infrastructure wasn't broken. The failure was completely internal to AWS and invisible to their monitoring systems.

## DNS Deep Dive

### Why DNS is the most dangerous single point of failure

DNS failures are uniquely catastrophic in distributed systems for three reasons:

1. **Negative caching.** NXDOMAIN responses get cached for the TTL duration. Fixing the root cause doesn't immediately fix the symptom.
2. **Universal dependency.** Every network connection starts with DNS resolution.
3. **Invisible failure mode.** Applications see connection timeouts, not DNS failures. Your monitoring says "connection refused" when the real problem is "couldn't resolve the hostname."

### The thundering herd problem at AWS scale

When DynamoDB recovered, DWFM tried to re-establish leases for the entire EC2 fleet simultaneously. This is a textbook congestive collapse:

```
Recovery Load > System Capacity
→ Requests timeout faster than they can be processed
→ Clients retry, increasing load further
→ System becomes less available during recovery than during outage
```

The solution is staggered recovery with circuit breakers and exponential backoff. But when the system wasn't designed for this failure mode, the recovery itself becomes the outage.

### The "cleanup as a weapon" anti-pattern

The cleanup process that deleted "stale" DNS plans was doing the right thing locally but the wrong thing globally. In distributed systems, cleanup operations that can't be rolled back are dangerous.

The deeper lesson: independence at the component level doesn't guarantee independence at the interaction level. The race condition was in the interaction between DNS Planner and DNS Enactor, not in either component individually.

## What Good DR Looked Like

During this incident, some customers were completely unaffected. Here's what worked:

- **Multi-region active-active architectures.** No single region dependency.
- **DynamoDB Global Tables.** Could fail over reads to other regions.
- **Route 53 health checks with failover routing.** Automatically routed to healthy regions.
- **ElastiCache in front of DynamoDB.** Cache absorbed reads during the outage.
- **Circuit breakers in application code.** Failed fast instead of hanging.
- **Hardcoded IPs** (ironically). Some customers with this bad practice actually worked during the DNS failure.

The value of multi-region architecture isn't just about AZ failures. It's about any single-region dependency, including internal AWS dependencies you can't see.

## What Changed

AWS's immediate response was decisive but drastic: disable DynamoDB DNS Planner and DNS Enactor automation worldwide. Switch to manual DNS management until safeguards could be implemented.

In November 2025, AWS introduced a DNS failover feature. Services can now specify backup DNS records that activate automatically if primary records become empty or invalid. Invariant checking prevents DNS records from ever being set to empty. Staggered recovery mechanisms prevent thundering herd problems.

The broader lesson: the fix for a race condition in automation isn't just fixing the race condition. It's adding invariants that prevent the system from ever reaching an invalid state. You don't just fix the bug. You make the bug's consequences impossible.

## Personal Takeaways

Working customer-facing triage during this incident taught me a few things I won't forget.

The hardest incidents are the invisible ones. When customers can see the failure (server down, network partition), they understand what's happening. When the failure is invisible to them but their applications are broken, trust erodes quickly.

DNS failures are uniquely bad because they're cached. Fixing the root cause doesn't immediately fix the symptom. This creates a secondary wave of confusion when customers' "fixes" don't work.

At AWS scale, recovery is itself a distributed systems problem. The DWFM congestive collapse showed that at sufficient scale, even recovery requires careful orchestration.

This incident affected 70,000+ organizations and caused hundreds of millions in estimated losses. It also demonstrated the incredible interconnectedness of modern cloud infrastructure. A race condition in a DNS management system became a global business continuity event. That's both the power and the fragility of the cloud.
