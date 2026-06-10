// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  👋 Welcome! Run setupSchedules() to get started.                           ║
// ║                                                                              ║
// ║  1. Make sure config.js is set up (copy from config.js.template)             ║
// ║  2. Select "setupSchedules" from the function dropdown above                 ║
// ║  3. Click ▶ Run                                                              ║
// ║                                                                              ║
// ║  That's it! The script will send reports automatically.                      ║
// ╚══════════════════════════════════════════════════════════════════════════════╝


/**
 * Function names managed by setupSchedules.
 * Only these triggers are touched — user-created triggers are left alone.
 */
const MANAGED_FUNCTIONS = ['dailyRun'];


/**
 * Creates time-based triggers based on your reportSchedules config.
 * Run this once after deploying. Safe to re-run — removes existing managed triggers first.
 *
 * Creates up to 2 triggers:
 * - weeklyRun: if any report is set to 'weekly'
 * - monthlyRun: if any report is set to 'monthly'
 *
 * Each batch function fetches contacts once and runs all reports for that frequency.
 */
function setupSchedules() {
  // Remove existing managed triggers
  const existing = ScriptApp.getProjectTriggers().filter(
    trigger => MANAGED_FUNCTIONS.includes(trigger.getHandlerFunction())
  );

  if (existing.length > 0) {
    Logger.log(`🔄 Removing ${existing.length} existing managed trigger(s):`);
    existing.forEach(trigger => {
      Logger.log(`   • ${trigger.getHandlerFunction()}`);
      ScriptApp.deleteTrigger(trigger);
    });
  }

  const r = typeof reports !== 'undefined' ? reports : {};
  const a = typeof actions !== 'undefined' ? actions : {};
  const hour = 8; // Hardcoded — triggers fire at approximately this hour (±1h)

  // Collect all schedule frequencies from reports and actions
  const reportFreqs = Object.entries(r)
    .filter(([k, v]) => typeof v === 'object' && v.schedule)
    .map(([k, v]) => v.schedule);
  const actionFreqs = Object.values(a)
    .filter(v => typeof v === 'object' && v.schedule)
    .map(v => v.schedule);
  const allFreqs = [...reportFreqs, ...actionFreqs];

  const hasDaily = allFreqs.includes('daily');
  const hasWeekly = allFreqs.includes('weekly');
  const hasMonthly = allFreqs.includes('monthly');

  if (!hasDaily && !hasWeekly && !hasMonthly) {
    Logger.log('ℹ️ No schedules enabled. Set schedule frequencies in reports/actions config.');
    return;
  }

  // Single daily trigger handles all schedule types
  // (daily runs always, weekly checks weekday, monthly checks day of month)
  ScriptApp.newTrigger('dailyRun')
    .timeBased()
    .everyDays(1)
    .atHour(hour)
    .create();

  const summary = [];
  if (hasDaily) summary.push('daily');
  if (hasWeekly) summary.push('weekly');
  if (hasMonthly) summary.push('monthly');
  Logger.log(`✅ Daily trigger at ~${hour}:00 (handles: ${summary.join(', ')})`);

  Logger.log('🎉 Schedules set up!');
}


/**
 * Removes all triggers managed by this script.
 * User-created triggers for other functions are left untouched.
 */
function removeSchedules() {
  const existing = ScriptApp.getProjectTriggers().filter(
    trigger => MANAGED_FUNCTIONS.includes(trigger.getHandlerFunction())
  );

  if (existing.length === 0) {
    Logger.log('ℹ️ No managed triggers found. Nothing to remove.');
    return;
  }

  Logger.log(`🗑️ Removing ${existing.length} managed trigger(s):`);
  existing.forEach(trigger => {
    Logger.log(`   • ${trigger.getHandlerFunction()}`);
    ScriptApp.deleteTrigger(trigger);
  });
  Logger.log('✅ All managed schedules removed.');
}
