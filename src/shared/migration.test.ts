import { describe, it, expect } from 'vitest';

import { transformCompletionsToStatuses, migrateStatusSchema } from '../shared/migration';
import type { GameCompletion, GameStatus } from '../shared/types';

describe('transformCompletionsToStatuses', () => {
  it('returns null when statuses already exist', () => {
    const completions: Record<number, GameCompletion> = { 1: { completed: true } };
    const statuses: Record<number, GameStatus> = { 2: { status: 'completed' } };
    expect(transformCompletionsToStatuses(completions, statuses)).toBeNull();
  });

  it('returns null when completions are empty', () => {
    const completions: Record<number, GameCompletion> = {};
    const statuses: Record<number, GameStatus> = {};
    expect(transformCompletionsToStatuses(completions, statuses)).toBeNull();
  });

  it('returns null when no completions are marked completed', () => {
    const completions: Record<number, GameCompletion> = {
      1: { completed: false },
      2: { completed: false, completedDate: '2023-01-01' },
    };
    const statuses: Record<number, GameStatus> = {};
    expect(transformCompletionsToStatuses(completions, statuses)).toBeNull();
  });

  it('migrates a single completed game', () => {
    const completions: Record<number, GameCompletion> = {
      440: { completed: true, completedDate: '2024-06-15' },
    };
    const statuses: Record<number, GameStatus> = {};
    const result = transformCompletionsToStatuses(completions, statuses);

    expect(result).not.toBeNull();
    expect(result![440]).toEqual({
      status: 'completed',
      statusDate: '2024-06-15',
      completedDate: '2024-06-15',
    });
  });

  it('uses current date when completedDate is missing', () => {
    const before = new Date().toISOString();
    const completions: Record<number, GameCompletion> = {
      100: { completed: true },
    };
    const statuses: Record<number, GameStatus> = {};
    const result = transformCompletionsToStatuses(completions, statuses);
    const after = new Date().toISOString();

    expect(result).not.toBeNull();
    expect(result![100]).toBeDefined();
    expect(result![100].status).toBe('completed');
    expect(result![100].statusDate! >= before).toBe(true);
    expect(result![100].statusDate! <= after).toBe(true);
  });

  it('migrates multiple games, skipping non-completed', () => {
    const completions: Record<number, GameCompletion> = {
      1: { completed: true, completedDate: '2023-01-01' },
      2: { completed: false },
      3: { completed: true, completedDate: '2023-06-15' },
    };
    const statuses: Record<number, GameStatus> = {};
    const result = transformCompletionsToStatuses(completions, statuses);

    expect(result).not.toBeNull();
    expect(Object.keys(result!)).toEqual(['1', '3']);
    expect(result![1].status).toBe('completed');
    expect(result![3].status).toBe('completed');
    expect(result![2]).toBeUndefined();
  });

  it('returns null for all non-completed', () => {
    const completions: Record<number, GameCompletion> = {
      1: { completed: false, completedDate: '' },
    };
    const statuses: Record<number, GameStatus> = {};
    expect(transformCompletionsToStatuses(completions, statuses)).toBeNull();
  });
});

describe('migrateStatusSchema', () => {
  it('returns null when nothing needs changing', () => {
    const statuses: Record<number, GameStatus> = {
      1: { status: 'completed', completedDate: '2024-01-01' },
      2: { status: 'dropped' },
      3: { status: 'backlog' },
    };
    expect(migrateStatusSchema(statuses)).toBeNull();
  });

  it('removes in_progress status and preserves other fields', () => {
    const statuses = {
      1: { status: 'in_progress' as GameStatus['status'], statusDate: '2024-01-01' },
    } as Record<number, GameStatus>;
    const result = migrateStatusSchema(statuses);
    expect(result).not.toBeNull();
    // status removed, but statusDate kept
    expect(result![1]).toEqual({ statusDate: '2024-01-01' });
    expect((result![1] as GameStatus).status).toBeUndefined();
  });

  it('drops an entry entirely when in_progress has no other fields', () => {
    const statuses = {
      1: { status: 'in_progress' as GameStatus['status'] },
    } as Record<number, GameStatus>;
    const result = migrateStatusSchema(statuses);
    expect(result).not.toBeNull();
    expect(result![1]).toBeUndefined();
  });

  it('strips the isEndless flag and keeps the rest of the entry', () => {
    const statuses = {
      1: { status: 'backlog', isEndless: true } as GameStatus & { isEndless: boolean },
    } as Record<number, GameStatus>;
    const result = migrateStatusSchema(statuses);
    expect(result).not.toBeNull();
    expect((result![1] as GameStatus & { isEndless?: boolean }).isEndless).toBeUndefined();
    expect(result![1].status).toBe('backlog');
  });

  it('drops an entry that only had isEndless: true with no other data', () => {
    const statuses = {
      1: { isEndless: true } as GameStatus & { isEndless: boolean },
    } as Record<number, GameStatus>;
    const result = migrateStatusSchema(statuses);
    expect(result).not.toBeNull();
    expect(result![1]).toBeUndefined();
  });

  it('leaves untouched entries intact', () => {
    const statuses = {
      1: { status: 'in_progress' as GameStatus['status'] },
      2: { status: 'completed', completedDate: '2024-01-01' },
    } as Record<number, GameStatus>;
    const result = migrateStatusSchema(statuses);
    expect(result![2]).toEqual({ status: 'completed', completedDate: '2024-01-01' });
  });
});
