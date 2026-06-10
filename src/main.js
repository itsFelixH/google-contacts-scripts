/**
 * @fileoverview Report entry points.
 *
 * Each function here is a top-level report that can be:
 * - Run manually from the Apps Script editor dropdown
 * - Called from batch functions (weeklyRun, monthlyRun)
 * - Called from sendAllReports() for a full manual run
 *
 * All report functions accept an optional `contacts` parameter.
 * When provided, they skip fetching and use the pre-fetched data.
 * This allows batch functions to fetch once and share the data.
 */


// ═══════════════════════════════════════════════════════════════════════════════
// Batch triggers — fetch contacts once, run multiple reports
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Checks if today is the correct weekday for a weekly schedule.
 * @param {number} [day=2] Day of week (1=Sunday, 2=Monday, ..., 7=Saturday)
 * @returns {boolean}
 */
function shouldRunWeekly(day) {
  const targetDay = day || 2; // default Monday
  const todayDay = new Date().getDay() + 1; // getDay() is 0-based, we use 1-based
  return todayDay === targetDay;
}


/**
 * Runs all scheduled reports and actions.
 * Handles daily, weekly, and monthly schedules.
 * This is the single daily trigger target.
 */
function dailyRun() {
  try {
    if (!isLabelFilterConfigured()) return;
    Logger.log('📬 Running daily check...');

    const c = cfg();
    const contacts = fetchContacts(c.useLabel ? c.labelFilter : []);
    const r = typeof reports !== 'undefined' ? reports : {};
    const a = typeof actions !== 'undefined' ? actions : {};
    const today = new Date().getDate();
    let successful = 0;
    let failed = 0;

    // All report/action entries
    const reportEntries = [
      { key: 'upcomingBirthdays', fn: () => sendUpcomingBirthdaysReport(null, contacts) },
      { key: 'duplicates',        fn: () => sendDuplicateContactsReport(contacts) },
      { key: 'contactOverview',   fn: () => sendContactOverviewReport(contacts) },
      { key: 'labelOverview',     fn: () => sendLabelOverviewReport(contacts) },
      { key: 'missingInfo',       fn: () => sendMissingInfoReport(contacts) },
      { key: 'dataQuality',       fn: () => sendDataQualityReport(contacts) },
    ];

    const actionEntries = [
      { key: 'autoLabeling',       fn: () => runAutoLabeling() },
      { key: 'nameFormatter',      fn: () => runNameFormatter() },
      { key: 'phoneNormalizer',    fn: () => runPhoneNormalizer() },
      { key: 'instagramToWebsite', fn: () => runInstagramToWebsite() },
      { key: 'messengerToWebsite', fn: () => runMessengerToWebsite() },
    ];

    // Run reports: daily always, weekly on matching weekday, monthly on matching day
    reportEntries.forEach(({ key, fn }) => {
      const conf = r[key];
      if (!conf) return;
      if (conf.schedule === 'daily') { /* run */ }
      else if (conf.schedule === 'weekly' && shouldRunWeekly(conf.day)) { /* run */ }
      else if (conf.schedule === 'monthly' && (conf.day || 1) === today) { /* run */ }
      else return;
      try { fn(); successful++; }
      catch (error) { failed++; Logger.log(`  ❌ ${key} failed: ${error.message}`); }
    });

    // Run actions: daily always, weekly on matching weekday, monthly on matching day
    actionEntries.forEach(({ key, fn }) => {
      const conf = a[key];
      if (!conf) return;
      if (conf.schedule === 'daily') { /* run */ }
      else if (conf.schedule === 'weekly' && shouldRunWeekly(conf.day)) { /* run */ }
      else if (conf.schedule === 'monthly' && (conf.day || 1) === today) { /* run */ }
      else return;
      try { fn(); successful++; }
      catch (error) { failed++; Logger.log(`  ❌ ${key} failed: ${error.message}`); }
    });

    Logger.log(`📬 Daily check done: ${successful} successful, ${failed} failed`);
  } catch (error) {
    Logger.log(`Error in dailyRun: ${error.message}`);
    throw error;
  }
}


/**
 * Legacy weekly trigger — calls dailyRun which handles weekly schedules.
 * Kept for backward compatibility with existing triggers.
 */
function weeklyRun() {
  dailyRun();
}


/**
 * Legacy monthly trigger — calls dailyRun which handles monthly schedules.
 * Kept for backward compatibility with existing triggers.
 */
function monthlyRun() {
  dailyRun();
}


/**
 * Sends all enabled reports in one batch (manual convenience function).
 * Fetches contacts once and runs everything.
 */
