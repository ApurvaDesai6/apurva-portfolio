---
title: "AI Governance in Smart Cities: Lessons from Prague"
description: "What I learned about governing AI in public infrastructure through the Prague Process simulation with Operátor ICT."
publishDate: 2024-05-15
tags: ["AI", "Research"]
---

During my last year at Michigan I participated in the Prague Process, an academic simulation where students took on roles of international delegates to negotiate AI governance policy. Think Model UN, but for AI regulation. What made it real was the case material: we worked with actual challenges from Operátor ICT (OICT), Prague's city-owned digital infrastructure company.

OICT runs Prague's smart city stack. Their transit app PID Lítačka handles AI-powered routing for millions of riders. Their Golemio platform is an open city data system that powers everything from traffic management to environmental monitoring. They operate the municipal camera network. These aren't hypothetical AI systems. They're live, serving citizens, making decisions that affect people's daily commutes and public safety.

That's what made the simulation interesting. We weren't debating abstract principles. We were trying to figure out how you actually govern an AI system that decides which bus route gets optimized first, or how a city camera network should handle facial recognition.

## The five approaches

We studied five jurisdictions, each with a fundamentally different philosophy.

The **EU** went furthest with the AI Act (2024), creating a comprehensive risk-based framework. Unacceptable risk systems are banned outright. High-risk systems need conformity assessments, CE marking, and fundamental rights impact assessments. Fines go up to 7% of global annual turnover. It's the most prescriptive approach in the world.

The **US** took a sector-specific path. Executive Order 14110 plus the NIST AI Risk Management Framework, with enforcement distributed across existing agencies. The FDA handles medical AI, NHTSA handles autonomous vehicles. It's flexible but fragmented, with real coverage gaps between sectors.

**China** focused on algorithmic accountability and state oversight. Algorithm registries, security assessments for systems that could influence public opinion, and the Cyberspace Administration of China as the central authority. Clear enforcement, but limited civil society input.

The **UK** bet on a pro-innovation approach, empowering existing regulators (ICO, FCA, CQC) to apply AI governance within their domains rather than creating new horizontal legislation. Flexible and innovation-friendly, but potentially inconsistent across sectors.

**India** is still building its framework around the Digital Personal Data Protection Act (2023), with a proposed Data Protection Board. The approach is emerging and likely to be risk-based, but the implementation timeline remains unclear.

## What smart cities taught us about governance

The OICT case material made abstract policy debates concrete. A few examples:

**Golemio's open data platform** raises questions about algorithmic transparency that don't have clean answers. The city publishes data openly, which is great for accountability. But the algorithms that process that data into recommendations for city services aren't always transparent. When an algorithm suggests reallocating bus routes based on ridership patterns, who checks whether that disproportionately affects lower-income neighborhoods?

**Transit AI fairness** is harder than it sounds. PID Lítačka optimizes routes for efficiency, but efficiency and equity aren't the same thing. A route that serves fewer riders might be the only option for elderly or disabled residents. The EU AI Act would classify this as high-risk. The US approach would leave it to local transit authorities. Neither answer is obviously right.

**Municipal surveillance** was the most contentious topic. Prague operates a city camera network, and the question of whether to deploy facial recognition divided every stakeholder group. Civil society representatives pushed for outright bans. City government wanted exceptions for public safety. Tech vendors argued for regulated use with oversight. We never reached consensus, which felt honest.

## Key findings

After months of research and simulation, a few things became clear.

Regulatory fragmentation is the biggest practical challenge. An organization like OICT that operates across EU member states has to navigate the AI Act, GDPR, national implementations, and municipal regulations simultaneously. The compliance burden falls hardest on smaller organizations and cities that don't have dedicated legal teams.

No jurisdiction has figured out the innovation-protection balance. The EU's approach provides clarity but may slow deployment. The US approach preserves flexibility but leaves gaps. The UK approach trusts existing regulators but risks inconsistency. Every choice involves real tradeoffs.

Enforcement capacity lags behind regulatory ambition everywhere. Writing rules for AI transparency is one thing. Having the technical expertise to audit whether a transit routing algorithm is actually fair is another. Every jurisdiction we studied had this gap.

The most useful output from the simulation wasn't a policy recommendation. It was understanding that AI governance isn't a problem you solve once. It's an ongoing negotiation between competing values, and the right answer depends heavily on context, culture, and what specific AI system you're talking about.
