export const getRatingColor = (score: number) => {
  if (score >= 70) return '#66c0f4';
  if (score >= 40) return '#b9a074';
  return '#a34c4c';
};

export const getGameCover = (appid: number, hash: string) => {
  if (!hash) return '';
  return `https://media.steampowered.com/steamcommunity/public/images/apps/${appid}/${hash}.jpg`;
};

export const formatPlaytime = (minutes: number) => {
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  return `${hours.toLocaleString()} hrs`;
};
