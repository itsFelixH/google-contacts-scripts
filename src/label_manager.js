/**
 * Class to manage contact labels.
 */
class LabelManager {
  constructor() {
    this.labels = this.fetchLabels();
  }


  /**
   * Retrieves and initializes all contact labels (groups) along with their IDs.
   *
   * @returns {Object[]} An array of objects, each containing the contact label name and its ID.
   */
  fetchLabels() {
    try {
      var groupsResponse = People.ContactGroups.list();
      var groupResourceNames = groupsResponse.contactGroups.map(group => group.resourceName);

      var batchGetResponse = People.ContactGroups.batchGet({
        resourceNames: groupResourceNames
      });

      var labels = batchGetResponse.responses.map(response => {
        return {
          id: response.contactGroup.resourceName,
          name: response.contactGroup.name
        };
      });

      return labels;
    } catch (error) {
      Logger.log("Error fetching contact labels: " + error.toString());
      return [];
    }
  }


  /**
   * Gets the contact label name by the provided label ID.
   *
   * @param {string} labelId - The ID of the contact label.
   * @returns {string|null} The contact label name if found, or null if not found.
   */
  getLabelNameById(labelId) {
    if (labelId == 'myContacts') {
      return null
    } else if (labelId == 'starred') {
      return null
    }
    for (var i = 0; i < this.labels.length; i++) {
      if (this.labels[i].id === labelId || this.labels[i].id === ('contactGroups/' + labelId)) {
        return this.labels[i].name;
      }
    }
    return null;
  }


  /**
   * Retrieves label names given their IDs, omitting any unknown label IDs.
   *
   * @param {string[]} labelIds - An array of label IDs to get names for.
   * @returns {string[]} An array of label names corresponding to the provided label IDs.
   */
  getLabelNamesByIds(labelIds) {
    return labelIds
      .map(labelId => {
        const labelName = this.getLabelNameById(labelId);
        return labelName !== null ? labelName : null;
      })
      .filter(labelName => labelName !== null);
  }

  /**
   * Checks if a label exists by its ID.
   *
   * @param {string} labelId - The ID of the contact label.
   * @returns {boolean} True if the label exists, false otherwise.
   */
  labelExistsById(labelId) {
    return this.labels.some(label => label.id === labelId || label.id === ('contactGroups/' + labelId));
  }

  /**
   * Checks if a label exists by its name.
   *
   * @param {string} labelName - The name of the contact label.
   * @returns {boolean} True if the label exists, false otherwise.
   */
  labelExistsByName(labelName) {
    return this.labels.some(label => label.name === labelName);
  }

  /**
   * Adds a new contact label (group).
   *
   * @param {string} name - The name of the new contact label.
   * @returns {Object|null} The added label object if successful, or null if an error occurs.
   */
  addLabel(name) {
    try {
      var newLabel = People.ContactGroups.create({
        contactGroup: {
          name: name
        }
      });

      // Update the local labels array
      this.labels.push({
        id: newLabel.resourceName,
        name: newLabel.name
      });

      return { id: newLabel.resourceName, name: newLabel.name };
    } catch (error) {
      Logger.log("Error adding contact label: " + error.toString());
      return null;
    }
  }


  /**
   * Logs all label names.
   */
  logAllLabels() {
    this.labels.forEach(label => {
      Logger.log(label.name);
    });
  }
}



