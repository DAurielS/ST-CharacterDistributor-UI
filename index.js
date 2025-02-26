// UI Extension for Character Distributor
// This extension provides the user interface for configuring and interacting with the server plugin

// Import SillyTavern functions
import { extension_settings, getContext, loadExtensionSettings } from "../../../extensions.js";
import { saveSettingsDebounced, getRequestHeaders } from "../../../../script.js";
// NOTE: We're not importing characters directly, as we'll fetch them via API instead

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
}

// Function to get SillyTavern's character tags
function getCharacterTags(characterName) {
    // Access SillyTavern's character object
    if (window.characters && characterName) {
        const character = window.characters.find(char => 
            char.name === characterName || char.avatar === characterName);
        
        if (character && character.tags) {
            return character.tags;
        }
    }
    
    // Alternative method - check the character selector data
    if (window.chat_metadata && window.chat_metadata.characters) {
        const character = Object.values(window.chat_metadata.characters)
            .find(char => char.name === characterName || char.avatar === characterName);
        
        if (character && character.tags) {
            return character.tags;
        }
    }
    
    return [];
}

// Filter characters based on SillyTavern tags
async function filterCharactersByTags(excludeTags) {
    console.log('Character Distributor UI: Filtering characters with excluded tags:', excludeTags);
    
    let characterData = [];
    
    // First attempt: Try the characters API endpoint
    try {
        console.log('Character Distributor UI: Attempting to fetch characters from API...');
        
        // This is the primary endpoint in SillyTavern for character list
        const response = await fetch('/api/characters/all', {
            headers: getRequestHeaders()
        });
        
        if (response.ok) {
            characterData = await response.json();
            console.log(`Character Distributor UI: Successfully fetched ${characterData.length} characters from API`);
        } else {
            console.warn('Character Distributor UI: Failed to fetch characters, status:', response.status);
        }
    } catch (fetchError) {
        console.warn('Character Distributor UI: Error fetching characters from API:', fetchError);
    }
    
    // Second attempt: Try the tag API if character API failed
    if (!characterData || characterData.length === 0) {
        try {
            console.log('Character Distributor UI: Attempting to fetch character tags from SillyTavern...');
            
            // This endpoint is used in newer SillyTavern versions
            const tagResponse = await fetch('/api/tags/get', {
                headers: getRequestHeaders()
            });
            
            if (tagResponse.ok) {
                const tagData = await tagResponse.json();
                console.log('Character Distributor UI: Successfully fetched tag data from API');
                
                // Tag data structure might contain character information with their tags
                if (tagData.characters && Array.isArray(tagData.characters)) {
                    characterData = tagData.characters;
                    console.log(`Character Distributor UI: Found ${characterData.length} characters from tag data`);
                } else if (tagData.tag_map) {
                    // If we only have the tag map, we need to merge it with character data
                    console.log('Character Distributor UI: Found tag_map, fetching characters separately');
                    
                    // Try to get characters list from another endpoint
                    try {
                        const charResponse = await fetch('/api/characters/list', {
                            headers: getRequestHeaders()
                        });
                        
                        if (charResponse.ok) {
                            const charList = await charResponse.json();
                            console.log(`Character Distributor UI: Found ${charList.length} characters from list API`);
                            
                            // Combine character list with tag map
                            characterData = charList.map(char => {
                                // Get character tags from tag_map if available
                                const charName = char.name || '';
                                const charTags = tagData.tag_map[charName] || [];
                                
                                return {
                                    ...char,
                                    tags: charTags
                                };
                            });
                        }
                    } catch (charError) {
                        console.warn('Character Distributor UI: Error fetching character list:', charError);
                    }
                }
            } else {
                console.warn('Character Distributor UI: Failed to fetch tag data, status:', tagResponse.status);
            }
        } catch (tagError) {
            console.warn('Character Distributor UI: Error fetching tag data:', tagError);
        }
    }
    
    // Last resort: Try global variables if API methods failed
    if (!characterData || characterData.length === 0) {
        console.log('Character Distributor UI: API methods failed, trying global variables...');
        
        // Try all possible ways to access the character list
        let globalCharacters = null;
        
        // Different versions of SillyTavern may have characters in different global variables
        const possibleGlobalPaths = [
            window.characters,
            window.SillyTavern?.characters,
            window.getCharacters && window.getCharacters(),
            window.Characters?.getCharacters(),
            window.charactersList
        ];
        
        for (const path of possibleGlobalPaths) {
            if (path && Array.isArray(path) && path.length > 0) {
                globalCharacters = path;
                console.log('Character Distributor UI: Found characters in global variable');
                break;
            }
        }
        
        if (globalCharacters) {
            characterData = globalCharacters.map(char => {
                // Try to get tags for this character using global tag functions
                let charTags = [];
                
                // Try different methods to get character tags
                try {
                    if (window.getTagsForCharacter) {
                        charTags = window.getTagsForCharacter(char.name) || [];
                    } else if (window.SillyTavern?.getTagsForCharacter) {
                        charTags = window.SillyTavern.getTagsForCharacter(char.name) || [];
                    } else if (window.Tags?.getTagsForCharacter) {
                        charTags = window.Tags.getTagsForCharacter(char.name) || [];
                    }
                } catch (tagError) {
                    console.warn(`Character Distributor UI: Error getting tags for ${char.name}:`, tagError);
                }
                
                return {
                    ...char,
                    tags: charTags
                };
            });
        }
    }
    
    // Final fallback - try to get at least basic info from the DOM if all else fails
    if (!characterData || characterData.length === 0) {
        console.log('Character Distributor UI: All methods failed, trying to extract from DOM...');
        
        // Try to get character list from character select menu in UI
        const charElements = document.querySelectorAll('#rm_print_characters_block .character_select');
        
        if (charElements && charElements.length > 0) {
            characterData = Array.from(charElements).map(element => {
                const name = element.getAttribute('title') || element.innerText;
                const filename = element.getAttribute('data-filename') || '';
                
                return {
                    name: name,
                    avatar_url: filename,
                    filename: filename,
                    tags: [] // No tags available from DOM
                };
            });
            
            console.log(`Character Distributor UI: Extracted ${characterData.length} characters from DOM`);
        }
    }
    
    // If we still don't have character data, give up
    if (!characterData || characterData.length === 0) {
        console.error('Character Distributor UI: Failed to retrieve character data using all available methods');
        return [];
    }
    
    // Normalize character data structure
    const normalizedCharacters = characterData.map(char => {
        // Make sure all characters have at least these fields
        return {
            name: char.name || char.char_name || 'Unknown Character',
            avatar_url: char.avatar_url || char.filename || char.img || '',
            filename: char.filename || char.avatar_url || char.img || '',
            tags: Array.isArray(char.tags) ? char.tags : 
                  (typeof char.tags === 'string' ? char.tags.split(',').map(tag => tag.trim()) : [])
        };
    });
    
    console.log(`Character Distributor UI: Normalized ${normalizedCharacters.length} characters`);
    
    // Filter characters based on excluded tags
    if (!excludeTags || excludeTags.length === 0) {
        return normalizedCharacters;
    }
    
    // If we have exclude tags, filter them out
    const filteredCharacters = normalizedCharacters.filter(char => {
        // If character has no tags, include it
        if (!char.tags || char.tags.length === 0) {
            return true;
        }
        
        // Check if character has any excluded tags
        for (const tag of char.tags) {
            if (excludeTags.includes(tag)) {
                console.log(`Character Distributor UI: Excluding character ${char.name} due to tag: ${tag}`);
                
                // Add excluded_by_tag property for UI feedback
                char.excluded_by_tag = tag;
                return false;
            }
        }
        
        return true;
    });
    
    console.log(`Character Distributor UI: Filtered to ${filteredCharacters.length} characters after tag exclusion`);
    return filteredCharacters;
}

