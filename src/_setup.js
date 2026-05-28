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
 * Returns the configured schedules, or sensible defaults.
 * @returns {Object[]}
 */
function getSchedules() {
  if (typeof schedules !== 'undefined' && Array.isArray(schedules)) {
    return schedules;
  }

  // Legacy / fallback defaults
  const hour = typeof scheduleHour !== 'undefined' ? scheduleHour : 8;
  const day = typeof scheduleReportDay !== 'undefined' ? scheduleReportDay : ScriptApp.WeekDay.MONDAY;

  return [
    { fn: 'sendUpcomingBirthdaysReport', frequency: 'daily', hour },
    { fn: 'sendAllReports', frequency: 'weekly', day, hour },
    { fn: 'sendContactOverviewReport', frequency: 'monthly', hour },
  ];
}


/**
 * Gets the list of function names managed by setupSchedules.
 * @returns {string[]}
 */
function getManagedFunctions() {
  return getSchedules().map(s => s.fn);
}


/**
 * Creates time-based triggers based on your config.
 * Run this once after deploying. Safe to re-run — removes existing managed triggers first.
 */
function setupSchedules() {
  const configuredSchedules = getSchedules();
  const managedFns = configuredSchedules.map(s => s.fn);

  // Remove only triggers managed by this script
  const existing = ScriptApp.getProjectTriggers().filter(
    trigger => managedFns.includes(trigger.getHandlerFunction())
  );

  if (existing.length > 0) {
    Logger.log(`🔄 Removing ${existing.length} existing managed trigger(s):`);
    existing.forEach(trigger => {
      Logger.log(`   • ${trigger.getHandlerFunction()}`);
      ScriptApp.deleteTrigger(trigger);
    });
  }

  // Create triggers from config
  configuredSchedules.forEach(schedule => {
    const { fn, frequency, day, hour } = schedule;
    const triggerHour = hour || 8;
    const trigger = ScriptApp.newTrigger(fn).timeBased();

    switch (frequency) {
      case 'daily':
        trigger.everyDays(1).atHour(triggerHour).create();
        Logger.log(`✅ ${fn} — daily at ~${triggerHour}:00`);
        break;

      case 'weekly':
        const weekDay = day || ScriptApp.WeekDay.MONDAY;
        trigger.onWeekDay(weekDay).atHour(triggerHour).create();
        Logger.log(`✅ ${fn} — weekly at ~${triggerHour}:00`);
        break;

      case 'monthly':
        trigger.onMonthDay(1).atHour(triggerHour).create();
        Logger.log(`✅ ${fn} — 1st of each month at ~${triggerHour}:00`);
        break;

      default:
        Logger.log(`⚠️ ${fn} — unknown frequency "${frequency}", skipping`);
        return;
    }
  });

  Logger.log(`🎉 ${configuredSchedules.length} schedule(s) set up!`);
}


/**
 * Removes all triggers managed by this script.
 * User-created triggers for other functions are left untouched.
 */
function removeSchedules() {
  const managedFns = getManagedFunctions();
  const existing = ScriptApp.getProjectTriggers().filter(
    trigger => managedFns.includes(trigger.getHandlerFunction())
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