function sendAllReports() {
  try {
    if (!isLabelFilterConfigured()) return;
    Logger.log('📬 Running all reports...');

    const contacts = fetchContacts(cfg().useLabel ? cfg().labelFilter : []);
    let successful = 0;
    let failed = 0;

    const reportFns = [];
    if (isReportEnabled('upcomingBirthdays')) reportFns.push(() => sendUpcomingBirthdaysReport(null, contacts));
    if (isReportEnabled('duplicates'))        reportFns.push(() => sendDuplicateContactsReport(contacts));
    if (isReportEnabled('contactOverview'))    reportFns.push(() => sendContactOverviewReport(contacts));
    if (isReportEnabled('labelOverview'))      reportFns.push(() => sendLabelOverviewReport(contacts));
    if (isReportEnabled('missingInfo'))       reportFns.push(() => sendMissingInfoReport(contacts));
    if (isReportEnabled('dataQuality'))        reportFns.push(() => sendDataQualityReport(contacts));

    reportFns.forEach((reportFn, index) => {
      try { reportFn(); successful++; }
      catch (error) { failed++; Logger.log(`  Report ${index + 1} failed: ${error.message}`); }
    });

    Logger.log(`📬 All reports done: ${successful} successful, ${failed} failed`);
  } catch (error) {
    Logger.log(`Error in sendAllReports: ${error.message}`);
    throw error;
  }
}


// ═══════════════════════════════════════════════════════════════════════════════
// Individual report functions
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Sends the Upcoming Birthdays report.
 * @param {number} [days] Days to look ahead (defaults to config)
 * @param {Contact[]} [prefetchedContacts] Pre-fetched contacts (skips API call if provided)
 */
function sendUpcomingBirthdaysReport(days, prefetchedContacts) {
  try {
    if (!isLabelFilterConfigured()) return;
    const lookAhead = days || (reportCfg('upcomingBirthdays').aheadDays || 14);

    if (typeof lookAhead !== 'number' || lookAhead < 1 || lookAhead > 365) {
      throw new Error('Days parameter must be a number between 1 and 365');
    }

    const contacts = prefetchedContacts || fetchContacts(cfg().useLabel ? cfg().labelFilter : []);
    const upcoming = prepareContacts(findUpcomingBirthdays(contacts, lookAhead));

    if (upcoming.length === 0) {
      Logger.log(`No upcoming birthdays in the next ${lookAhead} days`);
      return;
    }

    const emailManager = new EmailManager();
    emailManager.sendUpcomingBirthdaysEmail(upcoming, lookAhead);
    Logger.log(`✅ Sent Upcoming Birthdays report (${upcoming.length} contacts)`);
  } catch (error) {
    Logger.log(`Error in sendUpcomingBirthdaysReport: ${error.message}`);
    throw error;
  }
}


/**
 * Sends the Duplicate Contacts report.
 * @param {Contact[]} [prefetchedContacts] Pre-fetched contacts (skips API call if provided)
 */
function sendDuplicateContactsReport(prefetchedContacts) {
  try {
    const contacts = prefetchedContacts || fetchContacts(cfg().useLabel ? cfg().labelFilter : []);
    const matchFields = reportCfg('duplicates').matchFields || ['name', 'email', 'phone'];
    const duplicates = findDuplicates(contacts, matchFields);

    if (duplicates.length === 0) {
      Logger.log('No potential duplicates found');
      return;
    }

    const emailManager = new EmailManager();
    emailManager.sendDuplicateContactsEmail(duplicates);
    Logger.log(`✅ Sent Duplicate Contacts report (${duplicates.length} groups)`);
  } catch (error) {
    Logger.log(`Error in sendDuplicateContactsReport: ${error.message}`);
    throw error;
  }
}


/**
 * Sends the Contact Overview report.
 * @param {Contact[]} [prefetchedContacts] Pre-fetched contacts (skips API call if provided)
 */
function sendContactOverviewReport(prefetchedContacts) {
  try {
    if (!isLabelFilterConfigured()) return;

    const contacts = prefetchedContacts || fetchContacts(cfg().useLabel ? cfg().labelFilter : []);
    const stats = computeContactStats(contacts);

    const emailManager = new EmailManager();
    emailManager.sendContactOverviewEmail(stats);
    Logger.log(`✅ Sent Contact Overview report (${stats.totalContacts} contacts)`);
  } catch (error) {
    Logger.log(`Error in sendContactOverviewReport: ${error.message}`);
    throw error;
  }
}


/**
 * Sends the Label Overview report.
 * @param {Contact[]} [prefetchedContacts] Pre-fetched contacts (skips API call if provided)
 */
