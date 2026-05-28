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
 * Functions managed by setupSchedules/removeSchedules.
 * Only triggers for these functions are touched — user-created triggers are left alone.
 */
const MANAGED_FUNCTIONS = [
  'sendAllReports',
  'sendUpcomingBirthdaysReport',
  'sendContactOverviewReport'
];

/**
 * Creates time-based triggers based on your config.
 * Run this once after deploying. Safe to re-run — removes existing managed triggers first.
 */
function setupSchedules() {
  // Remove only triggers managed by this script
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

  const reportDay = typeof scheduleReportDay !== 'undefined' ? scheduleReportDay : ScriptApp.WeekDay.MONDAY;
  const reportHour = typeof scheduleReportHour !== 'undefined' ? scheduleReportHour : 8;

  // Weekly reports
  ScriptApp.newTrigger('sendAllReports')
    .timeBased()
    .onWeekDay(reportDay)
    .atHour(reportHour)
    .create();
  Logger.log(`✅ sendAllReports — weekly at ~${reportHour}:00`);

  // Daily upcoming birthdays check
  ScriptApp.newTrigger('sendUpcomingBirthdaysReport')
    .timeBased()
    .everyDays(1)
    .atHour(reportHour)
    .create();
  Logger.log(`✅ sendUpcomingBirthdaysReport — daily at ~${reportHour}:00`);

  // Monthly overview
  ScriptApp.newTrigger('sendContactOverviewReport')
    .timeBased()
    .onMonthDay(1)
    .atHour(reportHour)
    .create();
  Logger.log(`✅ sendContactOverviewReport — 1st of each month at ~${reportHour}:00`);

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
