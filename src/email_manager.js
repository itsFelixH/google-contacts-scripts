/**
 * Email Manager — handles all email-related functionality.
 */
class EmailManager {
  constructor() {
    this.templates = EmailTemplates;
    this.subjects = typeof emailSubjects !== 'undefined' ? emailSubjects : {};
  }


  /**
   * Gets common email context (sender, recipient).
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
   * Sends an email via Gmail API.
   * @param {string} toEmail Recipient email address
   * @param {string} fromEmail Sender email address
   * @param {string} senderName Name of the sender
   * @param {string} subject Email subject
   * @param {string} textBody Plain text email body
   * @param {string} htmlBody HTML email body
   */
  sendMail(toEmail, fromEmail, senderName, subject, textBody, htmlBody) {
    const boundary = `boundary_${Date.now()}_${Math.random().toString(36).slice(2)}`;
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


  /**
   * Sends the Upcoming Birthdays report.
   * @param {Contact[]} contacts
   * @param {number} days
   */
  sendUpcomingBirthdaysEmail(contacts, days) {
    const { toEmail, fromEmail, senderName } = this.getEmailContext();
    const subject = (this.subjects.upcomingBirthdays || '🎂 Upcoming Birthdays').replace('{days}', days);

    const lines = contacts.map(contact => {
      const age = contact.hasKnownBirthYear() ? ` (turns ${contact.calculateAge() + 1})` : '';
      const daysUntil = contact.daysToNextBirthday();
      const daysLabel = daysUntil === 0 ? '🎂 TODAY!' : daysUntil === 1 ? 'tomorrow' : `in ${daysUntil} days`;
      return { name: contact.getName(), age, daysLabel, contact };
    });

    const textBody = [`🎂 Upcoming Birthdays (next ${days} days)`, '',
      ...lines.map(l => `  • ${l.name}${l.age} — ${l.daysLabel}`)
    ].join('\n');

    const listHtml = lines.map(l => {
      const info = this._contactInfoHtml(l.contact);
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
   * @param {Object[]} duplicateGroups
   */
  sendDuplicateContactsEmail(duplicateGroups) {
    const { toEmail, fromEmail, senderName } = this.getEmailContext();
    const subject = this.subjects.duplicates || '🔍 Duplicate Contacts';

    const textBody = ['🔍 Duplicate Contacts', '',
      ...duplicateGroups.map((g, i) =>
        `  Group ${i + 1}: ${g.contacts.map(c => c.getName()).join(', ')} (${g.reason})`
      )
    ].join('\n');

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
   * Sends the Contact Overview report (general stats).
   * @param {Object} stats
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
   * Sends the Label Health report (label stats + unlabeled contacts).
   * @param {Object} labelStats from getLabelUsageStats()
   * @param {Contact[]} unlabeledContacts
   * @param {Object} labelDistribution { labelName: count }
   * @param {number} totalContacts
   */
  sendLabelHealthEmail(labelStats, unlabeledContacts, labelDistribution, totalContacts) {
    const { toEmail, fromEmail, senderName } = this.getEmailContext();
    const subject = this.subjects.labelHealth || '🏷️ Label Health';

    // Text version
    const textLines = [
      '🏷️ Label Health', '',
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

    // HTML version
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
      this.templates.header('🏷️ Label Health', 'Labels overview and unlabeled contacts') +
      summaryHtml +
      `<h3>📊 Label Distribution</h3>\n<ul>${distHtml}</ul>` +
      unlabeledHtml +
      this.templates.footer()
    );

    this.sendMail(toEmail, fromEmail, senderName, subject, textBody, htmlBody);
  }


  /**
   * Sends the Missing Info report (contacts missing a specific field).
   * @param {string} field 'email' | 'phone' | 'city' | 'birthday'
   * @param {Contact[]} contacts
   */
  sendMissingInfoEmail(field, contacts) {
    const { toEmail, fromEmail, senderName } = this.getEmailContext();
    const fieldNames = { email: 'Email', phone: 'Phone', city: 'City', birthday: 'Birthday' };
    const fieldEmojis = { email: '📧', phone: '📱', city: '🌆', birthday: '🎂' };
    const emoji = fieldEmojis[field] || '📋';
    const name = fieldNames[field] || field;
    const subject = (this.subjects.missingInfo || `${emoji} Missing Info: {field}`).replace('{field}', name);

    const textBody = [`${emoji} Contacts Missing ${name}`, '',
      ...contacts.map(c => `  • ${c.getName()}`)
    ].join('\n');

    const listHtml = contacts.map(c => {
      const editLink = (typeof includeEditLinks !== 'undefined' && includeEditLinks && c.getContactLink())
        ? ` — <a href="${c.getContactLink()}">edit</a>` : '';
      return `<li>${c.getName()}${editLink}</li>`;
    }).join('\n');

    const htmlBody = this.templates.wrapEmail(
      this.templates.header(`${emoji} Missing Info: ${name}`, `${contacts.length} contacts are missing ${name.toLowerCase()}`) +
      `<ul>${listHtml}</ul>` +
      this.templates.footer()
    );

    this.sendMail(toEmail, fromEmail, senderName, subject, textBody, htmlBody);
  }


  /**
   * Sends the Data Quality report (surnames + invalid phones combined).
   * @param {Contact[]} noSurname Contacts without surnames
   * @param {Contact[]} invalidPhones Contacts with invalid phone numbers
   */
  sendDataQualityEmail(noSurname, invalidPhones) {
    const { toEmail, fromEmail, senderName } = this.getEmailContext();
    const subject = this.subjects.dataQuality || '🔧 Data Quality';
    const total = noSurname.length + invalidPhones.length;

    // Text version
    const textLines = ['🔧 Data Quality', '', `${total} issues found`, ''];

    if (noSurname.length > 0) {
      textLines.push(`👤 Missing Surnames (${noSurname.length}):`);
      textLines.push(...noSurname.map(c => `  • ${c.getName()}`));
      textLines.push('');
    }
    if (invalidPhones.length > 0) {
      textLines.push(`📱 Invalid Phone Numbers (${invalidPhones.length}):`);
      textLines.push(...invalidPhones.map(c => `  • ${c.getName()} — ${c.phoneNumber}`));
    }

    const textBody = textLines.join('\n');

    // HTML version
    let sectionsHtml = '';

    if (noSurname.length > 0) {
      const items = noSurname.map(c => {
        const editLink = (typeof includeEditLinks !== 'undefined' && includeEditLinks && c.getContactLink())
          ? ` — <a href="${c.getContactLink()}">edit</a>` : '';
        return `<li>${c.getName()}${editLink}</li>`;
      }).join('\n');
      sectionsHtml += `<h3>👤 Missing Surnames (${noSurname.length})</h3>\n<ul>${items}</ul>`;
    }

    if (invalidPhones.length > 0) {
      const items = invalidPhones.map(c =>
        `<li><strong>${c.getName()}</strong> — 📱 ${c.phoneNumber}</li>`
      ).join('\n');
      sectionsHtml += `<h3>📱 Invalid Phone Numbers (${invalidPhones.length})</h3>\n<ul>${items}</ul>`;
    }

    const htmlBody = this.templates.wrapEmail(
      this.templates.header('🔧 Data Quality', `${total} issues found`) +
      sectionsHtml +
      this.templates.footer()
    );

    this.sendMail(toEmail, fromEmail, senderName, subject, textBody, htmlBody);
  }


  // ─── Private helpers ──────────────────────────────────────────────────────────

  /**
   * Builds contact info line (email, phone, city) as HTML.
   * @param {Contact} contact
   * @returns {string}
   * @private
   */
  _contactInfoHtml(contact) {
    const parts = [];
    if (contact.email) parts.push(`📧 <a href="mailto:${contact.email}">${contact.email}</a>`);
    if (contact.phoneNumber) {
      let phonePart = `📱 ${contact.phoneNumber}`;
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


/**
 * Email templates — simple HTML wrapper, no heavy styling.
 */
class EmailTemplates {
  /**
   * Creates a header/title section.
   * @param {string} heading
   * @param {string} [subtitle]
   * @returns {string}
   */
  static header(heading, subtitle = '') {
    return `<h2>${heading}</h2>${subtitle ? `<p>${subtitle}</p>` : ''}\n`;
  }

  /**
   * Creates a footer with links.
   * @returns {string}
   */
  static footer() {
    return `<hr><p><a href="https://contacts.google.com">Manage Contacts</a> · <a href="https://github.com/itsFelixH/google-contacts-scripts">GitHub</a></p>\n`;
  }

  /**
   * Wraps email content in a minimal HTML shell.
   * @param {string} content
   * @returns {string}
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
