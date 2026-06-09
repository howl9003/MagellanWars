import { processTurn, type TurnResult } from './turn.js';

const DEFAULT_TURN_INTERVAL_SECONDS = 60;

let timer: NodeJS.Timeout | null = null;
let intervalSeconds: number | null = null;
let running = false;
let skippedRuns = 0;
let lastStartedAt: string | null = null;
let lastCompletedAt: string | null = null;
let lastDurationMs: number | null = null;
let lastTurn: number | null = null;
let lastError: string | null = null;

export interface SchedulerStatus {
  enabled: boolean;
  intervalSeconds: number;
  running: boolean;
  skippedRuns: number;
  lastStartedAt: string | null;
  lastCompletedAt: string | null;
  lastDurationMs: number | null;
  lastTurn: number | null;
  lastError: string | null;
}

export function startScheduler(onTick?: (result: TurnResult) => void) {
  if (timer) return;

  intervalSeconds = readTurnIntervalSeconds();
  timer = setInterval(() => {
    void runTurn(onTick);
  }, intervalSeconds * 1000);

  console.info(`[Scheduler] Turn engine started. Interval: ${intervalSeconds}s`);
}

export function stopScheduler() {
  if (!timer) return;

  clearInterval(timer);
  timer = null;
  console.info('[Scheduler] Turn engine stopped.');
}

export function getSchedulerStatus(): SchedulerStatus {
  return {
    enabled: timer !== null,
    intervalSeconds: intervalSeconds ?? readTurnIntervalSeconds(),
    running,
    skippedRuns,
    lastStartedAt,
    lastCompletedAt,
    lastDurationMs,
    lastTurn,
    lastError,
  };
}

export async function waitForSchedulerIdle(timeoutMs = 10_000): Promise<boolean> {
  const startedAt = Date.now();

  while (running && Date.now() - startedAt < timeoutMs) {
    await delay(100);
  }

  return !running;
}

async function runTurn(onTick?: (result: TurnResult) => void) {
  if (running) {
    skippedRuns += 1;
    console.warn('[Scheduler] Previous turn is still running; skipping this tick.');
    return;
  }

  running = true;
  const startedAt = Date.now();
  lastStartedAt = new Date(startedAt).toISOString();

  try {
    const result = await processTurn();
    lastTurn = result.turn;
    lastError = null;
    onTick?.(result);

    console.info(
      `[Turn ${result.turn}] Processed ${result.playersProcessed} players, ` +
        `${result.fleetsProcessed} fleets at ${result.processedAt.toISOString()}`,
    );
  } catch (err: unknown) {
    lastError = formatError(err);
    console.error('[Scheduler] Turn processing failed:', err);
  } finally {
    lastDurationMs = Date.now() - startedAt;
    lastCompletedAt = new Date().toISOString();
    running = false;
  }
}

function readTurnIntervalSeconds(): number {
  const raw = process.env['TURN_INTERVAL_SECONDS'];
  const value = raw === undefined ? DEFAULT_TURN_INTERVAL_SECONDS : Number(raw);

  if (!Number.isInteger(value) || value <= 0) {
    throw new Error('TURN_INTERVAL_SECONDS must be a positive integer.');
  }

  return value;
}

function formatError(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function delay(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}
