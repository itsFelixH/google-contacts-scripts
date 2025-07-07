/**
 * Email Manager class to handle all email-related functionality
 */
class EmailManager {
  constructor() {
    this.templates = EmailTemplates;
  }


  /**
   * Sends an email with the specified parameters
   * @param {string} toEmail - Recipient email address
   * @param {string} fromEmail - Sender email address
   * @param {string} senderName - Name of the sender
   * @param {string} subject - Email subject
   * @param {string} textBody - Plain text email body
   * @param {string} htmlBody - HTML email body
   */
  sendMail(toEmail, fromEmail, senderName, subject, textBody, htmlBody) {
    const boundary = "boundaryboundary";
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
    ].join("\r\n");

    const rawMessage = Utilities.base64EncodeWebSafe(mailData);
    Gmail.Users.Messages.send({ raw: rawMessage }, "me");
  }


  /**
   * Sends an email containing a list of contacts without labels
   * @param {Array<Contact>} unlabeledContacts - List of contacts without labels
   */
  sendUnlabeledContactsEmail(unlabeledContacts) {
    const subject = "🏷️ Contacts Without Labels 🏷️";
    const senderName = DriveApp.getFileById(ScriptApp.getScriptId()).getName();
    const toEmail = Session.getActiveUser().getEmail();
    const fromEmail = Session.getEffectiveUser().getEmail();

    // Create HTML content
    const content = `
      ${this.templates.header("Contacts Without Labels Report", "These contacts don't have any labels assigned")}
      ${this.templates.contactList(unlabeledContacts)}
      ${this.templates.footer()}
    `;

    const htmlBody = this.templates.wrapEmail(content);
    
    // Create plain text content
    const textBody = `Contacts Without Labels Report\n\n` +
      unlabeledContacts.map(contact => {
        const details = [];
        if (contact.email) details.push(`Email: ${contact.email}`);
        if (contact.phoneNumber) details.push(`Phone: ${contact.phoneNumber}`);
        if (contact.city) details.push(`City: ${contact.city}`);
        return `${contact.getName()}\n${details.join('\n')}`;
      }).join('\n\n');

    this.sendMail(toEmail, fromEmail, senderName, subject, textBody, htmlBody);
  }


  /**
   * Sends an email containing a list of contacts without birthdays
   * @param {Array<Contact>} contactsWithoutBirthday - List of contacts without birthdays
   */
  sendContactsWithoutBirthdayEmail(contactsWithoutBirthday) {
    const subject = "🎂 Contacts Without Birthday 🎂";
    const senderName = DriveApp.getFileById(ScriptApp.getScriptId()).getName();
    const toEmail = Session.getActiveUser().getEmail();
    const fromEmail = Session.getEffectiveUser().getEmail();

    // Create HTML content
    const content = `
      ${this.templates.header("Contacts Without Birthday Report", "These contacts don't have a birthday set")}
      ${this.templates.contactList(contactsWithoutBirthday)}
      ${this.templates.footer()}
    `;

    const htmlBody = this.templates.wrapEmail(content);
    
    // Create plain text content
    const textBody = `Contacts Without Birthday Report\n\n` +
      contactsWithoutBirthday.map(contact => {
        const details = [];
        if (contact.email) details.push(`Email: ${contact.email}`);
        if (contact.phoneNumber) details.push(`Phone: ${contact.phoneNumber}`);
        if (contact.city) details.push(`City: ${contact.city}`);
        return `${contact.getName()}\n${details.join('\n')}`;
      }).join('\n\n');

    this.sendMail(toEmail, fromEmail, senderName, subject, textBody, htmlBody);
  }


  /**
   * Sends an email containing a list of contacts with a specific label
   * @param {string} label - The label to filter contacts by
   * @param {Array<Contact>} labeledContacts - List of contacts with the specified label
   */
  sendContactsWithLabelEmail(label, labeledContacts) {
    const subject = `👥 Contacts With Label "${label}" 👥`;
    const senderName = DriveApp.getFileById(ScriptApp.getScriptId()).getName();
    const toEmail = Session.getActiveUser().getEmail();
    const fromEmail = Session.getEffectiveUser().getEmail();

    // Create HTML content
    const content = `
      ${this.templates.header(`Contacts With Label "${label}"`, `These contacts have the label "${label}" assigned`)}
      ${this.templates.contactList(labeledContacts)}
      ${this.templates.footer()}
    `;

    const htmlBody = this.templates.wrapEmail(content);
    
    // Create plain text content
    const textBody = `Contacts With Label "${label}" Report\n\n` +
      labeledContacts.map(contact => {
        const details = [];
        if (contact.email) details.push(`Email: ${contact.email}`);
        if (contact.phoneNumber) details.push(`Phone: ${contact.phoneNumber}`);
        if (contact.city) details.push(`City: ${contact.city}`);
        return `${contact.getName()}\n${details.join('\n')}`;
      }).join('\n\n');

    this.sendMail(toEmail, fromEmail, senderName, subject, textBody, htmlBody);
  }


  /**
   * Sends an email containing a list of contacts with upcoming birthdays
   * @param {Array<Contact>} upcomingBirthdays - List of contacts with upcoming birthdays
   * @param {number} days - Number of days ahead being reported
   */
  sendUpcomingBirthdaysEmail(upcomingBirthdays, days) {
    const subject = `🎂 Upcoming Birthdays (Next ${days} Days) 🎂`;
    const senderName = DriveApp.getFileById(ScriptApp.getScriptId()).getName();
    const toEmail = Session.getActiveUser().getEmail();
    const fromEmail = Session.getEffectiveUser().getEmail();

    // Create HTML content
    const content = `
      ${this.templates.header("Upcoming Birthdays Report", `Birthdays in the next ${days} days`)}
      ${this.templates.birthdayList(upcomingBirthdays)}
      ${this.templates.footer()}
    `;

    const htmlBody = this.templates.wrapEmail(content);
    
    // Create plain text content
    const textBody = `Upcoming Birthdays Report (Next ${days} Days)\n\n` +
      upcomingBirthdays.map(contact => {
        const details = [];
        details.push(`Birthday: ${contact.getBirthdayShortFormat()}`);
        if (contact.hasKnownBirthYear()) details.push(`Age: ${contact.calculateAge()}`);
        if (contact.email) details.push(`Email: ${contact.email}`);
        if (contact.phoneNumber) details.push(`Phone: ${contact.phoneNumber}`);
        return `${contact.getName()}\n${details.join('\n')}`;
      }).join('\n\n');

    this.sendMail(toEmail, fromEmail, senderName, subject, textBody, htmlBody);
  }


  /**
   * Sends an email containing contacts with potentially invalid phone numbers
   * @param {Array<Contact>} contactsWithInvalidPhones - List of contacts with suspicious phone numbers
   */
  sendInvalidPhonesEmail(contactsWithInvalidPhones) {
    const subject = `📱 Invalid Phone Numbers Report 📱`;
    const senderName = DriveApp.getFileById(ScriptApp.getScriptId()).getName();
    const toEmail = Session.getActiveUser().getEmail();
    const fromEmail = Session.getEffectiveUser().getEmail();

    // Create HTML content
    const content = `
      ${this.templates.header("Invalid Phone Numbers Report", "These contacts have potentially invalid or malformed phone numbers")}
      ${this.templates.contactList(contactsWithInvalidPhones)}
      ${this.templates.footer()}
    `;

    const htmlBody = this.templates.wrapEmail(content);
    
    // Create plain text content
    const textBody = `Invalid Phone Numbers Report\n\n` +
      contactsWithInvalidPhones.map(contact => {
        const details = [];
        if (contact.phoneNumber) details.push(`Phone: ${contact.phoneNumber}`);
        if (contact.email) details.push(`Email: ${contact.email}`);
        return `${contact.getName()}\n${details.join('\n')}`;
      }).join('\n\n');

    this.sendMail(toEmail, fromEmail, senderName, subject, textBody, htmlBody);
  }


  /**
   * Sends an email containing contact statistics
   * @param {Object} stats - Statistics object from ContactManager.generateContactStats()
   */
  sendContactStatsEmail(stats) {
    const subject = `📊 Contact Statistics Report 📊`;
    const senderName = DriveApp.getFileById(ScriptApp.getScriptId()).getName();
    const toEmail = Session.getActiveUser().getEmail();
    const fromEmail = Session.getEffectiveUser().getEmail();

    // Create HTML content
    const content = `
      ${this.templates.header("Contact Statistics Report", "Overview of your contacts database")}
      ${this.templates.statsReport(stats)}
      ${this.templates.footer()}
    `;

    const htmlBody = this.templates.wrapEmail(content);
    
    // Create plain text content
    const textBody = `Contact Statistics Report\n\n` +
      `Total Contacts: ${stats.totalContacts}\n` +
      `With Birthday: ${stats.withBirthday} (${stats.birthdayPercentage}%)\n` +
      `With Email: ${stats.withEmail} (${stats.emailPercentage}%)\n` +
      `With Phone: ${stats.withPhone} (${stats.phonePercentage}%)\n` +
      `With City: ${stats.withCity} (${stats.cityPercentage}%)\n` +
      `With Labels: ${stats.withLabels} (${stats.labelPercentage}%)\n` +
      `With Instagram: ${stats.withInstagram} (${stats.instagramPercentage}%)\n\n` +
      `Label Distribution:\n` +
      Object.entries(stats.labelDistribution)
        .map(([label, count]) => `${label}: ${count} contacts`)
        .join('\n');

    this.sendMail(toEmail, fromEmail, senderName, subject, textBody, htmlBody);
  }
}