// Trigger synchronization with Dropbox
async function triggerSync() {
    try {
        console.log('Character Distributor UI: Starting sync...');
        
        // Update UI to show sync is in progress
        updateSyncStatus({ running: true, message: 'Syncing characters...' });
        
        // First check server status to make sure it's online
        const serverStatus = await checkServerStatus();
        if (!serverStatus.running) {
            console.error('Character Distributor UI: Server plugin not running');
            updateSyncStatus({ 
                running: false, 
                success: false, 
                message: 'Server plugin not running. Please check server logs.' 
            });
            return;
        }
        
        // Then check authentication status
        const authStatus = await refreshAuthStatus();
        if (!authStatus.authenticated) {
            console.error('Character Distributor UI: Not authenticated with Dropbox');
            updateSyncStatus({ 
                running: false, 
                success: false, 
                message: 'Not authenticated with Dropbox. Please authenticate first.' 
            });
            return;
        }
        
        // Get current exclude tags from settings
        const excludeTags = settings.excludeTags || [];
        
        // Get filtered characters
        const filteredCharacters = await filterCharactersByTags(excludeTags);
        
        // Extract the allowedCharacterFiles list (those not excluded by tags)
        const allowedCharacterFiles = filteredCharacters
            .filter(char => !char.excluded_by_tag)
            .map(char => char.filename || char.avatar_url)
            .filter(filename => !!filename); // Remove any undefined or empty filenames
            
        // Extract excluded character files for logging
        const excludedCharacterFiles = filteredCharacters
            .filter(char => char.excluded_by_tag)
            .map(char => char.filename || char.avatar_url)
            .filter(filename => !!filename);
        
        console.log(`Character Distributor UI: Found ${allowedCharacterFiles.length} characters to sync`);
        console.log(`Character Distributor UI: Excluding ${excludedCharacterFiles.length} characters with excluded tags`);
        
        // Call sync endpoint
        const response = await fetch('/api/plugins/character-distributor/sync', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...getRequestHeaders()
            },
            body: JSON.stringify({
                allowedCharacterFiles,
                excludeTags
            })
        });
        
        if (response.ok) {
            const result = await response.json();
            console.log('Character Distributor UI: Sync result:', result);
            
            // Update UI with sync result
            updateSyncStatus({
                running: false,
                success: result.success,
                message: result.message || (result.success ? 'Sync completed successfully' : 'Sync failed'),
                count: result.count || 0,
                removed: result.removed || 0,
                total: result.total || 0
            });
            
            // Show toast with sync result
            if (result.success) {
                toastr.success(`Synced ${result.count} characters${result.removed ? `, removed ${result.removed}` : ''}`, 'Character Distributor');
            } else {
                toastr.error(`Sync failed: ${result.message || 'Unknown error'}`, 'Character Distributor');
            }
        } else {
            console.error('Character Distributor UI: Sync request failed', response.status);
            
            // Try to get error details from response
            let errorMessage = 'Unknown error';
            try {
                const errorData = await response.json();
                errorMessage = errorData.message || errorData.error || 'Unknown error';
            } catch (e) {
                errorMessage = `HTTP error ${response.status}`;
            }
            
            updateSyncStatus({
                running: false,
                success: false,
                message: `Sync failed: ${errorMessage}`
            });
            
            toastr.error(`Sync failed: ${errorMessage}`, 'Character Distributor');
        }
    } catch (error) {
        console.error('Character Distributor UI: Error during sync', error);
        
        updateSyncStatus({
            running: false,
            success: false,
            message: `Sync error: ${error.message || 'Unknown error'}`
        });
        
        toastr.error(`Sync error: ${error.message || 'Unknown error'}`, 'Character Distributor');
    }
}

