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
 * Runs all reports scheduled as 'weekly'.
 * Fetches contacts once and passes them to each report.
 * This is the weekly trigger target.
 */
function weeklyRun() {
  try {
    if (!isLabelFilterConfigured()) return;
    Logger.log('📬 Running weekly reports...');

    const contacts = fetchContacts(useLabel ? labelFilter : []);
    const schedules = typeof reportSchedules !== 'undefined' ? reportSchedules : {};
    let successful = 0;
    let failed = 0;

    const weeklyReports = [
      { key: 'upcomingBirthdays', fn: () => sendUpcomingBirthdaysReport(null, contacts) },
      { key: 'autoLabeling',      fn: () => runAutoLabeling() },
    ];

    weeklyReports.forEach(({ key, fn }) => {
      if (schedules[key] !== 'weekly') return;
      try { fn(); successful++; }
      catch (error) { failed++; Logger.log(`  ❌ ${key} failed: ${error.message}`); }
    });

    Logger.log(`📬 Weekly reports done: ${successful} successful, ${failed} failed`);
  } catch (error) {
    Logger.log(`Error in weeklyRun: ${error.message}`);
    throw error;
  }
}


/**
 * Runs all reports scheduled as 'monthly'.
 * Fetches contacts once and passes them to each report.
 * This is the monthly trigger target.
 */
function monthlyRun() {
  try {
    if (!isLabelFilterConfigured()) return;
    Logger.log('📬 Running monthly reports...');

    const contacts = fetchContacts(useLabel ? labelFilter : []);
    const schedules = typeof reportSchedules !== 'undefined' ? reportSchedules : {};
    let successful = 0;
    let failed = 0;

    const monthlyReports = [
      { key: 'upcomingBirthdays', fn: () => sendUpcomingBirthdaysReport(null, contacts) },
      { key: 'duplicates',        fn: () => sendDuplicateContactsReport(contacts) },
      { key: 'contactOverview',   fn: () => sendContactOverviewReport(contacts) },
      { key: 'labelOverview',     fn: () => sendLabelOverviewReport(contacts) },
      { key: 'missingInfo',       fn: () => sendMissingInfoReport(contacts) },
      { key: 'dataQuality',       fn: () => sendDataQualityReport(contacts) },
      { key: 'autoLabeling',      fn: () => runAutoLabeling() },
    ];

    monthlyReports.forEach(({ key, fn }) => {
      if (schedules[key] !== 'monthly') return;
      try { fn(); successful++; }
      catch (error) { failed++; Logger.log(`  ❌ ${key} failed: ${error.message}`); }
    });

    Logger.log(`📬 Monthly reports done: ${successful} successful, ${failed} failed`);
  } catch (error) {
    Logger.log(`Error in monthlyRun: ${error.message}`);
    throw error;
  }
}


/**
 * Sends all enabled reports in one batch (manual convenience function).
 * Fetches contacts once and runs everything.
 */
function sendAllReports() {
  try {
    if (!isLabelFilterConfigured()) return;
    Logger.log('📬 Running all reports...');

    const contacts = fetchContacts(useLabel ? labelFilter : []);
    let successful = 0;
    let failed = 0;

    const reports = [];
    if (isReportEnabled('upcomingBirthdays')) reports.push(() => sendUpcomingBirthdaysReport(null, contacts));
    if (isReportEnabled('duplicates'))        reports.push(() => sendDuplicateContactsReport(contacts));
    if (isReportEnabled('contactOverview'))    reports.push(() => sendContactOverviewReport(contacts));
    if (isReportEnabled('labelOverview'))      reports.push(() => sendLabelOverviewReport(contacts));
    if (isReportEnabled('missingInfo'))       reports.push(() => sendMissingInfoReport(contacts));
    if (isReportEnabled('dataQuality'))        reports.push(() => sendDataQualityReport(contacts));

    reports.forEach((reportFn, index) => {
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
    const isDryRun = typeof dryRun !== 'undefined' && dryRun;
    const lookAhead = days || (typeof upcomingBirthdaysDays !== 'undefined' ? upcomingBirthdaysDays : 14);

    if (typeof lookAhead !== 'number' || lookAhead < 1 || lookAhead > 365) {
      throw new Error('Days parameter must be a number between 1 and 365');
    }

    const contacts = prefetchedContacts || fetchContacts(useLabel ? labelFilter : []);
    const upcoming = prepareContacts(findUpcomingBirthdays(contacts, lookAhead));

    if (upcoming.length === 0) {
      Logger.log(`No upcoming birthdays in the next ${lookAhead} days`);
      return;
    }

    if (isDryRun) {
      Logger.log(`🧪 [DRY RUN] Would send Upcoming Birthdays report (${upcoming.length} contacts, ${lookAhead} days)`);
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
    const contacts = prefetchedContacts || fetchContacts(useLabel ? labelFilter : []);
    const matchFields = typeof duplicateMatchFields !== 'undefined' ? duplicateMatchFields : ['name', 'email', 'phone'];
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
    const isDryRun = typeof dryRun !== 'undefined' && dryRun;

    const contacts = prefetchedContacts || fetchContacts(useLabel ? labelFilter : []);
    const stats = computeContactStats(contacts);

    if (isDryRun) {
      Logger.log(`🧪 [DRY RUN] Would send Contact Overview report (${stats.totalContacts} contacts)`);
      return;
    }

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
    const isDryRun = typeof dryRun !== 'undefined' && dryRun;

    const contacts = prefetchedContacts || fetchContacts(useLabel ? labelFilter : []);
    const labelStats = computeLabelStats(contacts);
    const unlabeled = prepareContacts(findUnlabeled(contacts));
    const stats = computeContactStats(contacts);

    if (isDryRun) {
      Logger.log(`🧪 [DRY RUN] Would send Label Overview report (${labelStats.totalLabels} labels, ${unlabeled.length} unlabeled)`);
      return;
    }

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
    const isDryRun = typeof dryRun !== 'undefined' && dryRun;
    const fields = typeof missingInfoFields !== 'undefined' ? missingInfoFields : ['email', 'phone', 'birthday'];

    const contacts = prefetchedContacts || fetchContacts(useLabel ? labelFilter : []);

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

    if (isDryRun) {
      Logger.log(`🧪 [DRY RUN] Would send Missing Info report (${totalMissing} gaps)`);
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
    const contacts = prefetchedContacts || fetchContacts(useLabel ? labelFilter : []);
    const noSurname = prepareContacts(findMissingSurnames(contacts));
    const invalidPhones = prepareContacts(findInvalidPhones(contacts));

    if (noSurname.length === 0 && invalidPhones.length === 0) {
      Logger.log('No data quality issues found');
      return;
    }

    const emailManager = new EmailManager();
    emailManager.sendDataQualityEmail(noSurname, invalidPhones);
    Logger.log(`✅ Sent Data Quality report (${noSurname.length} missing surnames, ${invalidPhones.length} invalid phones)`);
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
    const contacts = fetchContacts(useLabel ? labelFilter : []);
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
    const contacts = fetchContacts(useLabel ? labelFilter : []);
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
