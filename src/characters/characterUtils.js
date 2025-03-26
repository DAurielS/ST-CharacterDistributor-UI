// Character utilities module for Character Distributor UI
// Contains functions for managing characters and their tags

import { getCharacters, getRequestHeaders } from "../../../../../../script.js";
import { getContext } from "../../../../../extensions.js";
import { getTagsList, getTagKeyForEntity, tag_map, tags } from "../../../../../tags.js";

// Variables to track loading state
let isLoadingCharacters = false;
let characterLoadDebounceTimer = null;

/**
 * Get character tags using SillyTavern's native tag system
 * @param {Object|string} characterIdentifier - Character object or identifier
 * @returns {string[]} Array of tag names
 */
export function getCharacterTags(characterIdentifier) {
    try {
        if (!characterIdentifier) {
            console.warn('Character Distributor UI: Called getCharacterTags with empty identifier');
            return [];
        }
        
        console.log(`Character Distributor UI: Getting tags for character: ${typeof characterIdentifier === 'object' ? 
            (characterIdentifier.name || characterIdentifier.avatar || 'Object without name') : 
            characterIdentifier}`);

        // Access tag_map and tags either through imports or window
        const tagMap = tag_map || window.tag_map;
        const tagsArray = tags || window.tags;
        
        // First try using the native tag system with getTagKeyForEntity and getTagsList
        if (typeof getTagKeyForEntity === 'function' && typeof getTagsList === 'function') {
            try {
                let tagKey = null;
                
                // For object identifiers (like a character object)
                if (typeof characterIdentifier === 'object' && characterIdentifier !== null) {
                    // SillyTavern uses the avatar field as the key for tags
                    if (characterIdentifier.avatar) {
                        tagKey = characterIdentifier.avatar;
                        console.log(`Character Distributor UI: Using avatar as tag key: ${tagKey}`);
                    } else if (characterIdentifier.filename) {
                        tagKey = characterIdentifier.filename;
                        console.log(`Character Distributor UI: Using filename as tag key: ${tagKey}`);
                    }
                } 
                // For string identifiers (most likely filename or avatar)
                else if (typeof characterIdentifier === 'string') {
                    // Try to use the string directly as the tag key
                    tagKey = characterIdentifier;
                    console.log(`Character Distributor UI: Using string directly as tag key: ${tagKey}`);
                }
                
                // Now check if this tag key exists in the tag_map
                if (tagKey && tagMap && tagKey in tagMap) {
                    console.log(`Character Distributor UI: Found tag key in tag_map: ${tagKey}`);
                    const tags = getTagsList(tagKey);
                    if (tags && Array.isArray(tags)) {
                        console.log(`Character Distributor UI: Retrieved ${tags.length} user-assigned tags for ${tagKey}`);
                        return tags.map(tag => tag.name);
                    } else {
                        console.log(`Character Distributor UI: getTagsList returned invalid result for ${tagKey}: ${typeof tags}`);
                    }
                } else if (tagKey) {
                    // Try to get tag key through the proper function
                    const properTagKey = getTagKeyForEntity(tagKey);
                    if (properTagKey) {
                        console.log(`Character Distributor UI: Found proper tag key: ${properTagKey}`);
                        const tags = getTagsList(properTagKey);
                        if (tags && Array.isArray(tags)) {
                            console.log(`Character Distributor UI: Retrieved ${tags.length} user-assigned tags for ${properTagKey}`);
                            return tags.map(tag => tag.name);
                        } else {
                            console.log(`Character Distributor UI: getTagsList returned invalid result for ${properTagKey}: ${typeof tags}`);
                        }
                    } else {
                        console.log(`Character Distributor UI: getTagKeyForEntity could not find a tag key for: ${tagKey}`);
                        
                        // Try using window.tag_map directly if available
                        if (tagMap && tagMap[tagKey] && Array.isArray(tagMap[tagKey])) {
                            console.log(`Character Distributor UI: Found tag key in tag_map: ${tagKey}`);
                            const tagIds = tagMap[tagKey];
                            const tagObjects = tagIds.map(id => {
                                return tagsArray ? tagsArray.find(tag => tag.id === id) : null;
                            }).filter(Boolean);
                            
                            if (tagObjects.length > 0) {
                                console.log(`Character Distributor UI: Retrieved ${tagObjects.length} tags using tag_map directly`);
                                return tagObjects.map(tag => tag.name);
                            }
                        }
                    }
                }
            } catch (tagError) {
                console.warn('Character Distributor UI: Error using native tag system:', tagError);
            }
        } else {
            console.log('Character Distributor UI: Native tag functions not available');
        }
        
        // If we get here, we couldn't get the user-assigned tags, so fall back to the character file tags
        
        // Fallback to direct character object access
        if (typeof characterIdentifier === 'object' && characterIdentifier !== null) {
            if (characterIdentifier.tags) {
                const tags = Array.isArray(characterIdentifier.tags) ? 
                    characterIdentifier.tags : 
                    (typeof characterIdentifier.tags === 'string' ? 
                        characterIdentifier.tags.split(',').map(t => t.trim()) : 
                        []);
                
                if (tags.length > 0) {
                    console.log(`Character Distributor UI: Retrieved ${tags.length} tags directly from character object`);
                    return tags;
                }
            }
            
            // If we're dealing with a character object but no name/identifier provided,
            // set the characterIdentifier to the name or avatar for fallback methods
            characterIdentifier = characterIdentifier.name || characterIdentifier.avatar || characterIdentifier.filename;
        }
        
        // Fallback approaches from the original implementation
        // 1. Try getCharacters()
        try {
            const characters = getCharacters();
            
            if (characters && Array.isArray(characters)) {
                const character = characters.find(char => 
                    char.name === characterIdentifier || 
                    char.avatar === characterIdentifier || 
                    (char.filename && char.filename === characterIdentifier));
                
                if (character && character.tags) {
                    const tags = Array.isArray(character.tags) ? 
                        character.tags : 
                        (typeof character.tags === 'string' ? 
                            character.tags.split(',').map(t => t.trim()) : 
                            []);
                    
                    if (tags.length > 0) {
                        console.log(`Character Distributor UI: Retrieved ${tags.length} tags via getCharacters()`);
                        return tags;
                    }
                }
            }
        } catch (charError) {
            console.warn('Character Distributor UI: Error accessing characters via getCharacters():', charError);
        }
        
        // 2. Try context data
        try {
            const context = getContext();
            if (context && context.characters) {
                const character = Object.values(context.characters).find(char => 
                    char.name === characterIdentifier || 
                    char.avatar === characterIdentifier);
                
                if (character && character.tags) {
                    const tags = Array.isArray(character.tags) ? 
                        character.tags : 
                        (typeof character.tags === 'string' ? 
                            character.tags.split(',').map(t => t.trim()) : 
                            []);
                    
                    if (tags.length > 0) {
                        console.log(`Character Distributor UI: Retrieved ${tags.length} tags via context data`);
                        return tags;
                    }
                }
            }
        } catch (contextError) {
            console.warn('Character Distributor UI: Error accessing context data:', contextError);
        }
        
        // 3. Try window.characters
        try {
            if (window.characters && Array.isArray(window.characters)) {
                const character = window.characters.find(char => 
                    char.name === characterIdentifier || 
                    char.avatar === characterIdentifier);
                
                if (character && character.tags) {
                    const tags = Array.isArray(character.tags) ? 
                        character.tags : 
                        (typeof character.tags === 'string' ? 
                            character.tags.split(',').map(t => t.trim()) : 
                            []);
                    
                    if (tags.length > 0) {
                        console.log(`Character Distributor UI: Retrieved ${tags.length} tags via window.characters`);
                        return tags;
                    }
                }
            }
        } catch (windowError) {
            console.warn('Character Distributor UI: Error accessing window.characters:', windowError);
        }
        
        console.log(`Character Distributor UI: No tags found for character: ${characterIdentifier}`);
    } catch (error) {
        console.error(`Character Distributor UI: Error getting character tags for ${characterIdentifier}`, error);
    }
    
    return [];
}

