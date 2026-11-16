import { useState } from 'react';

import styles from './game-thumb.module.css';

type Props = {
  appid: number;
  iconHash?: string;
};

const getHeaderUrl = (appid: number) =>
  `https://steamcdn-a.akamaihd.net/steam/apps/${appid}/header.jpg`;

const getIconUrl = (appid: number, hash: string) =>
  `https://media.steampowered.com/steamcommunity/public/images/apps/${appid}/${hash}.jpg`;

/** Wide header thumbnail. Newer games lack the legacy header path, so fall back to the icon. */
export const GameThumb = ({ appid, iconHash }: Props) => {
  const [stage, setStage] = useState<'header' | 'icon' | 'none'>('header');

  const src =
    stage === 'header'
      ? getHeaderUrl(appid)
      : stage === 'icon' && iconHash
        ? getIconUrl(appid, iconHash)
        : null;

  return (
    <div className={styles.thumb}>
      {src && (
        // WebKit only defers the request when `loading` is set before `src`.
        <img
          loading="lazy"
          className={stage === 'icon' ? styles.icon : undefined}
          src={src}
          alt=""
          onError={() => setStage(stage === 'header' ? 'icon' : 'none')}
        />
      )}
    </div>
  );
};
