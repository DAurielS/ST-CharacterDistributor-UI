// UI Extension for Character Distributor
// This extension provides the user interface for configuring and interacting with the server plugin

// Import SillyTavern functions
import { extension_settings, getContext, loadExtensionSettings } from "../../../extensions.js";
import { saveSettingsDebounced, getRequestHeaders, eventSource, event_types, getCharacters } from "../../../../script.js";
import { getTagsList, getTagKeyForEntity, tag_map, tags } from "../../../tags.js";

// Extension metadata
const MODULE_NAME = 'ST-CharacterDistributor-UI';
const extensionFolderPath = `/scripts/extensions/third-party/${MODULE_NAME}`;

// Default settings
const defaultSettings = {
    dropboxAppKey: '',
    dropboxAppSecret: '',
    autoSync: true,
    syncInterval: 1800, // 30 minutes
    excludeTags: ['Private']
};

// Variables to track loading state
let isLoadingCharacters = false;
let characterLoadDebounceTimer = null;
let charactersLoaded = false;  // New flag to track if initial loading has happened

// Add a new property to store the current authorization details with refresh token support
let authData = {
    accessToken: null,
    refreshToken: null,
    expiresIn: null,
    tokenType: null
};

// Initialize extension settings if needed
function loadSettings() {
    console.log('Character Distributor UI: Loading settings');
    
    // Make sure the module settings object exists
    if (!extension_settings[MODULE_NAME]) {
        console.log('Character Distributor UI: Creating empty settings object');
        extension_settings[MODULE_NAME] = {};
    }
    
    console.log('Character Distributor UI: Current settings keys:', Object.keys(extension_settings[MODULE_NAME]));
    
    // Check if settings are empty, apply defaults if needed
    if (Object.keys(extension_settings[MODULE_NAME]).length === 0) {
        console.log('Character Distributor UI: Applying default settings');
        Object.assign(extension_settings[MODULE_NAME], defaultSettings);
        saveSettingsDebounced();
    }
    
    // Log current settings for debugging
    console.log('Character Distributor UI: App Key exists:', !!extension_settings[MODULE_NAME].dropboxAppKey);
    console.log('Character Distributor UI: App Secret exists:', !!extension_settings[MODULE_NAME].dropboxAppSecret);
    console.log('Character Distributor UI: Auto sync:', extension_settings[MODULE_NAME].autoSync);
    console.log('Character Distributor UI: Sync interval:', extension_settings[MODULE_NAME].syncInterval);
    
    if (extension_settings[MODULE_NAME].dropboxAppKey) {
        console.log('Character Distributor UI: App Key length:', extension_settings[MODULE_NAME].dropboxAppKey.length);
    }
    
    if (extension_settings[MODULE_NAME].dropboxAppSecret) {
        console.log('Character Distributor UI: App Secret length:', extension_settings[MODULE_NAME].dropboxAppSecret.length);
    }
    
    // Update UI with current settings
    try {
        $('#dropbox_app_key').val(extension_settings[MODULE_NAME].dropboxAppKey || '');
        $('#dropbox_app_secret').val(extension_settings[MODULE_NAME].dropboxAppSecret || '');
        $('#auto_sync').prop('checked', extension_settings[MODULE_NAME].autoSync || false);
        
        // Handle sync interval calculation (convert from seconds to minutes for display)
        const syncIntervalMinutes = extension_settings[MODULE_NAME].syncInterval
            ? Math.floor(extension_settings[MODULE_NAME].syncInterval / 60)
            : defaultSettings.syncInterval / 60;
            
        $('#sync_interval').val(syncIntervalMinutes);
        
        // Handle exclude tags (array to string)
        const excludeTags = extension_settings[MODULE_NAME].excludeTags || [];
        $('#exclude_tags').val(excludeTags.join(', '));
        
        console.log('Character Distributor UI: UI updated with settings');
    } catch (error) {
        console.error('Character Distributor UI: Error updating UI with settings:', error);
    }
    
    // Check server status to update UI with auth status
    checkServerStatus();
}

// Save settings from UI inputs
function saveSettings() {
    console.log('Character Distributor UI: Saving settings...');
    const settings = extension_settings[MODULE_NAME];
    
    Object.assign(settings, {
        dropboxAppKey: $('#dropbox_app_key').val(),
        dropboxAppSecret: $('#dropbox_app_secret').val(),
        autoSync: $('#auto_sync').prop('checked'),
        syncInterval: parseInt($('#sync_interval').val()) * 60,
        excludeTags: $('#exclude_tags').val().split(',').map(tag => tag.trim()).filter(tag => tag.length > 0)
    });
    
    saveSettingsDebounced();
    
    // Send settings to server plugin
    sendSettingsToServer();
}

