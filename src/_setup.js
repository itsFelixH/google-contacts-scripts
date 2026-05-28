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
 * All function names that setupSchedules manages.
 * Only these triggers are touched — user-created triggers are left alone.
 */
const MANAGED_FUNCTIONS = [
  'sendUpcomingBirthdaysReport',
  'sendDuplicateContactsReport',
  'sendLabelOverviewReport',
  'sendMissingInfoReportAll',
  'sendDataQualityReport',
  'sendContactOverviewReport',
  'runAutoLabeling'
];


/**
 * Creates time-based triggers based on your config.
 * Run this once after deploying. Safe to re-run — removes existing managed triggers first.
 *
 * Default schedule:
 * - Weekly: Upcoming Birthdays, Auto-labeling
 * - Monthly: Duplicates, Label Overview, Missing Info, Data Quality, Contact Overview
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
  const doAutoLabel = typeof scheduleAutoLabeling !== 'undefined' ? scheduleAutoLabeling : false;

  // ─── Weekly triggers ────────────────────────────────────────────────────────

  // Upcoming Birthdays — weekly (covers next 14 days by default)
  ScriptApp.newTrigger('sendUpcomingBirthdaysReport')
    .timeBased()
    .onWeekDay(weekDay)
    .atHour(hour)
    .create();
  Logger.log(`✅ Upcoming Birthdays — weekly at ~${hour}:00`);

  // Auto-labeling — weekly (optional)
  if (doAutoLabel) {
    ScriptApp.newTrigger('runAutoLabeling')
      .timeBased()
      .onWeekDay(weekDay)
      .atHour(hour)
      .create();
    Logger.log(`✅ Auto-labeling — weekly at ~${hour}:00`);
  }

  // ─── Monthly triggers ───────────────────────────────────────────────────────

  ScriptApp.newTrigger('sendDuplicateContactsReport')
    .timeBased()
    .onMonthDay(monthDay)
    .atHour(hour)
    .create();
  Logger.log(`✅ Duplicate Contacts — monthly on day ${monthDay} at ~${hour}:00`);

  ScriptApp.newTrigger('sendLabelOverviewReport')
    .timeBased()
    .onMonthDay(monthDay)
    .atHour(hour)
    .create();
  Logger.log(`✅ Label Overview — monthly on day ${monthDay} at ~${hour}:00`);

  ScriptApp.newTrigger('sendMissingInfoReportAll')
    .timeBased()
    .onMonthDay(monthDay)
    .atHour(hour)
    .create();
  Logger.log(`✅ Missing Info — monthly on day ${monthDay} at ~${hour}:00`);

  ScriptApp.newTrigger('sendDataQualityReport')
    .timeBased()
    .onMonthDay(monthDay)
    .atHour(hour)
    .create();
  Logger.log(`✅ Data Quality — monthly on day ${monthDay} at ~${hour}:00`);

  ScriptApp.newTrigger('sendContactOverviewReport')
    .timeBased()
    .onMonthDay(monthDay)
    .atHour(hour)
    .create();
  Logger.log(`✅ Contact Overview — monthly on day ${monthDay} at ~${hour}:00`);

  Logger.log('🎉 All schedules set up!');
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
