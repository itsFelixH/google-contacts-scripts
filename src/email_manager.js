/**
 * @fileoverview Email formatting and sending.
 *
 * EmailManager builds both plain-text and HTML versions of each report
 * and sends them as multipart MIME messages via the Gmail API.
 * EmailTemplates provides the HTML wrapper and reusable components.
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

    /** @type {string} Script ID for Apps Script editor link */
    this.scriptId = typeof ScriptApp !== 'undefined' ? ScriptApp.getScriptId() : '';
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
      const editLink = this._editLink(l.contact);
      const info = this._formatContactDetails(l.contact);
      return this.templates.listItem(
        `${l.daysLabel} — <strong>${l.name}</strong>${l.age}${editLink}${info}`
      );
    }).join('\n');

    const htmlBody = this.templates.wrapEmail(
      this.templates.header('🎂 Upcoming Birthdays', `${contacts.length} birthdays in the next ${days} days`) +
      this._cardWithList(listHtml, contacts) +
      this.templates.footer(this.scriptId, [{ label: 'Open Calendar', url: 'https://calendar.google.com' }])
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
      ...duplicateGroups.map((g, i) => {
        const names = g.contacts.map(c => {
          const details = this._summarizeDuplicateContact(c);
          return details ? `${c.getName()} (${details})` : c.getName();
        }).join(', ');
        return `  Group ${i + 1}: ${names}\n    ↳ ${g.reason}`;
      })
    ].join('\n');

    // HTML
    const listHtml = duplicateGroups.map((g, i) => {
      const members = g.contacts.map(c => {
        const editLink = this._editLink(c);
        const details = this._summarizeDuplicateContactHtml(c);
        return `<strong>${c.getName()}</strong>${editLink}${details}`;
      }).join('<br>');
      return this.templates.listItem(
        `<strong>Group ${i + 1}</strong> (${g.count}):<br>${members}<br><small style="color: #666;">↳ ${g.reason}</small>`
      );
    }).join('\n');

    const htmlBody = this.templates.wrapEmail(
      this.templates.header('🔍 Duplicate Contacts', `${duplicateGroups.length} groups may need review`) +
      this.templates.card(this.templates.list(listHtml)) +
      this.templates.footer(this.scriptId, [{ label: 'Merge Contacts', url: 'https://contacts.google.com/merge' }])
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

    const statLines = [
      { emoji: '📇', label: 'Total Contacts', value: stats.totalContacts },
      { emoji: '📧', label: 'With Email', value: stats.withEmail, pct: stats.emailPercentage },
      { emoji: '📱', label: 'With Phone', value: stats.withPhone, pct: stats.phonePercentage },
      { emoji: '🎂', label: 'With Birthday', value: stats.withBirthday, pct: stats.birthdayPercentage },
      { emoji: '🌆', label: 'With City', value: stats.withCity, pct: stats.cityPercentage },
      { emoji: '🏷️', label: 'With Labels', value: stats.withLabels, pct: stats.labelPercentage },
      { emoji: '📸', label: 'With Instagram', value: stats.withInstagram, pct: stats.instagramPercentage },
    ];

    // ── Plain text ──
    const textLines = ['📊 Contact Overview', '',
      ...statLines.map(s => `  ${s.emoji} ${s.label}: ${s.value}${s.pct ? ` (${s.pct}%)` : ''}`),
      '',
      `✅ Completeness: ${stats.completeCount} contacts have all 4 fields (${stats.completenessPercentage}%)`,
      `   4/4: ${stats.completeness[4]} · 3/4: ${stats.completeness[3]} · 2/4: ${stats.completeness[2]} · 1/4: ${stats.completeness[1]} · 0/4: ${stats.completeness[0]}`,
    ];

    if (stats.topCities.length > 0) {
      textLines.push('', '🌆 Top Cities:');
      textLines.push(...stats.topCities.map(c => `  ${c.city}: ${c.count}`));
    }

    if (stats.birthdayMonths && stats.birthdayMonths.some(n => n > 0)) {
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      textLines.push('', '🎂 Birthdays by Month:');
      textLines.push(...stats.birthdayMonths.map((count, i) => `  ${monthNames[i]}: ${count}`));
    }

    const textBody = textLines.join('\n');

    // ── HTML ──
    const statsHtml = statLines.map(s => {
      const pct = s.pct ? ` <span style="color: #666;">(${s.pct}%)</span>` : '';
      return `<div style="padding: 8px 0; border-bottom: 1px solid #eee;">${s.emoji} ${s.label}: <strong>${s.value}</strong>${pct}</div>`;
    }).join('\n');

    // Completeness section
    const completenessHtml = [
      `<div style="padding: 8px 0; border-bottom: 1px solid #eee;">✅ Complete (all 4 fields): <strong>${stats.completeCount}</strong> <span style="color: #666;">(${stats.completenessPercentage}%)</span></div>`,
      `<div style="padding: 8px 0;">` +
        `<span style="margin-right: 12px;">4/4: <strong>${stats.completeness[4]}</strong></span>` +
        `<span style="margin-right: 12px;">3/4: <strong>${stats.completeness[3]}</strong></span>` +
        `<span style="margin-right: 12px;">2/4: <strong>${stats.completeness[2]}</strong></span>` +
        `<span style="margin-right: 12px;">1/4: <strong>${stats.completeness[1]}</strong></span>` +
        `<span>0/4: <strong>${stats.completeness[0]}</strong></span>` +
      `</div>`,
    ].join('\n');

    // Top cities section
    let citiesHtml = '';
    if (stats.topCities.length > 0) {
      const cityItems = stats.topCities.map(c =>
        this.templates.listItem(`<strong>${c.city}</strong>: ${c.count}`)
      ).join('\n');
      citiesHtml = this.templates.section('🌆 Top Cities') +
        this.templates.card(this.templates.list(cityItems));
    }

    // Birthday months section
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    let birthdayMonthsHtml = '';
    if (stats.birthdayMonths && stats.birthdayMonths.some(n => n > 0)) {
      const maxMonth = Math.max(...stats.birthdayMonths);
      const monthBars = stats.birthdayMonths.map((count, i) => {
        const width = maxMonth > 0 ? Math.round((count / maxMonth) * 100) : 0;
        return `<div style="padding: 4px 0; display: flex; align-items: center;">` +
          `<span style="width: 32px; font-size: 12px; color: #666;">${monthNames[i]}</span>` +
          `<span style="flex: 1; height: 14px; background: #e8e8e8; border-radius: 3px; overflow: hidden;">` +
          `<span style="display: block; height: 100%; width: ${width}%; background: #1a73e8; border-radius: 3px;"></span></span>` +
          `<span style="width: 28px; text-align: right; font-size: 12px; font-weight: 500;">${count}</span></div>`;
      }).join('\n');
      birthdayMonthsHtml = this.templates.section('🎂 Birthdays by Month') +
        this.templates.card(monthBars);
    }

    const htmlBody = this.templates.wrapEmail(
      this.templates.header('📊 Contact Overview', `${stats.totalContacts} contacts`) +
      this.templates.card(statsHtml) +
      this.templates.section('📋 Completeness (email + phone + birthday + city)') +
      this.templates.card(completenessHtml) +
      citiesHtml +
      birthdayMonthsHtml +
      this.templates.footer(this.scriptId)
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
      `✅ Labeled: ${labelStats.labeledCount} · ❌ Unlabeled: ${labelStats.unlabeledCount}`,
      `📊 Avg labels/contact: ${labelStats.avgLabelsPerContact}`,
      `🔀 With multiple labels: ${labelStats.multiLabelCount}`,
      '',
      '── Label Distribution ──', '',
      ...Object.entries(labelDistribution)
        .sort((a, b) => b[1] - a[1])
        .map(([label, count]) => `  ${label}: ${count} (${(count / totalContacts * 100).toFixed(1)}%)`),
    ];

    if (unlabeledContacts.length > 0) {
      textLines.push('', '── Unlabeled Contacts ──', '');
      textLines.push(...unlabeledContacts.map(c => `  • ${c.getName()}`));
    }

    const textBody = textLines.join('\n');

    // ── HTML ──
    const summaryHtml = [
      `<div style="padding: 8px 0; border-bottom: 1px solid #eee;">🏷️ Total Labels: <strong>${labelStats.totalLabels}</strong></div>`,
      `<div style="padding: 8px 0; border-bottom: 1px solid #eee;">👑 Most Used: <strong>${labelStats.mostUsed?.label || 'N/A'}</strong> (${labelStats.mostUsed?.count || 0})</div>`,
      `<div style="padding: 8px 0; border-bottom: 1px solid #eee;">📉 Least Used: <strong>${labelStats.leastUsed?.label || 'N/A'}</strong> (${labelStats.leastUsed?.count || 0})</div>`,
      `<div style="padding: 8px 0; border-bottom: 1px solid #eee;">✅ Labeled: <strong>${labelStats.labeledCount}</strong> · ❌ Unlabeled: <strong>${labelStats.unlabeledCount}</strong></div>`,
      `<div style="padding: 8px 0; border-bottom: 1px solid #eee;">📊 Avg labels per contact: <strong>${labelStats.avgLabelsPerContact}</strong></div>`,
      `<div style="padding: 8px 0;">🔀 With multiple labels: <strong>${labelStats.multiLabelCount}</strong></div>`,
    ].join('\n');

    const distHtml = Object.entries(labelDistribution)
      .sort((a, b) => b[1] - a[1])
      .map(([label, count]) =>
        this.templates.listItem(`<strong>${label}</strong>: ${count} <span style="color: #666;">(${(count / totalContacts * 100).toFixed(1)}%)</span>`)
      ).join('\n');

    // Only show unlabeled section if there are any
    let unlabeledHtml = '';
    if (unlabeledContacts.length > 0) {
      const items = unlabeledContacts.map(c => {
        const editLink = this._editLink(c);
        return this.templates.listItem(`<strong>${c.getName()}</strong>${editLink}`);
      }).join('\n');
      unlabeledHtml = this.templates.section(`❌ Unlabeled Contacts (${unlabeledContacts.length})`) +
        this._cardWithList(items, unlabeledContacts);
    }

    const htmlBody = this.templates.wrapEmail(
      this.templates.header('🏷️ Label Overview', `${labelStats.totalLabels} labels · ${totalContacts} contacts`) +
      this.templates.card(summaryHtml) +
      this.templates.section('📊 Label Distribution') +
      this.templates.card(this.templates.list(distHtml)) +
      unlabeledHtml +
      this.templates.footer(this.scriptId)
    );

    this.sendMail(toEmail, fromEmail, senderName, subject, textBody, htmlBody);
  }

  /**
   * Sends the Missing Info report for all configured fields in one email.
   *
   * @param {Object} fieldData Map of field → Contact[] (e.g. { email: [...], phone: [...] })
   */
  sendMissingInfoEmail(fieldData) {
    const { toEmail, fromEmail, senderName } = this.getEmailContext();

    const fieldNames = { email: 'Email', phone: 'Phone', city: 'City', birthday: 'Birthday' };
    const fieldEmojis = { email: '📧', phone: '📱', city: '🌆', birthday: '🎂' };

    const fields = Object.keys(fieldData).filter(f => fieldData[f].length > 0);
    if (fields.length === 0) return;

    const totalMissing = fields.reduce((sum, f) => sum + fieldData[f].length, 0);
    const subject = this.subjects.missingInfo || '📋 Missing Info';

    // ── Plain text ──
    const textLines = ['📋 Missing Info', '', `${totalMissing} gaps across ${fields.length} fields`, ''];
    fields.forEach(field => {
      const displayName = fieldNames[field] || field;
      const emoji = fieldEmojis[field] || '📋';
      textLines.push(`${emoji} Missing ${displayName} (${fieldData[field].length}):`);
      textLines.push(...fieldData[field].map(c => {
        const has = this._summarizeExistingFields(c, field);
        return `  • ${c.getName()}${has ? `  (${has})` : ''}`;
      }));
      textLines.push('');
    });

    const textBody = textLines.join('\n');

    // ── HTML ──
    let sectionsHtml = '';
    fields.forEach(field => {
      const displayName = fieldNames[field] || field;
      const emoji = fieldEmojis[field] || '📋';
      const items = fieldData[field].map(c => {
        const editLink = this._editLink(c);
        const has = this._summarizeExistingFieldsHtml(c, field);
        return this.templates.listItem(`<strong>${c.getName()}</strong>${editLink}${has}`);
      }).join('\n');
      sectionsHtml += this.templates.section(`${emoji} Missing ${displayName} (${fieldData[field].length})`) +
        this.templates.card(this.templates.list(items));
    });

    const htmlBody = this.templates.wrapEmail(
      this.templates.header('📋 Missing Info', `${totalMissing} gaps across ${fields.length} fields`) +
      sectionsHtml +
      this.templates.footer(this.scriptId)
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
    return `<br><small style="color: #666;">${parts.join(' · ')}</small>`;
  }

  /**
   * Sends the Data Quality report.
   *
   * @param {Contact[]} missingSurnames Contacts without a surname
   * @param {Contact[]} invalidPhones Contacts with invalid phone numbers
   * @param {Object[]} duplicatePhones Array of { phone, contacts: Contact[] }
   * @param {Contact[]} emptyContacts Contacts with only a name
   * @param {Contact[]} badNames Contacts with ALL CAPS or all lowercase names
   * @param {number} totalContacts Total contact count for context
   */
  sendDataQualityEmail(missingSurnames, invalidPhones, duplicatePhones, emptyContacts, badNames, totalContacts) {
    const { toEmail, fromEmail, senderName } = this.getEmailContext();
    const subject = this.subjects.dataQuality || '🔧 Data Quality';
    const totalIssues = missingSurnames.length + invalidPhones.length + duplicatePhones.length + emptyContacts.length + badNames.length;

    // ── Summary parts ──
    const summaryParts = [];
    if (missingSurnames.length > 0) summaryParts.push(`${missingSurnames.length} missing surnames`);
    if (invalidPhones.length > 0) summaryParts.push(`${invalidPhones.length} invalid phones`);
    if (duplicatePhones.length > 0) summaryParts.push(`${duplicatePhones.length} shared numbers`);
    if (emptyContacts.length > 0) summaryParts.push(`${emptyContacts.length} empty contacts`);
    if (badNames.length > 0) summaryParts.push(`${badNames.length} formatting issues`);

    // ── Plain text ──
    const textLines = ['🔧 Data Quality', '', `${totalIssues} issues found across ${totalContacts} contacts`, '',
      ...summaryParts.map(p => `  • ${p}`), ''];

    if (missingSurnames.length > 0) {
      textLines.push(`👤 Missing Surnames (${missingSurnames.length}):`);
      textLines.push(...missingSurnames.map(c => `  • ${c.getName()}`));
      textLines.push('');
    }
    if (invalidPhones.length > 0) {
      textLines.push(`📱 Invalid Phone Numbers (${invalidPhones.length}):`);
      textLines.push(...invalidPhones.map(c => `  • ${c.getName()} — ${c.phoneNumber}`));
      textLines.push('');
    }
    if (duplicatePhones.length > 0) {
      textLines.push(`📞 Shared Phone Numbers (${duplicatePhones.length}):`);
      textLines.push(...duplicatePhones.map(g => `  • ${g.phone}: ${g.contacts.map(c => c.getName()).join(', ')}`));
      textLines.push('');
    }
    if (emptyContacts.length > 0) {
      textLines.push(`👻 Empty Contacts (${emptyContacts.length}):`);
      textLines.push(...emptyContacts.map(c => `  • ${c.getName()}`));
      textLines.push('');
    }
    if (badNames.length > 0) {
      textLines.push(`🔤 Name Formatting Issues (${badNames.length}):`);
      textLines.push(...badNames.map(c => `  • ${c.getName()}`));
      textLines.push('');
    }

    const textBody = textLines.join('\n');

    // ── HTML ──
    // Summary card
    const summaryHtml = summaryParts.map((p, i) =>
      `<div style="padding: 6px 0;${i < summaryParts.length - 1 ? ' border-bottom: 1px solid #eee;' : ''}">${p}</div>`
    ).join('\n');

    let sectionsHtml = '';

    if (missingSurnames.length > 0) {
      const items = missingSurnames.map(c => {
        const editLink = this._editLink(c);
        const info = this._summarizeExistingFieldsHtml(c, 'name');
        return this.templates.listItem(`<strong>${c.getName()}</strong>${editLink}${info}`);
      }).join('\n');
      sectionsHtml += this.templates.section(`👤 Missing Surnames (${missingSurnames.length})`) +
        this.templates.card(this.templates.list(items));
    }

    if (invalidPhones.length > 0) {
      const items = invalidPhones.map(c => {
        const editLink = this._editLink(c);
        return this.templates.listItem(`<strong>${c.getName()}</strong>${editLink} — 📱 ${c.phoneNumber}`);
      }).join('\n');
      sectionsHtml += this.templates.section(`📱 Invalid Phone Numbers (${invalidPhones.length})`) +
        this.templates.card(this.templates.list(items));
    }

    if (duplicatePhones.length > 0) {
      const items = duplicatePhones.map(g => {
        const names = g.contacts.map(c => {
          const editLink = this._editLink(c);
          return `<strong>${c.getName()}</strong>${editLink}`;
        }).join(', ');
        return this.templates.listItem(`📞 ${g.phone}<br><small style="color: #666;">→ ${names}</small>`);
      }).join('\n');
      sectionsHtml += this.templates.section(`📞 Shared Phone Numbers (${duplicatePhones.length})`) +
        this.templates.card(this.templates.list(items));
    }

    if (emptyContacts.length > 0) {
      const items = emptyContacts.map(c => {
        const editLink = this._editLink(c);
        return this.templates.listItem(`<strong>${c.getName()}</strong>${editLink}`);
      }).join('\n');
      sectionsHtml += this.templates.section(`👻 Empty Contacts (${emptyContacts.length})`) +
        this.templates.card(this.templates.list(items));
    }

    if (badNames.length > 0) {
      const items = badNames.map(c => {
        const editLink = this._editLink(c);
        return this.templates.listItem(`<strong>${c.getName()}</strong>${editLink}`);
      }).join('\n');
      sectionsHtml += this.templates.section(`🔤 Name Formatting Issues (${badNames.length})`) +
        this.templates.card(this.templates.list(items));
    }

    const htmlBody = this.templates.wrapEmail(
      this.templates.header('🔧 Data Quality', `${totalIssues} issues across ${totalContacts} contacts`) +
      this.templates.card(summaryHtml) +
      sectionsHtml +
      this.templates.footer(this.scriptId)
    );

    this.sendMail(toEmail, fromEmail, senderName, subject, textBody, htmlBody);
  }


  // ─── Private helpers ────────────────────────────────────────────────────────

  /**
   * Generates an edit link for a contact (respects includeEditLinks config).
   * @param {Contact} contact
   * @returns {string} HTML link or empty string
   * @private
   */
  _editLink(contact) {
    if (typeof includeEditLinks === 'undefined' || !includeEditLinks) return '';
    const url = contact.getContactLink();
    if (!url) return '';
    return ` <a href="${url}" style="color: #1a73e8; text-decoration: none; font-size: 12px;">edit</a>`;
  }

  /**
   * Renders a card with a list and an optional truncation note.
   * @param {string} listHtml Concatenated listItem() results
   * @param {any[]} sourceList The original (possibly truncated) array for the "and X more" note
   * @returns {string} HTML string
   * @private
   */
  _cardWithList(listHtml, sourceList) {
    return this.templates.card(this.templates.list(listHtml)) +
      this.templates.truncatedNote(sourceList || []);
  }

  /**
   * Summarizes a contact's distinguishing details for the duplicate report (plain text).
   * @param {Contact} contact
   * @returns {string} Comma-separated summary, or ''
   * @private
   */
  _summarizeDuplicateContact(contact) {
    const parts = [];
    if (contact.email) parts.push(contact.email);
    if (contact.phoneNumber) parts.push(contact.phoneNumber);
    if (contact.city) parts.push(contact.city);
    if (contact.getLabels().length > 0) parts.push(contact.getLabels().join(', '));
    return parts.join(', ');
  }

  /**
   * Summarizes a contact's distinguishing details for the duplicate report (HTML).
   * @param {Contact} contact
   * @returns {string} HTML snippet or ''
   * @private
   */
  _summarizeDuplicateContactHtml(contact) {
    const parts = [];
    if (contact.email) parts.push(`📧 ${contact.email}`);
    if (contact.phoneNumber) parts.push(`📱 ${contact.phoneNumber}`);
    if (contact.city) parts.push(`🌆 ${contact.city}`);
    if (contact.getLabels().length > 0) parts.push(`🏷️ ${contact.getLabels().join(', ')}`);
    if (parts.length === 0) return '';
    return ` <small style="color: #666;">${parts.join(' · ')}</small>`;
  }

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
      parts.push(`📧 <a href="mailto:${contact.email}" style="color: #1a73e8; text-decoration: none;">${contact.email}</a>`);
    }
    if (contact.phoneNumber) {
      let phonePart = `📱 ${contact.phoneNumber}`;
      if (typeof includeWhatsAppLinks !== 'undefined' && includeWhatsAppLinks) {
        const waLink = contact.getWhatsAppLink();
        if (waLink) phonePart += ` (<a href="${waLink}" style="color: #1a73e8; text-decoration: none;">WhatsApp</a>)`;
      }
      parts.push(phonePart);
    }
    if (contact.city) parts.push(`🌆 ${contact.city}`);
    if (contact.getLabels().length > 0) parts.push(`🏷️ ${contact.getLabels().join(', ')}`);

    if (parts.length === 0) return '';
    return `<br><small style="color: #666;">${parts.join(' · ')}</small>`;
  }
}


