import {
  ArrowLeft, ArrowRight, BadgeDollarSign, Banknote, BarChart3, Bell,
  Building2, Check, ChevronDown, Circle, CircleAlert, Clock3, CreditCard,
  Eye, FileCheck2, FileText, Flag, Headphones, Hospital, KeyRound,
  LayoutDashboard, LifeBuoy, Link2, LockKeyhole, Mail, Play, RefreshCcw,
  Send, Shield, ShieldCheck, UserCog, UserPlus, UserRound, Users, X,
} from "lucide-react";

const icons = {
  arrowLeft: ArrowLeft, arrowRight: ArrowRight, banknote: Banknote,
  billing: BadgeDollarSign, chart: BarChart3, bell: Bell, building: Building2,
  check: Check, chevronDown: ChevronDown, alert: CircleAlert, clock: Clock3,
  card: CreditCard, dashboard: LayoutDashboard, eye: Eye, fileCheck: FileCheck2,
  file: FileText, flag: Flag, headphones: Headphones, hospital: Hospital,
  key: KeyRound, lifeBuoy: LifeBuoy, link: Link2, lock: LockKeyhole,
  mail: Mail, play: Play, refresh: RefreshCcw, send: Send, shield: Shield,
  shieldCheck: ShieldCheck, userCog: UserCog, userPlus: UserPlus,
  user: UserRound, users: Users, x: X,
};

export default function LucideIcon({ name, size = 24, strokeWidth = 1.9, ...props }) {
  const Icon = icons[name] || Circle;
  return <Icon aria-hidden="true" size={size} strokeWidth={strokeWidth} {...props} />;
}
