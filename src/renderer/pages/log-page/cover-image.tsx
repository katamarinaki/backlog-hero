import { useMemo, useState } from 'react';

import styles from './log-page.module.css';
import { getVerticalCoverUrl, getHeaderImageUrl } from './utils';

type Props = {
  appid: number;
  name: string;
  /** Accurate URL resolved from Steam's store API (preferred when available). */
  resolvedUrl?: string;
};

/**
 * Renders a game's vertical cover, trying the resolved URL first, then the
 * legacy library/header paths, and finally a text placeholder. Failed URLs are
 * tracked in state and the first non-failed candidate is picked during render,
 * so a later-arriving resolved URL correctly replaces a broken earlier attempt.
 */
export const CoverImage = ({ appid, name, resolvedUrl }: Props) => {
  const candidates = useMemo(
    () =>
      [resolvedUrl, getVerticalCoverUrl(appid), getHeaderImageUrl(appid)].filter(
        (url): url is string => Boolean(url),
      ),
    [resolvedUrl, appid],
  );

  const [failed, setFailed] = useState<Record<string, true>>({});
  const src = candidates.find((url) => !failed[url]);

  if (!src) {
    return <div className={styles.coverPlaceholder}>{name}</div>;
  }

  return (
    <img
      src={src}
      alt={name}
      loading="lazy"
      onError={() => setFailed((prev) => ({ ...prev, [src]: true }))}
    />
  );
};
