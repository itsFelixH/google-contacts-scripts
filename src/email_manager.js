/**
 * @fileoverview Email formatting and sending.
 *
 * EmailManager builds both plain-text and HTML versions of each report
 * and sends them as multipart MIME messages via the Gmail API.
 * EmailTemplates provides the minimal HTML wrapper.
 */


/**
 * Builds and sends email reports.
 *
 * Each `send*Email` method takes pre-filtered data, formats it into
 * a plain-text body and an HTML body, then sends via Gmail API.
 * All emails are sent to the script owner (self-addressed reports).
 */
class EmailManager {

  constructor() {
    /** @type {typeof EmailTemplates} HTML template helpers */
    this.templates = EmailTemplates;

    /** @type {Object} Custom email subjects from config */
    this.subjects = typeof emailSubjects !== 'undefined' ? emailSubjects : {};
  }


  // ─── Core ───────────────────────────────────────────────────────────────────

  /**
   * Gets the sender/recipient context for self-addressed emails.
   * @returns {{toEmail: string, fromEmail: string, senderName: string}}
   */
  getEmailContext() {
    return {
      toEmail: Session.getActiveUser().getEmail(),
      fromEmail: Session.getActiveUser().getEmail(),
      senderName: DriveApp.getFileById(ScriptApp.getScriptId()).getName()
    };
  }

  /**
   * Sends a multipart MIME email (plain text + HTML) via the Gmail API.
   *
   * @param {string} toEmail Recipient
   * @param {string} fromEmail Sender address
   * @param {string} senderName Display name for the sender
   * @param {string} subject Email subject (will be UTF-8 encoded)
   * @param {string} textBody Plain text version
   * @param {string} htmlBody HTML version
   */
  sendMail(toEmail, fromEmail, senderName, subject, textBody, htmlBody) {
    const boundary = `boundary_${Date.now()}_${Math.random().toString(36).slice(2)}`;

    // Build raw MIME message with both text and HTML parts
    const mailData = [
      `MIME-Version: 1.0`,
      `To: ${toEmail}`,
      `From: "${senderName}" <${fromEmail}>`,
      `Subject: =?UTF-8?B?${Utilities.base64Encode(subject, Utilities.Charset.UTF_8)}?=`,
      `Content-Type: multipart/alternative; boundary=${boundary}`,
      ``,
      `--${boundary}`,
      `Content-Type: text/plain; charset=UTF-8`,
      ``,
      textBody,
      ``,
      `--${boundary}`,
      `Content-Type: text/html; charset=UTF-8`,
      `Content-Transfer-Encoding: base64`,
      ``,
      Utilities.base64Encode(htmlBody, Utilities.Charset.UTF_8),
      ``,
      `--${boundary}--`,
    ].join('\r\n');

    const rawMessage = Utilities.base64EncodeWebSafe(mailData);
    Gmail.Users.Messages.send({ raw: rawMessage }, 'me');
  }


  // ─── Report emails ──────────────────────────────────────────────────────────

  /**
   * Sends the Upcoming Birthdays report.
   *
   * @param {Contact[]} contacts Contacts with upcoming birthdays (pre-filtered)
   * @param {number} days How many days ahead was searched
   */
  sendUpcomingBirthdaysEmail(contacts, days) {
    const { toEmail, fromEmail, senderName } = this.getEmailContext();
    const subject = (this.subjects.upcomingBirthdays || '🎂 Upcoming Birthdays').replace('{days}', days);
    const showAge = typeof birthdayShowAge !== 'undefined' ? birthdayShowAge : true;

    // Build per-contact display data
    const lines = contacts.map(contact => {
      const age = (showAge && contact.hasKnownBirthYear()) ? ` (turns ${contact.calculateAge() + 1})` : '';
      const daysUntil = contact.daysToNextBirthday();
      const daysLabel = daysUntil === 0 ? '🎂 TODAY!' : daysUntil === 1 ? 'tomorrow' : `in ${daysUntil} days`;
      return { name: contact.getName(), age, daysLabel, contact };
    });

    // Plain text
    const textBody = [`🎂 Upcoming Birthdays (next ${days} days)`, '',
      ...lines.map(l => `  • ${l.name}${l.age} — ${l.daysLabel}`)
    ].join('\n');

    // HTML
    const listHtml = lines.map(l => {
      const info = this._formatContactDetails(l.contact);
      return `<li>${l.daysLabel} — <strong>${l.name}</strong>${l.age}${info}</li>`;
    }).join('\n');

    const htmlBody = this.templates.wrapEmail(
      this.templates.header('🎂 Upcoming Birthdays', `${contacts.length} birthdays in the next ${days} days`) +
      `<ul>${listHtml}</ul>` +
      this.templates.footer()
    );

    this.sendMail(toEmail, fromEmail, senderName, subject, textBody, htmlBody);
  }

