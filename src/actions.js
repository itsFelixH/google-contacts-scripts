/**
 * @fileoverview Contact actions — scripts that modify contact data.
 *
 * Unlike reports (which only read and email), these functions write back
 * to Google Contacts. They all support dryRun mode for safe previewing.
 * Each action sends a summary email after running (configurable).
 *
 * Actions:
 * - Auto-labeling: assign labels based on configurable rules
 * - Name formatter: fix capitalization and formatting issues
 * - Phone normalizer: convert phone numbers to international format
 * - Instagram sync: validate Instagram handles in contact notes
 */


// ═══════════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Checks if action reports are enabled.
 * @returns {boolean}
 */
function shouldSendActionReports() {
  return typeof sendActionReports !== 'undefined' ? sendActionReports : true;
}


// ═══════════════════════════════════════════════════════════════════════════════
// Auto-labeling
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Applies auto-labeling rules to all contacts.
 * Each rule matches contacts by a condition and assigns a label.
 *
 * Rules are defined in config as `autoLabelRules`. Example:
 * ```
 * { field: 'email', contains: '@company.com', label: 'Work' }
 * { field: 'city', equals: 'Berlin', label: 'Berlin' }
 * { field: 'name', contains: 'Dr.', label: 'Doctors' }
 * ```
 *
 * @returns {{applied: number, skipped: number, changes: Object[]}} Results
 */
function runAutoLabeling() {
  const rules = typeof autoLabelRules !== 'undefined' ? autoLabelRules : [];
  const isDryRun = typeof dryRun !== 'undefined' && dryRun;

  if (rules.length === 0) {
    Logger.log('⚠️ No auto-label rules configured. Add autoLabelRules to config.js.');
    return { applied: 0, skipped: 0, changes: [] };
  }

  Logger.log(`🏷️ Running auto-labeling with ${rules.length} rule(s)...`);

  const labelManager = new LabelManager();
  let applied = 0;
  let skipped = 0;
  const changes = []; // { name, label }

  // Fetch all contacts (unfiltered — rules apply globally)
  const contacts = fetchContacts([]);

  contacts.forEach(contact => {
    rules.forEach(rule => {
      // Skip if contact already has this label
      if (contact.getLabels().includes(rule.label)) {
        skipped++;
        return;
      }

      // Check if the rule matches
      if (!matchesAutoLabelRule(contact, rule)) return;

      changes.push({ name: contact.getName(), label: rule.label });

      if (isDryRun) {
        Logger.log(`🧪 [DRY RUN] Would add "${rule.label}" to ${contact.getName()}`);
        applied++;
        return;
      }

      // Ensure the label exists (create if needed)
      if (!labelManager.labelExistsByName(rule.label)) {
        Logger.log(`  Creating new label: "${rule.label}"`);
        labelManager.addLabel(rule.label);
      }

      // Add the label to the contact via People API
      const labelId = labelManager.labels.find(l => l.name === rule.label)?.id;
      if (labelId) {
        try {
          People.ContactGroups.Members.modify({
            resourceNamesToAdd: [contact.resourceName]
          }, labelId);
          applied++;
          Logger.log(`  ✅ Added "${rule.label}" to ${contact.getName()}`);
        } catch (error) {
          Logger.log(`  ❌ Failed to label ${contact.getName()}: ${error.message}`);
        }
      }
    });
  });

  // Send summary report
  if (changes.length > 0 && !isDryRun && shouldSendActionReports()) {
    sendAutoLabelingReport(changes);
  }

  Logger.log(`🏷️ Auto-labeling done: ${applied} applied, ${skipped} already had label`);
  return { applied, skipped, changes };
}


/**
 * Checks if a contact matches an auto-label rule.
 *
 * @param {Contact} contact The contact to check
 * @param {Object} rule Rule with { field, contains|equals|endsWith|startsWith|matches, label }
 * @returns {boolean} True if the rule matches
 * @private
 */
function matchesAutoLabelRule(contact, rule) {
  // Get the field value to check
  let value = '';
  switch (rule.field) {
    case 'email':  value = (contact.email || '').toLowerCase(); break;
    case 'phone':  value = contact.phoneNumber || ''; break;
    case 'city':   value = (contact.city || '').toLowerCase(); break;
    case 'name':   value = contact.getName().toLowerCase(); break;
    default: return false;
  }

  if (!value) return false;

  // Regex match (case-insensitive)
  if (rule.matches) {
    try {
      return new RegExp(rule.matches, 'i').test(value);
    } catch (e) {
      Logger.log(`⚠️ Invalid regex in auto-label rule: ${rule.matches}`);
      return false;
    }
  }

  // Apply the matching condition
  const target = (rule.contains || rule.equals || rule.startsWith || rule.endsWith || '').toLowerCase();
  if (!target) return false;

  if (rule.contains)   return value.includes(target);
  if (rule.equals)     return value === target;
  if (rule.startsWith) return value.startsWith(target);
  if (rule.endsWith)   return value.endsWith(target);

  return false;
}


