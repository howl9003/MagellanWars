import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TurnResult } from '../src/game/turn.js';

const mocks = vi.hoisted(() => ({
  processTurn: vi.fn<() => Promise<TurnResult>>(),
}));

vi.mock('../src/game/turn.js', () => ({
  processTurn: mocks.processTurn,
}));

describe('turn scheduler', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.resetModules();
    vi.spyOn(console, 'info').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    mocks.processTurn.mockReset();
    process.env['TURN_INTERVAL_SECONDS'] = '1';
  });

  afterEach(async () => {
    const scheduler = await import('../src/game/scheduler.js');
    scheduler.stopScheduler();
    vi.useRealTimers();
    vi.restoreAllMocks();
    delete process.env['TURN_INTERVAL_SECONDS'];
  });

  it('skips a tick instead of overlapping turn processing', async () => {
    let resolveFirstTurn: (value: TurnResult) => void = () => undefined;
    mocks.processTurn.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveFirstTurn = resolve;
        }),
    );

    const scheduler = await import('../src/game/scheduler.js');
    scheduler.startScheduler();

    await vi.advanceTimersByTimeAsync(1_000);
    expect(mocks.processTurn).toHaveBeenCalledTimes(1);
    expect(scheduler.getSchedulerStatus().running).toBe(true);

    await vi.advanceTimersByTimeAsync(1_000);
    expect(mocks.processTurn).toHaveBeenCalledTimes(1);
    expect(scheduler.getSchedulerStatus().skippedRuns).toBe(1);

    resolveFirstTurn(turnResult(42));
    await Promise.resolve();
    await Promise.resolve();

    expect(scheduler.getSchedulerStatus()).toMatchObject({
      running: false,
      lastError: null,
      lastTurn: 42,
    });
  });

  it('records turn errors without crashing the scheduler', async () => {
    mocks.processTurn.mockRejectedValueOnce(new Error('database unavailable'));

    const scheduler = await import('../src/game/scheduler.js');
    scheduler.startScheduler();

    await vi.advanceTimersByTimeAsync(1_000);
    await Promise.resolve();

    expect(scheduler.getSchedulerStatus()).toMatchObject({
      running: false,
      lastError: 'database unavailable',
      lastTurn: null,
    });
  });

  it('fails fast on invalid turn intervals', async () => {
    process.env['TURN_INTERVAL_SECONDS'] = '0';
    const scheduler = await import('../src/game/scheduler.js');

    expect(() => scheduler.startScheduler()).toThrow('TURN_INTERVAL_SECONDS must be a positive integer.');
  });
});

function turnResult(turn: number): TurnResult {
  return {
    turn,
    processedAt: new Date('2026-01-01T00:00:00.000Z'),
    playersProcessed: 0,
    fleetsProcessed: 0,
  };
}