// Check if server plugin is running
async function checkServerStatus() {
    console.log('Character Distributor UI: Checking server status...');
    
    try {
        const response = await fetch('/api/plugins/character-distributor/status', {
            headers: getRequestHeaders()
        });
        
        if (response.ok) {
            const status = await response.json();
            console.log('Character Distributor UI: Server status', status);
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
        } else {
            console.error('Character Distributor UI: Server status check failed');
            updateServerStatus({ running: false });
        }
    } catch (error) {
        console.error('Character Distributor UI: Error checking server status', error);
        updateServerStatus({ running: false });
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
        serverStatusElement.text('Server plugin: Not running');
        serverStatusElement.addClass('error').removeClass('success');
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

// Load character list for sharing
function loadCharacterList() {
    console.log('Character Distributor UI: Loading character list for sharing');
    
    // Clear current options
    $('#share_character').empty();
    
    // Add a placeholder option
    $('#share_character').append($('<option>', {
        value: '',
        text: '-- Select a character --',
        disabled: true,
        selected: true
    }));
    
    // Get excluded tags from settings
    const excludeTags = settings.excludeTags || [];
    
    // Use our improved character retrieval function
    filterCharactersByTags(excludeTags)
        .then(characters => {
            // Sort characters by name
            characters.sort((a, b) => {
                return (a.name || '').localeCompare(b.name || '');
            });
            
            // Add each character as an option
            characters.forEach(character => {
                // Skip characters with excluded tags
                if (character.excluded_by_tag) {
                    return;
                }
                
                // Get filename to use as value
                const filename = character.filename || character.avatar_url || '';
                if (!filename) {
                    return; // Skip characters without a filename
                }
                
                // Create option element
                const option = $('<option>', {
                    value: filename,
                    text: character.name || 'Unnamed Character',
                    'data-avatar': character.avatar_url || filename,
                    'data-tags': character.tags ? character.tags.join(',') : ''
                });
                
                // Add to select element
                $('#share_character').append(option);
            });
            
            console.log(`Character Distributor UI: Loaded ${$('#share_character option').length - 1} characters for sharing`);
            
            // Enable the select if we have characters
            $('#share_character').prop('disabled', $('#share_character option').length <= 1);
            
            // If no characters were found, show message
            if ($('#share_character option').length <= 1) {
                $('#share_character').append($('<option>', {
                    value: '',
                    text: 'No characters available'
                }));
                
                console.warn('Character Distributor UI: No characters available for sharing');
            }
        })
        .catch(error => {
            console.error('Character Distributor UI: Error loading character list', error);
            
            // Show error message
            $('#share_character').append($('<option>', {
                value: '',
                text: 'Error loading characters'
            }));
            
            // Disable the select
            $('#share_character').prop('disabled', true);
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