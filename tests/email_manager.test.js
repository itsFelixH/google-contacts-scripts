describe('EmailManager', () => {
  let emailManager;

  beforeEach(() => {
    emailManager = new EmailManager();
    Gmail.Users.Messages.send.mockClear();
  });

  test('getEmailContext returns correct values', () => {
    const ctx = emailManager.getEmailContext();
    expect(ctx.toEmail).toBe('test@example.com');
    expect(ctx.fromEmail).toBe('test@example.com');
    expect(ctx.senderName).toBe('Google Contacts Scripts');
  });

  test('sendMail calls Gmail API', () => {
    emailManager.sendMail('to@test.com', 'from@test.com', 'Sender', 'Subject', 'text', '<p>html</p>');
    expect(Gmail.Users.Messages.send).toHaveBeenCalledTimes(1);
    expect(Gmail.Users.Messages.send).toHaveBeenCalledWith(
      expect.objectContaining({ raw: expect.any(String) }),
      'me'
    );
  });

  test('sendUpcomingBirthdaysEmail sends email', () => {
    const contacts = [new Contact('Birthday', new Date('1990-06-15'))];
    emailManager.sendUpcomingBirthdaysEmail(contacts, 7);
    expect(Gmail.Users.Messages.send).toHaveBeenCalledTimes(1);
  });

  test('sendDuplicateContactsEmail sends email', () => {
    const groups = [{
      contacts: [new Contact('Dupe 1', null), new Contact('Dupe 2', null)],
      count: 2,
      reason: 'name match'
    }];
    emailManager.sendDuplicateContactsEmail(groups);
    expect(Gmail.Users.Messages.send).toHaveBeenCalledTimes(1);
  });

  test('sendContactOverviewEmail sends email', () => {
    const stats = {
      totalContacts: 100, withBirthday: 75, withEmail: 90, withPhone: 80,
      withCity: 70, withLabels: 85, withInstagram: 40,
      birthdayPercentage: '75.0', emailPercentage: '90.0', phonePercentage: '80.0',
      cityPercentage: '70.0', labelPercentage: '85.0', instagramPercentage: '40.0',
    };
    emailManager.sendContactOverviewEmail(stats);
    expect(Gmail.Users.Messages.send).toHaveBeenCalledTimes(1);
  });

  test('sendLabelHealthEmail sends email', () => {
    const labelStats = {
      totalLabels: 3,
      mostUsed: { label: 'Friends', count: 50 },
      leastUsed: { label: 'Work', count: 5 },
      unlabeledCount: 10
    };
    const unlabeled = [new Contact('No Label', null)];
    const distribution = { Friends: 50, Family: 30, Work: 5 };
    emailManager.sendLabelHealthEmail(labelStats, unlabeled, distribution, 100);
    expect(Gmail.Users.Messages.send).toHaveBeenCalledTimes(1);
  });

  test('sendLabelHealthEmail works with no unlabeled contacts', () => {
    const labelStats = {
      totalLabels: 2,
      mostUsed: { label: 'Friends', count: 50 },
      leastUsed: { label: 'Work', count: 5 },
      unlabeledCount: 0
    };
    emailManager.sendLabelHealthEmail(labelStats, [], { Friends: 50, Work: 5 }, 55);
    expect(Gmail.Users.Messages.send).toHaveBeenCalledTimes(1);
  });

  test('sendMissingInfoEmail sends email for each field', () => {
    const contacts = [new Contact('Missing', null)];

    ['email', 'phone', 'city', 'birthday'].forEach(field => {
      Gmail.Users.Messages.send.mockClear();
      emailManager.sendMissingInfoEmail(field, contacts);
      expect(Gmail.Users.Messages.send).toHaveBeenCalledTimes(1);
    });
  });

  test('sendDataQualityEmail sends email with both sections', () => {
    const noSurname = [new Contact('SingleName', null)];
    const invalidPhones = [new Contact('Bad Phone', null, [], '', '', 'abc')];
    emailManager.sendDataQualityEmail(noSurname, invalidPhones);
    expect(Gmail.Users.Messages.send).toHaveBeenCalledTimes(1);
  });

  test('sendDataQualityEmail works with only surnames', () => {
    const noSurname = [new Contact('SingleName', null)];
    emailManager.sendDataQualityEmail(noSurname, []);
    expect(Gmail.Users.Messages.send).toHaveBeenCalledTimes(1);
  });

  test('sendDataQualityEmail works with only invalid phones', () => {
    const invalidPhones = [new Contact('Bad Phone', null, [], '', '', 'abc')];
    emailManager.sendDataQualityEmail([], invalidPhones);
    expect(Gmail.Users.Messages.send).toHaveBeenCalledTimes(1);
  });
});


describe('EmailTemplates', () => {
  test('header generates HTML with title', () => {
    const html = EmailTemplates.header('Test Title', 'Subtitle');
    expect(html).toContain('Test Title');
    expect(html).toContain('Subtitle');
  });

  test('footer generates HTML with links', () => {
    const html = EmailTemplates.footer();
    expect(html).toContain('contacts.google.com');
    expect(html).toContain('github.com');
  });

  test('wrapEmail generates complete HTML document', () => {
    const html = EmailTemplates.wrapEmail('<p>Content</p>');
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<p>Content</p>');
    expect(html).toContain('</html>');
  });
});
