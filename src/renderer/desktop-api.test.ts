import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ invoke: vi.fn(), listen: vi.fn(), openUrl: vi.fn() }));
vi.mock('@tauri-apps/api/core', () => ({ invoke: mocks.invoke }));
vi.mock('@tauri-apps/api/event', () => ({ listen: mocks.listen }));
vi.mock('@tauri-apps/plugin-opener', () => ({ openUrl: mocks.openUrl }));
vi.stubGlobal('window', {});
vi.stubGlobal('document', { addEventListener: vi.fn() });
const { desktopAPI } = await import('./desktop-api');

beforeEach(() => vi.clearAllMocks());

describe('Tauri desktop bridge', () => {
  it('preserves the payload shape for session edits, settings, and batch fetches', async () => {
    const session = { id: 'session-1', appid: 10, date: '2026-01-01', minutes: 45 };
    await desktopAPI.saveSession(10, session);
    expect(mocks.invoke).toHaveBeenLastCalledWith('request', {
      operation: 'save-session',
      payload: { appid: 10, session },
    });
    await desktopAPI.fetchAchievements([10, 20]);
    expect(mocks.invoke).toHaveBeenLastCalledWith('request', {
      operation: 'fetch-achievements',
      payload: [10, 20],
    });
    await desktopAPI.getGames();
    expect(mocks.invoke).toHaveBeenLastCalledWith('request', {
      operation: 'get-games',
      payload: null,
    });
  });

  it('removes a listener even when unmounted before registration completes', async () => {
    let register!: (stop: () => void) => void;
    mocks.listen.mockReturnValue(
      new Promise<() => void>((resolve) => {
        register = resolve;
      }),
    );
    const stop = desktopAPI.onRatingsProgress(vi.fn());
    stop();
    const unlisten = vi.fn();
    register(unlisten);
    await Promise.resolve();
    expect(unlisten).toHaveBeenCalledOnce();
  });

  it('passes progress payloads to subscribers and cleans up registered listeners', async () => {
    const unlisten = vi.fn();
    mocks.listen.mockResolvedValue(unlisten);
    const callback = vi.fn();
    const stop = desktopAPI.onAchievementsProgress(callback);
    const handler = mocks.listen.mock.calls[0][1];
    handler({ payload: { fetched: 2, total: 5 } });
    expect(callback).toHaveBeenCalledWith({ fetched: 2, total: 5 });
    await Promise.resolve();
    stop();
    expect(unlisten).toHaveBeenCalledOnce();
  });
});
