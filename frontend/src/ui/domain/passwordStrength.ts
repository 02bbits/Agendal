export function passwordStrength(password: string): number {
  const length = [...password].length;
  if (length < 8) return 0;
  let score = 1;
  if (length >= 12) score += 1;
  if (length >= 16) score += 1;

  let classes = 0;
  if (/[a-z]/.test(password)) classes += 1;
  if (/[A-Z]/.test(password)) classes += 1;
  if (/[0-9]/.test(password)) classes += 1;
  if (/[^a-zA-Z0-9]/.test(password)) classes += 1;
  if (classes >= 3) score += 1;

  return Math.min(Math.max(score, 1), 4);
}