/**
 * Check if a character has any of the specified excluded tags
 * @param {Object|string} character - Character object or identifier
 * @param {string[]} excludeTags - Array of tags to exclude
 * @returns {boolean} True if character has excluded tags
 */
export function characterHasExcludedTags(character, excludeTags) {
    if (!character || !excludeTags || !Array.isArray(excludeTags) || excludeTags.length === 0) {
        return false;
    }
    
    // Get the character's tags
    const characterTags = getCharacterTags(character);
    
    // Log the found tags for debugging
    const charName = typeof character === 'object' ? (character.name || 'Unknown') : character;
    console.log(`Character Distributor UI: ${charName} has ${characterTags.length} tags: ${characterTags.join(', ')}`);
    
    // Check if any of the character's tags are in the excluded tags list
    const excluded = characterTags.some(tag => 
        excludeTags.some(excludeTag => 
            // Case-insensitive comparison
            typeof tag === 'string' && typeof excludeTag === 'string' && 
            tag.toLowerCase() === excludeTag.toLowerCase()
        )
    );
    
    if (excluded) {
        console.log(`Character Distributor UI: Character ${charName} has excluded tags`);
    }
    
    return excluded;
}

/**
 * Filter characters based on SillyTavern tags
 * @param {string[]} excludeTags - Array of tags to exclude
 * @returns {Promise<Object>} Object with excludedCharacters and characterFiles arrays
 */
