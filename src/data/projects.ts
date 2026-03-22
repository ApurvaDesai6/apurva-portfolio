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
    tags: ['AWS', 'Security', 'Engineering'],
    badge: 'AWS Internal',
  },
  {
    name: 'AquaSDG',
    description: "AI water security analysis using Google's Groundsource dataset, FloodHub, and Gemini. Recommends infrastructure investment for UN SDG 6 compliance.",
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
    url: 'https://wine.apurvad.xyz',
    tags: ['ML', 'Python'],
    badge: 'New',
  },
  {
    name: 'SmartDose',
    description: 'IoT medication adherence platform. React Native + Node.js + DynamoDB + ESP32 hardware. $15K funded through EECS 495, selected 1 of 10 out of 50+ proposals.',
    image: '/images/projects/smartdose.webp',
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
    tags: ['AWS', 'Engineering'],
  },
];
