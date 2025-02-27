/**
 * ST-CharacterDistributor-UI - Characters Module
 * Contains functions for managing character lists, filtering, and display
 */

// Import dependencies from settings module
import { defaultSettings } from './settings.js';

// Fallback characters for when server is unreachable
const fallbackCharacters = [
    { 
        name: "Example Character 1", 
        avatar: "img/default_avatar.png", 
        tags: ["example", "fallback"],
        id: "example1"
    },
    { 
        name: "Example Character 2", 
        avatar: "img/default_avatar.png", 
        tags: ["example", "fallback"],
        id: "example2"
    }
];

// Store current character list
let currentCharacters = [];

/**
 * Load character list from server or use fallback
 * @returns {Promise<Array>} List of characters
 */
async function loadCharacterList() {
    try {
        console.log('Character Distributor UI: Loading character list...');
        const response = await fetch('/api/plugins/character-distributor/characters', {
            method: 'GET',
            headers: getRequestHeaders()
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error(`Character Distributor UI: Failed to load characters. Status: ${response.status}`, errorText);
            toastr.error(`Failed to load characters from server (${response.status})`, 'Error');
            return useFallbackCharacters();
        }
        
        try {
            const data = await response.json();
            
            if (Array.isArray(data.characters)) {
                console.log(`Character Distributor UI: Loaded ${data.characters.length} characters`);
                
                // Store current character list
                currentCharacters = data.characters;
                
                // Apply tag filters and populate dropdown
                refreshCharacterList();
                
                return data.characters;
            } else {
                console.error('Character Distributor UI: Unexpected characters response format', data);
                toastr.error('Unexpected data format from server', 'Error');
                return useFallbackCharacters();
            }
        } catch (parseError) {
            console.error('Character Distributor UI: Error parsing character data', parseError);
            toastr.error('Error parsing character data', 'Error');
            return useFallbackCharacters();
        }
    } catch (error) {
        console.error('Character Distributor UI: Error loading character list', error);
        toastr.error('Error loading character list: ' + error.message, 'Network Error');
        return useFallbackCharacters();
    }
}

/**
 * Use fallback characters when server data is unavailable
 * @returns {Array} Fallback character list
 */
function useFallbackCharacters() {
    console.log('Character Distributor UI: Using fallback characters');
    // Store fallback as current characters
    currentCharacters = [...fallbackCharacters];
    
    // Apply tag filters and populate dropdown (uses the stored currentCharacters)
    refreshCharacterList();
    
    return fallbackCharacters;
}

/**
 * Get all unique tags from the current character list
 * @returns {Array} Sorted list of unique tags
 */
function getCharacterTags() {
    if (!currentCharacters || !currentCharacters.length) {
        return [];
    }
    
    // Create a Set to store unique tags
    const tagSet = new Set();
    
    // Iterate through characters and add their tags to the set
    currentCharacters.forEach(character => {
        if (character.tags && Array.isArray(character.tags)) {
            character.tags.forEach(tag => {
                if (tag && typeof tag === 'string' && tag.trim()) {
                    tagSet.add(tag.trim());
                }
            });
        }
    });
    
    // Convert set to array and sort alphabetically
    return Array.from(tagSet).sort();
}

/**
 * Check if a character has any excluded tags
 * @param {Object} character - Character object to check
 * @returns {boolean} True if character has excluded tags
 */
function characterHasExcludedTags(character) {
    const excludeTags = extension_settings[MODULE_NAME].excludeTags || [];
    
    // If no excluded tags, character is not excluded
    if (!excludeTags.length) {
        return false;
    }
    
    // If character has no tags, it can't have excluded tags
    if (!character.tags || !Array.isArray(character.tags) || !character.tags.length) {
        return false;
    }
    
    // Check if any of the character's tags match the excluded tags
    return character.tags.some(tag => excludeTags.includes(tag));
}

/**
 * Filter characters by excluded tags
 * @returns {Array} Filtered character list
 */
function filterCharactersByTags() {
    if (!currentCharacters || !Array.isArray(currentCharacters)) {
        console.warn('Character Distributor UI: No characters to filter');
        return [];
    }
    
    console.log(`Character Distributor UI: Filtering ${currentCharacters.length} characters`);
    
    // Get the excluded tags from settings
    const excludeTags = extension_settings[MODULE_NAME].excludeTags || [];
    console.log('Character Distributor UI: Excluding tags:', excludeTags);
    
    // If no excluded tags, return all characters
    if (!excludeTags.length) {
        return currentCharacters;
    }
    
    // Filter out characters with excluded tags
    const filteredCharacters = currentCharacters.filter(character => {
        // Keep characters that don't have excluded tags
        return !characterHasExcludedTags(character);
    });
    
    console.log(`Character Distributor UI: Filtered to ${filteredCharacters.length} characters`);
    return filteredCharacters;
}

/**
 * Refresh the character list UI based on current filters
 */
function refreshCharacterList() {
    try {
        // Get filtered characters
        const filteredCharacters = filterCharactersByTags();
        
        // Update the character count display
        $('#character-count').text(`${filteredCharacters.length} characters`);
        
        // Populate the dropdown
        populateCharacterDropdown(filteredCharacters);
    } catch (error) {
        console.error('Character Distributor UI: Error refreshing character list', error);
        toastr.error('Error refreshing character list', 'Error');
    }
}

/**
 * Populate character dropdown with filtered characters
 * @param {Array} characters - List of characters to display
 */
function populateCharacterDropdown(characters) {
    // Get the dropdown element
    const dropdown = $('#character-dropdown');
    
    // Clear existing items
    dropdown.empty();
    
    // Check if we have characters to display
    if (!characters || !characters.length) {
        dropdown.append(`<option value="" disabled selected>No characters available</option>`);
        return;
    }
    
    // Add default prompt
    dropdown.append(`<option value="" disabled selected>Select a character</option>`);
    
    // Sort characters alphabetically by name
    characters.sort((a, b) => {
        const nameA = a.name ? a.name.toLowerCase() : '';
        const nameB = b.name ? b.name.toLowerCase() : '';
        return nameA.localeCompare(nameB);
    });
    
    // Add characters to dropdown
    characters.forEach(character => {
        // Create tags display if character has tags
        let tagsDisplay = '';
        if (character.tags && Array.isArray(character.tags) && character.tags.length) {
            tagsDisplay = ` [${character.tags.join(', ')}]`;
        }
        
        // Create option with character info
        dropdown.append(`<option value="${character.id}" 
                        data-name="${character.name || ''}" 
                        data-avatar="${character.avatar || ''}"
                        data-tags="${character.tags ? character.tags.join(',') : ''}">${character.name}${tagsDisplay}</option>`);
    });
    
    // Enable the dropdown
    dropdown.prop('disabled', false);
}

/**
 * Handle character selection from dropdown
 * @param {Event} event - Selection event
 */
function handleCharacterSelection(event) {
    const selectedOption = $(event.target).find(':selected');
    const characterId = selectedOption.val();
    
    if (!characterId) {
        console.log('Character Distributor UI: No character selected');
        return;
    }
    
    // Get character details from the option data attributes
    const characterName = selectedOption.data('name');
    const characterAvatar = selectedOption.data('avatar');
    const characterTags = selectedOption.data('tags') ? selectedOption.data('tags').split(',') : [];
    
    console.log('Character Distributor UI: Selected character:', characterId, characterName);
    
    // Display character details in UI
    $('#selected-character-name').text(characterName || 'Unknown');
    $('#selected-character-tags').text(characterTags.length ? characterTags.join(', ') : 'No tags');
    
    // Update avatar if available
    if (characterAvatar) {
        $('#selected-character-avatar').attr('src', characterAvatar).show();
    } else {
        $('#selected-character-avatar').hide();
    }
    
    // Show character details section
    $('#character-details').show();
    
    // Enable activation button
    $('#activate-character-btn').prop('disabled', false);
}

/**
 * Activate the selected character in SillyTavern
 */
async function activateSelectedCharacter() {
    try {
        const characterId = $('#character-dropdown').val();
        
        if (!characterId) {
            console.warn('Character Distributor UI: No character selected for activation');
            toastr.warning('Please select a character first', 'Warning');
            return;
        }
        
        console.log('Character Distributor UI: Activating character:', characterId);
        
        // Show loading indicator
        $('#activate-character-btn').prop('disabled', true).text('Activating...');
        
        // Send request to server to activate character
        const response = await fetch('/api/plugins/character-distributor/activate', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({ characterId })
        });
        
        if (response.ok) {
            const result = await response.json();
            console.log('Character Distributor UI: Character activation result:', result);
            toastr.success(`Character "${result.name}" activated successfully`, 'Success');
            
            // Optionally, update UI to reflect the activated character
            if (result.name) {
                $('#activated-character-name').text(result.name);
                $('#activation-status').show();
            }
        } else {
            const errorText = await response.text();
            console.error('Character Distributor UI: Character activation failed', errorText);
            toastr.error(`Failed to activate character: ${errorText || response.status}`, 'Error');
        }
    } catch (error) {
        console.error('Character Distributor UI: Error during character activation', error);
        toastr.error(`Error activating character: ${error.message}`, 'Error');
    } finally {
        // Reset button state
        $('#activate-character-btn').prop('disabled', false).text('Activate Character');
    }
}

// Export functions
export {
    loadCharacterList,
    useFallbackCharacters,
    getCharacterTags,
    characterHasExcludedTags,
    filterCharactersByTags,
    refreshCharacterList,
    populateCharacterDropdown,
    handleCharacterSelection,
    activateSelectedCharacter
}; 