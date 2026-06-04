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
 * - Instagram → Website: convert @handles in notes to website fields
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

/**
 * Throttles API write operations to avoid hitting Google's rate limits.
 * Sleeps briefly between calls. Only active in production (not dry run).
 * @param {boolean} isDryRun Whether we're in dry run mode
 * @private
 */
function throttle(isDryRun) {
  if (!isDryRun && typeof Utilities !== 'undefined') {
    Utilities.sleep(100); // 100ms between writes — ~10 ops/sec
  }
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
          throttle(isDryRun);
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
    EmailTemplates.listItem(`<strong>${c.name}</strong> → 🏷️ ${c.label}`)
  ).join('\n');

  const htmlBody = EmailTemplates.wrapEmail(
    EmailTemplates.header('🏷️ Auto-Labeling Summary', `${changes.length} labels applied`) +
    EmailTemplates.card(EmailTemplates.list(listHtml)) +
    EmailTemplates.footer(emailManager.scriptId)
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
      throttle(isDryRun);
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

  // Split into parenthetical segments and regular text
  // Preserve content inside parens as-is (e.g. "(Swing Barcelona)")
  const parts = result.split(/(\([^)]*\))/g);

  result = parts.map(part => {
    // If it's a parenthetical, leave it untouched
    if (part.startsWith('(') && part.endsWith(')')) return part;

    // Title case: lowercase, then capitalize first char of each word and after hyphens
    return part.toLowerCase()
      .replace(/(^|\s|-)(\S)/g, (match, sep, char) => sep + char.toUpperCase());
  }).join('');

  // Handle lowercase prefixes (hardcoded — these are universal)
  const prefixes = ['von', 'van', 'de', 'del', 'der', 'di', 'la', 'le', 'el'];

  result = result.split(' ').map((word, i) => {
    if (i === 0) return word; // Never lowercase the first word
    // Skip words inside parens
    if (word.startsWith('(')) return word;
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
    EmailTemplates.listItem(`"${c.before}" → <strong>${c.after}</strong>`)
  ).join('\n');

  const htmlBody = EmailTemplates.wrapEmail(
    EmailTemplates.header('✏️ Name Formatter Summary', `${changes.length} names fixed`) +
    EmailTemplates.card(EmailTemplates.list(listHtml)) +
    EmailTemplates.footer(emailManager.scriptId)
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
      throttle(isDryRun);
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
 * Normalizes a single phone number to international format with consistent spacing.
 *
 * Output format: +CC XXX XXXXXXX (country code · area/mobile prefix · number)
 * Numbers that are already well-formatted are left unchanged.
 *
 * @param {string} phone The phone number to normalize
 * @param {string} countryCode Default country code (e.g. '+49')
 * @returns {string} Normalized phone number
 * @private
 */
function normalizePhoneNumber(phone, countryCode) {
  // Already international format — strip all separators, then reformat with consistent spaces
  if (phone.startsWith('+')) {
    const digits = phone.replace(/[^\d]/g, ''); // strip everything except digits
    // Detect country code length (1-3 digits) using common patterns
    const ccDigitLen = detectCountryCodeLength(digits);
    const cc = '+' + digits.slice(0, ccDigitLen);
    const rest = digits.slice(ccDigitLen);
    if (rest.length >= 7) {
      const areaLen = rest.length <= 8 ? 2 : 3;
      return `${cc} ${rest.slice(0, areaLen)} ${rest.slice(areaLen)}`;
    }
    return `+${digits}`; // too short to format meaningfully
  }

  // Local format starting with 0 — replace leading 0 with country code
  if (phone.startsWith('0')) {
    const digits = phone.substring(1).replace(/\D/g, '');
    if (digits.length >= 7) {
      const areaLen = digits.length <= 8 ? 2 : 3;
      return `${countryCode} ${digits.slice(0, areaLen)} ${digits.slice(areaLen)}`;
    }
    return `${countryCode}${digits}`;
  }

  // Doesn't match known patterns — return as-is
  return phone;
}


/**
 * Detects the country code length (in digits) from a phone number's leading digits.
 * Uses ITU-T E.164 patterns for accurate detection.
 *
 * @param {string} digits Phone number digits (without +)
 * @returns {number} Number of digits in the country code (1-3)
 * @private
 */
function detectCountryCodeLength(digits) {
  // 1-digit country codes
  if (digits.startsWith('1') || digits.startsWith('7')) return 1;

  // Known 2-digit country codes (major ones)
  const twoDigitCodes = [
    '20', '27', '30', '31', '32', '33', '34', '36', '39',
    '40', '41', '43', '44', '45', '46', '47', '48', '49',
    '51', '52', '53', '54', '55', '56', '57', '58',
    '60', '61', '62', '63', '64', '65', '66',
    '81', '82', '84', '86',
    '90', '91', '92', '93', '94', '95', '98',
  ];

  const first2 = digits.slice(0, 2);
  if (twoDigitCodes.includes(first2)) return 2;

  // Everything else is 3-digit
  return 3;
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
    EmailTemplates.listItem(`<strong>${c.name}</strong>: ${c.before} → <strong>${c.after}</strong>`)
  ).join('\n');

  const htmlBody = EmailTemplates.wrapEmail(
    EmailTemplates.header('📱 Phone Normalizer Summary', `${changes.length} numbers normalized`) +
    EmailTemplates.card(EmailTemplates.list(listHtml)) +
    EmailTemplates.footer(emailManager.scriptId)
  );

  emailManager.sendMail(toEmail, fromEmail, senderName, subject, textBody, htmlBody);
  Logger.log(`✅ Sent phone normalizer report (${changes.length} changes)`);
}


// ═══════════════════════════════════════════════════════════════════════════════
// Instagram → Website
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Converts Instagram @usernames from contact notes into website fields.
 * For each @username found in the biography/notes:
 * - Adds https://instagram.com/username as a website (type: "Instagram")
 * - Removes the @username from the notes
 *
 * Skips contacts that already have the Instagram URL in their websites.
 * Supports dryRun mode for previewing changes.
 *
 * @returns {{converted: number, skipped: number, changes: Object[]}} Results
 */
function runInstagramToWebsite() {
  const isDryRun = typeof dryRun !== 'undefined' && dryRun;
  Logger.log('📸 Running Instagram → Website conversion...');

  // Fetch contacts with biographies and urls
  const contacts = fetchContacts([]);
  const contactsWithInstagram = contacts.filter(c => c.instagramNames.length > 0);

  if (contactsWithInstagram.length === 0) {
    Logger.log('No contacts with Instagram handles found');
    return { converted: 0, skipped: 0, changes: [] };
  }

  Logger.log(`📸 Found ${contactsWithInstagram.length} contacts with Instagram handles`);

  let converted = 0;
  let skipped = 0;
  const changes = []; // { name, handles, url }

  contactsWithInstagram.forEach(contact => {
    // Fetch current urls in a single API call (notes already available on contact)
    const personData = getContactFields(contact.resourceName, 'urls');
    const existingUrls = personData.urls || [];
    const existingUrlValues = existingUrls.map(u => (u.value || '').toLowerCase());
    const currentNotes = contact.notes;

    const handlesToConvert = [];

    contact.instagramNames.forEach(handle => {
      const cleanHandle = handle.replace(/^@/, '');
      const instagramUrl = `https://www.instagram.com/${cleanHandle}`;

      // Skip if this URL already exists as a website (check for both www and non-www)
      if (existingUrlValues.some(url => url.includes(`instagram.com/${cleanHandle.toLowerCase()}`))) {
        skipped++;
        return;
      }

      handlesToConvert.push({ handle, cleanHandle, url: instagramUrl });
    });

    if (handlesToConvert.length === 0) return;

    changes.push({
      name: contact.getName(),
      handles: handlesToConvert.map(h => h.handle),
      urls: handlesToConvert.map(h => h.url),
    });

    if (isDryRun) {
      handlesToConvert.forEach(h => {
        Logger.log(`🧪 [DRY RUN] ${contact.getName()}: ${h.handle} → website ${h.url}`);
      });
      converted += handlesToConvert.length;
      return;
    }

    try {
      // Build new websites array (keep existing + add new Instagram ones)
      const newUrls = [
        ...existingUrls,
        ...handlesToConvert.map(h => ({ value: h.url, type: 'other', formattedType: 'Instagram' })),
      ];

      // Remove @handles from notes
      let updatedNotes = currentNotes;
      handlesToConvert.forEach(h => {
        // Remove the handle and any surrounding whitespace/punctuation
        updatedNotes = updatedNotes
          .replace(new RegExp(`Instagram:\\s*${h.cleanHandle}`, 'gi'), '')
          .replace(new RegExp(`@${h.cleanHandle}`, 'gi'), '');
      });
      // Clean up leftover separators and whitespace
      updatedNotes = updatedNotes.replace(/[,;]\s*[,;]/g, ',').replace(/^\s*[,;.]\s*/gm, '').replace(/\s*[,;.]\s*$/gm, '').replace(/\n{3,}/g, '\n\n').trim();

      // Update the contact: add websites + clean notes
      const updateFields = ['urls'];
      const updateBody = { urls: newUrls };

      if (updatedNotes !== currentNotes) {
        updateFields.push('biographies');
        updateBody.biographies = updatedNotes ? [{ value: updatedNotes, contentType: 'TEXT_PLAIN' }] : [];
      }

      People.People.updateContact(updateBody, contact.resourceName, {
        updatePersonFields: updateFields.join(',')
      });

      converted += handlesToConvert.length;
      handlesToConvert.forEach(h => {
        Logger.log(`  ✅ ${contact.getName()}: ${h.handle} → ${h.url}`);
      });
      throttle(isDryRun);
    } catch (error) {
      Logger.log(`  ❌ Failed to update ${contact.getName()}: ${error.message}`);
    }
  });

  // Send summary report
  if (changes.length > 0 && !isDryRun && shouldSendActionReports()) {
    sendInstagramToWebsiteReport(changes);
  }

  Logger.log(`📸 Instagram → Website done: ${converted} converted, ${skipped} already existed`);
  return { converted, skipped, changes };
}


/**
 * Gets specific fields for a contact from the People API in a single call.
 * @param {string} resourceName The contact's resource name
 * @param {string} personFields Comma-separated fields to fetch
 * @returns {Object} The person object with requested fields
 * @private
 */
function getContactFields(resourceName, personFields) {
  try {
    return People.People.get(resourceName, { personFields });
  } catch (error) {
    Logger.log(`  ⚠️ Failed to read ${resourceName}: ${error.message}`);
    return {};
  }
}


/**
 * Sends a summary email of Instagram → Website conversions.
 * @param {Object[]} changes Array of { name, handles, urls }
 * @private
 */
function sendInstagramToWebsiteReport(changes) {
  const emailManager = new EmailManager();
  const { toEmail, fromEmail, senderName } = emailManager.getEmailContext();
  const totalHandles = changes.reduce((sum, c) => sum + c.handles.length, 0);
  const subject = '📸 Instagram → Website Summary';

  const textBody = ['📸 Instagram → Website Summary', '',
    `${totalHandles} handles converted for ${changes.length} contacts:`, '',
    ...changes.map(c => `  • ${c.name}: ${c.handles.join(', ')} → website`)
  ].join('\n');

  const listHtml = changes.map(c => {
    const links = c.urls.map(url => `<a href="${url}" style="color: #1a73e8; text-decoration: none;">${url}</a>`).join(', ');
    return EmailTemplates.listItem(`<strong>${c.name}</strong><br><small style="color: #666;">${c.handles.join(', ')} → ${links}</small>`);
  }).join('\n');

  const htmlBody = EmailTemplates.wrapEmail(
    EmailTemplates.header('📸 Instagram → Website', `${totalHandles} handles converted for ${changes.length} contacts`) +
    EmailTemplates.card(EmailTemplates.list(listHtml)) +
    EmailTemplates.footer(emailManager.scriptId)
  );

  emailManager.sendMail(toEmail, fromEmail, senderName, subject, textBody, htmlBody);
  Logger.log(`✅ Sent Instagram → Website report (${changes.length} contacts)`);
}