// Send settings to server plugin
async function sendSettingsToServer() {
    try {
        console.log('Character Distributor UI: Sending settings to server...');
        
        // Create a clean copy of the settings to send
        const settingsToSend = JSON.parse(JSON.stringify(extension_settings[MODULE_NAME]));
        
        // Log the settings we're about to send - sanitize by showing only key names and types for security
        const sanitizedSettings = {};
        for (const [key, value] of Object.entries(settingsToSend)) {
            if (key.toLowerCase().includes('key') || key.toLowerCase().includes('secret')) {
                sanitizedSettings[key] = value ? `[${typeof value}:${String(value).length} chars]` : 'empty';
            } else {
                sanitizedSettings[key] = value;
            }
        }
        console.log('Character Distributor UI: Sending settings:', JSON.stringify(sanitizedSettings));
        
        // Check if we have any settings to send
        if (Object.keys(settingsToSend).length === 0) {
            console.warn('Character Distributor UI: Settings object is empty');
            toastr.warning('Settings object is empty', 'Warning');
        }
        
        // Get request headers and explicitly set Content-Type
        const headers = getRequestHeaders();
        headers['Content-Type'] = 'application/json';
        
        // Log headers (but sanitize any auth-related headers)
        const sanitizedHeaders = {...headers};
        for (const [key, value] of Object.entries(sanitizedHeaders)) {
            if (key.toLowerCase().includes('auth')) {
                sanitizedHeaders[key] = '[REDACTED]';
            }
        }
        console.log('Character Distributor UI: Request headers:', JSON.stringify(sanitizedHeaders));
        
        // Make the API call with timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10-second timeout
        
        try {
            const response = await fetch('/api/plugins/character-distributor/settings', {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(settingsToSend),
                signal: controller.signal
            });
            
            // Clear timeout since the request completed
            clearTimeout(timeoutId);
            
            // Log response status
            console.log('Character Distributor UI: Settings API response status:', response.status, response.statusText);
            
            if (response.ok) {
                console.log('Character Distributor UI: Settings sent to server plugin successfully');
                toastr.success('Settings saved and sent to server plugin');
                
                // Check if response has content
                try {
                    const responseText = await response.text();
                    if (responseText) {
                        try {
                            const responseData = JSON.parse(responseText);
                            console.log('Character Distributor UI: Server response:', responseData);
                        } catch (jsonError) {
                            console.log('Character Distributor UI: Server response (plain text):', responseText);
                        }
                    } else {
                        console.log('Character Distributor UI: Server returned empty response');
                    }
                } catch (responseError) {
                    console.warn('Character Distributor UI: Could not read server response', responseError);
                }
                
                return true; // Return true to indicate success
            } else {
                let errorMessage = `Failed to send settings (Status: ${response.status})`;
                
                try {
                    // Try to parse error response
                    const errorText = await response.text();
                    console.error('Character Distributor UI: Error response text:', errorText);
                    
                    try {
                        const errorData = JSON.parse(errorText);
                        errorMessage = errorData.error || errorMessage;
                        console.error('Character Distributor UI: Error response data:', errorData);
                    } catch (jsonError) {
                        console.error('Character Distributor UI: Could not parse error response as JSON');
                    }
                } catch (textError) {
                    console.error('Character Distributor UI: Could not read error response text', textError);
                }
                
                console.error(`Character Distributor UI: Failed to send settings to server: ${errorMessage}`);
                toastr.error(errorMessage, 'Settings Error');
                
                // Wait a moment then try the echo endpoint for diagnostics
                setTimeout(testEchoEndpoint, 1000);
                
                return false; // Return false to indicate failure
            }
        } catch (fetchError) {
            // Always clear the timeout to prevent memory leaks
            clearTimeout(timeoutId);
            
            // Handle abort/timeout separately
            if (fetchError.name === 'AbortError') {
                console.error('Character Distributor UI: Request timed out after 10 seconds');
                toastr.error('Request timed out. Server not responding.', 'Timeout Error');
            } else {
                console.error('Character Distributor UI: Fetch error:', fetchError.message);
                toastr.error(`Network error: ${fetchError.message}`, 'Connection Error');
            }
            
            throw fetchError; // Rethrow for outer try/catch
        }
    } catch (error) {
        console.error('Character Distributor UI: Error sending settings to server plugin:', error);
        toastr.error('Error sending settings to server plugin: ' + (error.message || 'Unknown error'));
        return false; // Return false to indicate failure
    }
}

// Test the echo endpoint to diagnose request handling issues
async function testEchoEndpoint() {
    try {
        console.log('Character Distributor UI: Testing echo endpoint...');
        
        // Create a test payload
        const testPayload = {
            test: true,
            timestamp: Date.now(),
            settings: extension_settings[MODULE_NAME]
        };
        
        // Set up headers with explicit Content-Type
        const headers = getRequestHeaders();
        headers['Content-Type'] = 'application/json';
        
        const response = await fetch('/api/plugins/character-distributor/echo', {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(testPayload)
        });
        
        if (response.ok) {
            const result = await response.json();
            console.log('Character Distributor UI: Echo test successful', result);
            toastr.info('Echo test successful, check console for details');
        } else {
            console.error('Character Distributor UI: Echo test failed, status:', response.status);
            console.error('Character Distributor UI: Response text:', await response.text());
            toastr.error('Echo test failed, check console for details');
        }
    } catch (error) {
        console.error('Character Distributor UI: Error testing echo endpoint', error);
        toastr.error('Error testing echo endpoint');
    }
}

// Add a function to manually check auth status from server
async function refreshAuthStatus() {
    console.log('Character Distributor UI: Refreshing authentication status');
    
    // Update UI to show operation in progress
    $('#auth_status').text('Checking auth status...');
    $('#refresh_auth_status').prop('disabled', true);
    
    try {
        const response = await fetch('/api/plugins/character-distributor/status', {
            headers: getRequestHeaders()
        });
        
        if (response.ok) {
            const status = await response.json();
            console.log('Auth status response:', status);
            
            if (status.authenticated) {
                $('#auth_status').text('Authenticated');
                $('#auth_status').addClass('success').removeClass('error');
                toastr.success('Authentication status refreshed');
            } else {
                $('#auth_status').text('Not authenticated');
                $('#auth_status').removeClass('success error');
                toastr.info('Not authenticated with Dropbox');
            }
            
            updateServerStatus(status);
        } else {
            console.error('Character Distributor UI: Auth status check failed');
            toastr.error('Failed to check authentication status');
        }
    } catch (error) {
        console.error('Character Distributor UI: Error checking auth status', error);
        toastr.error('Error checking authentication status');
    } finally {
        $('#refresh_auth_status').prop('disabled', false);
    }
}

// Handle manual token submission
async function submitManualToken() {
    console.log('Character Distributor UI: Processing manual token submission');
    
    // Get the token from the textarea
    const accessToken = $('#manual_access_token').val().trim();
    
    if (!accessToken) {
        toastr.error('Please enter an access token', 'Missing Token');
        return;
    }
    
    if (accessToken.length < 10) {
        toastr.error('Token is too short to be valid', 'Invalid Token');
        return;
    }
    
    // Get app key from settings
    const appKey = $('#dropbox_app_key').val();
    const appSecret = $('#dropbox_app_secret').val();
    
    if (!appKey || !appSecret) {
        toastr.error('App Key and Secret must be configured before submitting token', 'Configuration Error');
        return;
    }
    
    // Save the settings first
    extension_settings[MODULE_NAME].dropboxAppKey = appKey;
    extension_settings[MODULE_NAME].dropboxAppSecret = appSecret;
    saveSettingsDebounced();
    await sendSettingsToServer();
    
    console.log('Character Distributor UI: Saved app key and secret to settings');
    
    // Update UI
    $('#auth_status').text('Validating token...');
    $('#submit_manual_token').prop('disabled', true);
    
    try {
        // Store the token in authData
        authData = {
            accessToken: accessToken,
            refreshToken: null,
            expiresIn: 14400, // Default to 4 hours
            tokenType: 'bearer'
        };
        
        // Send the token to the server
        await sendTokenToServer();
        
        // Clear the textarea
        $('#manual_access_token').val('');
    } catch (error) {
        console.error('Character Distributor UI: Error processing manual token', error);
        toastr.error('Error processing manual token');
        $('#auth_status').text('Token validation failed').removeClass('success').addClass('error');
    } finally {
        $('#submit_manual_token').prop('disabled', false);
    }
}