  /**
   * Sends the Duplicate Contacts report.
   *
   * @param {Object[]} duplicateGroups Array of { contacts, count, reason }
   */
  sendDuplicateContactsEmail(duplicateGroups) {
    const { toEmail, fromEmail, senderName } = this.getEmailContext();
    const subject = this.subjects.duplicates || '🔍 Duplicate Contacts';

    // Plain text
    const textBody = ['🔍 Duplicate Contacts', '',
      ...duplicateGroups.map((g, i) =>
        `  Group ${i + 1}: ${g.contacts.map(c => c.getName()).join(', ')} (${g.reason})`
      )
    ].join('\n');

    // HTML
    const listHtml = duplicateGroups.map((g, i) =>
      `<li><strong>Group ${i + 1}</strong> (${g.count}): ${g.contacts.map(c => c.getName()).join(', ')}<br>↳ ${g.reason}</li>`
    ).join('\n');

    const htmlBody = this.templates.wrapEmail(
      this.templates.header('🔍 Duplicate Contacts', `${duplicateGroups.length} groups may need review`) +
      `<ul>${listHtml}</ul>` +
      this.templates.footer()
    );

    this.sendMail(toEmail, fromEmail, senderName, subject, textBody, htmlBody);
  }

  /**
   * Sends the Contact Overview report (general statistics).
   *
   * @param {Object} stats Output from computeContactStats()
   */
  sendContactOverviewEmail(stats) {
    const { toEmail, fromEmail, senderName } = this.getEmailContext();
    const subject = this.subjects.overview || '📊 Contact Overview';

    const lines = [
      `📇 Total Contacts: ${stats.totalContacts}`,
      `🎂 With Birthday: ${stats.withBirthday} (${stats.birthdayPercentage}%)`,
      `📧 With Email: ${stats.withEmail} (${stats.emailPercentage}%)`,
      `📱 With Phone: ${stats.withPhone} (${stats.phonePercentage}%)`,
      `🌆 With City: ${stats.withCity} (${stats.cityPercentage}%)`,
      `🏷️ With Labels: ${stats.withLabels} (${stats.labelPercentage}%)`,
      `📸 With Instagram: ${stats.withInstagram} (${stats.instagramPercentage}%)`
    ];

    const textBody = ['📊 Contact Overview', '', ...lines].join('\n');
    const htmlBody = this.templates.wrapEmail(
      this.templates.header('📊 Contact Overview', `${stats.totalContacts} contacts`) +
      lines.map(l => `<p>${l}</p>`).join('\n') +
      this.templates.footer()
    );

    this.sendMail(toEmail, fromEmail, senderName, subject, textBody, htmlBody);
  }

