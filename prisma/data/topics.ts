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
  { slug: "habits-behaviour-change", name: "Habits & Behaviour Change", group: PG, iconKey: "repeat", description: "How habits actually form, and how to start one you'll keep." },
  { slug: "confidence-self-esteem", name: "Confidence & Self-Esteem", group: PG, iconKey: "shield", description: "Where confidence comes from, and how to build more of it." },
  { slug: "mindfulness-meditation", name: "Mindfulness & Meditation", group: PG, iconKey: "flower", description: "Short exercises for a busy mind. No incense required." },
  { slug: "stress-management-resilience", name: "Stress Management & Resilience", group: PG, iconKey: "waves", description: "Practical ways to handle pressure and get through bad weeks." },
  { slug: "motivation-discipline", name: "Motivation & Discipline", group: PG, iconKey: "flame", description: "Getting started when you don't feel like it." },
  { slug: "critical-thinking", name: "Critical Thinking", group: PG, iconKey: "search", description: "Spot weak arguments, dodgy stats and claims that don't add up." },
  { slug: "decision-making", name: "Decision-Making", group: PG, iconKey: "split", description: "Better ways to choose when there's no obvious right answer." },
  { slug: "creativity-innovation", name: "Creativity & Innovation", group: PG, iconKey: "lightbulb", description: "Where good ideas come from, and how to have more of them." },

  { slug: "productivity-time-management", name: "Productivity & Time Management", group: CA, iconKey: "clock", featuredRank: 3, description: "Focus on meaningful work, build better routines and use time intentionally." },
  { slug: "communication-skills", name: "Communication Skills", group: CA, iconKey: "message", featuredRank: 5, description: "Express ideas clearly, listen better and handle conversations with confidence." },
  { slug: "leadership-management", name: "Leadership & Management", group: CA, iconKey: "compass", featuredRank: 7, description: "Build the skills to guide people, make decisions and create clarity." },
  { slug: "public-speaking-storytelling", name: "Public Speaking & Storytelling", group: CA, iconKey: "mic", description: "Talks and presentations people remember for the right reasons." },
  { slug: "negotiation-conflict-resolution", name: "Negotiation & Conflict Resolution", group: CA, iconKey: "handshake", description: "Getting to a fair deal, and disagreeing without falling out." },
  { slug: "career-growth-workplace-skills", name: "Career Growth & Workplace Skills", group: CA, iconKey: "trending-up", description: "Getting noticed, getting promoted and getting better at your job." },
  { slug: "personal-branding-networking", name: "Personal Branding & Networking", group: CA, iconKey: "network", description: "Meeting people and staying in touch without it feeling fake." },
  { slug: "teamwork-collaboration", name: "Teamwork & Collaboration", group: CA, iconKey: "users", description: "Why some teams work well together and others grind." },
  { slug: "problem-solving", name: "Problem-Solving", group: CA, iconKey: "puzzle", description: "Breaking a messy problem into pieces you can actually fix." },
  { slug: "learning-how-to-learn", name: "Learning How to Learn", group: CA, iconKey: "graduation", description: "Study techniques that work, and popular ones that don't." },

  { slug: "personal-finance-budgeting", name: "Personal Finance & Budgeting", group: BM, iconKey: "wallet", featuredRank: 1, description: "Make better everyday money decisions, build a budget and understand financial basics." },
  { slug: "investing-fundamentals", name: "Investing Fundamentals", group: BM, iconKey: "line-chart", featuredRank: 8, description: "Learn core investing concepts, risk, diversification and long-term thinking." },
  { slug: "money-psychology", name: "Money Psychology", group: BM, iconKey: "piggy-bank", description: "Why we spend, save and worry about money the way we do." },
  { slug: "entrepreneurship-startups", name: "Entrepreneurship & Startups", group: BM, iconKey: "rocket", featuredRank: 10, description: "Explore business models, customers, validation and building ventures." },
  { slug: "business-strategy", name: "Business Strategy", group: BM, iconKey: "target", description: "How companies pick where to compete, and what to say no to." },
  { slug: "sales-persuasion", name: "Sales & Persuasion", group: BM, iconKey: "badge-dollar", description: "Selling without being pushy, and noticing when you're being sold to." },
  { slug: "marketing-branding", name: "Marketing & Branding", group: BM, iconKey: "megaphone", description: "How people notice, remember and pick one brand over another." },
  { slug: "customer-experience", name: "Customer Experience", group: BM, iconKey: "smile", description: "What makes customers come back, and what makes them leave." },
  { slug: "operations-project-management", name: "Operations & Project Management", group: BM, iconKey: "kanban", description: "Planning work, keeping it on track and actually finishing." },
  { slug: "economics-business-trends", name: "Economics & Business Trends", group: BM, iconKey: "globe", description: "Inflation, interest rates and the other numbers in the news, explained." },

  { slug: "nutrition-healthy-eating", name: "Nutrition & Healthy Eating", group: HL, iconKey: "apple", featuredRank: 9, description: "Understand everyday nutrition and make more informed food choices." },
  { slug: "fitness-strength-training", name: "Fitness & Strength Training", group: HL, iconKey: "dumbbell", description: "Getting stronger safely, even if you've never lifted anything." },
  { slug: "sleep-recovery", name: "Sleep & Recovery", group: HL, iconKey: "moon", description: "Sleeping better, with habits that don't need a gadget." },
  { slug: "mental-health-literacy", name: "Mental Health Literacy", group: HL, iconKey: "heart-pulse", description: "Understanding common mental health problems, and when to get help." },
  { slug: "brain-health-memory", name: "Brain Health & Memory", group: HL, iconKey: "brain-circuit", description: "Keeping your brain healthy and your memory working well." },
  { slug: "longevity-preventive-health", name: "Longevity & Preventive Health", group: HL, iconKey: "hourglass", description: "The checks and habits that matter most for a long, healthy life." },
  { slug: "relationships-social-skills", name: "Relationships & Social Skills", group: HL, iconKey: "heart-handshake", description: "Getting on with people, and keeping the relationships you care about." },
  { slug: "parenting-family", name: "Parenting & Family", group: HL, iconKey: "baby", description: "Practical ideas for family life, from toddlers to teenagers." },
  { slug: "digital-wellbeing", name: "Digital Wellbeing", group: HL, iconKey: "smartphone", description: "Taking back some of the time your phone takes." },
  { slug: "practical-first-aid-safety", name: "Practical First Aid & Safety", group: HL, iconKey: "life-buoy", description: "What to do in the first few minutes of an emergency." },

  { slug: "artificial-intelligence-ai-tools", name: "Artificial Intelligence & AI Tools", group: TS, iconKey: "bot", featuredRank: 4, description: "Understand practical AI concepts, tools and how technology is changing work." },
  { slug: "technology-future-trends", name: "Technology & Future Trends", group: TS, iconKey: "cpu", description: "New technology explained, and how much of the hype to believe." },
  { slug: "data-digital-literacy", name: "Data & Digital Literacy", group: TS, iconKey: "database", description: "Reading charts and statistics, and staying safe online." },
  { slug: "science-explained", name: "Science Explained", group: TS, iconKey: "flask", description: "Everyday questions, answered with real science." },
  { slug: "history-civilisations", name: "History & Civilisations", group: TS, iconKey: "landmark", description: "The people and events that shaped the world we live in." },
  { slug: "philosophy-ethics", name: "Philosophy & Ethics", group: TS, iconKey: "scale", description: "Old questions about right, wrong and how to live, made practical." },
  { slug: "climate-sustainability", name: "Climate & Sustainability", group: TS, iconKey: "leaf", description: "How climate change works, and what actually makes a difference." },
  { slug: "geopolitics-world-affairs", name: "Geopolitics & World Affairs", group: TS, iconKey: "map", description: "Why countries do what they do, explained without jargon." },
  { slug: "culture-human-society", name: "Culture & Human Society", group: TS, iconKey: "drama", description: "Why people believe and behave the way they do in groups." },
  { slug: "design-visual-thinking", name: "Design & Visual Thinking", group: TS, iconKey: "palette", description: "Seeing like a designer, and making your own slides and documents clearer." },
];