/**
 * Sends a summary email of auto-labeling changes.
 * @param {Object[]} changes Array of { name, label }
 * @private
 */
function sendAutoLabelingReport(changes) {
  const emailManager = new EmailManager();
  const { toEmail, fromEmail, senderName } = emailManager.getEmailContext();
  const subject = '🏷️ Auto-Labeling Summary';

  const textBody = ['🏷️ Auto-Labeling Summary', '',
    `${changes.length} labels applied:`, '',
    ...changes.map(c => `  • ${c.name} → "${c.label}"`)
  ].join('\n');

  const listHtml = changes.map(c =>
    `<li><strong>${c.name}</strong> → 🏷️ ${c.label}</li>`
  ).join('\n');

  const htmlBody = EmailTemplates.wrapEmail(
    EmailTemplates.header('🏷️ Auto-Labeling Summary', `${changes.length} labels applied`) +
    `<ul>${listHtml}</ul>` +
    EmailTemplates.footer()
  );

  emailManager.sendMail(toEmail, fromEmail, senderName, subject, textBody, htmlBody);
  Logger.log(`✅ Sent auto-labeling report (${changes.length} changes)`);
}


// ═══════════════════════════════════════════════════════════════════════════════
// Name formatter
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Fixes common name formatting issues across all contacts:
 * - Capitalizes first letter of each word ("john doe" → "John Doe")
 * - Trims extra whitespace ("John   Doe" → "John Doe")
 * - Swaps "Last, First" to "First Last" format
 * - Preserves lowercase prefixes (von, van, de, etc.)
 *
 * Only modifies contacts that actually need fixing.
 *
 * @returns {{fixed: number, unchanged: number, changes: Object[]}} Results
 */
function runNameFormatter() {
  const isDryRun = typeof dryRun !== 'undefined' && dryRun;
  Logger.log('✏️ Running name formatter...');

  const contacts = fetchContacts([]);
  let fixed = 0;
  let unchanged = 0;
  const changes = []; // { before, after }

  contacts.forEach(contact => {
    const original = contact.getName();
    const formatted = formatName(original);

    if (formatted === original) {
      unchanged++;
      return;
    }

    changes.push({ before: original, after: formatted });

    if (isDryRun) {
      Logger.log(`🧪 [DRY RUN] "${original}" → "${formatted}"`);
      fixed++;
      return;
    }

    // Update via People API
    try {
      People.People.updateContact({
        names: [{ displayName: formatted, givenName: formatted.split(' ')[0], familyName: formatted.split(' ').slice(1).join(' ') }]
      }, contact.resourceName, { updatePersonFields: 'names' });
      Logger.log(`  ✅ "${original}" → "${formatted}"`);
      fixed++;
    } catch (error) {
      Logger.log(`  ❌ Failed to update ${original}: ${error.message}`);
    }
  });

  // Send summary report
  if (changes.length > 0 && !isDryRun && shouldSendActionReports()) {
    sendNameFormatterReport(changes);
  }

  Logger.log(`✏️ Name formatter done: ${fixed} fixed, ${unchanged} unchanged`);
  return { fixed, unchanged, changes };
}


/**
 * Formats a contact name by applying standard rules.
 *
 * @param {string} name Original name
 * @returns {string} Formatted name
 * @private
 */
function formatName(name) {
  let result = name.trim();

  // Collapse multiple spaces
  result = result.replace(/\s+/g, ' ');

  // Swap "Last, First" → "First Last" (configurable)
  const doSwap = typeof nameSwapLastFirst !== 'undefined' ? nameSwapLastFirst : true;
  if (doSwap && result.includes(',') && result.split(',').length === 2) {
    const [last, first] = result.split(',').map(s => s.trim());
    if (first && last) {
      result = `${first} ${last}`;
    }
  }

  // Title case: lowercase everything, then capitalize first char of each word
  result = result.toLowerCase().replace(/(^|\s)\S/g, char => char.toUpperCase());

  // Handle lowercase prefixes (hardcoded — these are universal)
  const prefixes = ['von', 'van', 'de', 'del', 'der', 'di', 'la', 'le', 'el'];

  result = result.split(' ').map((word, i) => {
    if (i === 0) return word; // Never lowercase the first word
    if (prefixes.includes(word.toLowerCase())) return word.toLowerCase();
    return word;
  }).join(' ');

  return result;
}