// Initialize UI components and event handlers
async function initializeUI() {
    // Load settings HTML
    const settingsHtml = await fetch(`${extensionFolderPath}/settings.html`).then(response => response.text());
    $('#extensions_settings2').append(settingsHtml);
    
    // Initialize event handlers
    $('#save_settings').on('click', saveSettings);
    $('#force_sync').on('click', triggerSync);
    $('#dropbox_auth').on('click', authenticateWithDropbox);
    $('#dropbox_logout').on('click', logoutFromDropbox);
    $('#get_share_link').on('click', generateShareLink);
    $('#copy_link').on('click', copyShareLink);
    $('#submit_manual_token').on('click', submitManualToken);
    $('#refresh_auth_status').on('click', refreshAuthStatus);
    $('#check_diagnostics').on('click', checkDiagnostics);
    $('#test_settings_api').on('click', testEchoEndpoint);
    
    // Load current settings
    loadSettings();
    
    // Check server plugin status
    checkServerStatus();
    
    // Listen for Dropbox auth callback
    window.addEventListener('message', handleDropboxAuthCallback);
    
    // Setup event listeners if available
    if (typeof eventSource !== 'undefined' && typeof event_types !== 'undefined') {
        console.log('Character Distributor UI: Setting up event listeners for SillyTavern events');

        // Check each event type exists before registering listeners
        // Known event in SillyTavern: CHARACTER_EDITED
        if (event_types.CHARACTER_EDITED) {
            eventSource.on(event_types.CHARACTER_EDITED, function() {
                console.log('Character Distributor UI: Event character_edited triggered, refreshing character list');
                refreshCharacterList();
            });
        } else {
            console.warn('Character Distributor UI: CHARACTER_EDITED event type not found');
        }

        // Known event in SillyTavern: CHARACTER_DELETED 
        if (event_types.CHARACTER_DELETED) {
            eventSource.on(event_types.CHARACTER_DELETED, function() {
                console.log('Character Distributor UI: Event character_deleted triggered, refreshing character list');
                refreshCharacterList();
            });
        } else {
            console.warn('Character Distributor UI: CHARACTER_DELETED event type not found');
        }
        
        // Known event in SillyTavern: CHARACTER_DUPLICATED (instead of CHARACTER_CREATED)
        if (event_types.CHARACTER_DUPLICATED) {
            eventSource.on(event_types.CHARACTER_DUPLICATED, function() {
                console.log('Character Distributor UI: Event character_duplicated triggered, refreshing character list');
                refreshCharacterList();
            });
        } else {
            console.warn('Character Distributor UI: CHARACTER_DUPLICATED event type not found');
        }
    } else {
        console.warn('Character Distributor UI: eventSource or event_types not available, character list will not auto-refresh');
    }

    // Initial character list loading
    await loadCharacterList();
    charactersLoaded = true;
}

// Initialize extension when jQuery is ready
jQuery(async () => {
    await initializeUI();
    
    // Set up refresh interval for server status check
    setInterval(checkServerStatus, 60000); // Check every minute

    // Check for auth token in localStorage after a short delay to ensure everything is loaded
    console.log('Character Distributor UI: Setting up localStorage token check...');
    setTimeout(async () => {
        console.log('Character Distributor UI: Running delayed localStorage token check...');
        try {
            await checkLocalStorageForToken();
        } catch (error) {
            console.error('Character Distributor UI: Error during localStorage token check:', error);
        }
    }, 2000);
    
    console.log('Character Distributor UI: Extension initialized');
});

