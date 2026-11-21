import {
  Apple, BadgeDollarSign, Baby, Bot, Brain, BrainCircuit, Clock, Compass, Cpu, Database, Drama, Dumbbell, Flame,
  FlaskConical, Flower2, Globe, GraduationCap, Handshake, Heart, HeartHandshake, HeartPulse, Hourglass, KanbanSquare,
  Landmark, Leaf, LifeBuoy, Lightbulb, LineChart, Map, Megaphone, MessageCircle, Mic, Moon, Network, Palette, PiggyBank,
  Puzzle, Repeat, Rocket, Scale, Search, Shield, Smartphone, Smile, Split, Target, TrendingUp, Users, Waves, BookOpen,
  type LucideIcon,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  apple: Apple, "badge-dollar": BadgeDollarSign, baby: Baby, bot: Bot, brain: Brain, "brain-circuit": BrainCircuit,
  clock: Clock, compass: Compass, cpu: Cpu, database: Database, drama: Drama, dumbbell: Dumbbell, flame: Flame,
  flask: FlaskConical, flower: Flower2, globe: Globe, graduation: GraduationCap, handshake: Handshake, heart: Heart,
  "heart-handshake": HeartHandshake, "heart-pulse": HeartPulse, hourglass: Hourglass, kanban: KanbanSquare,
  landmark: Landmark, leaf: Leaf, "life-buoy": LifeBuoy, lightbulb: Lightbulb, "line-chart": LineChart, map: Map,
  megaphone: Megaphone, message: MessageCircle, mic: Mic, moon: Moon, network: Network, palette: Palette,
  "piggy-bank": PiggyBank, puzzle: Puzzle, repeat: Repeat, rocket: Rocket, scale: Scale, search: Search, shield: Shield,
  smartphone: Smartphone, smile: Smile, split: Split, target: Target, "trending-up": TrendingUp, users: Users, waves: Waves,
};

export function TopicIcon({ iconKey, className = "size-5" }: { iconKey: string; className?: string }) {
  const Icon = ICONS[iconKey] ?? BookOpen;
  return <Icon className={className} aria-hidden />;
}
