/**
 * @fileoverview Google Contacts Scripts — Main entry points for contact reports.
 */


// ═══════════════════════════════════════════════════════════════════════════════
// Config helpers
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Validates the configuration and logs warnings for invalid values.
 * Call this once at setup or before running reports.
 * @returns {string[]} Array of validation error messages (empty = all good)
 */
function validateConfig() {
  const errors = [];

  // Label filter
  if (typeof useLabel !== 'boolean') {
    errors.push('useLabel must be a boolean (true/false)');
  }
  if (useLabel && (!Array.isArray(labelFilter) || labelFilter.length === 0)) {
    errors.push('useLabel is true but labelFilter is empty — no contacts will match');
  }
  if (Array.isArray(labelFilter) && labelFilter.some(l => typeof l !== 'string')) {
    errors.push('labelFilter must only contain strings');
  }

  // Exclude labels
  if (typeof excludeLabels !== 'undefined' && !Array.isArray(excludeLabels)) {
    errors.push('excludeLabels must be an array of strings');
  }

  // Upcoming birthdays
  if (typeof upcomingBirthdaysDays !== 'undefined') {
    if (typeof upcomingBirthdaysDays !== 'number' || upcomingBirthdaysDays < 1 || upcomingBirthdaysDays > 365) {
      errors.push('upcomingBirthdaysDays must be a number between 1 and 365');
    }
  }

  // Birthday format
  const validFormats = ['dd.MM.', 'dd/MM', 'MM/dd', 'dd MMM', 'MMM dd'];
  if (typeof birthdayFormat !== 'undefined' && !validFormats.includes(birthdayFormat)) {
    errors.push(`birthdayFormat must be one of: ${validFormats.join(', ')}`);
  }

  // Sort
  const validSorts = ['name', 'name-desc', 'labels', 'city'];
  if (typeof sortContactsBy !== 'undefined' && !validSorts.includes(sortContactsBy)) {
    errors.push(`sortContactsBy must be one of: ${validSorts.join(', ')}`);
  }

  // Max contacts
  if (typeof maxContactsPerReport !== 'undefined') {
    if (typeof maxContactsPerReport !== 'number' || maxContactsPerReport < 0) {
      errors.push('maxContactsPerReport must be a number >= 0');
    }
  }

  // Enabled reports
  if (typeof enabledReports !== 'undefined') {
    const validKeys = ['upcomingBirthdays', 'duplicates', 'contactOverview', 'labelOverview', 'missingInfo', 'dataQuality'];
    Object.keys(enabledReports).forEach(key => {
      if (!validKeys.includes(key)) errors.push(`enabledReports: unknown report "${key}"`);
    });
  }

  // Missing info fields
  if (typeof missingInfoFields !== 'undefined') {
    const validFields = ['email', 'phone', 'city', 'birthday'];
    if (!Array.isArray(missingInfoFields)) {
      errors.push('missingInfoFields must be an array');
    } else {
      missingInfoFields.forEach(f => {
        if (!validFields.includes(f)) errors.push(`missingInfoFields: invalid field "${f}"`);
      });
    }
  }

  // Duplicate match fields
  if (typeof duplicateMatchFields !== 'undefined') {
    const validDupFields = ['name', 'email', 'phone'];
    if (!Array.isArray(duplicateMatchFields)) {
      errors.push('duplicateMatchFields must be an array');
    } else {
      duplicateMatchFields.forEach(f => {
        if (!validDupFields.includes(f)) errors.push(`duplicateMatchFields: invalid field "${f}"`);
      });
    }
  }

  // Birthday schedule
  if (typeof birthdaySchedule !== 'undefined' && !['daily', 'weekly'].includes(birthdaySchedule)) {
    errors.push('birthdaySchedule must be "daily" or "weekly"');
  }

  // Schedule hour
  if (typeof scheduleHour !== 'undefined') {
    if (typeof scheduleHour !== 'number' || scheduleHour < 0 || scheduleHour > 23) {
      errors.push('scheduleHour must be a number between 0 and 23');
    }
  }

  // Monthly overview
  if (typeof monthlyOverview !== 'undefined' && typeof monthlyOverview !== 'boolean') {
    errors.push('monthlyOverview must be true or false');
  }

  // Log results
  if (errors.length > 0) {
    Logger.log('⚠️ Config validation issues:');
    errors.forEach(e => Logger.log(`   • ${e}`));
  } else {
    Logger.log('✅ Config is valid');
  }

  return errors;
}

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

/**
 * Sorts a contact list based on the sortContactsBy config.
 * @param {Contact[]} contacts
 * @returns {Contact[]}
 */
function applySorting(contacts) {
  const sortBy = typeof sortContactsBy !== 'undefined' ? sortContactsBy : 'name';
  const sorted = [...contacts];

  switch (sortBy) {
    case 'name':
      sorted.sort((a, b) => a.getName().localeCompare(b.getName()));
      break;
    case 'name-desc':
      sorted.sort((a, b) => b.getName().localeCompare(a.getName()));
      break;
    case 'labels':
      sorted.sort((a, b) => b.getLabels().length - a.getLabels().length);
      break;
    case 'city':
      sorted.sort((a, b) => (a.city || '').localeCompare(b.city || ''));
      break;
    default:
      sorted.sort((a, b) => a.getName().localeCompare(b.getName()));
  }

  return sorted;
}

/**
 * Filters out contacts that have any of the excluded labels.
 * @param {Contact[]} contacts
 * @returns {Contact[]}
 */
function applyExcludeLabels(contacts) {
  const excluded = typeof excludeLabels !== 'undefined' ? excludeLabels : [];
  if (!Array.isArray(excluded) || excluded.length === 0) return contacts;
  return contacts.filter(c => !c.getLabels().some(l => excluded.includes(l)));
}

/**
 * Applies standard post-processing: exclude labels, sort, limit.
 * @param {Contact[]} contacts
 * @returns {Contact[]}
 */
function prepareContacts(contacts) {
  return applyLimit(applySorting(applyExcludeLabels(contacts)));
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
    const upcoming = prepareContacts(findContactsWithUpcomingBirthdays(contacts, lookAhead));

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
    const unlabeled = prepareContacts(findContactsWithoutLabels(contacts));
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
    const missing = prepareContacts(findContactsMissingField(contacts, field));

    if (missing.length === 0) {
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
    const noSurname = prepareContacts(findContactsWithoutSurnames(contacts));
    const invalidPhones = prepareContacts(findContactsWithInvalidPhones(contacts));

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
