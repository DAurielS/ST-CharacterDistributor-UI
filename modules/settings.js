/**
 * ST-CharacterDistributor-UI - Settings Module
 * Contains functions for loading, saving, and sending settings to the server
 */

// Default settings
const defaultSettings = {
    dropboxAppKey: '',
    dropboxAppSecret: '',
    autoSync: false,
    syncInterval: 3600,  // 1 hour in seconds
    excludeTags: []
};

/**
 * Load settings from extension_settings and update UI
 */
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

/**
 * Save settings from UI inputs
 */
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

/**
 * Send settings to server plugin
 * @returns {Promise<boolean>} Success status
 */
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

/**
 * Test the echo endpoint to diagnose request handling issues
 */
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

// Export functions and data
export {
    defaultSettings,
    loadSettings,
    saveSettings,
    sendSettingsToServer,
    testEchoEndpoint
}; 