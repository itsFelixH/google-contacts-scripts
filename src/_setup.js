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
  'sendAllReports',
  'sendContactOverviewReport',
  'runAutoLabeling'
];


/**
 * Creates time-based triggers based on your config.
 * Run this once after deploying. Safe to re-run — removes existing managed triggers first.
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
  const bSchedule = typeof birthdaySchedule !== 'undefined' ? birthdaySchedule : 'daily';
  const weekDay = typeof weeklyReportDay !== 'undefined' ? weeklyReportDay : ScriptApp.WeekDay.MONDAY;
  const doMonthly = typeof monthlyOverview !== 'undefined' ? monthlyOverview : true;

  // 1. Upcoming Birthdays — daily or weekly
  const birthdayTrigger = ScriptApp.newTrigger('sendUpcomingBirthdaysReport').timeBased();
  if (bSchedule === 'weekly') {
    birthdayTrigger.onWeekDay(weekDay).atHour(hour).create();
    Logger.log(`✅ Upcoming Birthdays — weekly at ~${hour}:00`);
  } else {
    birthdayTrigger.everyDays(1).atHour(hour).create();
    Logger.log(`✅ Upcoming Birthdays — daily at ~${hour}:00`);
  }

  // 2. All Reports — weekly
  ScriptApp.newTrigger('sendAllReports')
    .timeBased()
    .onWeekDay(weekDay)
    .atHour(hour)
    .create();
  Logger.log(`✅ All Reports — weekly at ~${hour}:00`);

  // 3. Contact Overview — monthly (optional)
  if (doMonthly) {
    ScriptApp.newTrigger('sendContactOverviewReport')
      .timeBased()
      .onMonthDay(1)
      .atHour(hour)
      .create();
    Logger.log(`✅ Contact Overview — 1st of each month at ~${hour}:00`);
  }

  // 4. Auto-labeling — weekly (optional)
  const doAutoLabel = typeof scheduleAutoLabeling !== 'undefined' ? scheduleAutoLabeling : false;
  if (doAutoLabel) {
    ScriptApp.newTrigger('runAutoLabeling')
      .timeBased()
      .onWeekDay(weekDay)
      .atHour(hour)
      .create();
    Logger.log(`✅ Auto-labeling — weekly at ~${hour}:00`);
  }

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
