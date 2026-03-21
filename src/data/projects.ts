export interface Project {
  name: string;
  description: string;
  image?: string;
  video?: string;
  url?: string;
  tags: string[];
  badge?: string;
}

export const projects: Project[] = [
  {
    name: 'WAF Rule Simulator',
    description: 'Interactive web simulator for testing AWS WAF rules against configurable traffic flows. Export to Terraform or JSON.',
    image: '/images/projects/waf-simulator.webp',
    video: '/images/projects/waf-simulator.mp4',
    tags: ['AWS', 'Security', 'Engineering'],
    badge: 'AWS Internal',
  },
  {
    name: 'AquaSDG',
    description: "AI water security analysis using Google's groundsource dataset, FloodHub, and Gemini. Recommends infrastructure investment for UN SDG 6 compliance.",
    image: '/images/projects/aquasdg.webp',
    tags: ['ML', 'AI', 'Climate'],
    badge: 'New',
  },
  {
    name: 'March Madness Agent Swarm',
    description: 'Multi-agent NCAA bracket predictor. Configure swarm size and agent personas. Update simulations in natural language.',
    image: '/images/projects/march-madness.webp',
    tags: ['ML', 'AI', 'Sports'],
    badge: 'New',
  },
  {
    name: 'Wine Quality & Price Predictor v2',
    description: 'CatBoost model on 130K reviews achieving 98% rating accuracy. SHAP interpretability, taster bias correction, and interactive UI.',
    image: '/images/projects/wine-predictor-v2.webp',
    url: 'https://github.com/ApurvaDesai6/wine-predictor',
    tags: ['ML', 'Python'],
    badge: 'New',
  },
  {
    name: 'DNS Cascade Incident (us-east-1)',
    description: "Technical case study: how a race condition in DynamoDB's DNS management system cascaded into a multi-hour outage affecting 70,000+ organizations.",
    image: '/images/projects/dns-incident.webp',
    url: '/essays/dns-incident',
    tags: ['AWS', 'Engineering', 'Incident'],
  },
  {
    name: 'me-central-1 Physical Disaster Response',
    description: 'Incident retrospective on the March 2026 UAE data center failure. Live workload migration, KMS re-encryption, and DR execution under physical infrastructure loss.',
    image: '/images/projects/me-central-1.webp',
    url: '/essays/me-central-1',
    tags: ['AWS', 'Engineering', 'Incident'],
  },
  {
    name: 'SmartDose',
    description: 'IoT medication management platform. React Native + Node.js + DynamoDB. ESP32 hardware. 1 of 10 student projects selected for continued funding.',
    image: '/images/projects/smartdose.webp',
    url: 'https://github.com/ApurvaDesai6/smartdose',
    tags: ['IoT', 'Engineering'],
  },
  {
    name: 'AI/ML Governance Framework',
    description: 'Delivered AI governance recommendations for the City of Prague under OICT. Healthcare predictive analytics and infrastructure management systems.',
    image: '/images/projects/ai-governance.webp',
    tags: ['AI', 'Research'],
    badge: 'Research',
  },
  {
    name: 'apurvad.xyz Infrastructure',
    description: 'Production AWS infrastructure: S3 + CloudFront + ACM + Route 53. Migrated from EC2/ALB/NAT ($59/mo) to static hosting ($2/mo) with full TLS and edge caching.',
    image: '/images/projects/infrastructure.webp',
    url: '/essays/infra',
    tags: ['AWS', 'Engineering'],
  },
];