/**
 * Sends a summary email of name formatting changes.
 * @param {Object[]} changes Array of { before, after }
 * @private
 */
function sendNameFormatterReport(changes) {
  const emailManager = new EmailManager();
  const { toEmail, fromEmail, senderName } = emailManager.getEmailContext();
  const subject = '✏️ Name Formatter Summary';

  const textBody = ['✏️ Name Formatter Summary', '',
    `${changes.length} names fixed:`, '',
    ...changes.map(c => `  • "${c.before}" → "${c.after}"`)
  ].join('\n');

  const listHtml = changes.map(c =>
    `<li>"${c.before}" → <strong>${c.after}</strong></li>`
  ).join('\n');

  const htmlBody = EmailTemplates.wrapEmail(
    EmailTemplates.header('✏️ Name Formatter Summary', `${changes.length} names fixed`) +
    `<ul>${listHtml}</ul>` +
    EmailTemplates.footer()
  );

  emailManager.sendMail(toEmail, fromEmail, senderName, subject, textBody, htmlBody);
  Logger.log(`✅ Sent name formatter report (${changes.length} changes)`);
}


// ═══════════════════════════════════════════════════════════════════════════════
// Phone number normalizer
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Normalizes phone numbers to international format.
 * Converts local numbers (e.g. "0176 1234567") to international format
 * (e.g. "+491761234567") using the configured default country code.
 *
 * Only modifies numbers that:
 * - Start with "0" (local format) — converted to international
 * - Start with "+" (already international) — separators stripped
 *
 * @returns {{normalized: number, unchanged: number, failed: number, changes: Object[]}} Results
 */
function runPhoneNormalizer() {
  const countryCode = typeof defaultCountryCode !== 'undefined' ? defaultCountryCode : '+49';
  const isDryRun = typeof dryRun !== 'undefined' && dryRun;

  Logger.log(`📱 Running phone normalizer (country code: ${countryCode})...`);

  const contacts = fetchContacts([]);
  let normalized = 0;
  let unchanged = 0;
  let failed = 0;
  const changes = []; // { name, before, after }

  contacts.forEach(contact => {
    const original = contact.phoneNumber;
    if (!original || !original.trim()) { unchanged++; return; }

    const formatted = normalizePhoneNumber(original.trim(), countryCode);

    if (formatted === original.trim()) {
      unchanged++;
      return;
    }

    changes.push({ name: contact.getName(), before: original.trim(), after: formatted });

    if (isDryRun) {
      Logger.log(`🧪 [DRY RUN] ${contact.getName()}: "${original}" → "${formatted}"`);
      normalized++;
      return;
    }

    // Update via People API
    try {
      People.People.updateContact({
        phoneNumbers: [{ value: formatted }]
      }, contact.resourceName, { updatePersonFields: 'phoneNumbers' });
      Logger.log(`  ✅ ${contact.getName()}: "${original}" → "${formatted}"`);
      normalized++;
    } catch (error) {
      Logger.log(`  ❌ Failed to update ${contact.getName()}: ${error.message}`);
      failed++;
    }
  });

  // Send summary report
  if (changes.length > 0 && !isDryRun && shouldSendActionReports()) {
    sendPhoneNormalizerReport(changes);
  }

  Logger.log(`📱 Phone normalizer done: ${normalized} normalized, ${unchanged} unchanged, ${failed} failed`);
  return { normalized, unchanged, failed, changes };
}


/**
 * Normalizes a single phone number to international format.
 *
 * @param {string} phone The phone number to normalize
 * @param {string} countryCode Default country code (e.g. '+49')
 * @returns {string} Normalized phone number
 * @private
 */
function normalizePhoneNumber(phone, countryCode) {
  // Already international format — just strip separators, keep digits and leading +
  if (phone.startsWith('+')) {
    const digits = phone.replace(/[^\d+]/g, '');
    return digits;
  }

  // Local format starting with 0 — replace leading 0 with country code
  if (phone.startsWith('0')) {
    const digits = phone.substring(1).replace(/\D/g, '');
    return `${countryCode}${digits}`;
  }

  // Doesn't match known patterns — return as-is
  return phone;
}


/**
 * Sends a summary email of phone normalization changes.
 * @param {Object[]} changes Array of { name, before, after }
 * @private
 */
