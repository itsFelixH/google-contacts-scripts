/**
 * Manages contact labels (groups) via the People API.
 */
class LabelManager {
  constructor() {
    this.labels = this.fetchLabels();
  }


  /**
   * Fetches all contact labels (groups) with their IDs.
   * @returns {Object[]} Array of { id, name } objects
   */
  fetchLabels() {
    try {
      const groupsResponse = People.ContactGroups.list();
      const groupResourceNames = groupsResponse.contactGroups.map(group => group.resourceName);

      const batchGetResponse = People.ContactGroups.batchGet({
        resourceNames: groupResourceNames
      });

      return batchGetResponse.responses.map(response => ({
        id: response.contactGroup.resourceName,
        name: response.contactGroup.name
      }));
    } catch (error) {
      Logger.log(`Error fetching contact labels: ${error.message}`);
      return [];
    }
  }


  /**
   * Gets a label name by its ID.
   * Returns null for system labels (myContacts, starred).
   * @param {string} labelId
   * @returns {string|null}
   */
  getLabelNameById(labelId) {
    if (labelId === 'myContacts' || labelId === 'starred') {
      return null;
    }

    const label = this.labels.find(
      l => l.id === labelId || l.id === `contactGroups/${labelId}`
    );

    return label ? label.name : null;
  }


  /**
   * Gets label names for an array of IDs, omitting unknown/system labels.
   * @param {string[]} labelIds
   * @returns {string[]}
   */
  getLabelNamesByIds(labelIds) {
    return labelIds
      .map(id => this.getLabelNameById(id))
      .filter(name => name !== null);
  }


  /**
   * Checks if a label exists by its ID.
   * @param {string} labelId
   * @returns {boolean}
   */
  labelExistsById(labelId) {
    return this.labels.some(
      l => l.id === labelId || l.id === `contactGroups/${labelId}`
    );
  }


  /**
   * Checks if a label exists by its name.
   * @param {string} labelName
   * @returns {boolean}
   */
  labelExistsByName(labelName) {
    return this.labels.some(l => l.name === labelName);
  }


  /**
   * Creates a new contact label (group).
   * @param {string} name
   * @returns {Object|null} The created { id, name } or null on error
   */
  addLabel(name) {
    try {
      const newLabel = People.ContactGroups.create({
        contactGroup: { name }
      });

      const label = { id: newLabel.resourceName, name: newLabel.name };
      this.labels.push(label);
      return label;
    } catch (error) {
      Logger.log(`Error adding contact label: ${error.message}`);
      return null;
    }
  }


  /**
   * Logs all label names.
   */
  logAllLabels() {
    this.labels.forEach(label => Logger.log(label.name));
  }
}
