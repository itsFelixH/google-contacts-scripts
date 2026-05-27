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
   * Sends an email report of contacts without labels.
   * @param {Contact[]} contacts
   */
  sendUnlabeledContactsEmail(contacts) {
    const { toEmail, fromEmail, senderName } = this.getEmailContext();
    const subject = this.subjects.unlabeled || '🏷️ Contacts Without Labels 🏷️';

    const content = `
      ${this.templates.header('Contacts Without Labels', `${contacts.length} contacts have no labels assigned`)}
      ${this._buildContactListHtml(contacts)}
      ${this.templates.footer()}
    `;

    const textBody = this._buildContactListText('Contacts Without Labels', contacts);
    this.sendMail(toEmail, fromEmail, senderName, subject, textBody, this.templates.wrapEmail(content));
  }


  /**
   * Sends an email report of contacts without birthdays.
   * @param {Contact[]} contacts
   */
  sendContactsWithoutBirthdayEmail(contacts) {
    const { toEmail, fromEmail, senderName } = this.getEmailContext();
    const subject = this.subjects.missingBirthday || '🎂 Contacts Without Birthday 🎂';

    const content = `
      ${this.templates.header('Contacts Without Birthday', `${contacts.length} contacts have no birthday set`)}
      ${this._buildSimpleListHtml(contacts)}
      ${this.templates.footer()}
    `;

    const textBody = this._buildSimpleListText('Contacts Without Birthday', contacts);
    this.sendMail(toEmail, fromEmail, senderName, subject, textBody, this.templates.wrapEmail(content));
  }


  /**
   * Sends an email report of contacts with a specific label.
   * @param {string} label
   * @param {Contact[]} contacts
   */
  sendContactsWithLabelEmail(label, contacts) {
    const { toEmail, fromEmail, senderName } = this.getEmailContext();
    const subject = `👥 Contacts With Label "${label}" 👥`;

    const content = `
      ${this.templates.header(`Contacts With Label "${label}"`, `${contacts.length} contacts found`)}
      ${this._buildContactListHtml(contacts)}
      ${this.templates.footer()}
    `;

    const textBody = this._buildContactListText(`Contacts With Label "${label}"`, contacts);
    this.sendMail(toEmail, fromEmail, senderName, subject, textBody, this.templates.wrapEmail(content));
  }


  /**
   * Sends an email report of contacts with upcoming birthdays.
   * @param {Contact[]} contacts
   * @param {number} days
   */
  sendUpcomingBirthdaysEmail(contacts, days) {
    const { toEmail, fromEmail, senderName } = this.getEmailContext();
    const subject = (this.subjects.upcomingBirthdays || '🎂 Upcoming Birthdays 🎂').replace('{days}', days);

    const listHtml = contacts.map(contact => {
      const age = contact.hasKnownBirthYear() ? ` (turns ${contact.calculateAge() + 1})` : '';
      const daysUntil = contact.daysToNextBirthday();
      const daysLabel = daysUntil === 0 ? '🎂 TODAY' : daysUntil === 1 ? 'tomorrow' : `in ${daysUntil} days`;

      return `
        <li style="padding: 10px; margin: 5px 0; border-left: 4px solid ${daysUntil === 0 ? '#ff6b6b' : '#007bff'}; background: #ffffff;">
          <strong>${contact.getName()}</strong>${age}
          <span style="color: #888; font-size: 12px; margin-left: 8px;">${daysLabel}</span>
          ${this._buildContactInfoHtml(contact)}
        </li>
      `;
    }).join('');

    const content = `
      ${this.templates.header(`Upcoming Birthdays`, `${contacts.length} birthdays in the next ${days} days`)}
      <div style="margin: 20px 0; padding: 15px; background: #f8f9fa; border-radius: 6px;">
        <ul style="list-style: none; padding: 0; margin: 0;">${listHtml}</ul>
      </div>
      ${this.templates.footer()}
    `;

    const textBody = [`Upcoming Birthdays (Next ${days} Days)`, '',
      ...contacts.map(contact => {
        const age = contact.hasKnownBirthYear() ? ` (turns ${contact.calculateAge() + 1})` : '';
        return `  • ${contact.getName()}${age} — ${contact.getBirthdayShortFormat()}`;
      })
    ].join('\n');

    this.sendMail(toEmail, fromEmail, senderName, subject, textBody, this.templates.wrapEmail(content));
  }


  /**
   * Sends an email report of contacts without surnames.
   * @param {Contact[]} contacts
   */
  sendContactsWithoutSurnamesEmail(contacts) {
    const { toEmail, fromEmail, senderName } = this.getEmailContext();
    const subject = this.subjects.missingSurnames || '👤 Contacts Without Surnames 👤';

    const content = `
      ${this.templates.header('Contacts Without Surnames', `${contacts.length} contacts only have a first name`)}
      ${this._buildSimpleListHtml(contacts)}
      ${this.templates.footer()}
    `;

    const textBody = this._buildSimpleListText('Contacts Without Surnames', contacts);
    this.sendMail(toEmail, fromEmail, senderName, subject, textBody, this.templates.wrapEmail(content));
  }


  /**
   * Sends an email report of contacts with invalid phone numbers.
   * @param {Contact[]} contacts
   */
  sendInvalidPhonesEmail(contacts) {
    const { toEmail, fromEmail, senderName } = this.getEmailContext();
    const subject = this.subjects.invalidPhones || '📱 Invalid Phone Numbers 📱';

    const listHtml = contacts.map(contact => `
      <li style="padding: 10px; margin: 5px 0; border-left: 4px solid #fa8231; background: #ffffff;">
        <strong>${contact.getName()}</strong>
        <div style="margin-top: 4px; font-size: 13px; color: #666;">📱 ${contact.phoneNumber}</div>
      </li>
    `).join('');

    const content = `
      ${this.templates.header('Invalid Phone Numbers', `${contacts.length} contacts have suspicious phone numbers`)}
      <div style="margin: 20px 0; padding: 15px; background: #f8f9fa; border-radius: 6px;">
        <ul style="list-style: none; padding: 0; margin: 0;">${listHtml}</ul>
      </div>
      ${this.templates.footer()}
    `;

    const textBody = [`Invalid Phone Numbers Report`, '',
      ...contacts.map(c => `  • ${c.getName()} — ${c.phoneNumber}`)
    ].join('\n');

    this.sendMail(toEmail, fromEmail, senderName, subject, textBody, this.templates.wrapEmail(content));
  }


  /**
   * Sends an email report of contacts missing a specific field.
   * @param {string} field
   * @param {Contact[]} contacts
   */
  sendMissingFieldEmail(field, contacts) {
    const { toEmail, fromEmail, senderName } = this.getEmailContext();
    const fieldNames = { email: 'Email Addresses', phone: 'Phone Numbers', city: 'City Information', birthday: 'Birthdays' };
    const subject = (this.subjects.missingField || '📋 Contacts Missing {field} 📋').replace('{field}', fieldNames[field]);

    const content = `
      ${this.templates.header(`Contacts Missing ${fieldNames[field]}`, `${contacts.length} contacts are missing ${field} information`)}
      ${this._buildSimpleListHtml(contacts)}
      ${this.templates.footer()}
    `;

    const textBody = this._buildSimpleListText(`Contacts Missing ${fieldNames[field]}`, contacts);
    this.sendMail(toEmail, fromEmail, senderName, subject, textBody, this.templates.wrapEmail(content));
  }


  /**
   * Sends label usage statistics email.
   * @param {Object} labelStats
   */
  sendLabelUsageStatsEmail(labelStats) {
    const { toEmail, fromEmail, senderName } = this.getEmailContext();
    const subject = this.subjects.labelUsage || '📊 Label Usage Statistics 📊';

    const statsHtml = `
      <div style="margin: 20px 0; padding: 15px; background: #f8f9fa; border-radius: 6px;">
        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
          <tr><td style="padding: 8px 0;">🏷️ Total Labels</td><td style="padding: 8px 0; text-align: right; font-weight: bold;">${labelStats.totalLabels}</td></tr>
          <tr><td style="padding: 8px 0;">👑 Most Used</td><td style="padding: 8px 0; text-align: right; font-weight: bold;">${labelStats.mostUsed?.label || 'N/A'} (${labelStats.mostUsed?.count || 0})</td></tr>
          <tr><td style="padding: 8px 0;">📉 Least Used</td><td style="padding: 8px 0; text-align: right; font-weight: bold;">${labelStats.leastUsed?.label || 'N/A'} (${labelStats.leastUsed?.count || 0})</td></tr>
          <tr><td style="padding: 8px 0;">❌ Unlabeled</td><td style="padding: 8px 0; text-align: right; font-weight: bold; color: #dc3545;">${labelStats.unlabeledCount}</td></tr>
        </table>
      </div>
    `;

    const content = `
      ${this.templates.header('Label Usage Statistics', 'Overview of how your contact labels are used')}
      ${statsHtml}
      ${this.templates.footer()}
    `;

    const textBody = [
      'Label Usage Statistics', '',
      `Total Labels: ${labelStats.totalLabels}`,
      `Most Used: ${labelStats.mostUsed?.label} (${labelStats.mostUsed?.count})`,
      `Least Used: ${labelStats.leastUsed?.label} (${labelStats.leastUsed?.count})`,
      `Unlabeled Contacts: ${labelStats.unlabeledCount}`
    ].join('\n');

    this.sendMail(toEmail, fromEmail, senderName, subject, textBody, this.templates.wrapEmail(content));
  }


  /**
   * Sends contacts grouped by city email.
   * @param {Object[]} cityGroups
   */
  sendContactsByCityEmail(cityGroups) {
    const { toEmail, fromEmail, senderName } = this.getEmailContext();
    const subject = this.subjects.contactsByCity || '🌆 Contacts by City 🌆';

    const listHtml = cityGroups.map(group => `
      <li style="padding: 10px; margin: 5px 0; border-left: 4px solid #20bf6b; background: #ffffff;">
        <strong>🌆 ${group.city}</strong>
        <span style="color: #888; font-size: 13px; margin-left: 8px;">👥 ${group.count} contacts</span>
      </li>
    `).join('');

    const content = `
      ${this.templates.header('Contacts by City', `Geographic distribution across ${cityGroups.length} cities`)}
      <div style="margin: 20px 0; padding: 15px; background: #f8f9fa; border-radius: 6px;">
        <ul style="list-style: none; padding: 0; margin: 0;">${listHtml}</ul>
      </div>
      ${this.templates.footer()}
    `;

    const textBody = ['Contacts by City', '',
      ...cityGroups.map(g => `  • ${g.city}: ${g.count} contacts`)
    ].join('\n');

    this.sendMail(toEmail, fromEmail, senderName, subject, textBody, this.templates.wrapEmail(content));
  }


  /**
   * Sends potential duplicates email.
   * @param {Object[]} duplicateGroups
   */
  sendDuplicatesEmail(duplicateGroups) {
    const { toEmail, fromEmail, senderName } = this.getEmailContext();
    const subject = this.subjects.duplicates || '🔍 Potential Duplicate Contacts 🔍';

    const listHtml = duplicateGroups.map((group, i) => `
      <li style="padding: 10px; margin: 5px 0; border-left: 4px solid #fa8231; background: #ffffff;">
        <strong>Group ${i + 1}</strong> (${group.count} contacts)
        <div style="margin-top: 4px; font-size: 13px; color: #666;">
          ${group.contacts.map(c => c.getName()).join(', ')}
          <br><small>Reason: ${group.reason}</small>
        </div>
      </li>
    `).join('');

    const content = `
      ${this.templates.header('Potential Duplicate Contacts', `${duplicateGroups.length} groups may need review`)}
      <div style="margin: 20px 0; padding: 15px; background: #f8f9fa; border-radius: 6px;">
        <ul style="list-style: none; padding: 0; margin: 0;">${listHtml}</ul>
      </div>
      ${this.templates.footer()}
    `;

    const textBody = ['Potential Duplicate Contacts', '',
      ...duplicateGroups.map((g, i) => `  Group ${i + 1}: ${g.contacts.map(c => c.getName()).join(', ')}`)
    ].join('\n');

    this.sendMail(toEmail, fromEmail, senderName, subject, textBody, this.templates.wrapEmail(content));
  }


  /**
   * Sends contact statistics email.
   * @param {Object} stats
   */
  sendContactStatsEmail(stats) {
    const { toEmail, fromEmail, senderName } = this.getEmailContext();
    const subject = this.subjects.statistics || '📊 Contact Statistics 📊';

    const statsHtml = `
      <div style="margin: 20px 0; padding: 15px; background: #f8f9fa; border-radius: 6px;">
        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
          <tr><td style="padding: 8px 0;">📇 Total Contacts</td><td style="padding: 8px 0; text-align: right; font-weight: bold;">${stats.totalContacts}</td></tr>
          <tr><td style="padding: 8px 0;">🎂 With Birthday</td><td style="padding: 8px 0; text-align: right;">${stats.withBirthday} (${stats.birthdayPercentage}%)</td></tr>
          <tr><td style="padding: 8px 0;">📧 With Email</td><td style="padding: 8px 0; text-align: right;">${stats.withEmail} (${stats.emailPercentage}%)</td></tr>
          <tr><td style="padding: 8px 0;">📱 With Phone</td><td style="padding: 8px 0; text-align: right;">${stats.withPhone} (${stats.phonePercentage}%)</td></tr>
          <tr><td style="padding: 8px 0;">🌆 With City</td><td style="padding: 8px 0; text-align: right;">${stats.withCity} (${stats.cityPercentage}%)</td></tr>
          <tr><td style="padding: 8px 0;">🏷️ With Labels</td><td style="padding: 8px 0; text-align: right;">${stats.withLabels} (${stats.labelPercentage}%)</td></tr>
          <tr><td style="padding: 8px 0;">📸 With Instagram</td><td style="padding: 8px 0; text-align: right;">${stats.withInstagram} (${stats.instagramPercentage}%)</td></tr>
        </table>
      </div>
    `;

    const content = `
      ${this.templates.header('Contact Statistics', `Overview of your ${stats.totalContacts} contacts`)}
      ${statsHtml}
      ${this.templates.footer()}
    `;

    const textBody = [
      'Contact Statistics Report', '',
      `📇 Total Contacts: ${stats.totalContacts}`,
      `🎂 With Birthday: ${stats.withBirthday} (${stats.birthdayPercentage}%)`,
      `📧 With Email: ${stats.withEmail} (${stats.emailPercentage}%)`,
      `📱 With Phone: ${stats.withPhone} (${stats.phonePercentage}%)`,
      `🌆 With City: ${stats.withCity} (${stats.cityPercentage}%)`,
      `🏷️ With Labels: ${stats.withLabels} (${stats.labelPercentage}%)`,
      `📸 With Instagram: ${stats.withInstagram} (${stats.instagramPercentage}%)`
    ].join('\n');

    this.sendMail(toEmail, fromEmail, senderName, subject, textBody, this.templates.wrapEmail(content));
  }


  /**
   * Sends label statistics email.
   * @param {Object} stats
   * @param {Object[]} allLabels
   */
  sendLabelStatsEmail(stats, allLabels) {
    const { toEmail, fromEmail, senderName } = this.getEmailContext();
    const subject = '🏷️ Label Statistics 🏷️';

    const labelRows = Object.entries(stats.labelDistribution)
      .sort((a, b) => b[1] - a[1])
      .map(([label, count]) => `
        <tr>
          <td style="padding: 6px 0;">${label}</td>
          <td style="padding: 6px 0; text-align: right;">${count} (${(count / stats.totalContacts * 100).toFixed(1)}%)</td>
        </tr>
      `).join('');

    const content = `
      ${this.templates.header('Label Statistics', `${allLabels.length} labels across ${stats.totalContacts} contacts`)}
      <div style="margin: 20px 0; padding: 15px; background: #f8f9fa; border-radius: 6px;">
        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
          ${labelRows}
        </table>
      </div>
      ${this.templates.footer()}
    `;

    const textBody = ['Label Statistics', '',
      ...Object.entries(stats.labelDistribution)
        .sort((a, b) => b[1] - a[1])
        .map(([label, count]) => `  🏷️ ${label}: ${count} contacts`)
    ].join('\n');

    this.sendMail(toEmail, fromEmail, senderName, subject, textBody, this.templates.wrapEmail(content));
  }


  // ─── Private helpers ──────────────────────────────────────────────────────────

  /**
   * Builds HTML for a detailed contact list.
   * @param {Contact[]} contacts
   * @returns {string}
   * @private
   */
  _buildContactListHtml(contacts) {
    const listHtml = contacts.map(contact => `
      <li style="padding: 10px; margin: 5px 0; border-left: 4px solid #007bff; background: #ffffff;">
        <strong>${contact.getName()}</strong>
        ${this._buildContactInfoHtml(contact)}
      </li>
    `).join('');

    return `
      <div style="margin: 20px 0; padding: 15px; background: #f8f9fa; border-radius: 6px;">
        <ul style="list-style: none; padding: 0; margin: 0;">${listHtml}</ul>
      </div>
    `;
  }

  /**
   * Builds HTML for a simple name-only contact list.
   * @param {Contact[]} contacts
   * @returns {string}
   * @private
   */
  _buildSimpleListHtml(contacts) {
    const listHtml = contacts.map(contact => {
      const editLink = (typeof includeEditLinks !== 'undefined' && includeEditLinks && contact.getContactLink())
        ? ` <a href="${contact.getContactLink()}" style="color: #007bff; text-decoration: none; font-size: 12px;">Edit</a>`
        : '';
      return `
        <li style="padding: 8px 10px; margin: 3px 0; border-left: 3px solid #007bff; background: #ffffff;">
          ${contact.getName()}${editLink}
        </li>
      `;
    }).join('');

    return `
      <div style="margin: 20px 0; padding: 15px; background: #f8f9fa; border-radius: 6px;">
        <ul style="list-style: none; padding: 0; margin: 0;">${listHtml}</ul>
      </div>
    `;
  }

  /**
   * Builds contact info line (email, phone, city) as HTML.
   * @param {Contact} contact
   * @returns {string}
   * @private
   */
  _buildContactInfoHtml(contact) {
    const parts = [];
    if (contact.email) parts.push(`📧 <a href="mailto:${contact.email}" style="color: #007bff; text-decoration: none;">${contact.email}</a>`);
    if (contact.phoneNumber) {
      let phonePart = `📱 ${contact.phoneNumber}`;
      if (typeof includeWhatsAppLinks !== 'undefined' && includeWhatsAppLinks) {
        const waLink = contact.getWhatsAppLink();
        if (waLink) phonePart += ` <a href="${waLink}" style="color: #25D366; text-decoration: none; font-size: 12px;">WhatsApp</a>`;
      }
      parts.push(phonePart);
    }
    if (contact.city) parts.push(`🌆 ${contact.city}`);
    if (contact.getLabels().length > 0) parts.push(`🏷️ ${contact.getLabels().join(', ')}`);

    if (parts.length === 0) return '';
    return `<div style="margin-top: 6px; font-size: 13px; color: #666;">${parts.join(' &nbsp;·&nbsp; ')}</div>`;
  }

  /**
   * Builds plain text for a detailed contact list.
   * @param {string} title
   * @param {Contact[]} contacts
   * @returns {string}
   * @private
   */
  _buildContactListText(title, contacts) {
    return [title, '',
      ...contacts.map(contact => {
        const details = [];
        if (contact.email) details.push(`Email: ${contact.email}`);
        if (contact.phoneNumber) details.push(`Phone: ${contact.phoneNumber}`);
        if (contact.city) details.push(`City: ${contact.city}`);
        return `  • ${contact.getName()}${details.length ? '\n    ' + details.join(' | ') : ''}`;
      })
    ].join('\n');
  }

  /**
   * Builds plain text for a simple name-only list.
   * @param {string} title
   * @param {Contact[]} contacts
   * @returns {string}
   * @private
   */
  _buildSimpleListText(title, contacts) {
    return [title, '',
      ...contacts.map(c => `  • ${c.getName()}`)
    ].join('\n');
  }
}


