/** Tall vertical "library" box-art used for the recent-activity cards. */
export const getVerticalCoverUrl = (appid: number) =>
  `https://steamcdn-a.akamaihd.net/steam/apps/${appid}/library_600x900.jpg`;

/** Wide header image used as a fallback and for the log-list thumbnails. */
export const getHeaderImageUrl = (appid: number) =>
  `https://steamcdn-a.akamaihd.net/steam/apps/${appid}/header.jpg`;

/** Formats a millisecond timestamp as e.g. "Jun 1, 2024", or "" when unknown. */
export const formatLogDate = (ms: number) => {
  if (!ms) return '';
  return new Date(ms).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};
