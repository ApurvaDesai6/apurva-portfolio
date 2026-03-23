export interface Project {
  name: string;
  description: string;
  image?: string;
  video?: string;
  url?: string;
  github?: string;
  tags: string[];
  badge?: string;
}

export const projects: Project[] = [
  {
    name: 'Wine Quality & Price Predictor v2',
    description: 'CatBoost model on 130K reviews achieving 98% rating accuracy. SHAP interpretability, taster bias correction, VLM label scanning, and live price search.',
    image: '/images/projects/wine-predictor.svg',
    url: 'https://wine.apurvad.xyz',
    github: 'https://github.com/ApurvaDesai6/wine-predictor',
    tags: ['ML', 'Python'],
    badge: 'New',
  },
  {
    name: 'WAF Rule Simulator',
    description: 'Interactive web simulator for testing AWS WAF rules against configurable traffic flows. Export to Terraform or JSON.',
    image: '/images/projects/waf-simulator.svg',
    url: 'https://wafsim.apurvad.xyz',
    github: 'https://github.com/ApurvaDesai6/wafsim',
    tags: ['AWS', 'Security', 'Engineering'],
  },
  {
    name: 'AquaSDG',
    description: "AI water security analysis using Google's Groundsource dataset, FloodHub, and Gemini. Recommends infrastructure investment for UN SDG 6 compliance.",
    image: '/images/projects/aquasdg.svg',
    url: 'https://aquasdg.apurvad.xyz',
    github: 'https://github.com/ApurvaDesai6/aquasdg',
    tags: ['ML', 'AI', 'Climate'],
    badge: 'New',
  },
  {
    name: 'March Madness Agent Swarm',
    description: 'Multi-agent NCAA bracket predictor. Configure swarm size and agent personas. Update simulations in natural language.',
    image: '/images/projects/march-madness.svg',
    url: 'https://ncaa.apurvad.xyz',
    github: 'https://github.com/ApurvaDesai6/ncaa-bracket-predictor',
    tags: ['ML', 'AI', 'Sports'],
    badge: 'New',
  },
  {
    name: 'SmartDose',
    description: 'IoT medication adherence platform. React Native + Node.js + DynamoDB + ESP32 hardware. $15K funded through EECS 495, selected 1 of 10 out of 50+ proposals.',
    image: '/images/projects/smartdose.svg',
    tags: ['IoT', 'Engineering'],
  },
];
