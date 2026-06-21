export interface LevelDef {
  tier: string;
  minXp: number;
  sortOrder: number;
  discount: number;
  badgeLabel: string;
  badgeColor: string;
}

export const LEVELS: LevelDef[] = [
  { tier: 'bronze',   minXp: 0,   sortOrder: 0, discount: 0,  badgeLabel: 'Bronce',   badgeColor: 'text-amber-600' },
  { tier: 'silver',   minXp: 30,  sortOrder: 1, discount: 5,  badgeLabel: 'Plata',    badgeColor: 'text-slate-300' },
  { tier: 'gold',     minXp: 100, sortOrder: 2, discount: 10, badgeLabel: 'Oro',      badgeColor: 'text-yellow-400' },
  { tier: 'platinum', minXp: 250, sortOrder: 3, discount: 15, badgeLabel: 'Platino',  badgeColor: 'text-cyan-300' },
];

export const XP_REWARDS = {
  RESERVATION_COMPLETED: 10,
} as const;

export function getLevelDef(tier: string): LevelDef | undefined {
  return LEVELS.find(l => l.tier === tier);
}

export function getNextLevelDef(currentTier: string): LevelDef | undefined {
  const current = LEVELS.find(l => l.tier === currentTier);
  if (!current) return LEVELS[0];
  return LEVELS[current.sortOrder + 1];
}

export interface BenefitInfo {
  type: string;
  description: string;
  config: Record<string, unknown> | null;
}

export function getBenefitsForLevel(tier: string): BenefitInfo[] {
  const level = LEVELS.find(l => l.tier === tier);
  if (!level) return [];

  const benefits: BenefitInfo[] = [
    {
      type: 'badge',
      description: `Badge nivel ${level.badgeLabel}`,
      config: { color: level.badgeColor, label: level.badgeLabel },
    },
  ];
  if (level.discount > 0) {
    benefits.push({
      type: 'discount',
      description: `${level.discount}% de descuento en reservas`,
      config: { percentage: level.discount },
    });
  }
  return benefits;
}