/**
 * Email templates and styling for birthday notifications
 */
class EmailTemplates {
  /**
   * CSS styles for email templates
   */
  static get styles() {
    return `
      .email-container {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        max-width: 600px;
        margin: 0 auto;
        padding: 20px;
        background-color: #ffffff;
        border-radius: 8px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      }
      .header {
        text-align: center;
        margin-bottom: 30px;
      }
      .title {
        color: #1a1a1a;
        font-size: 24px;
        font-weight: bold;
        margin: 10px 0;
      }
      .subtitle {
        color: #666;
        font-size: 16px;
        margin: 10px 0;
      }
      .section {
        margin: 20px 0;
        padding: 15px;
        background: #f8f9fa;
        border-radius: 6px;
      }
      .section-title {
        color: #2c3e50;
        font-size: 18px;
        margin-bottom: 15px;
        border-bottom: 2px solid #e9ecef;
        padding-bottom: 5px;
      }
      .birthday-list {
        list-style: none;
        padding: 0;
        margin: 0;
      }
      .birthday-item {
        padding: 10px;
        margin: 5px 0;
        border-left: 4px solid #007bff;
        background: white;
        transition: all 0.2s;
      }
      .birthday-item:hover {
        transform: translateX(5px);
      }
      .contact-info {
        display: grid;
        grid-template-columns: auto 1fr;
        gap: 10px;
        align-items: center;
        margin-top: 5px;
        font-size: 14px;
        color: #666;
      }
      .action-buttons {
        margin-top: 15px;
        text-align: center;
      }
      .button {
        display: inline-block;
        padding: 8px 16px;
        margin: 0 5px;
        background-color: #007bff;
        color: white;
        text-decoration: none;
        border-radius: 4px;
        font-size: 14px;
        transition: background-color 0.2s;
      }
      .button:hover {
        background-color: #0056b3;
      }
      .stats {
        display: flex;
        justify-content: space-around;
        margin: 20px 0;
        text-align: center;
      }
      .stat-item {
        flex: 1;
        padding: 10px;
      }
      .stat-number {
        font-size: 24px;
        font-weight: bold;
        color: #007bff;
      }
      .stat-label {
        font-size: 14px;
        color: #666;
      }
      .footer {
        margin-top: 30px;
        padding-top: 20px;
        border-top: 1px solid #eaeaea;
        text-align: center;
        font-size: 12px;
        color: #666;
      }
      .footer a {
        color: #007bff;
        text-decoration: none;
      }
      .footer a:hover {
        text-decoration: underline;
      }
    `;
  }

