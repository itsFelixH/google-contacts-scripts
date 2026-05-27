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

  test('sendUnlabeledContactsEmail sends email', () => {
    const contacts = [
      new Contact('Test User', null, [], 'test@example.com', 'Berlin', '+1234567890'),
    ];
    emailManager.sendUnlabeledContactsEmail(contacts);
    expect(Gmail.Users.Messages.send).toHaveBeenCalledTimes(1);
  });

  test('sendContactsWithoutBirthdayEmail sends email', () => {
    const contacts = [new Contact('No Birthday', null)];
    emailManager.sendContactsWithoutBirthdayEmail(contacts);
    expect(Gmail.Users.Messages.send).toHaveBeenCalledTimes(1);
  });

  test('sendContactsWithLabelEmail sends email', () => {
    const contacts = [new Contact('Friend', new Date(), ['Friends'])];
    emailManager.sendContactsWithLabelEmail('Friends', contacts);
    expect(Gmail.Users.Messages.send).toHaveBeenCalledTimes(1);
  });

  test('sendUpcomingBirthdaysEmail sends email', () => {
    const contacts = [new Contact('Birthday', new Date('1990-06-15'))];
    emailManager.sendUpcomingBirthdaysEmail(contacts, 7);
    expect(Gmail.Users.Messages.send).toHaveBeenCalledTimes(1);
  });

  test('sendContactsWithoutSurnamesEmail sends email', () => {
    const contacts = [new Contact('SingleName', null)];
    emailManager.sendContactsWithoutSurnamesEmail(contacts);
    expect(Gmail.Users.Messages.send).toHaveBeenCalledTimes(1);
  });

  test('sendInvalidPhonesEmail sends email', () => {
    const contacts = [new Contact('Bad Phone', null, [], '', '', 'abc')];
    emailManager.sendInvalidPhonesEmail(contacts);
    expect(Gmail.Users.Messages.send).toHaveBeenCalledTimes(1);
  });

  test('sendMissingFieldEmail sends email', () => {
    const contacts = [new Contact('Missing', null)];
    emailManager.sendMissingFieldEmail('email', contacts);
    expect(Gmail.Users.Messages.send).toHaveBeenCalledTimes(1);
  });

  test('sendLabelUsageStatsEmail sends email', () => {
    const stats = {
      totalLabels: 3,
      mostUsed: { label: 'Friends', count: 50 },
      leastUsed: { label: 'Work', count: 5 },
      allLabels: [],
      unlabeledCount: 10
    };
    emailManager.sendLabelUsageStatsEmail(stats);
    expect(Gmail.Users.Messages.send).toHaveBeenCalledTimes(1);
  });

  test('sendContactsByCityEmail sends email', () => {
    const cityGroups = [{ city: 'Berlin', contacts: [], count: 5 }];
    emailManager.sendContactsByCityEmail(cityGroups);
    expect(Gmail.Users.Messages.send).toHaveBeenCalledTimes(1);
  });

  test('sendDuplicatesEmail sends email', () => {
    const groups = [{
      contacts: [new Contact('Dupe 1', null), new Contact('Dupe 2', null)],
      count: 2,
      reason: 'name match'
    }];
    emailManager.sendDuplicatesEmail(groups);
    expect(Gmail.Users.Messages.send).toHaveBeenCalledTimes(1);
  });

  test('sendContactStatsEmail sends email', () => {
    const stats = {
      totalContacts: 100, withBirthday: 75, withEmail: 90, withPhone: 80,
      withCity: 70, withLabels: 85, withInstagram: 40,
      birthdayPercentage: '75.0', emailPercentage: '90.0', phonePercentage: '80.0',
      cityPercentage: '70.0', labelPercentage: '85.0', instagramPercentage: '40.0',
      labelDistribution: { Friends: 50 }
    };
    emailManager.sendContactStatsEmail(stats);
    expect(Gmail.Users.Messages.send).toHaveBeenCalledTimes(1);
  });

  test('sendLabelStatsEmail sends email', () => {
    const stats = { totalContacts: 100, labelDistribution: { Friends: 50, Work: 30 } };
    const allLabels = [{ id: '1', name: 'Friends' }, { id: '2', name: 'Work' }];
    emailManager.sendLabelStatsEmail(stats, allLabels);
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
