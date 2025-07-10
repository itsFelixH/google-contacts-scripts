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

    const htmlBody = this.templates.wrapEmail(content, 'contacts');
    
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

    // Create HTML content with simplified template
    const content = `
      ${this.templates.header("Contacts Without Birthday Report", "These contacts don't have a birthday set")}
      ${this.templates.contactList(contactsWithoutBirthday, true)}
      ${this.templates.footer()}
    `;

    const htmlBody = this.templates.wrapEmail(content, 'warning');
    
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

    const htmlBody = this.templates.wrapEmail(content, 'labels');
    
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

    const htmlBody = this.templates.wrapEmail(content, 'birthday');
    
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
   * Sends an email containing contacts missing a specific field
   * @param {string} field - Field name (email, phone, city, birthday)
   * @param {Contact[]} contacts - Contacts missing the field
   */
  sendMissingFieldEmail(field, contacts) {
    const fieldNames = {
      email: 'Email Addresses',
      phone: 'Phone Numbers', 
      city: 'City Information',
      birthday: 'Birthdays'
    };
    
    const subject = `📋 Contacts Missing ${fieldNames[field]} 📋`;
    const senderName = DriveApp.getFileById(ScriptApp.getScriptId()).getName();
    const toEmail = Session.getActiveUser().getEmail();
    const fromEmail = Session.getEffectiveUser().getEmail();

    const content = `
      ${this.templates.header(`Contacts Missing ${fieldNames[field]}`, `These contacts are missing ${field} information`)}
      ${this.templates.contactList(contacts, true)}
      ${this.templates.footer()}
    `;

    const htmlBody = this.templates.wrapEmail(content, 'warning');
    const textBody = `Contacts Missing ${fieldNames[field]} Report\n\n` +
      contacts.map(contact => contact.getName()).join('\n');

    this.sendMail(toEmail, fromEmail, senderName, subject, textBody, htmlBody);
  }

  /**
   * Sends label usage statistics email
   * @param {Object} labelStats - Label usage statistics
   */
  sendLabelUsageStatsEmail(labelStats) {
    const subject = "📊 Label Usage Statistics 📊";
    const senderName = DriveApp.getFileById(ScriptApp.getScriptId()).getName();
    const toEmail = Session.getActiveUser().getEmail();
    const fromEmail = Session.getEffectiveUser().getEmail();

    const content = `
      ${this.templates.header("Label Usage Statistics", "Overview of how your contact labels are being used")}
      <div class="section">
        <h2 class="section-title">📈 Usage Overview</h2>
        <div class="stats">
          <div class="stat-item">
            <div class="stat-icon">🏷️</div>
            <div class="stat-number">${labelStats.totalLabels}</div>
            <div class="stat-label">Total Labels</div>
          </div>
          <div class="stat-item">
            <div class="stat-icon">👑</div>
            <div class="stat-number">${labelStats.mostUsed?.count || 0}</div>
            <div class="stat-label">Most Used: ${labelStats.mostUsed?.label || 'N/A'}</div>
          </div>
          <div class="stat-item">
            <div class="stat-icon">📉</div>
            <div class="stat-number">${labelStats.leastUsed?.count || 0}</div>
            <div class="stat-label">Least Used: ${labelStats.leastUsed?.label || 'N/A'}</div>
          </div>
          <div class="stat-item">
            <div class="stat-icon">❌</div>
            <div class="stat-number">${labelStats.unlabeledCount}</div>
            <div class="stat-label">Unlabeled Contacts</div>
          </div>
        </div>
      </div>
      ${this.templates.footer()}
    `;

    const htmlBody = this.templates.wrapEmail(content, 'stats');
    const textBody = `Label Usage Statistics\n\n` +
      `Total Labels: ${labelStats.totalLabels}\n` +
      `Most Used: ${labelStats.mostUsed?.label} (${labelStats.mostUsed?.count})\n` +
      `Least Used: ${labelStats.leastUsed?.label} (${labelStats.leastUsed?.count})\n` +
      `Unlabeled Contacts: ${labelStats.unlabeledCount}`;

    this.sendMail(toEmail, fromEmail, senderName, subject, textBody, htmlBody);
  }

  /**
   * Sends contacts grouped by city email
   * @param {Object[]} cityGroups - Contacts grouped by city
   */
  sendContactsByCityEmail(cityGroups) {
    const subject = "🌆 Contacts by City 🌆";
    const senderName = DriveApp.getFileById(ScriptApp.getScriptId()).getName();
    const toEmail = Session.getActiveUser().getEmail();
    const fromEmail = Session.getEffectiveUser().getEmail();

    const cityList = cityGroups.map(group => `
      <div class="birthday-item">
        <strong>🌆 ${group.city}</strong>
        <div class="contact-info">
          👥 ${group.count} contacts
        </div>
      </div>
    `).join('');

    const content = `
      ${this.templates.header("Contacts by City", "Geographic distribution of your contacts")}
      <div class="section">
        <h2 class="section-title">🗺️ City Distribution (${cityGroups.length})</h2>
        <div class="birthday-list">
          ${cityList}
        </div>
      </div>
      ${this.templates.footer()}
    `;

    const htmlBody = this.templates.wrapEmail(content, 'contacts');
    const textBody = `Contacts by City Report\n\n` +
      cityGroups.map(group => `${group.city}: ${group.count} contacts`).join('\n');

    this.sendMail(toEmail, fromEmail, senderName, subject, textBody, htmlBody);
  }

  /**
   * Sends potential duplicates email
   * @param {Object[]} duplicateGroups - Groups of potential duplicate contacts
   */
  sendDuplicatesEmail(duplicateGroups) {
    const subject = "🔍 Potential Duplicate Contacts 🔍";
    const senderName = DriveApp.getFileById(ScriptApp.getScriptId()).getName();
    const toEmail = Session.getActiveUser().getEmail();
    const fromEmail = Session.getEffectiveUser().getEmail();

    const duplicateList = duplicateGroups.map((group, index) => `
      <div class="birthday-item">
        <strong>📋 Group ${index + 1} (${group.count} contacts)</strong>
        <div class="contact-info">
          ${group.contacts.map(contact => `<span class="tag">${contact.getName()}</span>`).join('')}
          <br><small>Reason: ${group.reason}</small>
        </div>
      </div>
    `).join('');

    const content = `
      ${this.templates.header("Potential Duplicate Contacts", "These contacts may be duplicates that need review")}
      <div class="section">
        <h2 class="section-title">🔍 Duplicate Groups (${duplicateGroups.length})</h2>
        <div class="birthday-list">
          ${duplicateList}
        </div>
      </div>
      ${this.templates.footer()}
    `;

    const htmlBody = this.templates.wrapEmail(content, 'warning');
    const textBody = `Potential Duplicate Contacts Report\n\n` +
      duplicateGroups.map((group, i) => 
        `Group ${i + 1}: ${group.contacts.map(c => c.getName()).join(', ')}`
      ).join('\n');

    this.sendMail(toEmail, fromEmail, senderName, subject, textBody, htmlBody);
  }

  /**
   * Sends an email containing a list of contacts without surnames
   * @param {Contact[]} contactsWithoutSurnames - List of contacts without surnames
   */
  sendContactsWithoutSurnamesEmail(contactsWithoutSurnames) {
    const subject = "👤 Contacts Without Surnames 👤";
    const senderName = DriveApp.getFileById(ScriptApp.getScriptId()).getName();
    const toEmail = Session.getActiveUser().getEmail();
    const fromEmail = Session.getEffectiveUser().getEmail();

    const content = `
      ${this.templates.header("Contacts Without Surnames Report", "These contacts only have a first name")}
      ${this.templates.contactList(contactsWithoutSurnames, true)}
      ${this.templates.footer()}
    `;

    const htmlBody = this.templates.wrapEmail(content, 'warning');
    
    const textBody = `Contacts Without Surnames Report\n\n` +
      contactsWithoutSurnames.map(contact => {
        const details = [];
        if (contact.email) details.push(`Email: ${contact.email}`);
        if (contact.phoneNumber) details.push(`Phone: ${contact.phoneNumber}`);
        if (contact.city) details.push(`City: ${contact.city}`);
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

    const htmlBody = this.templates.wrapEmail(content, 'warning');
    
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
      ${this.templates.header("Contact Statistics Report 📊", "Overview of your contacts database")}
      ${this.templates.statsReport(stats)}
      ${this.templates.footer()}
    `;

    const htmlBody = this.templates.wrapEmail(content, 'stats');
    
    // Create plain text content
    const textBody = `Contact Statistics Report\n\n` +
      `📇 Total Contacts: ${stats.totalContacts}\n` +
      `🎂 With Birthday: ${stats.withBirthday} (${stats.birthdayPercentage}%)\n` +
      `📧 With Email: ${stats.withEmail} (${stats.emailPercentage}%)\n` +
      `📱 With Phone: ${stats.withPhone} (${stats.phonePercentage}%)\n` +
      `🌆 With City: ${stats.withCity} (${stats.cityPercentage}%)\n` +
      `🏷️ With Labels: ${stats.withLabels} (${stats.labelPercentage}%)\n` +
      `📸 With Instagram: ${stats.withInstagram} (${stats.instagramPercentage}%)\n\n` +
      `Label Distribution:\n` +
      Object.entries(stats.labelDistribution)
        .map(([label, count]) => `🏷️ ${label}: ${count} contacts`)
        .join('\n');

    this.sendMail(toEmail, fromEmail, senderName, subject, textBody, htmlBody);
  }

  /**
   * Sends an email containing label statistics and distribution
   * @param {Object} stats - Statistics object from ContactManager.generateContactStats()
   * @param {Array<Object>} allLabels - Array of all labels with their IDs
   */
  sendLabelStatsEmail(stats, allLabels) {
    const subject = `🏷️ Label Statistics Report 🏷️`;
    const senderName = DriveApp.getFileById(ScriptApp.getScriptId()).getName();
    const toEmail = Session.getActiveUser().getEmail();
    const fromEmail = Session.getEffectiveUser().getEmail();

    // Create HTML content
    const content = `
      ${this.templates.header("Label Statistics Report 🏷️", "Overview of your contact labels and their usage")}
      ${this.templates.labelStatsReport(stats, allLabels)}
      ${this.templates.footer()}
    `;

    const htmlBody = this.templates.wrapEmail(content, 'labels');
    
    // Create plain text content
    const textBody = `Label Statistics Report\n\n` +
      `📇 Total Contacts: ${stats.totalContacts}\n` +
      `🏷️ Total Labels: ${allLabels.length}\n` +
      `👥 Contacts with Labels: ${stats.withLabels} (${stats.labelPercentage}%)\n\n` +
      `Label Distribution:\n` +
      Object.entries(stats.labelDistribution)
        .sort((a, b) => b[1] - a[1])
        .map(([label, count]) => 
          `🏷️ ${label}: ${count} contacts (${(count/stats.totalContacts*100).toFixed(1)}%)`
        ).join('\n');

    this.sendMail(toEmail, fromEmail, senderName, subject, textBody, htmlBody);
  }
}


/**
 * Email templates and styling for birthday notifications
 */
class EmailTemplates {
  /**
   * Get the theme configuration for a specific content type
   * @param {string} contentType - Type of content ('birthday', 'stats', 'contacts', 'labels', 'warning')
   * @returns {Object} Theme configuration object
   */
  static getTheme(contentType = 'default') {
    const themes = {
      birthday: {
        headerGradient: 'linear-gradient(135deg, #FF6B6B, #FF8E8E)',
        accentColor: '#FF6B6B',
        iconColor: '#FF4949',
        borderColor: '#FFE0E0'
      },
      stats: {
        headerGradient: 'linear-gradient(135deg, #4834D4, #686DE0)',
        accentColor: '#4834D4',
        iconColor: '#686DE0',
        borderColor: '#E4E2FF'
      },
      contacts: {
        headerGradient: 'linear-gradient(135deg, #6B8CFF, #4466FF)',
        accentColor: '#4466FF',
        iconColor: '#6B8CFF',
        borderColor: '#E5EAFF'
      },
      labels: {
        headerGradient: 'linear-gradient(135deg, #20BF6B, #26DE81)',
        accentColor: '#20BF6B',
        iconColor: '#26DE81',
        borderColor: '#E0FFE9'
      },
      warning: {
        headerGradient: 'linear-gradient(135deg, #FA8231, #FD9644)',
        accentColor: '#FA8231',
        iconColor: '#FD9644',
        borderColor: '#FFE5D3'
      },
      default: {
        headerGradient: 'linear-gradient(135deg, #6B8CFF, #4466FF)',
        accentColor: '#4466FF',
        iconColor: '#6B8CFF',
        borderColor: '#E5EAFF'
      }
    };
    
    return themes[contentType] || themes.default;
  }

  /**
   * CSS styles for email templates
   * @param {string} contentType - Type of content for styling
   * @returns {string} CSS styles
   */
  static getStyles(contentType = 'default') {
    const theme = this.getTheme(contentType);
    
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
        padding: 20px;
        background: ${theme.headerGradient};
        border-radius: 8px;
        color: white;
      }
      .title {
        color: #ffffff;
        font-size: 28px;
        font-weight: bold;
        margin: 10px 0;
        text-shadow: 1px 1px 2px rgba(0,0,0,0.1);
      }
      .subtitle {
        color: rgba(255,255,255,0.9);
        font-size: 16px;
        margin: 10px 0;
      }
      .section {
        margin: 20px 0;
        padding: 20px;
        background: #f8f9fa;
        border-radius: 8px;
        box-shadow: 0 1px 3px rgba(0,0,0,0.05);
      }
      .section-title {
        color: #2c3e50;
        font-size: 20px;
        margin-bottom: 20px;
        padding-bottom: 10px;
        border-bottom: 2px solid ${theme.borderColor};
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .birthday-list {
        list-style: none;
        padding: 0;
        margin: 0;
      }
      .birthday-item {
        padding: 15px;
        margin: 8px 0;
        border-radius: 6px;
        background: white;
        box-shadow: 0 1px 3px rgba(0,0,0,0.05);
        transition: all 0.2s;
        border-left: 4px solid ${theme.accentColor};
      }
      .birthday-item:hover {
        transform: translateX(5px);
        box-shadow: 0 2px 5px rgba(0,0,0,0.1);
      }
      .contact-info {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        align-items: center;
        margin-top: 8px;
        font-size: 14px;
        color: #666;
      }
      .contact-detail {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 4px 8px;
        background: #f8f9fa;
        border-radius: 4px;
      }
      
      /* Simplified template styles */
      .birthday-item.simple {
        padding: 10px;
        margin: 4px 0;
        background: white;
        border-radius: 4px;
        border-left: 2px solid ${theme.accentColor};
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
      }
      
      .simple-details {
        color: #666;
        font-size: 14px;
        flex: 1;
      }
      
      .link-button {
        color: ${theme.accentColor};
        text-decoration: none;
        font-size: 14px;
      }
      
      .link-button:hover {
        text-decoration: underline;
      }
      
      /* WhatsApp button specific styles */
      .button.whatsapp {
        background-color: #25D366;
        margin-left: 8px;
      }
      
      .button.whatsapp:hover {
        background-color: #128C7E;
      }
      .action-buttons {
        margin-top: 10px;
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }
      .button {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 8px 16px;
        background-color: ${theme.accentColor};
        color: white;
        text-decoration: none;
        border-radius: 6px;
        font-size: 14px;
        transition: all 0.2s;
        border: none;
        cursor: pointer;
      }
      .button:hover {
        background-color: ${theme.iconColor};
        transform: translateY(-1px);
      }
      .button.small {
        padding: 4px 8px;
        font-size: 12px;
      }
      .stats {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
        gap: 15px;
        margin: 20px 0;
      }
      .stat-item {
        text-align: center;
        padding: 15px;
        background: white;
        border-radius: 8px;
        box-shadow: 0 1px 3px rgba(0,0,0,0.05);
      }
      .stat-icon {
        font-size: 24px;
        margin-bottom: 8px;
        color: ${theme.iconColor};
      }
      .stat-number {
        font-size: 20px;
        font-weight: bold;
        color: ${theme.accentColor};
        margin: 5px 0;
      }
      .stat-label {
        font-size: 14px;
        color: #666;
      }
      .progress-bar {
        flex: 1;
        height: 24px;
        background: #f1f3f5;
        border-radius: 12px;
        overflow: hidden;
        position: relative;
      }
      .progress {
        height: 100%;
        background: ${theme.headerGradient};
        transition: width 0.3s ease;
      }
      .progress-text {
        position: absolute;
        left: 10px;
        top: 50%;
        transform: translateY(-50%);
        color: #2c3e50;
        font-size: 12px;
        font-weight: 500;
      }
      .footer {
        margin-top: 30px;
        padding: 20px;
        border-top: 1px solid #eaeaea;
        text-align: center;
        font-size: 12px;
        color: #666;
        background: #f8f9fa;
        border-radius: 8px;
      }
      .footer a {
        color: ${theme.accentColor};
        text-decoration: none;
      }
      .footer a:hover {
        text-decoration: underline;
      }
      .tag {
        display: inline-block;
        padding: 2px 6px;
        background: ${theme.borderColor};
        border-radius: 4px;
        font-size: 12px;
        color: ${theme.accentColor};
        margin: 2px;
      }
      .contact-link {
        color: ${theme.accentColor};
        text-decoration: none;
        font-weight: 500;
      }
      .contact-link:hover {
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
  static contactList(contacts, simplified = false) {
    if (!contacts || contacts.length === 0) {
      return '<p>No contacts found.</p>';
    }

    const contactItems = contacts.map(contact => {
      if (simplified) {
        // Simplified version for long lists (e.g. Contacts Without Birthday report)
        const details = [];
        if (contact.email) details.push(contact.email);
        if (contact.phoneNumber) details.push(contact.phoneNumber);
        
        return `
          <div class="birthday-item simple">
            <strong>${contact.getName()}</strong>
            ${details.length > 0 ? `<div class="simple-details">${details.join(' • ')}</div>` : ''}
            <a href="https://contacts.google.com/search/${encodeURIComponent(contact.getName())}" class="link-button" target="_blank">Edit</a>
          </div>
        `;
      }

      // Full detailed version for other reports
      const details = [];
      
      // Add contact details with icons
      if (contact.email) details.push(`
        <span class="contact-detail">
          📧 <a href="mailto:${contact.email}" class="contact-link">${contact.email}</a>
        </span>
      `);
      
      if (contact.phoneNumber) details.push(`
        <span class="contact-detail">
          📱 ${contact.phoneNumber}
          ${contact.getWhatsAppLink() ? `<a href="${contact.getWhatsAppLink()}" class="button small whatsapp" target="_blank">WhatsApp</a>` : ''}
        </span>
      `);
      
      if (contact.city) details.push(`
        <span class="contact-detail">
          🌆 ${contact.city}
        </span>
      `);

      // Add labels with tags
      if (contact.getLabels() && contact.getLabels().length > 0) {
        details.push(`
          <span class="contact-detail">
            🏷️ ${contact.getLabels().map(label => `
              <span class="tag">${label}</span>
            `).join('')}
          </span>
        `);
      }

      // Add Instagram links if available
      if (contact.instagramNames && contact.instagramNames.length > 0) {
        details.push(`
          <span class="contact-detail">
            📸 ${contact.instagramNames.map(username => `
              <a href="${contact.getInstagramLink(username)}" class="button small" target="_blank">${username}</a>
            `).join(' ')}
          </span>
        `);
      }
      
      return `
        <div class="birthday-item">
          <strong>👤 ${contact.getName()}</strong>
          <div class="contact-info">
            ${details.join('')}
          </div>
          <div class="action-buttons">
            <a href="https://contacts.google.com/search/${encodeURIComponent(contact.getName())}" class="button small" target="_blank">
              👀 View Contact
            </a>
          </div>
        </div>
      `;
    }).join('');

    return `
      <div class="section">
        <h2 class="section-title">👥 Contacts (${contacts.length})</h2>
        <div class="birthday-list">
          ${contactItems}
        </div>
      </div>
    `;
  }

  /**
   * Creates a birthday list section for the email
   * @param {Array<Contact>} contacts - List of contacts with upcoming birthdays
   * @returns {string} HTML for the birthday list section
   */
  static birthdayList(contacts) {
    if (!contacts || contacts.length === 0) {
      return '<p>No upcoming birthdays found.</p>';
    }

    const birthdayItems = contacts.map(contact => {
      const details = [];
      details.push(`
        <span class="contact-detail">
          🎂 ${contact.getBirthdayShortFormat()}
          ${contact.hasKnownBirthYear() ? ` (${contact.calculateAge()} years)` : ''}
        </span>
      `);
      
      if (contact.email) details.push(`
        <span class="contact-detail">
          📧 <a href="mailto:${contact.email}" class="contact-link">${contact.email}</a>
        </span>
      `);
      
      if (contact.phoneNumber) details.push(`
        <span class="contact-detail">
          📱 ${contact.phoneNumber}
          ${contact.getWhatsAppLink() ? `<a href="${contact.getWhatsAppLink()}" class="button small" target="_blank">WhatsApp</a>` : ''}
        </span>
      `);

      if (contact.city) details.push(`
        <span class="contact-detail">
          🌆 ${contact.city}
        </span>
      `);

      // Add labels with tags
      if (contact.getLabels() && contact.getLabels().length > 0) {
        details.push(`
          <span class="contact-detail">
            🏷️ ${contact.getLabels().map(label => `
              <span class="tag">${label}</span>
            `).join('')}
          </span>
        `);
      }

      return `
        <div class="birthday-item">
          <strong>👤 ${contact.getName()}</strong>
          <div class="contact-info">
            ${details.join('')}
          </div>
          <div class="action-buttons">
            <a href="https://contacts.google.com/search/${encodeURIComponent(contact.getName())}" class="button small" target="_blank">
              👀 View Contact
            </a>
          </div>
        </div>
      `;
    }).join('');

    return `
      <div class="section">
        <h2 class="section-title">🎂 Upcoming Birthdays (${contacts.length})</h2>
        <div class="birthday-list">
          ${birthdayItems}
        </div>
      </div>
    `;
  }

  /**
   * Creates a statistics report section for the email
   * @param {Object} stats - Statistics object from ContactManager.generateContactStats()
   * @returns {string} HTML for the statistics section
   */
  static statsReport(stats) {
    const mainStats = [
      { label: 'Total Contacts', value: stats.totalContacts, icon: '📇' },
      { label: 'With Birthday', value: `${stats.withBirthday} (${stats.birthdayPercentage}%)`, icon: '🎂' },
      { label: 'With Email', value: `${stats.withEmail} (${stats.emailPercentage}%)`, icon: '📧' },
      { label: 'With Phone', value: `${stats.withPhone} (${stats.phonePercentage}%)`, icon: '📱' },
      { label: 'With City', value: `${stats.withCity} (${stats.cityPercentage}%)`, icon: '🌆' },
      { label: 'With Labels', value: `${stats.withLabels} (${stats.labelPercentage}%)`, icon: '🏷️' },
      { label: 'With Instagram', value: `${stats.withInstagram} (${stats.instagramPercentage}%)`, icon: '📸' }
    ];

    const mainStatsHtml = mainStats.map(stat => `
      <div class="stat-item">
        <div class="stat-icon">${stat.icon}</div>
        <div class="stat-number">${stat.value}</div>
        <div class="stat-label">${stat.label}</div>
      </div>
    `).join('');

    const labelDistributionHtml = Object.entries(stats.labelDistribution)
      .sort((a, b) => b[1] - a[1])
      .map(([label, count]) => `
        <div class="birthday-item">
          <strong>🏷️ ${label}</strong>
          <div class="contact-info">
            👥 ${count} contacts (${(count/stats.totalContacts*100).toFixed(1)}%)
            <a href="#" class="button small" onclick="google.script.run.sendContactsWithLabelReport('${label}')">View Contacts</a>
          </div>
        </div>
      `).join('');

    return `
      <div class="section">
        <h2 class="section-title">📊 General Statistics</h2>
        <div class="stats">
          ${mainStatsHtml}
        </div>
      </div>
      <div class="section">
        <h2 class="section-title">🏷️ Label Distribution</h2>
        <div class="birthday-list">
          ${labelDistributionHtml}
        </div>
      </div>
    `;
  }

  /**
   * Creates a label statistics report section for the email
   * @param {Object} stats - Statistics object from ContactManager.generateContactStats()
   * @param {Array<Object>} allLabels - Array of all labels with their IDs
   * @returns {string} HTML for the label statistics section
   */
  static labelStatsReport(stats, allLabels) {
    const overviewStats = [
      { label: 'Total Contacts', value: stats.totalContacts, icon: '📇' },
      { label: 'Total Labels', value: allLabels.length, icon: '🏷️' },
      { label: 'Labeled Contacts', value: `${stats.withLabels} (${stats.labelPercentage}%)`, icon: '👥' }
    ];

    const overviewHtml = overviewStats.map(stat => `
      <div class="stat-item">
        <div class="stat-icon">${stat.icon}</div>
        <div class="stat-number">${stat.value}</div>
        <div class="stat-label">${stat.label}</div>
      </div>
    `).join('');

    const labelDistributionHtml = Object.entries(stats.labelDistribution)
      .sort((a, b) => b[1] - a[1])
      .map(([label, count]) => {
        const percentage = (count/stats.totalContacts*100).toFixed(1);
        const progressWidth = Math.max(percentage, 5); // Minimum 5% width for visibility
        return `
          <div class="birthday-item">
            <strong>🏷️ ${label}</strong>
            <div class="contact-info">
              <div class="progress-bar">
                <div class="progress" style="width: ${progressWidth}%"></div>
                <span class="progress-text">
                  👥 ${count} contacts (${percentage}%)
                </span>
              </div>
              <div class="action-buttons">
                <a href="#" class="button small" onclick="google.script.run.sendContactsWithLabelReport('${label}')">View Contacts</a>
              </div>
            </div>
          </div>
        `;
      }).join('');

    return `
      <div class="section">
        <h2 class="section-title">📊 Label Overview</h2>
        <div class="stats">
          ${overviewHtml}
        </div>
      </div>
      <div class="section">
        <h2 class="section-title">📈 Label Distribution</h2>
        <div class="birthday-list">
          ${labelDistributionHtml}
        </div>
      </div>
    `;
  }

  /**
   * Wraps email content in a standard template with styles
   * @param {string} content - Email content to wrap
   * @param {string} contentType - Type of content for styling
   * @returns {string} Complete HTML email
   */
  static wrapEmail(content, contentType = 'default') {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>${this.getStyles(contentType)}</style>
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