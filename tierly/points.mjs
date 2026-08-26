export function calculatePoints(placement) {
  if (placement === 1) return 10;
  if (placement === 2) return 6;
  if (placement === 3) return 3;
  return 1;
}

if (typeof window !== "undefined") {
  window.calculatePoints = calculatePoints;
}
