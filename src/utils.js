/**
 * Utility functions — pure helpers with no domain-specific logic.
 */


/**
 * Extracts Instagram usernames from the given notes.
 * Supports @username patterns and "Instagram: username" format.
 *
 * @param {string} notes The notes containing Instagram usernames.
 * @returns {string[]} Array of Instagram usernames (with @ prefix), or empty array if none found.
 */
function extractInstagramNamesFromNotes(notes) {
  if (!notes) return [];

  const instagramNames = [];

  // Match all @username patterns in the notes
  const atMatches = notes.match(/@[\w.]+/g);
  if (atMatches) {
    atMatches.forEach(match => {
      const username = match.startsWith('@') ? match : '@' + match;
      if (!instagramNames.includes(username)) {
        instagramNames.push(username);
      }
    });
  }

  // Also match "Instagram: username" pattern (without @)
  const instaPattern = /Instagram:\s*([^\s,@][^\s,]*)/gi;
  let match;
  while ((match = instaPattern.exec(notes)) !== null) {
    const username = '@' + match[1].trim();
    if (!instagramNames.includes(username)) {
      instagramNames.push(username);
    }
  }

  return instagramNames;
}


/**
 * Gets the current user's first name from Google People API.
 * @returns {string} The user's first name, or empty string if unavailable.
 */
function getCurrentUserFirstName() {
  try {
    const peopleResponse = People.People.getBatchGet({
      resourceNames: ['people/me'],
      personFields: 'names'
    });

    if (peopleResponse && peopleResponse.responses && peopleResponse.responses.length > 0) {
      const person = peopleResponse.responses[0].person;
      if (person && person.names && person.names.length > 0) {
        return person.names[0].givenName || '';
      }
    }
    return '';
  } catch (err) {
    Logger.log('Failed to get own profile: ' + err.message);
    return '';
  }
}
