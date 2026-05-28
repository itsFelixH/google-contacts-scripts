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
 * Maps report config keys to their trigger function names.
 */
const REPORT_FUNCTIONS = {
  upcomingBirthdays: 'sendUpcomingBirthdaysReport',
  duplicates:        'sendDuplicateContactsReport',
  contactOverview:   'sendContactOverviewReport',
  labelOverview:     'sendLabelOverviewReport',
  missingInfo:       'sendMissingInfoReportAll',
  dataQuality:       'sendDataQualityReport',
  autoLabeling:      'runAutoLabeling',
};


/**
 * All function names that setupSchedules manages.
 */
const MANAGED_FUNCTIONS = Object.values(REPORT_FUNCTIONS);


/**
 * Creates time-based triggers based on your reportSchedules config.
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
  const weekDay = typeof weeklyReportDay !== 'undefined' ? weeklyReportDay : ScriptApp.WeekDay.MONDAY;
  const monthDay = typeof monthlyReportDay !== 'undefined' ? monthlyReportDay : 1;
  const schedules = typeof reportSchedules !== 'undefined' ? reportSchedules : {};

  let created = 0;

  // Create a trigger for each enabled report
  Object.entries(REPORT_FUNCTIONS).forEach(([key, fn]) => {
    const frequency = schedules[key] || 'off';
    if (frequency === 'off') return;

    const trigger = ScriptApp.newTrigger(fn).timeBased();

    if (frequency === 'weekly') {
      trigger.onWeekDay(weekDay).atHour(hour).create();
      Logger.log(`✅ ${key} — weekly at ~${hour}:00`);
      created++;
    } else if (frequency === 'monthly') {
      trigger.onMonthDay(monthDay).atHour(hour).create();
      Logger.log(`✅ ${key} — monthly on day ${monthDay} at ~${hour}:00`);
      created++;
    } else {
      Logger.log(`⚠️ ${key} — unknown frequency "${frequency}", skipping`);
    }
  });

  if (created === 0) {
    Logger.log('ℹ️ No schedules enabled. Set frequencies in reportSchedules config.');
  } else {
    Logger.log(`🎉 ${created} schedule(s) set up!`);
  }
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