  /**
   * Sends the Label Overview report (stats + distribution + unlabeled list).
   *
   * @param {Object} labelStats Output from computeLabelStats()
   * @param {Contact[]} unlabeledContacts Contacts with no labels
   * @param {Object} labelDistribution Map of label name → contact count
   * @param {number} totalContacts Total contacts (for percentage calculation)
   */
  sendLabelOverviewEmail(labelStats, unlabeledContacts, labelDistribution, totalContacts) {
    const { toEmail, fromEmail, senderName } = this.getEmailContext();
    const subject = this.subjects.labelOverview || '🏷️ Label Overview';

    // ── Plain text ──
    const textLines = [
      '🏷️ Label Overview', '',
      `Total Labels: ${labelStats.totalLabels}`,
      `👑 Most Used: ${labelStats.mostUsed?.label || 'N/A'} (${labelStats.mostUsed?.count || 0})`,
      `📉 Least Used: ${labelStats.leastUsed?.label || 'N/A'} (${labelStats.leastUsed?.count || 0})`,
      `❌ Unlabeled: ${labelStats.unlabeledCount}`,
      '',
      '── Label Distribution ──', '',
      ...Object.entries(labelDistribution)
        .sort((a, b) => b[1] - a[1])
        .map(([label, count]) => `  🏷️ ${label}: ${count} (${(count / totalContacts * 100).toFixed(1)}%)`),
    ];

    if (unlabeledContacts.length > 0) {
      textLines.push('', '── Unlabeled Contacts ──', '');
      textLines.push(...unlabeledContacts.map(c => `  • ${c.getName()}`));
    }

    const textBody = textLines.join('\n');

    // ── HTML ──
    const summaryHtml = [
      `<p>🏷️ Total Labels: <strong>${labelStats.totalLabels}</strong></p>`,
      `<p>👑 Most Used: <strong>${labelStats.mostUsed?.label || 'N/A'}</strong> (${labelStats.mostUsed?.count || 0})</p>`,
      `<p>📉 Least Used: <strong>${labelStats.leastUsed?.label || 'N/A'}</strong> (${labelStats.leastUsed?.count || 0})</p>`,
      `<p>❌ Unlabeled: <strong>${labelStats.unlabeledCount}</strong></p>`,
    ].join('\n');

    const distHtml = Object.entries(labelDistribution)
      .sort((a, b) => b[1] - a[1])
      .map(([label, count]) =>
        `<li>🏷️ <strong>${label}</strong>: ${count} (${(count / totalContacts * 100).toFixed(1)}%)</li>`
      ).join('\n');

    // Only show unlabeled section if there are any
    let unlabeledHtml = '';
    if (unlabeledContacts.length > 0) {
      const items = unlabeledContacts.map(c => {
        const editLink = (typeof includeEditLinks !== 'undefined' && includeEditLinks && c.getContactLink())
          ? ` — <a href="${c.getContactLink()}">edit</a>` : '';
        return `<li>${c.getName()}${editLink}</li>`;
      }).join('\n');
      unlabeledHtml = `<h3>❌ Unlabeled Contacts (${unlabeledContacts.length})</h3>\n<ul>${items}</ul>`;
    }

    const htmlBody = this.templates.wrapEmail(
      this.templates.header('🏷️ Label Overview', 'Labels overview and unlabeled contacts') +
      summaryHtml +
      `<h3>📊 Label Distribution</h3>\n<ul>${distHtml}</ul>` +
      unlabeledHtml +
      this.templates.footer()
    );

    this.sendMail(toEmail, fromEmail, senderName, subject, textBody, htmlBody);
  }