// Function to refresh character list with simple debouncing
function refreshCharacterList() {
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

// Get character tags using SillyTavern's native tag system
function getCharacterTags(characterIdentifier) {
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

// Check if a character has any of the specified excluded tags
function characterHasExcludedTags(character, excludeTags) {
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

// Filter characters based on SillyTavern tags using a more reliable approach
async function filterCharactersByTags(excludeTags) {
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

// Trigger synchronization with Dropbox
async function triggerSync() {
    // Update UI to show sync is running
    $('#sync_status').text('Sync running...');
    
    // Get excluded tags from settings
    const excludeTags = $('#exclude_tags').val().split(',').map(tag => tag.trim()).filter(tag => tag);
    console.log('Character Distributor UI: Excluded tags:', excludeTags);
    
    try {
        // Filter characters based on SillyTavern tags
        const { excludedCharacters, characterFiles } = await filterCharactersByTags(excludeTags);
        
        // Log detailed information for debugging
        console.log(`Character Distributor UI: Will share ${characterFiles.length} characters`);
        console.log(`Character Distributor UI: Will exclude ${excludedCharacters.length} characters due to tags`);
        
        if (excludedCharacters.length > 0) {
            console.log('Character Distributor UI: Excluded characters:', excludedCharacters);
        }
        
        // Get proper request headers and add Content-Type
        const headers = getRequestHeaders();
        headers['Content-Type'] = 'application/json';
        
        // Now send the list of allowed characters to the server
        fetch('/api/plugins/character-distributor/sync', {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({
                allowedCharacterFiles: characterFiles, // Send list of files that are allowed
                excludeTags: excludeTags, // Also send excluded tags for secondary filtering
                excludedCharacters: excludedCharacters // Explicitly send the excluded character list
            })
        })
        .then(response => response.json())
        .then(data => {
            // Update UI with sync results including removed files
            updateSyncStatus({
                ...data,
                message: data.success ? 
                    `Synced ${data.count} characters` + (data.removed ? `, removed ${data.removed}` : '') : 
                    'Sync failed'
            });
            
            // Log the response for debugging
            console.log('Character Distributor UI: Sync response:', data);
            
            // Show a toast with more details if available
            if (data.success) {
                const details = [];
                if (data.count !== undefined) details.push(`Synced: ${data.count}`);
                if (data.added !== undefined) details.push(`Added: ${data.added}`);
                if (data.removed !== undefined) details.push(`Removed: ${data.removed}`);
                if (data.excluded !== undefined) details.push(`Excluded: ${data.excluded}`);
                
                toastr.success(details.join(' | '), 'Sync Complete');
            } else {
                toastr.error(data.error || 'Unknown error occurred', 'Sync Failed');
            }
        })
        .catch(error => {
            console.error('Character Distributor UI: Error during sync', error);
            updateSyncStatus({ success: false, message: 'Sync failed. Check server logs.' });
            toastr.error('Error during sync operation. Check the console for details.');
        });
    } catch (error) {
        console.error('Character Distributor UI: Error during sync preparation', error);
        updateSyncStatus({ success: false, message: 'Error preparing sync. Check console logs.' });
        toastr.error('Error preparing sync. Check the console for details.');
    }
}

// Check if server plugin is running
async function checkServerStatus() {
    console.log('Character Distributor UI: Checking server status...');
    
    try {
        // Add a timeout to the fetch to prevent hanging if server is not responding
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
        
        try {
            const response = await fetch('/api/plugins/character-distributor/status', {
                headers: getRequestHeaders(),
                signal: controller.signal
            });
            
            // Clear the timeout since the request completed
            clearTimeout(timeoutId);
            
            if (response.ok) {
                const status = await response.json();
                console.log('Character Distributor UI: Server status', status);
                
                // Add more detailed logging
                console.log('Character Distributor UI: Server running:', status.running);
                console.log('Character Distributor UI: Authentication status:', status.authenticated);
                console.log('Character Distributor UI: Last sync:', status.lastSync);
                console.log('Character Distributor UI: Shared characters:', status.sharedCharacters);
                
                updateServerStatus(status);
                
                // Update the auth status display based on the response
                if (status.hasOwnProperty('authenticated')) {
                    $('#auth_status').text(status.authenticated ? 'Authenticated' : 'Not authenticated');
                    if (status.authenticated) {
                        $('#auth_status').addClass('success').removeClass('error');
                    } else {
                        $('#auth_status').removeClass('success error');
                    }
                }
                
                return status; // Return the status for potential further processing
            } else {
                console.error(`Character Distributor UI: Server status check failed with status ${response.status}`);
                
                // Try to get more details from the response
                try {
                    const errorText = await response.text();
                    console.error('Character Distributor UI: Error details:', errorText);
                } catch (textError) {
                    console.error('Character Distributor UI: Could not read error details');
                }
                
                updateServerStatus({ running: false });
                return { running: false };
            }
        } catch (fetchError) {
            // Make sure to clear the timeout to prevent memory leaks
            clearTimeout(timeoutId);
            
            // Handle different error types
            if (fetchError.name === 'AbortError') {
                console.error('Character Distributor UI: Server status check timed out after 5 seconds');
                updateServerStatus({ running: false, timedOut: true });
                return { running: false, timedOut: true };
            } else {
                throw fetchError; // Re-throw for the outer catch
            }
        }
    } catch (error) {
        console.error('Character Distributor UI: Error checking server status:', error.message);
        console.error(error);
        updateServerStatus({ running: false, error: error.message });
        return { running: false, error: error.message };
    }
}

// Update server status in UI
function updateServerStatus(status) {
    const serverStatusElement = $('#server_status');
    
    if (status.running) {
        serverStatusElement.text('Server plugin: Running');
        serverStatusElement.addClass('success').removeClass('error');
        $('#last_sync').text(`Last sync: ${status.lastSync || 'Never'}`);
        $('#shared_characters').text(`Shared characters: ${status.sharedCharacters || 0}`);
        
        // Update auth status if available
        if (status.hasOwnProperty('authenticated')) {
            $('#auth_status').text(status.authenticated ? 'Authenticated' : 'Not authenticated');
            if (status.authenticated) {
                $('#auth_status').addClass('success').removeClass('error');
            } else {
                $('#auth_status').removeClass('success error');
            }
        }
    } else {
        let statusText = 'Server plugin: Not running';
        
        // Add more details if available
        if (status.timedOut) {
            statusText = 'Server plugin: Not responding (timeout)';
        } else if (status.error) {
            statusText = `Server plugin: Error (${status.error})`;
        }
        
        serverStatusElement.text(statusText);
        serverStatusElement.addClass('error').removeClass('success');
        
        // Clear other status displays
        $('#last_sync').text('Last sync: N/A');
        $('#shared_characters').text('Shared characters: 0');
        $('#auth_status').text('Authentication status unknown');
        $('#auth_status').removeClass('success error');
        
        // Show a diagnostic helper message if this is likely a first-time setup
        if (!localStorage.getItem('character_distributor_shown_setup_help')) {
            setTimeout(() => {
                toastr.info(
                    'If this is your first time using Character Distributor, make sure you have installed and activated the server plugin.<br><br>' +
                    'The server plugin must be installed separately from the UI extension.<br><br>' +
                    'Check the README.md file for installation instructions.',
                    'Server Plugin Not Detected',
                    { timeOut: 15000, extendedTimeOut: 5000, closeButton: true, tapToDismiss: true }
                );
                localStorage.setItem('character_distributor_shown_setup_help', 'true');
            }, 2000);
        }
    }
}

// Update sync status in UI
function updateSyncStatus(result) {
    const syncStatusElement = $('#sync_status');
    const lastSyncElement = $('#last_sync');
    const sharedCharactersElement = $('#shared_characters');
    
    if (result.success) {
        syncStatusElement.html(`<span style="color: green;">✓ ${result.message || 'Sync completed successfully'}</span>`);
        lastSyncElement.text(`Last sync: ${new Date().toLocaleString()}`);
        
        // If we have a count of shared characters
        if (result.total !== undefined || result.count !== undefined) {
            const total = result.total || result.count || 0;
            sharedCharactersElement.text(`Shared characters: ${total}`);
            
            // Add details about removed characters if available
            if (result.removed !== undefined && result.removed > 0) {
                sharedCharactersElement.append(`<br><span style="color: orange;">(${result.removed} characters removed due to tag exclusion)</span>`);
            }
        }
    } else {
        syncStatusElement.html(`<span style="color: red;">✗ ${result.message || 'Sync failed'}</span>`);
    }
}

// Authenticate with Dropbox using OAuth2 PKCE flow - now includes refresh token handling
async function authenticateWithDropbox() {
    try {
        console.log('Character Distributor UI: Starting Dropbox authentication');
        
        // Clear any previous auth data
        authData = {
            accessToken: null,
            refreshToken: null,
            expiresIn: null,
            tokenType: null
        };
        
        // Update UI to show auth in progress
        $('#auth_status').text('Authentication in progress...');
        
        // Get app key from settings
        const appKey = $('#dropbox_app_key').val();
        const appSecret = $('#dropbox_app_secret').val();
        
        if (!appKey) {
            toastr.error('App Key must be configured before authenticating', 'Authentication Error');
            console.error('Character Distributor UI: Missing Dropbox App Key');
            $('#auth_status').text('Not authenticated').removeClass('success').addClass('error');
            return;
        }
        
        if (!appSecret) {
            toastr.error('App Secret must be configured before authenticating', 'Authentication Error');
            console.error('Character Distributor UI: Missing Dropbox App Secret');
            $('#auth_status').text('Not authenticated').removeClass('success').addClass('error');
            return;
        }
        
        // Save the settings before continuing
        extension_settings[MODULE_NAME].dropboxAppKey = appKey;
        extension_settings[MODULE_NAME].dropboxAppSecret = appSecret;
        saveSettingsDebounced();
        
        console.log('Character Distributor UI: Saved app key and secret to settings');
        console.log('Character Distributor UI: App Key length:', appKey.length);
        console.log('Character Distributor UI: App Secret length:', appSecret.length);
        
        // Ensure settings are sent to server before proceeding
        await sendSettingsToServer();
        
        // Generate a code verifier and challenge for PKCE (improved security over implicit flow)
        const codeVerifier = generateCodeVerifier();
        const codeChallenge = await generateCodeChallenge(codeVerifier);
        
        // Store code verifier in sessionStorage for later use
        sessionStorage.setItem('dropbox_code_verifier', codeVerifier);
        console.log('Character Distributor UI: Stored code verifier in sessionStorage');
        
        // Construct the authorization URL with code challenge
        const redirectUri = window.location.origin + '/scripts/extensions/third-party/ST-CharacterDistributor-UI/public/oauth_callback.html';
        console.log('Character Distributor UI: Redirect URI:', redirectUri);
        
        const authUrl = `https://www.dropbox.com/oauth2/authorize?client_id=${appKey}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&code_challenge=${codeChallenge}&code_challenge_method=S256&token_access_type=offline`; // Request refresh token with offline access
        console.log('Character Distributor UI: Authorization URL length:', authUrl.length);
        
        // Store the app key in sessionStorage for the callback page to use
        sessionStorage.setItem('dropbox_app_key', appKey);
        
        // Open the authorization URL in a new tab/window
        const authWindow = window.open(authUrl, '_blank', 'width=800,height=600');
        
        if (!authWindow) {
            console.error('Character Distributor UI: Failed to open auth window - popup blocked?');
            toastr.error('Failed to open authentication window. Please allow popups for this site.', 'Authentication Error');
            $('#auth_status').text('Authentication failed - popup blocked').removeClass('success').addClass('error');
            return;
        }
        
        console.log('Character Distributor UI: Opened auth window, waiting for response via postMessage');
        // We're now relying on the postMessage communication or localStorage fallback
        // with the callback page rather than polling, which was unreliable
        
        // Set a reasonable timeout for the overall process (3 minutes)
        setTimeout(() => {
            // Only show timeout message if we're still in the "Authentication in progress" state
            if ($('#auth_status').text() === 'Authentication in progress...') {
                console.warn('Character Distributor UI: Auth process timed out after 3 minutes');
                $('#auth_status').text('Authentication timed out').removeClass('success').addClass('error');
                toastr.warning('Authentication process timed out after 3 minutes', 'Authentication Timeout');
            }
        }, 180000);
    } catch (error) {
        console.error('Character Distributor UI: Authentication error', error);
        $('#auth_status').text('Authentication error').removeClass('success').addClass('error');
        toastr.error(`Error during authentication process: ${error.message}`, 'Authentication Failed');
    }
}

// Exchange authorization code for access and refresh tokens
async function exchangeCodeForToken(code, appKey, redirectUri) {
    try {
        console.log('Character Distributor UI: Exchanging authorization code for tokens');
        
        // Get the code verifier from sessionStorage
        const codeVerifier = sessionStorage.getItem('dropbox_code_verifier');
        
        if (!codeVerifier) {
            console.error('Character Distributor UI: No code verifier found');
            $('#auth_status').text('Authentication failed').removeClass('success').addClass('error');
            toastr.error('Authentication session expired or invalid', 'Authentication Failed');
            return;
        }
        
        // Prepare the token request
        const tokenRequestBody = new URLSearchParams();
        tokenRequestBody.append('code', code);
        tokenRequestBody.append('grant_type', 'authorization_code');
        tokenRequestBody.append('client_id', appKey);
        tokenRequestBody.append('redirect_uri', redirectUri);
        tokenRequestBody.append('code_verifier', codeVerifier);
        
        // Make the token request to Dropbox
        const tokenResponse = await fetch('https://api.dropboxapi.com/oauth2/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: tokenRequestBody.toString()
        });
        
        if (!tokenResponse.ok) {
            const errorText = await tokenResponse.text();
            console.error('Character Distributor UI: Token request failed', tokenResponse.status, errorText);
            $('#auth_status').text('Token request failed').removeClass('success').addClass('error');
            toastr.error(`Token request failed: ${tokenResponse.status}`, 'Authentication Failed');
            return;
        }
        
        // Parse the token response
        const tokenData = await tokenResponse.json();
        
        if (!tokenData.access_token) {
            console.error('Character Distributor UI: No access token in response', tokenData);
            $('#auth_status').text('No access token received').removeClass('success').addClass('error');
            toastr.error('No access token received from Dropbox', 'Authentication Failed');
            return;
        }
        
        console.log('Character Distributor UI: Received access token');
        console.log('Character Distributor UI: Refresh token received:', !!tokenData.refresh_token);
        
        // Store the tokens
        authData = {
            accessToken: tokenData.access_token,
            refreshToken: tokenData.refresh_token || null,
            expiresIn: tokenData.expires_in || 14400, // Default to 4 hours if not provided
            tokenType: tokenData.token_type || 'bearer'
        };
        
        // Send the tokens to the server plugin
        await sendTokenToServer();
    } catch (error) {
        console.error('Character Distributor UI: Error exchanging code for token', error);
        $('#auth_status').text('Token exchange error').removeClass('success').addClass('error');
        toastr.error('Error exchanging authorization code for access token', 'Authentication Failed');
    }
}

// Generate a code verifier for PKCE
function generateCodeVerifier() {
    const array = new Uint8Array(32);
    window.crypto.getRandomValues(array);
    return Array.from(array, dec => ('0' + dec.toString(16)).slice(-2)).join('');
}

// Generate a code challenge from code verifier
async function generateCodeChallenge(verifier) {
    const encoder = new TextEncoder();
    const data = encoder.encode(verifier);
    const hash = await window.crypto.subtle.digest('SHA-256', data);
    return btoa(String.fromCharCode(...new Uint8Array(hash)))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
}

// Send the token to the Character Distributor server plugin
async function sendTokenToServer() {
    try {
        console.log('Character Distributor UI: Sending token to server');
        
        // Update UI to show token being sent
        $('#auth_status').text('Sending token to server...');
        
        // Validate authData
        if (!authData || !authData.accessToken) {
            console.error('Character Distributor UI: No valid token data available');
            $('#auth_status').text('Authentication failed: No valid token').removeClass('success').addClass('error');
            toastr.error('No valid authentication token available', 'Authentication Failed');
            return;
        }
        
        // Prepare the request
        const requestBody = {
            accessToken: authData.accessToken,
            tokenType: authData.tokenType || 'bearer',
            expiresIn: authData.expiresIn || 14400,
            refreshToken: authData.refreshToken
        };
        
        // Log sanitized details
        console.log('Character Distributor UI: Token length:', authData.accessToken?.length || 0);
        console.log('Character Distributor UI: Token type:', authData.tokenType || 'bearer');
        console.log('Character Distributor UI: Expires in:', authData.expiresIn || 14400);
        console.log('Character Distributor UI: Refresh token provided:', !!authData.refreshToken);
        
        // Check if the app keys are set in the UI/settings
        const appKey = $('#dropbox_app_key').val() || extension_settings[MODULE_NAME].dropboxAppKey;
        const appSecret = $('#dropbox_app_secret').val() || extension_settings[MODULE_NAME].dropboxAppSecret;
        
        if (!appKey || !appSecret) {
            console.error('Character Distributor UI: App key or secret is missing');
            $('#auth_status').text('Authentication failed: Missing app credentials').removeClass('success').addClass('error');
            toastr.error('Dropbox App Key and Secret must be configured', 'Authentication Failed');
            return;
        }
        
        // Ensure settings are saved and sent to server before proceeding
        extension_settings[MODULE_NAME].dropboxAppKey = appKey;
        extension_settings[MODULE_NAME].dropboxAppSecret = appSecret;
        saveSettingsDebounced();
        
        try {
            console.log('Character Distributor UI: Sending settings to server before authentication');
            const settingsSent = await sendSettingsToServer();
            if (!settingsSent) {
                console.error('Character Distributor UI: Failed to send settings to server');
                $('#auth_status').text('Authentication failed: Could not configure server').removeClass('success').addClass('error');
                toastr.error('Failed to send app credentials to server', 'Authentication Failed');
                return;
            }
        } catch (settingsError) {
            console.error('Character Distributor UI: Error sending settings to server:', settingsError);
            $('#auth_status').text('Authentication failed: Configuration error').removeClass('success').addClass('error');
            toastr.error('Error configuring server with app credentials', 'Authentication Failed');
            return;
        }
        
        // Get headers and ensure content type is set
        const headers = {
            'Content-Type': 'application/json',
            ...getRequestHeaders()
        };
        
        // Set up request with timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000); // 15-second timeout
        
        try {
            // Send the token to the server plugin
            const response = await fetch('/api/plugins/character-distributor/auth', {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(requestBody),
                signal: controller.signal
            });
            
            // Clear timeout since request completed
            clearTimeout(timeoutId);
            
            // Log full response details
            console.log('Character Distributor UI: Auth response status:', response.status);
            console.log('Character Distributor UI: Auth response status text:', response.statusText);
            
            // Handle the response
            if (response.ok) {
                let data;
                try {
                    const responseText = await response.text();
                    console.log('Character Distributor UI: Auth response text:', responseText);
                    data = responseText ? JSON.parse(responseText) : { success: true };
                } catch (parseError) {
                    console.warn('Character Distributor UI: Could not parse response as JSON:', parseError);
                    data = { success: true }; // Assume success if we can't parse the response
                }
                
                if (data.success) {
                    console.log('Character Distributor UI: Token sent successfully');
                    $('#auth_status').text('Authenticated').addClass('success').removeClass('error');
                    toastr.success('Successfully authenticated with Dropbox');
                    
                    // Store the token in localStorage for persistence
                    storeAuthToken(authData.accessToken, authData.tokenType, authData.expiresIn, authData.refreshToken);
                    
                    // Check server status after a short delay to confirm
                    setTimeout(refreshAuthStatus, 2000);
                    return true;
                } else {
                    console.error('Character Distributor UI: Server returned success=false:', data.error);
                    $('#auth_status').text(`Authentication failed: ${data.error || 'Unknown server error'}`).removeClass('success').addClass('error');
                    toastr.error(data.error || 'Unknown server error', 'Authentication Failed');
                    return false;
                }
            } else {
                try {
                    // Try to parse error response
                    const errorText = await response.text();
                    let errorData;
                    let errorMessage = `Server error (${response.status})`;
                    
                    try {
                        errorData = JSON.parse(errorText);
                        console.error('Character Distributor UI: Server error response:', errorData);
                        errorMessage = errorData.error || errorMessage;
                    } catch (jsonError) {
                        // If we can't parse the error as JSON, use the text directly
                        console.error('Character Distributor UI: Server error text:', errorText);
                        errorMessage = errorText || errorMessage;
                    }
                    
                    $('#auth_status').text(`Authentication failed: ${errorMessage}`).removeClass('success').addClass('error');
                    toastr.error(errorMessage, `Authentication Failed (${response.status})`);
                    return false;
                } catch (responseError) {
                    console.error('Character Distributor UI: Error reading response:', responseError);
                    $('#auth_status').text(`Authentication failed: Server error (${response.status})`).removeClass('success').addClass('error');
                    toastr.error(`Server error (${response.status})`, 'Authentication Failed');
                    return false;
                }
            }
        } catch (fetchError) {
            // Always clear the timeout to prevent memory leaks
            clearTimeout(timeoutId);
            
            // Handle timeout errors specially
            if (fetchError.name === 'AbortError') {
                console.error('Character Distributor UI: Auth request timed out after 15 seconds');
                $('#auth_status').text('Authentication failed: Server timeout').removeClass('success').addClass('error');
                toastr.error('Server is not responding', 'Authentication Timeout');
            } else {
                console.error('Character Distributor UI: Fetch error during authentication:', fetchError);
                $('#auth_status').text(`Authentication failed: ${fetchError.message}`).removeClass('success').addClass('error');
                toastr.error(`Network error: ${fetchError.message}`, 'Authentication Failed');
            }
            
            return false;
        }
    } catch (error) {
        console.error('Character Distributor UI: Error sending token to server:', error);
        $('#auth_status').text(`Authentication failed: ${error.message || 'Unknown error'}`).removeClass('success').addClass('error');
        toastr.error(`Error: ${error.message || 'Unknown error'}`, 'Authentication Failed');
        return false;
    }
}

// Logout from Dropbox
function logoutFromDropbox() {
    fetch('/api/plugins/character-distributor/logout', {
        method: 'POST',
        headers: getRequestHeaders()
    })
    .then(response => {
        if (response.ok) {
            $('#auth_status').text('Not authenticated');
            $('#auth_status').removeClass('success error');
            toastr.success('Logged out from Dropbox');
        } else {
            toastr.error('Failed to logout from Dropbox');
        }
    })
    .catch(error => {
        console.error('Character Distributor UI: Error logging out', error);
        toastr.error('Error logging out from Dropbox');
    });
}

// Generate share link for a character
function generateShareLink() {
    const characterId = $('#share_character').val();
    
    if (!characterId) {
        toastr.error('Please select a character');
        return;
    }
    
    fetch(`/api/plugins/character-distributor/share/${characterId}`, {
        headers: getRequestHeaders()
    })
    .then(response => response.json())
    .then(data => {
        if (data.shareLink) {
            $('#share_link').val(data.shareLink);
            $('#share_link_container').show();
            toastr.success('Share link generated');
        } else {
            toastr.error('Failed to generate share link');
        }
    })
    .catch(error => {
        console.error('Character Distributor UI: Error generating share link', error);
        toastr.error('Error generating share link');
    });
}

// Copy share link to clipboard
function copyShareLink() {
    const shareLink = $('#share_link').val();
    
    if (shareLink) {
        navigator.clipboard.writeText(shareLink)
            .then(() => toastr.success('Link copied to clipboard'))
            .catch(() => toastr.error('Failed to copy link'));
    }
}

// Load character list for sharing using SillyTavern's APIs
async function loadCharacterList() {
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

// Helper function to use fallback character sources
function useFallbackCharacters() {
    console.log('Character Distributor UI: Attempting to use fallback character sources');
    
    // Try window variables
    const fallbackCharacters = window.characters || 
        (window.charactersList) || 
        Object.values(window.chat_metadata?.characters || {});
        
    if (fallbackCharacters && Array.isArray(fallbackCharacters) && fallbackCharacters.length > 0) {
        console.log(`Character Distributor UI: Found ${fallbackCharacters.length} characters using fallback data`);
        populateCharacterDropdown(fallbackCharacters);
    } else {
        console.warn('Character Distributor UI: No characters available from any source');
        // Add a placeholder option when no characters are available
        const selectElement = $('#share_character');
        selectElement.empty();
        selectElement.append($('<option></option>')
            .attr('value', '')
            .text('No characters available'));
    }
}

// Populate character dropdown from data
function populateCharacterDropdown(characters) {
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

// Check localStorage for auth token
async function checkLocalStorageForToken() {
    // Check if there's a token in localStorage
    const accessToken = localStorage.getItem('dropbox_auth_token');
    const tokenType = localStorage.getItem('dropbox_token_type');
    const expiresIn = localStorage.getItem('dropbox_expires_in');
    const timestamp = localStorage.getItem('dropbox_auth_timestamp');
    const refreshToken = localStorage.getItem('dropbox_refresh_token');
    
    console.log('Character Distributor UI: Checking localStorage for token...');
    console.log('Token exists:', !!accessToken);
    console.log('Timestamp exists:', !!timestamp);
    console.log('Token length:', accessToken?.length || 0);
    console.log('Refresh token exists:', !!refreshToken);
    
    // Make sure we have app keys configured before trying to use the token
    const appKey = $('#dropbox_app_key').val() || extension_settings[MODULE_NAME].dropboxAppKey;
    const appSecret = $('#dropbox_app_secret').val() || extension_settings[MODULE_NAME].dropboxAppSecret;
    
    if (!appKey || !appSecret) {
        console.warn('Character Distributor UI: App Key or Secret not configured. Cannot use saved token.');
        clearLocalStorageTokens();
        return;
    }
    
    // Make sure settings are saved with the current app key/secret
    extension_settings[MODULE_NAME].dropboxAppKey = appKey;
    extension_settings[MODULE_NAME].dropboxAppSecret = appSecret;
    saveSettingsDebounced();
    
    // Make sure settings are sent to server
    try {
        console.log('Character Distributor UI: Sending settings to server before using saved token');
        await sendSettingsToServer();
    } catch (error) {
        console.error('Character Distributor UI: Error sending settings to server:', error);
        toastr.error('Could not configure server settings', 'Token Restoration Failed');
        return;
    }
    
    // If we have a token, try to use it
    if (accessToken) {
        console.log('Character Distributor UI: Found token in localStorage, attempting to use it');
        
        // Check token age if timestamp exists
        if (timestamp) {
            const tokenAge = Date.now() - parseInt(timestamp);
            const maxAge = 3600000; // 1 hour in milliseconds
            
            if (tokenAge > maxAge && !refreshToken) {
                console.warn(`Character Distributor UI: Token is old (${Math.floor(tokenAge / 60000)} minutes), skipping auto-login`);
                toastr.info('Found an old saved token but no refresh token. Please re-authenticate.', 'Authentication Needed');
                return;
            }
        }
        
        // Store in authData for use by sendTokenToServer
        authData = {
            accessToken: accessToken,
            refreshToken: refreshToken,
            expiresIn: parseInt(expiresIn || '14400'),
            tokenType: tokenType || 'bearer'
        };
        
        // Update UI
        $('#auth_status').text('Restoring saved authentication...');
        
        try {
            // Send token to server
            await sendTokenToServer();
            console.log('Character Distributor UI: Successfully restored authentication from localStorage');
            
            // Clear tokens from localStorage after successful restoration
            // This prevents auto-login if the server rejects the token next time
            clearLocalStorageTokens(); 
        } catch (error) {
            console.error('Character Distributor UI: Error sending saved token to server:', error);
            $('#auth_status').text('Failed to restore authentication').removeClass('success').addClass('error');
            toastr.error('Could not restore authentication from saved token', 'Authentication Failed');
            
            // Clear the invalid saved token
            clearLocalStorageTokens();
        }
    } else {
        console.log('Character Distributor UI: No saved token found in localStorage');
    }
}

// Clear localStorage tokens
function clearLocalStorageTokens() {
    try {
        console.log('Character Distributor UI: Clearing auth tokens from localStorage');
        
        // Get current values for logging
        const hadToken = !!localStorage.getItem('dropbox_auth_token');
        const hadRefreshToken = !!localStorage.getItem('dropbox_refresh_token');
        
        // Remove all token-related items
        localStorage.removeItem('dropbox_auth_token');
        localStorage.removeItem('dropbox_token_type');
        localStorage.removeItem('dropbox_expires_in');
        localStorage.removeItem('dropbox_auth_timestamp');
        localStorage.removeItem('dropbox_refresh_token');
        
        // Verify removal was successful
        const tokenRemoved = !localStorage.getItem('dropbox_auth_token');
        const refreshTokenRemoved = !localStorage.getItem('dropbox_refresh_token');
        
        if (!tokenRemoved || !refreshTokenRemoved) {
            console.error('Character Distributor UI: Failed to remove all tokens from localStorage');
            return false;
        }
        
        console.log('Character Distributor UI: Auth tokens cleared from localStorage');
        console.log('Character Distributor UI: Removed access token:', hadToken);
        console.log('Character Distributor UI: Removed refresh token:', hadRefreshToken);
        return true;
    } catch (error) {
        console.error('Character Distributor UI: Error clearing auth tokens from localStorage:', error);
        return false;
    }
}

// Add custom styles
const styleElement = document.createElement('style');
styleElement.textContent = `
#character_distributor_settings .success {
    color: #00aa00;
}

#character_distributor_settings .error {
    color: #ff0000;
}
`;
document.head.appendChild(styleElement);

// Check plugin diagnostics
async function checkDiagnostics() {
    console.log('Character Distributor UI: Checking diagnostics...');
    $('#check_diagnostics').prop('disabled', true);
    
    try {
        const response = await fetch('/api/plugins/character-distributor/debug', {
            headers: getRequestHeaders()
        });
        
        if (response.ok) {
            const diagnosticInfo = await response.json();
            console.log('Character Distributor UI: Diagnostics', diagnosticInfo);
            
            // Format diagnostic info as a message
            let message = '<h4>Character Distributor Diagnostics</h4>';
            message += '<pre style="text-align: left; background-color: #1a1a1a; padding: 10px; max-height: 400px; overflow-y: auto;">';
            message += JSON.stringify(diagnosticInfo, null, 2);
            message += '</pre>';
            
            // Display in custom toastr
            toastr.info(message, 'Diagnostics', { 
                timeOut: 0,
                extendedTimeOut: 0,
                closeButton: true,
                tapToDismiss: false,
                escapeHtml: false
            });
        } else {
            console.error('Character Distributor UI: Failed to get diagnostics');
            toastr.error('Failed to get diagnostics information');
        }
    } catch (error) {
        console.error('Character Distributor UI: Error checking diagnostics', error);
        toastr.error('Error checking diagnostics');
    } finally {
        $('#check_diagnostics').prop('disabled', false);
    }
}

// Store authentication token in localStorage for persistence
function storeAuthToken(accessToken, tokenType, expiresIn, refreshToken) {
    try {
        console.log('Character Distributor UI: Storing auth token in localStorage');
        
        // Validate parameters
        if (!accessToken) {
            console.error('Character Distributor UI: Cannot store null/empty token');
            return false;
        }
        
        if (typeof accessToken !== 'string') {
            console.error('Character Distributor UI: Token must be a string, got:', typeof accessToken);
            return false;
        }
        
        if (accessToken.length < 10) {
            console.warn('Character Distributor UI: Token is suspiciously short:', accessToken.length, 'chars');
        }
        
        // Store the token with clean values
        localStorage.setItem('dropbox_auth_token', accessToken);
        localStorage.setItem('dropbox_token_type', tokenType || 'bearer');
        localStorage.setItem('dropbox_expires_in', String(expiresIn || 14400));
        localStorage.setItem('dropbox_auth_timestamp', Date.now().toString());
        
        // Only store refresh token if it exists and is a string
        if (refreshToken && typeof refreshToken === 'string') {
            localStorage.setItem('dropbox_refresh_token', refreshToken);
            console.log('Character Distributor UI: Refresh token stored (length:', refreshToken.length, ')');
        } else if (refreshToken) {
            console.warn('Character Distributor UI: Invalid refresh token format, not storing');
        }
        
        // Verify storage was successful
        const storedToken = localStorage.getItem('dropbox_auth_token');
        if (storedToken !== accessToken) {
            console.error('Character Distributor UI: Token storage verification failed');
            return false;
        }
        
        console.log('Character Distributor UI: Auth token stored in localStorage successfully');
        console.log('Character Distributor UI: Token expiration set to:', new Date(Date.now() + (parseInt(expiresIn || '14400') * 1000)).toISOString());
        return true;
    } catch (error) {
        console.error('Character Distributor UI: Error storing auth token in localStorage:', error);
        return false;
    }
}

// Handle the OAuth callback message from the popup window
function handleDropboxAuthCallback(event) {
    console.log('Character Distributor UI: Received postMessage event');
    
    // Validate message source and data
    if (!event.data || typeof event.data !== 'object' || event.data.source !== 'dropbox-auth') {
        console.log('Character Distributor UI: Ignoring unrelated message event', event.data?.source || 'no source');
        return;
    }
    
    console.log('Character Distributor UI: Processing Dropbox auth callback message');
    
    try {
        // Check for error first
        if (event.data.error) {
            console.error('Character Distributor UI: Received error from auth window:', event.data.error);
            $('#auth_status').text(`Authentication failed: ${event.data.error}`).removeClass('success').addClass('error');
            toastr.error(event.data.error, 'Authentication Failed');
            return;
        }
        
        // Extract token data from the message
        const { accessToken, tokenType, expiresIn, refreshToken } = event.data;
        
        if (!accessToken) {
            console.error('Character Distributor UI: No access token in callback message');
            $('#auth_status').text('Authentication failed: No token received').removeClass('success').addClass('error');
            toastr.error('No access token received from Dropbox', 'Authentication Failed');
            return;
        }
        
        console.log('Character Distributor UI: Received access token from callback');
        console.log('Character Distributor UI: Token length:', accessToken.length);
        console.log('Character Distributor UI: Token type:', tokenType || 'bearer');
        console.log('Character Distributor UI: Refresh token present:', !!refreshToken);
        
        // Store the token in authData
        authData = {
            accessToken: accessToken,
            refreshToken: refreshToken,
            expiresIn: parseInt(expiresIn || '14400'),
            tokenType: tokenType || 'bearer'
        };
        
        // Update UI
        $('#auth_status').text('Processing token from callback...');
        
        // Send the token to the server
        sendTokenToServer().then(success => {
            if (success) {
                console.log('Character Distributor UI: Successfully authenticated with token from callback');
            } else {
                console.error('Character Distributor UI: Failed to authenticate with token from callback');
            }
        }).catch(error => {
            console.error('Character Distributor UI: Error processing callback token:', error);
            $('#auth_status').text('Authentication failed').removeClass('success').addClass('error');
            toastr.error('Error processing authentication token', 'Authentication Failed');
        });
    } catch (error) {
        console.error('Character Distributor UI: Error processing auth callback:', error);
        $('#auth_status').text('Authentication callback error').removeClass('success').addClass('error');
        toastr.error('Error processing authentication callback', 'Authentication Failed');
    }
}