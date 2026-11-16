export const getRatingColor = (score: number) => {
  if (score >= 70) return '#66c0f4';
  if (score >= 40) return '#b9a074';
  return '#e07a7a';
};