/**
 * Email templates — minimal inline-styled HTML for maximum email client compatibility.
 */
class EmailTemplates {
  /**
   * Inline style for button links.
   */
  static get buttonStyle() {
    return 'display: inline-block; padding: 8px 16px; margin: 4px; background-color: #007bff; color: #ffffff; text-decoration: none; border-radius: 4px; font-size: 14px;';
  }

  /**
   * Creates a header section.
   * @param {string} title
   * @param {string} [subtitle]
   * @returns {string}
   */
  static header(title, subtitle = '') {
    return `
      <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #1a1a1a; font-size: 24px; font-weight: bold; margin: 10px 0;">${title}</h1>
        ${subtitle ? `<p style="color: #666666; font-size: 16px; margin: 10px 0;">${subtitle}</p>` : ''}
      </div>
    `;
  }

  /**
   * Creates a footer section with action buttons.
   * @returns {string}
   */
  static footer() {
    return `
      <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eaeaea; text-align: center;">
        <a href="https://contacts.google.com" style="${this.buttonStyle}">Manage Contacts</a>
        <a href="https://github.com/itsFelixH/google-contacts-scripts" style="${this.buttonStyle}">GitHub</a>
      </div>
    `;
  }

  /**
   * Wraps email content in a standard HTML template.
   * @param {string} content
   * @returns {string}
   */
  static wrapEmail(content) {
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f4;">
  <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #ffffff;">
    ${content}
  </div>
</body>
</html>`;
  }
}