// ═══════════════════════════════════════════════════════════════════════════════


/**
 * HTML email templates with card-based layout.
 * Uses inline styles for maximum email client compatibility.
 */
class EmailTemplates {

  /**
   * Renders a report header (title + optional subtitle).
   * @param {string} heading Main title text
   * @param {string} [subtitle] Optional subtitle/description
   * @returns {string} HTML string
   */
  static header(heading, subtitle = '') {
    return `<h2 style="margin: 0 0 4px 0; font-size: 20px; font-weight: 600;">${heading}</h2>\n` +
      (subtitle ? `<p style="margin: 0 0 16px 0; color: #666; font-size: 14px;">${subtitle}</p>\n` : '');
  }

  /**
   * Renders a section heading (h3 equivalent).
   * @param {string} text Section title
   * @returns {string} HTML string
   */
  static section(text) {
    return `<h3 style="margin: 20px 0 8px 0; font-size: 15px; font-weight: 600;">${text}</h3>\n`;
  }

  /**
   * Wraps content in a card (light background, rounded corners, padding).
   * @param {string} content Inner HTML
   * @returns {string} HTML string
   */
  static card(content) {
    return `<div style="margin: 12px 0; padding: 14px 16px; background: #f8f9fa; border-radius: 8px;">\n${content}\n</div>\n`;
  }

