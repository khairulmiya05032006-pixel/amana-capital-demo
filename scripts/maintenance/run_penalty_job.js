import 'dotenv/config.js';
import db from '../../config/db.js';
import { runDailyPenalties } from '../../jobs/penaltyJob.js';

(async () => {
  try {
    await runDailyPenalties();
    process.exit(0);
  } catch (err) {
    console.error('Fatal error during penalty job:', err);
    process.exit(1);
  }
})();
