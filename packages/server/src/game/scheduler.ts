import cron from 'node-cron';
import { processTurn } from './turn.js';

let task: cron.ScheduledTask | null = null;

// Turn interval in seconds — matches archspace.config SecondPerTurn=60
const TURN_INTERVAL_SECONDS = parseInt(process.env['TURN_INTERVAL_SECONDS'] ?? '60', 10);

export function startScheduler(onTick?: (result: Awaited<ReturnType<typeof processTurn>>) => void) {
  if (task) return;

  // Build cron expression from interval. node-cron supports second-level cron.
  // For intervals under a minute, run every N seconds; otherwise every N minutes.
  let cronExpr: string;
  if (TURN_INTERVAL_SECONDS < 60) {
    cronExpr = `*/${TURN_INTERVAL_SECONDS} * * * * *`; // every N seconds
  } else {
    const mins = Math.round(TURN_INTERVAL_SECONDS / 60);
    cronExpr = `0 */${mins} * * * *`; // every N minutes at :00 seconds
  }

  task = cron.schedule(cronExpr, () => {
    void processTurn()
      .then((result) => {
        console.info(
          `[Turn ${result.turn}] Processed ${result.playersProcessed} players, ` +
            `${result.fleetsProcessed} fleets at ${result.processedAt.toISOString()}`,
        );
        onTick?.(result);
      })
      .catch((err: unknown) => {
        console.error('[Scheduler] Turn processing failed:', err);
      });
  });

  console.info(`[Scheduler] Turn engine started. Interval: ${TURN_INTERVAL_SECONDS}s (cron: ${cronExpr})`);
}

export function stopScheduler() {
  task?.stop();
  task = null;
  console.info('[Scheduler] Turn engine stopped.');
}
