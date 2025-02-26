// UI Extension for Character Distributor
// This extension provides the user interface for configuring and interacting with the server plugin

// Import SillyTavern functions
import { extension_settings, getContext, loadExtensionSettings } from "../../../extensions.js";
import { saveSettingsDebounced, getRequestHeaders, eventSource, event_types, getCharacters } from "../../../../script.js";
import { getTagsList, getTagKeyForEntity } from "../../../tags.js";

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

// Initialize extension settings if needed
function loadSettings() {
    extension_settings[MODULE_NAME] = extension_settings[MODULE_NAME] || {};
    if (Object.keys(extension_settings[MODULE_NAME]).length === 0) {
        Object.assign(extension_settings[MODULE_NAME], defaultSettings);
        saveSettingsDebounced();
    }
    
    // Update UI with current settings
    $('#dropbox_app_key').val(extension_settings[MODULE_NAME].dropboxAppKey || '');
    $('#dropbox_app_secret').val(extension_settings[MODULE_NAME].dropboxAppSecret || '');
    $('#auto_sync').prop('checked', extension_settings[MODULE_NAME].autoSync || false);
    $('#sync_interval').val(extension_settings[MODULE_NAME].syncInterval / 60);
    $('#exclude_tags').val(extension_settings[MODULE_NAME].excludeTags.join(', '));
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
        // Create a clean copy of the settings to send
        const settingsToSend = JSON.parse(JSON.stringify(extension_settings[MODULE_NAME]));
        
        // Log the settings we're about to send
        console.log('Character Distributor UI: Sending settings to server:', JSON.stringify(settingsToSend));
        console.log('Character Distributor UI: Settings type:', typeof settingsToSend);
        
        // Log the headers we're using
        const headers = getRequestHeaders();
        console.log('Character Distributor UI: Request headers:', JSON.stringify(headers));
        
        // Add explicit Content-Type header to ensure proper parsing
        headers['Content-Type'] = 'application/json';
        
        const response = await fetch('/api/plugins/character-distributor/settings', {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(settingsToSend)
        });
        
        if (response.ok) {
            console.log('Character Distributor UI: Settings sent to server plugin');
            toastr.success('Settings saved and sent to server plugin');
            
            // Check if response has content
            try {
                const responseText = await response.text();
                if (responseText) {
                    console.log('Character Distributor UI: Server response:', responseText);
                }
            } catch (responseError) {
                console.warn('Character Distributor UI: Could not parse server response', responseError);
            }
        } else {
            console.error('Character Distributor UI: Failed to send settings to server plugin, status:', response.status);
            console.error('Character Distributor UI: Response text:', await response.text());
            toastr.error('Failed to send settings to server plugin');
            
            // Wait a moment then try the echo endpoint for diagnostics
            setTimeout(testEchoEndpoint, 1000);
        }
    } catch (error) {
        console.error('Character Distributor UI: Error sending settings to server plugin', error);
        toastr.error('Error sending settings to server plugin');
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
    console.log('Character Distributor UI: Manually refreshing auth status...');
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
    
    // Listen for SillyTavern character changes
    if (eventSource && event_types) {
        console.log('Character Distributor UI: Setting up event listeners for SillyTavern events');
        
        // Listen for character list updates
        eventSource.addEventListener(event_types.CHARACTERS_LOADED, function() {
            console.log('Character Distributor UI: Characters updated, refreshing list');
            loadCharacterList();
        });
        
        // Also listen for other relevant events that might change characters
        const relevantEvents = [
            event_types.CHARACTER_EDITED,
            event_types.CHARACTER_DELETED,
            event_types.CHARACTER_PAGE_LOADED
        ];
        
        for (const eventType of relevantEvents) {
            if (eventType) {
                console.log(`Character Distributor UI: Adding listener for ${eventType}`);
                eventSource.addEventListener(eventType, function() {
                    console.log(`Character Distributor UI: Event ${eventType} triggered, refreshing character list`);
                    loadCharacterList();
                });
            }
        }
    } else {
        console.warn('Character Distributor UI: SillyTavern eventSource or event_types not available');
    }
    
    // Load the character list for the share dropdown
    loadCharacterList();
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

        // First try using the native tag system with getTagKeyForEntity and getTagsList
        if (typeof getTagKeyForEntity === 'function' && typeof getTagsList === 'function') {
            try {
                let tagKey = null;
                // For string identifiers (like a name or filename)
                if (typeof characterIdentifier === 'string') {
                    tagKey = getTagKeyForEntity(characterIdentifier);
                } 
                // For object identifiers (like a character object)
                else if (typeof characterIdentifier === 'object' && characterIdentifier !== null) {
                    // Try various properties that might work as identifiers
                    tagKey = getTagKeyForEntity(characterIdentifier.name || 
                                               characterIdentifier.avatar || 
                                               characterIdentifier.filename);
                }
                
                if (tagKey) {
                    console.log(`Character Distributor UI: Found tag key: ${tagKey}`);
                    const tags = getTagsList(tagKey);
                    if (tags && Array.isArray(tags)) {
                        console.log(`Character Distributor UI: Retrieved ${tags.length} tags for ${tagKey} using native tag system`);
                        return tags;
                    } else {
                        console.log(`Character Distributor UI: getTagsList returned invalid result for ${tagKey}: ${typeof tags}`);
                    }
                } else {
                    console.log('Character Distributor UI: getTagKeyForEntity returned null/undefined');
                }
            } catch (tagError) {
                console.warn('Character Distributor UI: Error using native tag system:', tagError);
            }
        } else {
            console.log('Character Distributor UI: Native tag functions not available');
        }
        
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

// Filter characters based on SillyTavern tags using a more reliable approach
async function filterCharactersByTags(excludeTags) {
    console.log('Character Distributor UI: Filtering characters with excluded tags:', excludeTags);
    const excludedCharacters = [];
    const characterFiles = [];
    
    try {
        // Try to use the proper SillyTavern function to get characters
        let characters = null;
        
        // Approach 1: Instead of direct call, use it as an async function
        try {
            if (typeof getCharacters === 'function') {
                console.log('Character Distributor UI: Calling getCharacters() as async function');
                // We need to await the function call since getCharacters is async
                await getCharacters();
                // The characters should now be populated in the global characters array
                if (window.characters && Array.isArray(window.characters)) {
                    characters = window.characters;
                    console.log('Character Distributor UI: Retrieved characters from global array after getCharacters() call');
                    console.log('Character Distributor UI: Characters array length:', characters.length);
                    if (characters.length > 0) {
                        // Log first character structure
                        console.log('Character Distributor UI: First character structure:', JSON.stringify(characters[0]));
                    }
                } else {
                    console.log('Character Distributor UI: Global characters array not populated after getCharacters() call');
                }
            } else {
                console.log('Character Distributor UI: getCharacters function not available');
            }
        } catch (e) {
            console.warn('Character Distributor UI: Error using getCharacters():', e);
        }
        
        // Add a flag to track if we've previously seen a 404 on the API endpoint
        if (!window.characterDistributor) {
            window.characterDistributor = {
                apiUnavailable: false
            };
        }
        
        // Approach 2: Try to get characters from API directly using POST like the native function
        if ((!characters || !Array.isArray(characters) || characters.length === 0) && !window.characterDistributor.apiUnavailable) {
            console.log('Character Distributor UI: No valid characters from getCharacters(), trying direct API call');
            try {
                const response = await fetch('/api/characters/all', {
                    method: 'POST', // Using POST as in script.js
                    headers: getRequestHeaders(),
                    body: JSON.stringify({ '': '' }) // Important: This empty object is required
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
            if (window.characterDistributor.apiUnavailable) {
                console.log('Character Distributor UI: Skipping API call as endpoint was previously unavailable');
            } else {
                console.log('Character Distributor UI: Using characters from getCharacters(), skipping API call');
            }
        }
        
        // Approach 3: Fallback to window variables
        if (!characters || !Array.isArray(characters) || characters.length === 0) {
            console.log('Character Distributor UI: No characters from primary methods, trying window variables');
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
            
            // Use our improved getCharacterTags function
            const characterTags = getCharacterTags(character);
            
            // Check if this character has any excluded tags
            if (characterTags.some(tag => excludeTags.includes(tag))) {
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
        
        // Get proper request headers and add Content-Type
        const headers = getRequestHeaders();
        headers['Content-Type'] = 'application/json';
        
        // Now send the list of allowed characters to the server
        fetch('/api/plugins/character-distributor/sync', {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({
                allowedCharacterFiles: characterFiles, // Send list of files that are allowed
                excludeTags: excludeTags // Also send excluded tags for secondary filtering
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
        })
        .catch(error => {
            console.error('Character Distributor UI: Error during sync', error);
            updateSyncStatus({ success: false, message: 'Sync failed. Check server logs.' });
        });
    } catch (error) {
        console.error('Character Distributor UI: Error during sync preparation', error);
        updateSyncStatus({ success: false, message: 'Error preparing sync. Check console logs.' });
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

// Authenticate with Dropbox
function authenticateWithDropbox() {
    const appKey = extension_settings[MODULE_NAME].dropboxAppKey;
    
    if (!appKey) {
        toastr.error('Please enter your Dropbox App Key in the settings');
        return;
    }
    
    const redirectUri = `${window.location.origin}${extensionFolderPath}/public/oauth_callback.html`;
    const authUrl = `https://www.dropbox.com/oauth2/authorize?client_id=${appKey}&response_type=token&redirect_uri=${encodeURIComponent(redirectUri)}`;
    
    // Store a marker in localStorage that we're expecting an auth callback
    localStorage.setItem('dropboxAuthPending', 'true');
    
    // Open popup with specific parameters to ensure window.opener works properly
    const popup = window.open(authUrl, 'dropbox-auth', 'width=800,height=600,resizable=yes,scrollbars=yes,status=yes');
    
    // Check if popup was blocked
    if (!popup || popup.closed || typeof popup.closed === 'undefined') {
        toastr.warning('Popup blocked! Please allow popups for this site and try again, or use the manual token input option.');
    }
}

// Handle manual token submission
function submitManualToken() {
    const accessToken = $('#manual_access_token').val().trim();
    
    if (!accessToken) {
        toastr.error('Please enter an access token');
        return;
    }
    
    console.log('Character Distributor UI: Submitting manual token');
    console.log('Character Distributor UI: Token length:', accessToken.length);
    
    // Make sure we have app keys configured
    if (!extension_settings[MODULE_NAME].dropboxAppKey || !extension_settings[MODULE_NAME].dropboxAppSecret) {
        toastr.error('Please enter your Dropbox App Key and App Secret in the settings first');
        return;
    }
    
    // Ensure headers are set properly
    const headers = getRequestHeaders();
    headers['Content-Type'] = 'application/json';
    
    // Send token to server plugin with detailed error handling
    fetch('/api/plugins/character-distributor/auth', {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({ 
            accessToken, 
            tokenType: 'bearer', 
            expiresIn: 14400 // Default 4 hours expiration if not specified
        })
    })
    .then(response => {
        console.log('Character Distributor UI: Auth response status:', response.status);
        
        // Try to get detailed error information
        return response.text().then(text => {
            let data = {};
            try {
                // Try to parse as JSON if possible
                data = text ? JSON.parse(text) : {};
            } catch (e) {
                console.log('Character Distributor UI: Response is not JSON:', text);
                // Just store the raw text
                data = { rawText: text };
            }
            return { status: response.status, ok: response.ok, data };
        });
    })
    .then(({ status, ok, data }) => {
        console.log('Character Distributor UI: Parsed response data:', data);
        
        if (ok) {
            $('#auth_status').text('Authenticated');
            $('#auth_status').addClass('success').removeClass('error');
            $('#manual_access_token').val(''); // Clear the token field for security
            toastr.success('Successfully authenticated with Dropbox using manual token');
            
            // Refresh the status to confirm
            setTimeout(refreshAuthStatus, 1000);
        } else {
            $('#auth_status').text('Authentication failed');
            $('#auth_status').addClass('error').removeClass('success');
            
            // Show a more detailed error message if available
            let errorMsg = 'Failed to authenticate with Dropbox';
            if (data.error) {
                errorMsg += ': ' + data.error;
            } else if (data.rawText) {
                errorMsg += ' (check console for details)';
            }
            
            toastr.error(errorMsg);
        }
    })
    .catch(error => {
        console.error('Character Distributor UI: Error during authentication:', error);
        $('#auth_status').text('Authentication failed');
        $('#auth_status').addClass('error').removeClass('success');
        toastr.error('Error during Dropbox authentication: ' + error.message);
    });
}

// Handle Dropbox auth callback
function handleDropboxAuthCallback(event) {
    if (event.data && event.data.source === 'dropbox-auth') {
        console.log('Character Distributor UI: Received Dropbox auth callback');
        
        const { accessToken, tokenType, expiresIn } = event.data;
        
        if (accessToken) {
            console.log('Character Distributor UI: Received token length:', accessToken.length);
            
            // Make sure we have app keys configured
            if (!extension_settings[MODULE_NAME].dropboxAppKey || !extension_settings[MODULE_NAME].dropboxAppSecret) {
                console.error('Character Distributor UI: App Key or Secret not configured');
                toastr.error('Please enter your Dropbox App Key and App Secret in the settings first');
                return;
            }
            
            // Ensure headers are set properly
            const headers = getRequestHeaders();
            headers['Content-Type'] = 'application/json';
            
            // Send token to server plugin
            fetch('/api/plugins/character-distributor/auth', {
                method: 'POST',
                headers: headers,
                body: JSON.stringify({ accessToken, tokenType, expiresIn })
            })
            .then(response => {
                console.log('Character Distributor UI: Auth response status:', response.status);
                
                // Try to get detailed error information
                return response.text().then(text => {
                    let data = {};
                    try {
                        // Try to parse as JSON if possible
                        data = text ? JSON.parse(text) : {};
                    } catch (e) {
                        console.log('Character Distributor UI: Response is not JSON:', text);
                        // Just store the raw text
                        data = { rawText: text };
                    }
                    return { status: response.status, ok: response.ok, data };
                });
            })
            .then(({ status, ok, data }) => {
                console.log('Character Distributor UI: Parsed response data:', data);
                
                if (ok) {
                    $('#auth_status').text('Authenticated');
                    $('#auth_status').addClass('success').removeClass('error');
                    toastr.success('Successfully authenticated with Dropbox');
                    
                    // Refresh the status to confirm
                    setTimeout(refreshAuthStatus, 1000);
                } else {
                    $('#auth_status').text('Authentication failed');
                    $('#auth_status').addClass('error').removeClass('success');
                    
                    // Show a more detailed error message if available
                    let errorMsg = 'Failed to authenticate with Dropbox';
                    if (data.error) {
                        errorMsg += ': ' + data.error;
                    } else if (data.rawText) {
                        errorMsg += ' (check console for details)';
                    }
                    
                    toastr.error(errorMsg);
                }
            })
            .catch(error => {
                console.error('Character Distributor UI: Error saving auth token', error);
                $('#auth_status').text('Authentication failed');
                $('#auth_status').addClass('error').removeClass('success');
                toastr.error('Error authenticating with Dropbox: ' + error.message);
            });
        } else {
            $('#auth_status').text('Authentication failed');
            $('#auth_status').addClass('error').removeClass('success');
            toastr.error('Dropbox authentication failed: No token received');
        }
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
    console.log('Character Distributor UI: Loading character list...');
    
    let characters = null;
    
    // Approach 1: Call getCharacters as async function
    try {
        if (typeof getCharacters === 'function') {
            console.log('Character Distributor UI: Calling getCharacters() as async function');
            // We need to await the function call since getCharacters is async
            await getCharacters();
            // The characters should now be populated in the global characters array
            if (window.characters && Array.isArray(window.characters)) {
                characters = window.characters;
                console.log('Character Distributor UI: Retrieved characters from global array after getCharacters() call');
                console.log('Character Distributor UI: Characters array length:', characters.length);
            } else {
                console.log('Character Distributor UI: Global characters array not populated after getCharacters() call');
            }
        } else {
            console.log('Character Distributor UI: getCharacters function not available');
        }
    } catch (e) {
        console.warn('Character Distributor UI: Error using getCharacters():', e);
    }
    
    // Add tracking marker if needed
    if (!window.characterDistributor) {
        window.characterDistributor = {
            apiUnavailable: false
        };
    }
    
    // Approach 2: Try to get characters from API directly using POST
    if ((!characters || !Array.isArray(characters) || characters.length === 0) && !window.characterDistributor?.apiUnavailable) {
        console.log('Character Distributor UI: No valid characters from getCharacters(), trying direct API call');
        
        try {
            const response = await fetch('/api/characters/all', {
                method: 'POST', // Use POST instead of GET
                headers: getRequestHeaders(),
                body: JSON.stringify({ '': '' }) // Important: This empty object is required
            });
            
            if (!response.ok) {
                console.warn(`Character Distributor UI: API returned status: ${response.status}`);
                
                // If we get a 404, mark the API as unavailable to avoid future attempts
                if (response.status === 404) {
                    console.log('Character Distributor UI: API endpoint not available, marking as unavailable for future requests');
                    window.characterDistributor.apiUnavailable = true;
                }
                
                throw new Error(`Server responded with status: ${response.status}`);
            }
            
            characters = await response.json();
            console.log(`Character Distributor UI: Retrieved ${characters.length} characters from API`);
            
            if (Array.isArray(characters) && characters.length > 0) {
                populateCharacterDropdown(characters);
                return; // Exit early if successful
            } else {
                console.warn('Character Distributor UI: API returned empty or invalid character data');
                // Continue to fallback
            }
        } catch (error) {
            console.error('Character Distributor UI: Error loading characters from API', error);
            // Continue to fallback
        }
    } else if (window.characterDistributor?.apiUnavailable) {
        console.log('Character Distributor UI: API previously marked as unavailable, skipping API call');
    }
    
    // Use the characters we got from getCharacters() if available
    if (characters && Array.isArray(characters) && characters.length > 0) {
        console.log(`Character Distributor UI: Using ${characters.length} characters from getCharacters()`);
        populateCharacterDropdown(characters);
    } else {
        // Otherwise, fallback to window variables
        useFallbackCharacters();
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

// Initialize extension when jQuery is ready
jQuery(async () => {
    await initializeUI();
    
    // Set up refresh interval for server status check
    setInterval(checkServerStatus, 60000); // Check every minute
    
    // Load character list
    loadCharacterList();
    
    // Check for auth token in localStorage after a short delay to ensure everything is loaded
    console.log('Setting up localStorage token check...');
    setTimeout(() => {
        console.log('Running delayed localStorage token check...');
        checkLocalStorageForToken();
    }, 2000);
    
    console.log('Character Distributor UI: Extension initialized');
});

// Check localStorage for auth token
function checkLocalStorageForToken() {
    // Check if there's a token in localStorage
    const accessToken = localStorage.getItem('dropbox_auth_token');
    const tokenType = localStorage.getItem('dropbox_token_type');
    const expiresIn = localStorage.getItem('dropbox_expires_in');
    const timestamp = localStorage.getItem('dropbox_auth_timestamp');
    
    console.log('Character Distributor UI: Checking localStorage for token...');
    console.log('Token exists:', !!accessToken);
    console.log('Timestamp exists:', !!timestamp);
    console.log('Token length:', accessToken?.length || 0);
    
    // Make sure we have app keys configured before trying to use the token
    if (!extension_settings[MODULE_NAME].dropboxAppKey || !extension_settings[MODULE_NAME].dropboxAppSecret) {
        console.warn('Character Distributor UI: App Key or Secret not configured. Cannot use saved token.');
        clearLocalStorageTokens();
        return;
    }
    
    // If we have a token and it's recent (within last 5 minutes)
    if (accessToken && timestamp) {
        const age = Date.now() - parseInt(timestamp, 10);
        console.log('Token age (ms):', age);
        
        if (age < 5 * 60 * 1000) { // 5 minutes
            console.log('Character Distributor UI: Found valid auth token in localStorage');
            
            // Ensure headers are set correctly
            const headers = getRequestHeaders();
            headers['Content-Type'] = 'application/json';
            
            // Send token to server plugin
            fetch('/api/plugins/character-distributor/auth', {
                method: 'POST',
                headers: headers,
                body: JSON.stringify({ 
                    accessToken, 
                    tokenType: tokenType || 'bearer', 
                    expiresIn: expiresIn || '14400'
                })
            })
            .then(response => {
                console.log('Auth API response status:', response.status);
                return response.text().then(text => {
                    try {
                        return text ? JSON.parse(text) : {};
                    } catch (e) {
                        console.error('Failed to parse response:', text);
                        return { rawText: text };
                    }
                }).then(data => {
                    console.log('Auth API response data:', data);
                    
                    if (response.ok) {
                        $('#auth_status').text('Authenticated');
                        $('#auth_status').addClass('success').removeClass('error');
                        toastr.success('Successfully authenticated with Dropbox using saved token');
                        
                        // Refresh the status to confirm
                        setTimeout(refreshAuthStatus, 1000);
                    } else {
                        $('#auth_status').text('Authentication failed');
                        $('#auth_status').addClass('error').removeClass('success');
                        
                        let errorMsg = 'Failed to authenticate with saved token';
                        if (data.error) {
                            errorMsg += ': ' + data.error;
                        } else if (data.rawText) {
                            errorMsg += ' (check console for details)';
                        }
                        
                        toastr.error(errorMsg);
                    }
                    
                    // Clear localStorage tokens after use regardless of success/failure
                    clearLocalStorageTokens();
                });
            })
            .catch(error => {
                console.error('Character Distributor UI: Error saving auth token from localStorage', error);
                toastr.error('Error authenticating with Dropbox: ' + error.message);
                $('#auth_status').text('Authentication failed');
                $('#auth_status').addClass('error').removeClass('success');
                clearLocalStorageTokens();
            });
        } else {
            // Token is too old, clear it
            console.log('Token too old, clearing it');
            clearLocalStorageTokens();
        }
    } else {
        console.log('No valid token found in localStorage');
    }
}

// Clear localStorage tokens
function clearLocalStorageTokens() {
    localStorage.removeItem('dropbox_auth_token');
    localStorage.removeItem('dropbox_token_type');
    localStorage.removeItem('dropbox_expires_in');
    localStorage.removeItem('dropbox_auth_timestamp');
    localStorage.removeItem('dropboxAuthPending');
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