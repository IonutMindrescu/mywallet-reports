import {
  Activity, AlertTriangle, ArrowDownLeft, ArrowLeftRight, Baby, Banknote, Bike, Briefcase, CalendarDays, Car, Cigarette, CircleHelp,
  Coffee, Coins, CreditCard, Dumbbell, FileText, Flame, Fuel, Gauge, Gift, GraduationCap, HandCoins, HeartPulse, House, KeyRound, Landmark, Laptop,
  type LucideProps, Package, PawPrint, PiggyBank, Plane, Repeat, Send, Shield, Shirt, ShoppingCart, Sparkles, Tag, Ticket,
  TrendingDown, TrendingUp, Undo2, UtensilsCrossed, Wallet, Wifi, Wrench, Zap,
} from 'lucide-react';
import type { ComponentType } from 'react';

const MAP: Record<string, ComponentType<LucideProps>> = {
  Activity, AlertTriangle, ArrowDownLeft, ArrowLeftRight, Baby, Banknote, Bike, Briefcase, CalendarDays, Car, Cigarette, CircleHelp,
  Coffee, Coins, CreditCard, Dumbbell, FileText, Flame, Fuel, Gauge, Gift, GraduationCap, HandCoins, HeartPulse, House, KeyRound, Landmark, Laptop,
  Package, PawPrint, PiggyBank, Plane, Repeat, Send, Shield, Shirt, ShoppingCart, Sparkles, Tag, Ticket, TrendingDown,
  TrendingUp, Undo2, UtensilsCrossed, Wallet, Wifi, Wrench, Zap,
};

export function Icon({ name, ...rest }: { name: string } & LucideProps) {
  const C = MAP[name] ?? Tag;
  return <C {...rest} />;
}
