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
const MANAGED_FUNCTIONS = ['weeklyRun', 'monthlyRun'];


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

  // Read config with defaults
  const hour = typeof scheduleHour !== 'undefined' ? scheduleHour : 8;
  const weekDay = typeof weeklyReportDay !== 'undefined' ? weeklyReportDay : ScriptApp.WeekDay.MONDAY;
  const monthDay = typeof monthlyReportDay !== 'undefined' ? monthlyReportDay : 1;
  const schedules = typeof reportSchedules !== 'undefined' ? reportSchedules : {};

  // Check if any reports are scheduled for each frequency
  const hasWeekly = Object.values(schedules).includes('weekly');
  const hasMonthly = Object.values(schedules).includes('monthly');

  if (!hasWeekly && !hasMonthly) {
    Logger.log('ℹ️ No schedules enabled. Set frequencies in reportSchedules config.');
    return;
  }

  // Create weekly trigger if needed
  if (hasWeekly) {
    ScriptApp.newTrigger('weeklyRun')
      .timeBased()
      .onWeekDay(weekDay)
      .atHour(hour)
      .create();
    const weeklyKeys = Object.entries(schedules).filter(([_, v]) => v === 'weekly').map(([k]) => k);
    Logger.log(`✅ Weekly (${weekDay === 2 ? 'Monday' : 'day ' + weekDay}) at ~${hour}:00 → ${weeklyKeys.join(', ')}`);
  }

  // Create monthly trigger if needed
  if (hasMonthly) {
    ScriptApp.newTrigger('monthlyRun')
      .timeBased()
      .onMonthDay(monthDay)
      .atHour(hour)
      .create();
    const monthlyKeys = Object.entries(schedules).filter(([_, v]) => v === 'monthly').map(([k]) => k);
    Logger.log(`✅ Monthly (day ${monthDay}) at ~${hour}:00 → ${monthlyKeys.join(', ')}`);
  }

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