  /**
   * Sends the Missing Info report for a specific field.
   *
   * @param {string} field Which field is missing: 'email', 'phone', 'city', or 'birthday'
   * @param {Contact[]} contacts Contacts missing that field
   */
  sendMissingInfoEmail(field, contacts) {
    const { toEmail, fromEmail, senderName } = this.getEmailContext();

    const fieldNames = { email: 'Email', phone: 'Phone', city: 'City', birthday: 'Birthday' };
    const fieldEmojis = { email: '📧', phone: '📱', city: '🌆', birthday: '🎂' };
    const emoji = fieldEmojis[field] || '📋';
    const displayName = fieldNames[field] || field;
    const subject = (this.subjects.missingInfo || `${emoji} Missing Info: {field}`).replace('{field}', displayName);

    // Plain text — show what info the contact does have for context
    const textBody = [`${emoji} Contacts Missing ${displayName}`, '',
      ...contacts.map(c => {
        const has = this._summarizeExistingFields(c, field);
        return `  • ${c.getName()}${has ? `  (has: ${has})` : ''}`;
      })
    ].join('\n');

    // HTML — show existing info + edit links
    const listHtml = contacts.map(c => {
      const editLink = (typeof includeEditLinks !== 'undefined' && includeEditLinks && c.getContactLink())
        ? ` <a href="${c.getContactLink()}">edit</a>` : '';
      const has = this._summarizeExistingFieldsHtml(c, field);
      return `<li><strong>${c.getName()}</strong>${editLink}${has}</li>`;
    }).join('\n');

    const htmlBody = this.templates.wrapEmail(
      this.templates.header(`${emoji} Missing Info: ${displayName}`, `${contacts.length} contacts are missing ${displayName.toLowerCase()}`) +
      `<ul>${listHtml}</ul>` +
      this.templates.footer()
    );

    this.sendMail(toEmail, fromEmail, senderName, subject, textBody, htmlBody);
  }

  /**
   * Summarizes what fields a contact does have (excluding the missing one).
   * Used for plain text version.
   * @param {Contact} contact
   * @param {string} missingField The field that's missing (excluded from summary)
   * @returns {string} Comma-separated list of existing fields, or ''
   * @private
   */
  _summarizeExistingFields(contact, missingField) {
    const parts = [];
    if (missingField !== 'email' && contact.email) parts.push(`📧 ${contact.email}`);
    if (missingField !== 'phone' && contact.phoneNumber) parts.push(`📱 ${contact.phoneNumber}`);
    if (missingField !== 'city' && contact.city) parts.push(`🌆 ${contact.city}`);
    if (missingField !== 'birthday' && contact.getBirthday()) parts.push(`🎂 ${contact.getBirthdayShortFormat()}`);
    if (contact.getLabels().length > 0) parts.push(`🏷️ ${contact.getLabels().join(', ')}`);
    return parts.join(', ');
  }

  /**
   * Summarizes what fields a contact does have as HTML.
   * @param {Contact} contact
   * @param {string} missingField The field that's missing (excluded from summary)
   * @returns {string} HTML snippet or ''
   * @private
   */
  _summarizeExistingFieldsHtml(contact, missingField) {
    const parts = [];
    if (missingField !== 'email' && contact.email) parts.push(`📧 ${contact.email}`);
    if (missingField !== 'phone' && contact.phoneNumber) parts.push(`📱 ${contact.phoneNumber}`);
    if (missingField !== 'city' && contact.city) parts.push(`🌆 ${contact.city}`);
    if (missingField !== 'birthday' && contact.getBirthday()) parts.push(`🎂 ${contact.getBirthdayShortFormat()}`);
    if (contact.getLabels().length > 0) parts.push(`🏷️ ${contact.getLabels().join(', ')}`);
    if (parts.length === 0) return '';
    return `<br><small>${parts.join(' · ')}</small>`;
  }

