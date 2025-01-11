/**
 * Class to manage contacts.
 */
class ContactManager {
  constructor() {
    this.contacts = this.fetchContacts();
  }

  fetchContacts() {
    const peopleService = People.People;

    let contacts = [];

    let pageToken = null;
    const pageSize = 100;

    try {
      do {
        const response = peopleService.Connections.list('people/me', {
          pageSize: pageSize,
          personFields: 'names,birthdays,memberships,emailAddresses,phoneNumbers,addresses,biographies',
          pageToken: pageToken
        });

        const connections = response.connections || [];
        connections.forEach(person => {
          var contact = {
            id: person.resourceName,
            name: person.names?.[0]?.displayName || 'Unnamed Contact'
          }
          contacts.push(contact);
        });

        pageToken = response.nextPageToken;
      } while (pageToken);
      
      return contacts;
    } catch (error) {
      Logger.log('Error fetching contacts:', error.toString());
    }
  }

  /**
   * Logs all contacts.
   */
  logAllContacts() {
    this.contacts.forEach(contact => {
      Logger.log(contact.name);
    });
  }

}



