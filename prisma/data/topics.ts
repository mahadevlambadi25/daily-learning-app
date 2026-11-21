// The 50-topic catalogue (PRD §2) with the 10 featured first-screen topics (PRD §3).
// `featuredRank` orders the featured tiles; `iconKey` maps to src/components/topic-icon.tsx.

export type TopicSeed = {
  slug: string;
  name: string;
  group: string;
  description: string;
  iconKey: string;
  featuredRank?: number;
};

const PG = "Personal Growth & Psychology";
const CA = "Career & Professional Skills";
const BM = "Business & Money";
const HL = "Health & Lifestyle";
const TS = "Technology, Society & Ideas";

export const TOPICS: TopicSeed[] = [
  { slug: "psychology-human-behaviour", name: "Psychology & Human Behaviour", group: PG, iconKey: "brain", featuredRank: 2, description: "Understand why people think, feel and behave the way they do." },
  { slug: "emotional-intelligence", name: "Emotional Intelligence", group: PG, iconKey: "heart", featuredRank: 6, description: "Recognise emotions, manage reactions and work better with other people." },
  { slug: "habits-behaviour-change", name: "Habits & Behaviour Change", group: PG, iconKey: "repeat", description: "Build routines that stick and break the ones that hold you back." },
  { slug: "confidence-self-esteem", name: "Confidence & Self-Esteem", group: PG, iconKey: "shield", description: "Grow a steady, realistic belief in your own abilities." },
  { slug: "mindfulness-meditation", name: "Mindfulness & Meditation", group: PG, iconKey: "flower", description: "Simple practices to focus attention and calm a busy mind." },
  { slug: "stress-management-resilience", name: "Stress Management & Resilience", group: PG, iconKey: "waves", description: "Handle pressure well and recover faster from setbacks." },
  { slug: "motivation-discipline", name: "Motivation & Discipline", group: PG, iconKey: "flame", description: "Get started, keep going and follow through on what matters." },
  { slug: "critical-thinking", name: "Critical Thinking", group: PG, iconKey: "search", description: "Question claims, spot weak arguments and reason more clearly." },
  { slug: "decision-making", name: "Decision-Making", group: PG, iconKey: "split", description: "Make better choices under uncertainty with simple frameworks." },
  { slug: "creativity-innovation", name: "Creativity & Innovation", group: PG, iconKey: "lightbulb", description: "Generate fresh ideas and turn them into something real." },

  { slug: "productivity-time-management", name: "Productivity & Time Management", group: CA, iconKey: "clock", featuredRank: 3, description: "Focus on meaningful work, build better routines and use time intentionally." },
  { slug: "communication-skills", name: "Communication Skills", group: CA, iconKey: "message", featuredRank: 5, description: "Express ideas clearly, listen better and handle conversations with confidence." },
  { slug: "leadership-management", name: "Leadership & Management", group: CA, iconKey: "compass", featuredRank: 7, description: "Build the skills to guide people, make decisions and create clarity." },
  { slug: "public-speaking-storytelling", name: "Public Speaking & Storytelling", group: CA, iconKey: "mic", description: "Speak with confidence and tell stories people remember." },
  { slug: "negotiation-conflict-resolution", name: "Negotiation & Conflict Resolution", group: CA, iconKey: "handshake", description: "Reach fair agreements and turn disagreements into progress." },
  { slug: "career-growth-workplace-skills", name: "Career Growth & Workplace Skills", group: CA, iconKey: "trending-up", description: "Grow your career with skills that get noticed at work." },
  { slug: "personal-branding-networking", name: "Personal Branding & Networking", group: CA, iconKey: "network", description: "Build genuine professional relationships and a clear reputation." },
  { slug: "teamwork-collaboration", name: "Teamwork & Collaboration", group: CA, iconKey: "users", description: "Work well with others and help teams do their best work." },
  { slug: "problem-solving", name: "Problem-Solving", group: CA, iconKey: "puzzle", description: "Break down messy problems and find solutions that work." },
  { slug: "learning-how-to-learn", name: "Learning How to Learn", group: CA, iconKey: "graduation", description: "Evidence-based techniques to learn faster and remember longer." },

  { slug: "personal-finance-budgeting", name: "Personal Finance & Budgeting", group: BM, iconKey: "wallet", featuredRank: 1, description: "Make better everyday money decisions, build a budget and understand financial basics." },
  { slug: "investing-fundamentals", name: "Investing Fundamentals", group: BM, iconKey: "line-chart", featuredRank: 8, description: "Learn core investing concepts, risk, diversification and long-term thinking." },
  { slug: "money-psychology", name: "Money Psychology", group: BM, iconKey: "piggy-bank", description: "Understand the habits and emotions behind money decisions." },
  { slug: "entrepreneurship-startups", name: "Entrepreneurship & Startups", group: BM, iconKey: "rocket", featuredRank: 10, description: "Explore business models, customers, validation and building ventures." },
  { slug: "business-strategy", name: "Business Strategy", group: BM, iconKey: "target", description: "How companies compete, create value and make big choices." },
  { slug: "sales-persuasion", name: "Sales & Persuasion", group: BM, iconKey: "badge-dollar", description: "Persuade ethically and understand what helps people say yes." },
  { slug: "marketing-branding", name: "Marketing & Branding", group: BM, iconKey: "megaphone", description: "Reach the right people with a message that resonates." },
  { slug: "customer-experience", name: "Customer Experience", group: BM, iconKey: "smile", description: "Design experiences customers love and keep coming back to." },
  { slug: "operations-project-management", name: "Operations & Project Management", group: BM, iconKey: "kanban", description: "Plan, run and deliver projects without the chaos." },
  { slug: "economics-business-trends", name: "Economics & Business Trends", group: BM, iconKey: "globe", description: "Make sense of markets, inflation and the forces shaping business." },

  { slug: "nutrition-healthy-eating", name: "Nutrition & Healthy Eating", group: HL, iconKey: "apple", featuredRank: 9, description: "Understand everyday nutrition and make more informed food choices." },
  { slug: "fitness-strength-training", name: "Fitness & Strength Training", group: HL, iconKey: "dumbbell", description: "Move better and build strength safely and sustainably." },
  { slug: "sleep-recovery", name: "Sleep & Recovery", group: HL, iconKey: "moon", description: "Sleep better and recover well with practical, science-backed habits." },
  { slug: "mental-health-literacy", name: "Mental Health Literacy", group: HL, iconKey: "heart-pulse", description: "Understand common mental health topics and when to seek support." },
  { slug: "brain-health-memory", name: "Brain Health & Memory", group: HL, iconKey: "brain-circuit", description: "Look after your brain and sharpen your memory." },
  { slug: "longevity-preventive-health", name: "Longevity & Preventive Health", group: HL, iconKey: "hourglass", description: "Everyday habits and checks that support a longer, healthier life." },
  { slug: "relationships-social-skills", name: "Relationships & Social Skills", group: HL, iconKey: "heart-handshake", description: "Build closer relationships and feel at ease with people." },
  { slug: "parenting-family", name: "Parenting & Family", group: HL, iconKey: "baby", description: "Practical ideas for raising children and strengthening family life." },
  { slug: "digital-wellbeing", name: "Digital Wellbeing", group: HL, iconKey: "smartphone", description: "Use technology on your terms and reclaim your attention." },
  { slug: "practical-first-aid-safety", name: "Practical First Aid & Safety", group: HL, iconKey: "life-buoy", description: "Know the basics to stay safe and help others in an emergency." },

  { slug: "artificial-intelligence-ai-tools", name: "Artificial Intelligence & AI Tools", group: TS, iconKey: "bot", featuredRank: 4, description: "Understand practical AI concepts, tools and how technology is changing work." },
  { slug: "technology-future-trends", name: "Technology & Future Trends", group: TS, iconKey: "cpu", description: "The technologies shaping tomorrow, explained simply." },
  { slug: "data-digital-literacy", name: "Data & Digital Literacy", group: TS, iconKey: "database", description: "Read data, spot misleading numbers and stay safe online." },
  { slug: "science-explained", name: "Science Explained", group: TS, iconKey: "flask", description: "Big scientific ideas made clear and relevant to daily life." },
  { slug: "history-civilisations", name: "History & Civilisations", group: TS, iconKey: "landmark", description: "Stories and lessons from the people and societies before us." },
  { slug: "philosophy-ethics", name: "Philosophy & Ethics", group: TS, iconKey: "scale", description: "Timeless questions about how to think, live and act well." },
  { slug: "climate-sustainability", name: "Climate & Sustainability", group: TS, iconKey: "leaf", description: "Understand climate science and practical ways to live sustainably." },
  { slug: "geopolitics-world-affairs", name: "Geopolitics & World Affairs", group: TS, iconKey: "map", description: "How power, trade and borders shape the world we live in." },
  { slug: "culture-human-society", name: "Culture & Human Society", group: TS, iconKey: "drama", description: "Explore the customs, beliefs and ideas that bind people together." },
  { slug: "design-visual-thinking", name: "Design & Visual Thinking", group: TS, iconKey: "palette", description: "See like a designer and communicate ideas visually." },
];