function sendPhoneNormalizerReport(changes) {
  const emailManager = new EmailManager();
  const { toEmail, fromEmail, senderName } = emailManager.getEmailContext();
  const subject = '📱 Phone Normalizer Summary';

  const textBody = ['📱 Phone Normalizer Summary', '',
    `${changes.length} numbers normalized:`, '',
    ...changes.map(c => `  • ${c.name}: "${c.before}" → "${c.after}"`)
  ].join('\n');

  const listHtml = changes.map(c =>
    `<li><strong>${c.name}</strong>: ${c.before} → <strong>${c.after}</strong></li>`
  ).join('\n');

  const htmlBody = EmailTemplates.wrapEmail(
    EmailTemplates.header('📱 Phone Normalizer Summary', `${changes.length} numbers normalized`) +
    `<ul>${listHtml}</ul>` +
    EmailTemplates.footer()
  );

  emailManager.sendMail(toEmail, fromEmail, senderName, subject, textBody, htmlBody);
  Logger.log(`✅ Sent phone normalizer report (${changes.length} changes)`);
}


// ═══════════════════════════════════════════════════════════════════════════════
// Instagram sync
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Validates Instagram handles stored in contact notes.
 * Checks if each @username resolves to a valid Instagram profile
 * by attempting to fetch the profile page.
 *
 * Contacts with broken handles are collected and reported via email.
 *
 * @returns {{valid: number, broken: number, checked: number}} Results
 */
function runInstagramSync() {
  const isDryRun = typeof dryRun !== 'undefined' && dryRun;
  Logger.log('📸 Running Instagram sync...');

  const contacts = fetchContacts([]);
  const contactsWithInstagram = contacts.filter(c => c.instagramNames.length > 0);

  if (contactsWithInstagram.length === 0) {
    Logger.log('No contacts with Instagram handles found');
    return { valid: 0, broken: 0, checked: 0 };
  }

  Logger.log(`📸 Checking ${contactsWithInstagram.length} contacts with Instagram handles...`);

  let valid = 0;
  let broken = 0;
  const brokenContacts = []; // { contact, handle }

  contactsWithInstagram.forEach(contact => {
    contact.instagramNames.forEach(handle => {
      const cleanHandle = handle.replace(/^@/, '');
      const isValid = checkInstagramHandle(cleanHandle);

      if (isValid) {
        valid++;
      } else {
        broken++;
        brokenContacts.push({ contact, handle });
        Logger.log(`  ❌ ${contact.getName()}: ${handle} — not found`);
      }
    });

    // Rate limiting — 1s between requests to avoid Instagram blocking
    Utilities.sleep(1000);
  });

  // Send report if there are broken handles (Instagram sync always reports broken ones)
  if (brokenContacts.length > 0 && !isDryRun && shouldSendActionReports()) {
    sendInstagramSyncReport(brokenContacts);
  }

  const checked = valid + broken;
  Logger.log(`📸 Instagram sync done: ${checked} checked, ${valid} valid, ${broken} broken`);
  return { valid, broken, checked };
}


/**
 * Checks if an Instagram handle exists by fetching the profile page.
 * Returns true if the page returns a 200 status.
 *
 * @param {string} handle Instagram username (without @)
 * @returns {boolean} True if the profile exists
 * @private
 */
function checkInstagramHandle(handle) {
  try {
    const url = `https://www.instagram.com/${handle}/`;
    const response = UrlFetchApp.fetch(url, {
      muteHttpExceptions: true,
      followRedirects: false
    });
    // 200 = profile exists, 404 = not found, 302 = redirect (usually login page for private)
    const code = response.getResponseCode();
    return code === 200 || code === 302;
  } catch (error) {
    Logger.log(`  ⚠️ Error checking @${handle}: ${error.message}`);
    return true; // Assume valid on network error (don't flag falsely)
  }
}


/**
 * Sends an email report of contacts with broken Instagram handles.
 * @param {Object[]} brokenContacts Array of { contact, handle }
 * @private
 */
function sendInstagramSyncReport(brokenContacts) {
  const emailManager = new EmailManager();
  const { toEmail, fromEmail, senderName } = emailManager.getEmailContext();
  const subject = '📸 Broken Instagram Handles';

  const textBody = ['📸 Broken Instagram Handles', '',
    `${brokenContacts.length} handles could not be found:`, '',
    ...brokenContacts.map(b => `  • ${b.contact.getName()} — ${b.handle}`)
  ].join('\n');

  const listHtml = brokenContacts.map(b =>
    `<li><strong>${b.contact.getName()}</strong> — ${b.handle}</li>`
  ).join('\n');

  const htmlBody = EmailTemplates.wrapEmail(
    EmailTemplates.header('📸 Broken Instagram Handles', `${brokenContacts.length} handles not found`) +
    `<ul>${listHtml}</ul>` +
    EmailTemplates.footer()
  );

  emailManager.sendMail(toEmail, fromEmail, senderName, subject, textBody, htmlBody);
  Logger.log(`✅ Sent Instagram sync report (${brokenContacts.length} broken handles)`);
}