function sendLabelOverviewReport(prefetchedContacts) {
  try {
    if (!isLabelFilterConfigured()) return;

    const contacts = prefetchedContacts || fetchContacts(cfg().useLabel ? cfg().labelFilter : []);
    const labelStats = computeLabelStats(contacts);
    const unlabeled = prepareContacts(findUnlabeled(contacts));
    const stats = computeContactStats(contacts);

    const emailManager = new EmailManager();
    emailManager.sendLabelOverviewEmail(labelStats, unlabeled, stats.labelDistribution, stats.totalContacts);
    Logger.log(`✅ Sent Label Overview report (${labelStats.totalLabels} labels, ${unlabeled.length} unlabeled)`);
  } catch (error) {
    Logger.log(`Error in sendLabelOverviewReport: ${error.message}`);
    throw error;
  }
}


/**
 * Sends the Missing Info report for all configured fields in one email.
 * @param {Contact[]} [prefetchedContacts] Pre-fetched contacts (skips API call if provided)
 */
function sendMissingInfoReport(prefetchedContacts) {
  try {
    if (!isLabelFilterConfigured()) return;
    const fields = reportCfg('missingInfo').fields || ['email', 'phone', 'birthday'];

    const contacts = prefetchedContacts || fetchContacts(cfg().useLabel ? cfg().labelFilter : []);

    // Build map of field → contacts missing that field
    const fieldData = {};
    fields.forEach(field => {
      fieldData[field] = prepareContacts(findMissingField(contacts, field));
    });

    const totalMissing = Object.values(fieldData).reduce((sum, arr) => sum + arr.length, 0);
    if (totalMissing === 0) {
      Logger.log('No missing info found');
      return;
    }

    const emailManager = new EmailManager();
    emailManager.sendMissingInfoEmail(fieldData);
    Logger.log(`✅ Sent Missing Info report (${totalMissing} gaps across ${fields.length} fields)`);
  } catch (error) {
    Logger.log(`Error in sendMissingInfoReport: ${error.message}`);
    throw error;
  }
}


/**
 * Sends the Data Quality report.
 * @param {Contact[]} [prefetchedContacts] Pre-fetched contacts (skips API call if provided)
 */
function sendDataQualityReport(prefetchedContacts) {
  try {
    const contacts = prefetchedContacts || fetchContacts(cfg().useLabel ? cfg().labelFilter : []);
    const noSurname = prepareContacts(findMissingSurnames(contacts));
    const invalidPhones = prepareContacts(findInvalidPhones(contacts));
    const duplicatePhones = findDuplicatePhones(contacts);
    const emptyContacts = prepareContacts(findEmptyContacts(contacts));
    const badNames = prepareContacts(findBadlyFormattedNames(contacts));
    const incompleteMessenger = prepareContacts(findIncompleteMessenger(contacts));

    const totalIssues = noSurname.length + invalidPhones.length + duplicatePhones.length + emptyContacts.length + badNames.length + incompleteMessenger.length;

    if (totalIssues === 0) {
      Logger.log('No data quality issues found');
      return;
    }

    const emailManager = new EmailManager();
    emailManager.sendDataQualityEmail(noSurname, invalidPhones, duplicatePhones, emptyContacts, badNames, incompleteMessenger, contacts.length);
    Logger.log(`✅ Sent Data Quality report (${totalIssues} issues)`);
  } catch (error) {
    Logger.log(`Error in sendDataQualityReport: ${error.message}`);
    throw error;
  }
}


// ═══════════════════════════════════════════════════════════════════════════════
// Test / debug helpers
// ═══════════════════════════════════════════════════════════════════════════════


/**
 * Tests contact fetching and logs all contact names.
 */
function testContacts() {
  try {
    const contacts = fetchContacts(cfg().useLabel ? cfg().labelFilter : []);
    logContactNames(contacts);
    Logger.log(`Contact test completed — ${contacts.length} contacts found`);
  } catch (error) {
    Logger.log(`Error in testContacts: ${error.message}`);
    throw error;
  }
}


/**
 * Tests label fetching and logs all labels.
 */
function testLabels() {
  try {
    const labelManager = new LabelManager();
    labelManager.logAllLabels();
    Logger.log(`Label test completed — ${labelManager.labels.length} labels found`);
  } catch (error) {
    Logger.log(`Error in testLabels: ${error.message}`);
    throw error;
  }
}


/**
 * Gets application health status and basic metrics.
 * @returns {Object} Health status information
 */
function getHealthStatus() {
  try {
    const startTime = Date.now();
    const contacts = fetchContacts(cfg().useLabel ? cfg().labelFilter : []);
    const labelManager = new LabelManager();
    const endTime = Date.now();

    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      responseTime: endTime - startTime,
      contactCount: contacts.length,
      labelCount: labelManager.labels.length
    };
  } catch (error) {
    Logger.log(`Health check failed: ${error.message}`);
    return {
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message
    };
  }
}
