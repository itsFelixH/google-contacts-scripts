describe('EmailManager', () => {
  let emailManager;
  let lastRawMessage;

  beforeEach(() => {
    emailManager = new EmailManager();
    Gmail.Users.Messages.send.mockClear();
    // Capture the raw message for content assertions
    Gmail.Users.Messages.send.mockImplementation((msg) => {
      lastRawMessage = Buffer.from(msg.raw, 'base64url').toString('utf8');
    });
  });

  test('getEmailContext returns correct values', () => {
    const ctx = emailManager.getEmailContext();
    expect(ctx.toEmail).toBe('test@example.com');
    expect(ctx.fromEmail).toBe('test@example.com');
    expect(ctx.senderName).toBe('Google Contacts Scripts');
  });

  test('sendMail calls Gmail API with correct structure', () => {
    emailManager.sendMail('to@test.com', 'from@test.com', 'Sender', 'Subject', 'text body', '<p>html</p>');
    expect(Gmail.Users.Messages.send).toHaveBeenCalledTimes(1);
    expect(Gmail.Users.Messages.send).toHaveBeenCalledWith(
      expect.objectContaining({ raw: expect.any(String) }),
      'me'
    );
  });

  test('sendMail produces valid MIME message', () => {
    emailManager.sendMail('to@test.com', 'from@test.com', 'Sender', 'Test Subject', 'plain text', '<p>html</p>');
    expect(lastRawMessage).toContain('MIME-Version: 1.0');
    expect(lastRawMessage).toContain('To: to@test.com');
    expect(lastRawMessage).toContain('Content-Type: multipart/alternative');
    expect(lastRawMessage).toContain('Content-Type: text/plain');
    expect(lastRawMessage).toContain('Content-Type: text/html');
    expect(lastRawMessage).toContain('plain text');
  });

  describe('sendUpcomingBirthdaysEmail', () => {
    test('sends email with contact names', () => {
      const contacts = [new Contact('Anna Schmidt', new Date('1990-06-15'))];
      emailManager.sendUpcomingBirthdaysEmail(contacts, 7);
      expect(Gmail.Users.Messages.send).toHaveBeenCalledTimes(1);
      expect(lastRawMessage).toContain('Anna Schmidt');
      expect(lastRawMessage).toContain('Upcoming Birthdays');
    });

    test('includes age when birthdayShowAge is true', () => {
      const today = new Date();
      const nextDay = new Date(today.getFullYear() - 30, today.getMonth(), today.getDate() + 1);
      const contacts = [new Contact('Test Person', nextDay)];
      emailManager.sendUpcomingBirthdaysEmail(contacts, 7);
      expect(lastRawMessage).toContain('turns 31');
    });
  });

  describe('sendDuplicateContactsEmail', () => {
    test('sends email with group info', () => {
      const groups = [{
        contacts: [new Contact('Dupe A', null), new Contact('Dupe B', null)],
        count: 2,
        reason: 'name match'
      }];
      emailManager.sendDuplicateContactsEmail(groups);
      expect(Gmail.Users.Messages.send).toHaveBeenCalledTimes(1);
      expect(lastRawMessage).toContain('Dupe A');
      expect(lastRawMessage).toContain('Dupe B');
      expect(lastRawMessage).toContain('name match');
    });
  });

  describe('sendContactOverviewEmail', () => {
    test('sends email with stats', () => {
      const stats = {
        totalContacts: 100, withBirthday: 75, withEmail: 90, withPhone: 80,
        withCity: 70, withLabels: 85, withInstagram: 40,
        birthdayPercentage: '75.0', emailPercentage: '90.0', phonePercentage: '80.0',
        cityPercentage: '70.0', labelPercentage: '85.0', instagramPercentage: '40.0',
      };
      emailManager.sendContactOverviewEmail(stats);
      expect(Gmail.Users.Messages.send).toHaveBeenCalledTimes(1);
      expect(lastRawMessage).toContain('100');
      expect(lastRawMessage).toContain('75.0%');
    });
  });

  describe('sendLabelOverviewEmail', () => {
    test('sends email with label stats and unlabeled contacts', () => {
      const labelStats = {
        totalLabels: 3,
        mostUsed: { label: 'Friends', count: 50 },
        leastUsed: { label: 'Work', count: 5 },
        unlabeledCount: 10
      };
      const unlabeled = [new Contact('No Label', null)];
      const distribution = { Friends: 50, Family: 30, Work: 5 };
      emailManager.sendLabelOverviewEmail(labelStats, unlabeled, distribution, 100);
      expect(Gmail.Users.Messages.send).toHaveBeenCalledTimes(1);
      expect(lastRawMessage).toContain('Friends');
      expect(lastRawMessage).toContain('No Label');
    });

    test('omits unlabeled section when empty', () => {
      const labelStats = {
        totalLabels: 2,
        mostUsed: { label: 'Friends', count: 50 },
        leastUsed: { label: 'Work', count: 5 },
        unlabeledCount: 0
      };
      emailManager.sendLabelOverviewEmail(labelStats, [], { Friends: 50, Work: 5 }, 55);
      expect(Gmail.Users.Messages.send).toHaveBeenCalledTimes(1);
      expect(lastRawMessage).not.toContain('Unlabeled Contacts');
    });
  });

  describe('sendMissingInfoEmail', () => {
    test('sends email for each field type', () => {
      const contacts = [new Contact('Missing Person', null)];

      ['email', 'phone', 'city', 'birthday'].forEach(field => {
        Gmail.Users.Messages.send.mockClear();
        emailManager.sendMissingInfoEmail(field, contacts);
        expect(Gmail.Users.Messages.send).toHaveBeenCalledTimes(1);
        expect(lastRawMessage).toContain('Missing Person');
      });
    });

    test('uses correct emoji per field', () => {
      const contacts = [new Contact('Test', null)];

      emailManager.sendMissingInfoEmail('email', contacts);
      expect(lastRawMessage).toContain('📧');

      Gmail.Users.Messages.send.mockClear();
      emailManager.sendMissingInfoEmail('phone', contacts);
      expect(lastRawMessage).toContain('📱');
    });
  });

  describe('sendDataQualityEmail', () => {
    test('sends email with both sections', () => {
      const noSurname = [new Contact('SingleName', null)];
      const invalidPhones = [new Contact('Bad Phone', null, [], '', '', 'abc')];
      emailManager.sendDataQualityEmail(noSurname, invalidPhones);
      expect(Gmail.Users.Messages.send).toHaveBeenCalledTimes(1);
      expect(lastRawMessage).toContain('SingleName');
      expect(lastRawMessage).toContain('Bad Phone');
      expect(lastRawMessage).toContain('abc');
    });

    test('works with only surnames section', () => {
      const noSurname = [new Contact('OnlyFirst', null)];
      emailManager.sendDataQualityEmail(noSurname, []);
      expect(Gmail.Users.Messages.send).toHaveBeenCalledTimes(1);
      expect(lastRawMessage).toContain('OnlyFirst');
      expect(lastRawMessage).not.toContain('Invalid Phone');
    });

    test('works with only invalid phones section', () => {
      const invalidPhones = [new Contact('Bad Phone', null, [], '', '', 'xyz')];
      emailManager.sendDataQualityEmail([], invalidPhones);
      expect(Gmail.Users.Messages.send).toHaveBeenCalledTimes(1);
      expect(lastRawMessage).toContain('xyz');
      expect(lastRawMessage).not.toContain('Missing Surnames');
    });
  });
});


describe('EmailTemplates', () => {
  test('header generates h2 with title', () => {
    const html = EmailTemplates.header('Test Title', 'Subtitle');
    expect(html).toContain('<h2>Test Title</h2>');
    expect(html).toContain('Subtitle');
  });

  test('header works without subtitle', () => {
    const html = EmailTemplates.header('Title Only');
    expect(html).toContain('<h2>Title Only</h2>');
    expect(html).not.toContain('<p>');
  });

  test('footer contains links', () => {
    const html = EmailTemplates.footer();
    expect(html).toContain('contacts.google.com');
    expect(html).toContain('github.com');
    expect(html).toContain('<hr>');
  });

  test('wrapEmail generates complete HTML document', () => {
    const html = EmailTemplates.wrapEmail('<p>Content</p>');
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<p>Content</p>');
    expect(html).toContain('</html>');
    expect(html).toContain('font-family');
    expect(html).toContain('margin-bottom: 6px');
  });
});
