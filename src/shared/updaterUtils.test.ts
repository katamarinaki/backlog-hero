import { describe, it, expect } from 'vitest';

import { getUpdateFeed, deriveAppBundlePath } from './updaterUtils';

describe('getUpdateFeed', () => {
  it('returns the GitHub provider for the stable channel', () => {
    expect(getUpdateFeed('katamarinaki', 'backlog-hero', false)).toEqual({
      provider: 'github',
      owner: 'katamarinaki',
      repo: 'backlog-hero',
    });
  });

  it('returns the generic beta-tag feed for the beta channel', () => {
    expect(getUpdateFeed('katamarinaki', 'backlog-hero', true)).toEqual({
      provider: 'generic',
      url: 'https://github.com/katamarinaki/backlog-hero/releases/download/beta/',
    });
  });
});

describe('deriveAppBundlePath', () => {
  it('extracts the .app bundle from a macOS executable path', () => {
    expect(deriveAppBundlePath('/Applications/Backlog Hero.app/Contents/MacOS/Backlog Hero')).toBe(
      '/Applications/Backlog Hero.app',
    );
  });

  it('works for bundles installed outside /Applications', () => {
    expect(
      deriveAppBundlePath('/Users/me/Desktop/Backlog Hero.app/Contents/MacOS/Backlog Hero'),
    ).toBe('/Users/me/Desktop/Backlog Hero.app');
  });

  it('returns null when the path is not inside an .app bundle', () => {
    expect(deriveAppBundlePath('/usr/local/bin/backlog-hero')).toBeNull();
  });
});
