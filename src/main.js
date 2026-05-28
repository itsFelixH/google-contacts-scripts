/**
 * @fileoverview Google Contacts Scripts — Main entry points for contact reports.
 */


// ═══════════════════════════════════════════════════════════════════════════════
// Config helpers
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Checks whether label filtering is correctly configured.
 * @returns {boolean} true if valid, false if misconfigured
 */
function isLabelFilterConfigured() {
  if (useLabel && (!labelFilter || labelFilter.length === 0)) {
    Logger.log('⚠️ useLabel is enabled but labelFilter is empty — no contacts will match.');
    Logger.log('   Add label names to labelFilter in config.js, or set useLabel to false.');
    return false;
  }
  return true;
}

/**
 * Checks if a specific report is enabled in config.
 * @param {string} reportName Key in enabledReports
 * @returns {boolean}
 */
function isReportEnabled(reportName) {
  if (typeof enabledReports === 'undefined') return true;
  return enabledReports[reportName] !== false;
}

/**
 * Returns whether empty reports should be skipped.
 * @returns {boolean}
 */
function shouldSkipEmpty() {
  return typeof skipEmptyReports !== 'undefined' ? skipEmptyReports : true;
}

/**
 * Returns the max contacts per report (0 = unlimited).
 * @returns {number}
 */
function getMaxContacts() {
  return typeof maxContactsPerReport !== 'undefined' ? maxContactsPerReport : 0;
}

/**
 * Trims a contact list to the configured max, if set.
 * @param {Contact[]} contacts
 * @returns {Contact[]}
 */
function applyLimit(contacts) {
  const max = getMaxContacts();
  if (max > 0 && contacts.length > max) {
    return contacts.slice(0, max);
  }
  return contacts;
}


// ═══════════════════════════════════════════════════════════════════════════════
// Report functions
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Sends the Upcoming Birthdays report.
 * Lists contacts with birthdays in the next N days.
 * @param {number} [days] Number of days to look ahead (defaults to config)
 */
function sendUpcomingBirthdaysReport(days) {
  try {
    if (!isLabelFilterConfigured()) return;
    const isDryRun = typeof dryRun !== 'undefined' && dryRun;
    const lookAhead = days || (typeof upcomingBirthdaysDays !== 'undefined' ? upcomingBirthdaysDays : 7);

    if (typeof lookAhead !== 'number' || lookAhead < 1 || lookAhead > 365) {
      throw new Error('Days parameter must be a number between 1 and 365');
    }

    const contacts = fetchContacts(useLabel ? labelFilter : []);
    const upcoming = applyLimit(findContactsWithUpcomingBirthdays(contacts, lookAhead));

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
 * Finds groups of contacts that may be duplicates based on configured match fields.
 */
function sendDuplicateContactsReport() {
  try {
    const contacts = fetchContacts(useLabel ? labelFilter : []);
    const matchFields = typeof duplicateMatchFields !== 'undefined' ? duplicateMatchFields : ['name', 'email', 'phone'];
    const duplicates = findPotentialDuplicates(contacts, matchFields);

    if (duplicates.length === 0 && shouldSkipEmpty()) {
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
 * Shows general statistics about your contacts (completeness percentages).
 */
function sendContactOverviewReport() {
  try {
    if (!isLabelFilterConfigured()) return;
    const isDryRun = typeof dryRun !== 'undefined' && dryRun;

    const contacts = fetchContacts(useLabel ? labelFilter : []);
    const stats = generateContactStats(contacts);

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
 * Combines label usage stats, distribution, and unlabeled contacts in one email.
 */
function sendLabelOverviewReport() {
  try {
    if (!isLabelFilterConfigured()) return;
    const isDryRun = typeof dryRun !== 'undefined' && dryRun;

    const contacts = fetchContacts(useLabel ? labelFilter : []);
    const labelStats = getLabelUsageStats(contacts);
    const unlabeled = applyLimit(findContactsWithoutLabels(contacts));
    const stats = generateContactStats(contacts);

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
 * Sends the Missing Info report for a specific field.
 * Lists contacts that are missing email, phone, city, or birthday.
 * @param {string} field Field to check ('email', 'phone', 'city', 'birthday')
 */
function sendMissingInfoReport(field) {
  try {
    const validFields = ['email', 'phone', 'city', 'birthday'];
    if (!validFields.includes(field)) {
      throw new Error(`Invalid field. Must be one of: ${validFields.join(', ')}`);
    }

    const contacts = fetchContacts(useLabel ? labelFilter : []);
    const missing = applyLimit(findContactsMissingField(contacts, field));

    if (missing.length === 0 && shouldSkipEmpty()) {
      Logger.log(`No contacts missing ${field} found`);
      return;
    }

    const emailManager = new EmailManager();
    emailManager.sendMissingInfoEmail(field, missing);
    Logger.log(`✅ Sent Missing Info report for ${field} (${missing.length} contacts)`);
  } catch (error) {
    Logger.log(`Error in sendMissingInfoReport: ${error.message}`);
    throw error;
  }
}


/**
 * Sends the Data Quality report.
 * Combines contacts without surnames and contacts with invalid phone numbers.
 */
function sendDataQualityReport() {
  try {
    const contacts = fetchContacts(useLabel ? labelFilter : []);
    const noSurname = applyLimit(findContactsWithoutSurnames(contacts));
    const invalidPhones = applyLimit(findContactsWithInvalidPhones(contacts));

    if (noSurname.length === 0 && invalidPhones.length === 0 && shouldSkipEmpty()) {
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


/**
 * Sends all enabled reports in one batch.
 * Respects enabledReports and missingInfoFields config.
 */
function sendAllReports() {
  try {
    Logger.log('Starting all reports...');

    const fields = typeof missingInfoFields !== 'undefined' ? missingInfoFields : ['email', 'phone', 'birthday'];

    const reports = [];

    if (isReportEnabled('upcomingBirthdays')) reports.push(() => sendUpcomingBirthdaysReport());
    if (isReportEnabled('duplicates'))        reports.push(() => sendDuplicateContactsReport());
    if (isReportEnabled('contactOverview'))    reports.push(() => sendContactOverviewReport());
    if (isReportEnabled('labelOverview'))      reports.push(() => sendLabelOverviewReport());
    if (isReportEnabled('missingInfo')) {
      fields.forEach(field => reports.push(() => sendMissingInfoReport(field)));
    }
    if (isReportEnabled('dataQuality'))        reports.push(() => sendDataQualityReport());

    let successful = 0;
    let failed = 0;

    reports.forEach((reportFn, index) => {
      try {
        reportFn();
        successful++;
      } catch (error) {
        failed++;
        Logger.log(`Report ${index + 1} failed: ${error.message}`);
      }
    });

    Logger.log(`All reports completed: ${successful} successful, ${failed} failed`);
  } catch (error) {
    Logger.log(`Error in sendAllReports: ${error.message}`);
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