  /**
   * Sends the Data Quality report (missing surnames + invalid phones).
   *
   * @param {Contact[]} missingSurnames Contacts without a surname
   * @param {Contact[]} invalidPhones Contacts with invalid phone numbers
   */
  sendDataQualityEmail(missingSurnames, invalidPhones) {
    const { toEmail, fromEmail, senderName } = this.getEmailContext();
    const subject = this.subjects.dataQuality || '🔧 Data Quality';
    const totalIssues = missingSurnames.length + invalidPhones.length;

    // ── Plain text ──
    const textLines = ['🔧 Data Quality', '', `${totalIssues} issues found`, ''];

    if (missingSurnames.length > 0) {
      textLines.push(`👤 Missing Surnames (${missingSurnames.length}):`);
      textLines.push(...missingSurnames.map(c => `  • ${c.getName()}`));
      textLines.push('');
    }
    if (invalidPhones.length > 0) {
      textLines.push(`📱 Invalid Phone Numbers (${invalidPhones.length}):`);
      textLines.push(...invalidPhones.map(c => `  • ${c.getName()} — ${c.phoneNumber}`));
    }

    const textBody = textLines.join('\n');

    // ── HTML ──
    let sectionsHtml = '';

    if (missingSurnames.length > 0) {
      const items = missingSurnames.map(c => {
        const editLink = (typeof includeEditLinks !== 'undefined' && includeEditLinks && c.getContactLink())
          ? ` — <a href="${c.getContactLink()}">edit</a>` : '';
        return `<li>${c.getName()}${editLink}</li>`;
      }).join('\n');
      sectionsHtml += `<h3>👤 Missing Surnames (${missingSurnames.length})</h3>\n<ul>${items}</ul>`;
    }

    if (invalidPhones.length > 0) {
      const items = invalidPhones.map(c =>
        `<li><strong>${c.getName()}</strong> — 📱 ${c.phoneNumber}</li>`
      ).join('\n');
      sectionsHtml += `<h3>📱 Invalid Phone Numbers (${invalidPhones.length})</h3>\n<ul>${items}</ul>`;
    }

    const htmlBody = this.templates.wrapEmail(
      this.templates.header('🔧 Data Quality', `${totalIssues} issues found`) +
      sectionsHtml +
      this.templates.footer()
    );

    this.sendMail(toEmail, fromEmail, senderName, subject, textBody, htmlBody);
  }


  // ─── Private helpers ────────────────────────────────────────────────────────

  /**
   * Formats a contact's details (email, phone, city, labels) as an HTML snippet.
   * Used as a secondary line under the contact name in list items.
   *
   * @param {Contact} contact The contact to format
   * @returns {string} HTML string (empty if no details available)
   * @private
   */
  _formatContactDetails(contact) {
    const parts = [];

    if (contact.email) {
      parts.push(`📧 <a href="mailto:${contact.email}">${contact.email}</a>`);
    }
    if (contact.phoneNumber) {
      let phonePart = `📱 ${contact.phoneNumber}`;
      // Append WhatsApp link if configured
      if (typeof includeWhatsAppLinks !== 'undefined' && includeWhatsAppLinks) {
        const waLink = contact.getWhatsAppLink();
        if (waLink) phonePart += ` (<a href="${waLink}">WhatsApp</a>)`;
      }
      parts.push(phonePart);
    }
    if (contact.city) parts.push(`🌆 ${contact.city}`);
    if (contact.getLabels().length > 0) parts.push(`🏷️ ${contact.getLabels().join(', ')}`);

    if (parts.length === 0) return '';
    return `<br><small>${parts.join(' · ')}</small>`;
  }
}


// ═══════════════════════════════════════════════════════════════════════════════


/**
 * Minimal HTML email templates.
 * Uses inline styles sparingly — just enough for readability across email clients.
 */
class EmailTemplates {

  /**
   * Renders a report header (title + optional subtitle).
   *
   * @param {string} heading Main title text
   * @param {string} [subtitle] Optional subtitle/description
   * @returns {string} HTML string
   */
  static header(heading, subtitle = '') {
    return `<h2>${heading}</h2>${subtitle ? `<p>${subtitle}</p>` : ''}\n`;
  }

  /**
   * Renders the email footer with action links.
   * @returns {string} HTML string
   */
  static footer() {
    return `<hr><p><a href="https://contacts.google.com">Manage Contacts</a> · <a href="https://github.com/itsFelixH/google-contacts-scripts">GitHub</a></p>\n`;
  }

  /**
   * Wraps content in a complete HTML document with minimal styling.
   *
   * @param {string} content The email body HTML
   * @returns {string} Complete HTML document
   */
  static wrapEmail(content) {
    return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 16px; line-height: 1.5;">
<style>li { margin-bottom: 6px; }</style>
${content}
</body>
</html>`;
  }
}
