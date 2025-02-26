// UI Extension for Character Distributor
// This extension provides the user interface for configuring and interacting with the server plugin

// Import SillyTavern functions
import { extension_settings, getContext, loadExtensionSettings } from "../../../extensions.js";
import { saveSettingsDebounced, getRequestHeaders } from "../../../../script.js";

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

// Trigger synchronization with Dropbox
async function triggerSync() {
    console.log('Character Distributor UI: Triggering sync...');
    $('#force_sync').prop('disabled', true);
    
    try {
        const response = await fetch('/api/plugins/character-distributor/sync', {
            method: 'POST',
            headers: getRequestHeaders()
        });
        
        if (response.ok) {
            const result = await response.json();
            console.log('Character Distributor UI: Sync result', result);
            updateSyncStatus(result);
            toastr.success('Synchronization completed');
        } else {
            console.error('Character Distributor UI: Sync failed');
            toastr.error('Synchronization failed');
        }
    } catch (error) {
        console.error('Character Distributor UI: Error during sync', error);
        toastr.error('Error during synchronization');
    } finally {
        $('#force_sync').prop('disabled', false);
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
    
    if (result.success) {
        syncStatusElement.text(`Sync completed: ${result.message || 'Success'}`);
        syncStatusElement.addClass('success').removeClass('error');
        $('#last_sync').text(`Last sync: ${new Date().toLocaleString()}`);
        $('#shared_characters').text(`Shared characters: ${result.sharedCharacters || 0}`);
    } else {
        syncStatusElement.text(`Sync failed: ${result.error || 'Unknown error'}`);
        syncStatusElement.addClass('error').removeClass('success');
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
    fetch('/api/characters/list', {
        headers: getRequestHeaders()
    })
    .then(response => response.json())
    .then(characters => {
        const selectElement = $('#share_character');
        selectElement.empty();
        
        characters.forEach(character => {
            selectElement.append($('<option></option>')
                .attr('value', character.avatar_url)
                .text(character.name));
        });
    })
    .catch(error => {
        console.error('Character Distributor UI: Error loading characters', error);
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