  /**
   * Wraps list items in a styled list container.
   * @param {string} items Concatenated listItem() results
   * @returns {string} HTML string
   */
  static list(items) {
    return `<ul style="list-style: none; padding: 0; margin: 0;">\n${items}\n</ul>`;
  }

  /**
   * Renders a single list item with a bottom border separator.
   * @param {string} content Inner HTML for the item
   * @returns {string} HTML string
   */
  static listItem(content) {
    return `<li style="padding: 8px 0; border-bottom: 1px solid #eee;">${content}</li>`;
  }

  /**
   * Renders a "and X more..." note when a list was truncated.
   * @param {Contact[]|any[]} list The (possibly truncated) list
   * @returns {string} HTML string or empty
   */
  static truncatedNote(list) {
    if (!list._totalBeforeLimit) return '';
    const remaining = list._totalBeforeLimit - list.length;
    return `<p style="margin: 8px 0 0 0; color: #999; font-size: 13px; font-style: italic;">…and ${remaining} more</p>\n`;
  }

  /**
   * Renders the email footer with styled action buttons.
   * @param {string} scriptId Google Apps Script project ID (for edit link)
   * @param {Object[]} [extraButtons] Additional buttons [{label, url}] to show before GitHub
   * @returns {string} HTML string
   */
  static footer(scriptId, extraButtons = []) {
    const btnStyle = 'display: inline-block; padding: 10px 20px; background: #f1f3f4; color: #333; border-radius: 6px; text-decoration: none; font-size: 14px; font-weight: 500;';
    const spacer = '<span style="display: inline-block; width: 8px;"></span>';

    let buttons = `<a href="https://contacts.google.com" style="display: inline-block; padding: 10px 20px; background: #1a73e8; color: #ffffff; border-radius: 6px; text-decoration: none; font-size: 14px; font-weight: 500;">Manage Contacts</a>`;

    extraButtons.forEach(btn => {
      buttons += `${spacer}<a href="${btn.url}" style="${btnStyle}">${btn.label}</a>`;
    });

    if (scriptId) {
      buttons += `${spacer}<a href="https://script.google.com/home/projects/${scriptId}/edit" style="${btnStyle}">Script</a>`;
    }

    buttons += `${spacer}<a href="https://github.com/itsFelixH/google-contacts-scripts" style="${btnStyle}">GitHub</a>`;

    return `<div style="margin-top: 24px; text-align: center;">${buttons}</div>\n`;
  }

  /**
   * Wraps content in a complete HTML document with base styling.
   * @param {string} content The email body HTML
   * @returns {string} Complete HTML document
   */
  static wrapEmail(content) {
    return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; line-height: 1.6; color: #333; background: #ffffff;">
${content}
</body>
</html>`;
  }
}
