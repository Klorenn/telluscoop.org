// Difficulty curve mirrors calculatePoints (10/6/3/1 per event): each tier
// roughly doubles/steps up from the previous one, and each tier splits into
// 3 divisions (I → III) with their own threshold, so climbing stays hard but
// reachable over a season. platinum/diamond icons pending, see NEXT_SESSION.md.
export const GAMING_TIERS = [
  { id: "bronze", icon: "/tierly/ranks/bronze.png", divisions: [0, 170, 340] },
  { id: "silver", icon: "/tierly/ranks/silver.png", divisions: [500, 670, 840] },
  { id: "gold", icon: "/tierly/ranks/gold.png", divisions: [1000, 1230, 1470] },
  { id: "platinum", icon: "/tierly/ranks/platinum.png", divisions: [1700, 2100, 2500] },
  { id: "diamond", icon: "/tierly/ranks/diamond.png", divisions: [3000, 3500, 4000] },
];

// Flattened, ascending list of every rank (tier + division), each with its
// own point minimum, e.g. bronze 1 at 0, bronze 2 at 170, silver 1 at 500...
export const GAMING_RANKS = GAMING_TIERS.flatMap((tier) =>
  tier.divisions.map((min, i) => ({ tierId: tier.id, icon: tier.icon, division: i + 1, min })),
);

export function rankForPoints(points) {
  let current = GAMING_RANKS[0];
  for (const rank of GAMING_RANKS) {
    if (points >= rank.min) current = rank;
  }
  return current;
}

export function nextRankForPoints(points) {
  return GAMING_RANKS.find((rank) => points < rank.min) || null;
}

if (typeof window !== "undefined") {
  window.GAMING_TIERS = GAMING_TIERS;
  window.GAMING_RANKS = GAMING_RANKS;
  window.rankForPoints = rankForPoints;
  window.nextRankForPoints = nextRankForPoints;
}