export async function filterCharactersByTags(excludeTags) {
    console.log('Character Distributor UI: Filtering characters with excluded tags:', excludeTags);
    const excludedCharacters = [];
    const characterFiles = [];
    
    try {
        // Directly use the API method that works
        let characters = null;
        
        // Add a flag to track if we've previously seen a 404 on the API endpoint
        if (!window.characterDistributor) {
            window.characterDistributor = {
                apiUnavailable: false
            };
        }
        
        // Use direct API call which we know works
        if (!window.characterDistributor.apiUnavailable) {
            console.log('Character Distributor UI: Making direct API call to get characters');
            try {
                const response = await fetch('/api/characters/all', {
                    method: 'POST',
                    headers: getRequestHeaders(),
                    body: JSON.stringify({}) // Empty object is sufficient
                });
                
                if (response.ok) {
                    characters = await response.json();
                    console.log('Character Distributor UI: Retrieved characters using API');
                    console.log('Character Distributor UI: API returned array?', Array.isArray(characters));
                    console.log('Character Distributor UI: API returned length:', characters.length);
                } else {
                    console.warn('Character Distributor UI: API returned status', response.status);
                    if (response.status === 404) {
                        console.log('Character Distributor UI: API endpoint not available, marking as unavailable for future requests');
                        window.characterDistributor.apiUnavailable = true;
                    }
                }
            } catch (e) {
                console.warn('Character Distributor UI: Error fetching characters from API:', e);
            }
        } else {
            console.log('Character Distributor UI: Skipping API call as endpoint was previously unavailable');
        }
        
        // Approach 2: Fallback to window variables
        if (!characters || !Array.isArray(characters) || characters.length === 0) {
            console.log('Character Distributor UI: No characters from API call, trying window variables');
            characters = window.characters || 
                        (window.getCharacters && window.getCharacters()) || 
                        (window.charactersList) || 
                        Object.values(window.chat_metadata?.characters || {});
            
            if (characters && Array.isArray(characters) && characters.length > 0) {
                console.log('Character Distributor UI: Retrieved characters using fallback methods');
                console.log('Character Distributor UI: Characters source:', 
                    characters === window.characters ? 'window.characters' :
                    characters === window.getCharacters?.() ? 'window.getCharacters()' :
                    characters === window.charactersList ? 'window.charactersList' :
                    'window.chat_metadata.characters');
            }
        }
        
        // Check if we have valid character data
        if (!characters || !Array.isArray(characters) || characters.length === 0) {
            console.warn('Character Distributor UI: Could not access SillyTavern characters');
            return { excludedCharacters, characterFiles };
        }
        
        console.log(`Character Distributor UI: Found ${characters.length} characters in SillyTavern`);
        
        // Process each character
        for (const character of characters) {
            // Skip characters without file information
            if (!character.filename && !character.avatar) {
                console.log('Character Distributor UI: Skipping character without filename or avatar', character.name || 'Unnamed');
                continue;
            }
            
            const filename = character.filename || character.avatar;
            
            // Check if this character has any excluded tags using our utility function
            if (characterHasExcludedTags(character, excludeTags)) {
                console.log(`Character Distributor UI: Excluding character with excluded tag: ${filename}`);
                excludedCharacters.push(filename);
            } else {
                characterFiles.push(filename);
            }
        }
        
        console.log(`Character Distributor UI: Found ${excludedCharacters.length} characters with excluded tags`);
        console.log(`Character Distributor UI: Found ${characterFiles.length} characters without excluded tags`);
    } catch (error) {
        console.error('Character Distributor UI: Error filtering characters by tags', error);
    }
    
    return { excludedCharacters, characterFiles };
}

/**
 * Function to refresh character list with debouncing
 */
