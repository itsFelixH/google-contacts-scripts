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
      // Create a birthday 2 days from now, 25 years ago
      // calculateAge() = 24 (hasn't happened yet), so "turns 25"
      const bday = new Date(today.getFullYear() - 25, today.getMonth(), today.getDate() + 2);
      const contacts = [new Contact('Test Person', bday)];
      emailManager.sendUpcomingBirthdaysEmail(contacts, 7);
      expect(lastRawMessage).toContain('turns 25');
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
        completeness: [2, 8, 20, 30, 40], completeCount: 40, completenessPercentage: '40.0',
        topCities: [{ city: 'Berlin', count: 25 }, { city: 'Munich', count: 15 }],
      };
      emailManager.sendContactOverviewEmail(stats);
      expect(Gmail.Users.Messages.send).toHaveBeenCalledTimes(1);
      expect(lastRawMessage).toContain('100');
      expect(lastRawMessage).toContain('75.0%');
      expect(lastRawMessage).toContain('40.0%');
      expect(lastRawMessage).toContain('Berlin');
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
    test('sends email with all field sections', () => {
      const contacts = [new Contact('Missing Person', null)];
      const fieldData = {
        email: contacts,
        phone: contacts,
        city: contacts,
        birthday: contacts,
      };

      emailManager.sendMissingInfoEmail(fieldData);
      expect(Gmail.Users.Messages.send).toHaveBeenCalledTimes(1);
      expect(lastRawMessage).toContain('Missing Person');
    });

    test('uses correct emoji per field', () => {
      const contacts = [new Contact('Test', null)];
      const fieldData = { email: contacts, phone: contacts };

      emailManager.sendMissingInfoEmail(fieldData);
      expect(lastRawMessage).toContain('📧');
      expect(lastRawMessage).toContain('📱');
    });
  });

  describe('sendDataQualityEmail', () => {
    test('sends email with multiple sections', () => {
      const noSurname = [new Contact('SingleName', null)];
      const invalidPhones = [new Contact('Bad Phone', null, [], '', '', 'abc')];
      emailManager.sendDataQualityEmail(noSurname, invalidPhones, [], [], [], 100);
      expect(Gmail.Users.Messages.send).toHaveBeenCalledTimes(1);
      expect(lastRawMessage).toContain('SingleName');
      expect(lastRawMessage).toContain('Bad Phone');
      expect(lastRawMessage).toContain('abc');
    });

    test('works with only surnames section', () => {
      const noSurname = [new Contact('OnlyFirst', null)];
      emailManager.sendDataQualityEmail(noSurname, [], [], [], [], 50);
      expect(Gmail.Users.Messages.send).toHaveBeenCalledTimes(1);
      expect(lastRawMessage).toContain('OnlyFirst');
      expect(lastRawMessage).not.toContain('Invalid Phone');
    });

    test('works with only invalid phones section', () => {
      const invalidPhones = [new Contact('Bad Phone', null, [], '', '', 'xyz')];
      emailManager.sendDataQualityEmail([], invalidPhones, [], [], [], 50);
      expect(Gmail.Users.Messages.send).toHaveBeenCalledTimes(1);
      expect(lastRawMessage).toContain('xyz');
      expect(lastRawMessage).not.toContain('Missing Surnames');
    });

    test('includes summary card and total contacts', () => {
      const noSurname = [new Contact('Felix', null)];
      const empty = [new Contact('Ghost', null)];
      emailManager.sendDataQualityEmail(noSurname, [], [], empty, [], 342);
      expect(lastRawMessage).toContain('342');
      expect(lastRawMessage).toContain('missing surnames');
      expect(lastRawMessage).toContain('empty contacts');
    });
  });
});


describe('EmailTemplates', () => {
  test('header generates h2 with title', () => {
    const html = EmailTemplates.header('Test Title', 'Subtitle');
    expect(html).toContain('Test Title</h2>');
    expect(html).toContain('Subtitle');
  });

  test('header works without subtitle', () => {
    const html = EmailTemplates.header('Title Only');
    expect(html).toContain('Title Only</h2>');
    expect(html).not.toContain('Subtitle');
  });

  test('footer contains links', () => {
    const html = EmailTemplates.footer();
    expect(html).toContain('contacts.google.com');
    expect(html).toContain('github.com');
    expect(html).toContain('Manage Contacts');
  });

  test('wrapEmail generates complete HTML document', () => {
    const html = EmailTemplates.wrapEmail('<p>Content</p>');
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<p>Content</p>');
    expect(html).toContain('</html>');
    expect(html).toContain('font-family');
    expect(html).toContain('max-width: 600px');
  });
});