  /**
   * Creates a header section for the email
   * @param {string} title - Main title
   * @param {string} subtitle - Optional subtitle
   * @returns {string} HTML for the header section
   */
  static header(title, subtitle = '') {
    return `
      <div class="header">
        <h1 class="title">${title}</h1>
        ${subtitle ? `<p class="subtitle">${subtitle}</p>` : ''}
      </div>
    `;
  }

  /**
   * Creates a footer section for the email
   * @returns {string} HTML for the footer section
   */
  static footer() {
    return `
      <div class="footer">
        <p>
          Sent by Google Contacs Scripts •
          <a href="https://contacts.google.com">Manage Contacts</a> •
          <a href="https://github.com/itsFelixH/google-contacts-scripts">GitHub Repo</a>
        </p>
      </div>
    `;
  }

  /**
   * Creates a contact list section for the email
   * @param {Array<Contact>} contacts - List of contacts to display
   * @returns {string} HTML for the contact list section
   */
  static contactList(contacts) {
    if (!contacts || contacts.length === 0) {
      return '<p>No contacts found.</p>';
    }

    const contactItems = contacts.map(contact => {
      const contactDetails = [];
      if (contact.email) contactDetails.push(`Email: ${contact.email}`);
      if (contact.phoneNumber) contactDetails.push(`Phone: ${contact.phoneNumber}`);
      if (contact.city) contactDetails.push(`City: ${contact.city}`);
      
      return `
        <div class="birthday-item">
          <strong>${contact.getName()}</strong>
          <div class="contact-info">
            ${contactDetails.join(' • ')}
          </div>
        </div>
      `;
    }).join('');

    return `
      <div class="section">
        <h2 class="section-title">Contacts Without Labels (${contacts.length})</h2>
        <div class="birthday-list">
          ${contactItems}
        </div>
      </div>
    `;
  }

  /**
   * Wraps email content in a standard template with styles
   * @param {string} content - Email content to wrap
   * @returns {string} Complete HTML email
   */
  static wrapEmail(content) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>${this.styles}</style>
      </head>
      <body>
        <div class="email-container">
          ${content}
        </div>
      </body>
      </html>
    `;
  }
}