export function refreshCharacterList() {
    // Clear any existing timer
    if (characterLoadDebounceTimer) {
        clearTimeout(characterLoadDebounceTimer);
    }
    
    // Set a new timer
    characterLoadDebounceTimer = setTimeout(async function() {
        console.log('Character Distributor UI: Debounced character refresh triggered');
        
        // Only proceed if not already loading
        if (!isLoadingCharacters) {
            await loadCharacterList();
        } else {
            console.log('Character Distributor UI: Character list refresh skipped - already loading');
        }
    }, 1000); // 1 second debounce
}

/**
 * Load character list for sharing using SillyTavern's APIs
 * @returns {Promise<void>}
 */
export async function loadCharacterList() {
    // Already loading characters? Don't start another load
    if (isLoadingCharacters) {
        console.log('Character Distributor UI: Already loading characters, skipping duplicate call');
        return;
    }
    
    // Set flag to indicate we're loading characters
    isLoadingCharacters = true;
    
    try {
        console.log('Character Distributor UI: Loading character list...');
        
        // Directly use the API call that we know works instead of getCharacters()
        let allCharacters = null;
        
        try {
            // Make the API call to get characters
            console.log('Character Distributor UI: Making direct API call to /api/characters/all');
            const response = await fetch('/api/characters/all', {
                method: 'POST',
                headers: getRequestHeaders(),
                body: JSON.stringify({})
            });
            
            // Check if the API call was successful
            if (response.ok) {
                allCharacters = await response.json();
                console.log('Character Distributor UI: Retrieved', allCharacters.length, 'characters from API');
            } else {
                // If we get a 404, log the error
                if (response.status === 404) {
                    console.log('Character Distributor UI: API endpoint /api/characters/all returned 404, attempting fallback');
                } else {
                    console.log('Character Distributor UI: API call failed with status', response.status);
                }
                // Try fallbacks
                allCharacters = useFallbackCharacters();
            }
        } catch (error) {
            console.error('Character Distributor UI: Error fetching characters from API:', error);
            allCharacters = useFallbackCharacters();
        }
        
        // Validate we got characters
        if (Array.isArray(allCharacters) && allCharacters.length > 0) {
            console.log('Character Distributor UI: Loaded', allCharacters.length, 'characters');
            populateCharacterDropdown(allCharacters);
        } else {
            console.error('Character Distributor UI: Failed to load characters from all methods');
        }
    } catch (error) {
        console.error('Character Distributor UI: Error in loadCharacterList:', error);
    } finally {
        // Don't immediately clear the flag - wait a bit to prevent rapid re-triggering
        setTimeout(function() {
            isLoadingCharacters = false;
        }, 500);
    }
}

/**
 * Helper function to use fallback character sources
 * @returns {Array|null} Array of character objects or null if none found
 */
export function useFallbackCharacters() {
    console.log('Character Distributor UI: Attempting to use fallback character sources');
    
    // Try window variables
    const fallbackCharacters = window.characters || 
        (window.charactersList) || 
        Object.values(window.chat_metadata?.characters || {});
        
    if (fallbackCharacters && Array.isArray(fallbackCharacters) && fallbackCharacters.length > 0) {
        console.log(`Character Distributor UI: Found ${fallbackCharacters.length} characters using fallback data`);
        populateCharacterDropdown(fallbackCharacters);
        return fallbackCharacters;
    } else {
        console.warn('Character Distributor UI: No characters available from any source');
        // Add a placeholder option when no characters are available
        const selectElement = $('#share_character');
        selectElement.empty();
        selectElement.append($('<option></option>')
            .attr('value', '')
            .text('No characters available'));
        return null;
    }
}

/**
 * Populate character dropdown from data
 * @param {Array} characters - Array of character objects
 */
export function populateCharacterDropdown(characters) {
    const selectElement = $('#share_character');
    selectElement.empty();
    
    if (!Array.isArray(characters) || characters.length === 0) {
        console.log('Character Distributor UI: No characters found');
        selectElement.append($('<option></option>')
            .attr('value', '')
            .text('No characters available'));
        return;
    }
    
    console.log(`Character Distributor UI: Loaded ${characters.length} characters`);
    
    // Sort characters by name
    characters.sort((a, b) => {
        const nameA = a.name || 'Unknown';
        const nameB = b.name || 'Unknown';
        return nameA.localeCompare(nameB);
    });
    
    // Now populate the dropdown
    characters.forEach(character => {
        // Add defensive checks for expected properties
        const name = character.name || 'Unknown Character';
        const avatarUrl = character.filename || character.avatar || '';
        
        if (avatarUrl) {
            selectElement.append($('<option></option>')
                .attr('value', avatarUrl)
                .text(name));
        }
    });
} 