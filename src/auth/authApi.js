// Authentication API module for Character Distributor UI
// Contains functions for authentication with Dropbox

import { getRequestHeaders, saveSettingsDebounced } from "../../../../../../script.js";
import { extension_settings } from "../../../../../extensions.js";
import { sendSettingsToServer, MODULE_NAME } from "../utils/settings.js";

// Add a global variable to store the current authorization details with refresh token support
let authData = {
    accessToken: null,
    refreshToken: null,
    expiresIn: null,
    tokenType: null
};

// Custom event name for auth state changes
const AUTH_STATE_CHANGED_EVENT = 'character-distributor-auth-state-changed';

/**
 * Authenticate with Dropbox via OAuth using PKCE flow
 * @returns {Promise<void>}
 */
export async function authenticateWithDropbox() {
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
        if (!extension_settings[MODULE_NAME]) {
            extension_settings[MODULE_NAME] = {};
        }
        extension_settings[MODULE_NAME].dropboxAppKey = appKey;
        extension_settings[MODULE_NAME].dropboxAppSecret = appSecret;
        saveSettingsDebounced();
        
        console.log('Character Distributor UI: Saved app key and secret to settings');
        console.log('Character Distributor UI: App Key length:', appKey.length);
        console.log('Character Distributor UI: App Secret length:', appSecret.length);
        
        // Ensure settings are sent to server before proceeding
        await sendSettingsToServer();
        
        // Generate a code verifier and challenge for PKCE (improved security over implicit flow)
        // The verifier is a random string that must be kept secret
        // The challenge is derived from the verifier using a one-way function (SHA-256)
        const codeVerifier = generateCodeVerifier();
        const codeChallenge = await generateCodeChallenge(codeVerifier);
        
        // Store code verifier in sessionStorage as a backup
        // However, since sessionStorage is not shared between browser contexts,
        // we'll also pass it through the state parameter
        sessionStorage.setItem('dropbox_code_verifier', codeVerifier);
        console.log('Character Distributor UI: Stored code verifier in sessionStorage');
        
        // PKCE Flow:
        // 1. We generate a random code verifier and a derived code challenge 
        // 2. We send the challenge (but not the verifier) to the authorization server
        // 3. The authorization server returns a code to the redirect URI
        // 4. We use the original verifier and the code to request an access token
        // 5. The server validates that the verifier matches the challenge it received
        
        // Create a callback URL with state parameter that contains the code verifier
        // We cannot modify the redirect URI after Dropbox sets it, but we can add a state parameter
        // that will be preserved in the redirect
        const baseRedirectUri = window.location.origin + '/scripts/extensions/third-party/ST-CharacterDistributor-UI/public/oauth_callback.html';
        
        // Add the code verifier as a state parameter - this will be preserved in the redirect
        // Will be returned as ?state=... in the callback
        const state = btoa(JSON.stringify({cv: codeVerifier}));
        console.log('Character Distributor UI: Generated state with embedded code verifier');
        
        // The authorization URL includes state which will be passed back to the callback
        const authUrl = `https://www.dropbox.com/oauth2/authorize?client_id=${appKey}&response_type=code&redirect_uri=${encodeURIComponent(baseRedirectUri)}&code_challenge=${codeChallenge}&code_challenge_method=S256&token_access_type=offline&state=${encodeURIComponent(state)}`; // Request refresh token with offline access
        console.log('Character Distributor UI: Authorization URL length:', authUrl.length);
        
        // Store the app key and code verifier in sessionStorage for the callback page to use
        sessionStorage.setItem('dropbox_app_key', appKey);
        // We still store it in sessionStorage as a backup
        sessionStorage.setItem('dropbox_code_verifier', codeVerifier);
        
        // Set flag to indicate authentication is in progress
        sessionStorage.setItem('dropbox_auth_in_progress', 'true');
        
        // Clear any previous auth completion flags
        localStorage.removeItem('dropbox_auth_completed');
        localStorage.removeItem('dropbox_auth_error');
        localStorage.removeItem('dropbox_auth_token');
        
        // Open the authorization URL in a new tab/window
        const authWindow = window.open(authUrl, '_blank', 'width=800,height=600');
        
        if (!authWindow) {
            console.error('Character Distributor UI: Failed to open auth window - popup blocked?');
            toastr.error('Failed to open authentication window. Please allow popups for this site.', 'Authentication Error');
            $('#auth_status').text('Authentication failed - popup blocked').removeClass('success').addClass('error');
            return;
        }
        
        console.log('Character Distributor UI: Opened auth window, waiting for completion via polling');
        
        // Poll for localStorage token flag
        let pollCount = 0;
        const maxPolls = 120; // Poll for up to 2 minutes
        const pollInterval = 1000; // Poll every second
        
        const pollForToken = setInterval(() => {
            pollCount++;
            
            // Check localStorage for token or auth completion flag
            const savedToken = localStorage.getItem('dropbox_auth_token');
            const authCompleted = localStorage.getItem('dropbox_auth_completed');
            
            if (savedToken || authCompleted === 'true') {
                console.log('Character Distributor UI: Detected auth completion via polling');
                clearInterval(pollForToken);
                
                // Clear the auth in progress flag
                sessionStorage.removeItem('dropbox_auth_in_progress');
                
                // Use the saved token if it exists
                if (savedToken) {
                    const tokenType = localStorage.getItem('dropbox_token_type') || 'bearer';
                    const expiresIn = localStorage.getItem('dropbox_expires_in') || '14400';
                    const refreshToken = localStorage.getItem('dropbox_refresh_token');
                    
                    // Create auth data from localStorage
                    authData = {
                        accessToken: savedToken,
                        refreshToken: refreshToken,
                        expiresIn: parseInt(expiresIn),
                        tokenType: tokenType
                    };
                    
                    // Send token to server
                    sendTokenToServer()
                        .then(success => {
                            if (success) {
                                console.log('Character Distributor UI: Successfully authenticated via polling');
                                // Clear auth completed flag
                                localStorage.removeItem('dropbox_auth_completed');
                            }
                        })
                        .catch(err => {
                            console.error('Character Distributor UI: Error in polling auth:', err);
                        });
                } else {
                    // Check for auth error
                    const authError = localStorage.getItem('dropbox_auth_error');
                    if (authError) {
                        $('#auth_status').text(`Authentication failed: ${authError}`).removeClass('success').addClass('error');
                        toastr.error(authError, 'Authentication Failed');
                        localStorage.removeItem('dropbox_auth_error');
                    }
                    
                    // Just check status if no token but auth was completed
                    refreshAuthStatus();
                    localStorage.removeItem('dropbox_auth_completed');
                }
            } else if (pollCount >= maxPolls) {
                clearInterval(pollForToken);
                console.warn('Character Distributor UI: Polling for token timed out');
                
                // Only update UI if we're still in the auth process
                if ($('#auth_status').text() === 'Authentication in progress...') {
                    $('#auth_status').text('Authentication timed out').removeClass('success').addClass('error');
                    toastr.warning('Authentication process timed out. Try refreshing the page if you completed authentication.', 'Authentication Timeout');
                }
                
                // Clear the auth in progress flag
                sessionStorage.removeItem('dropbox_auth_in_progress');
            }
        }, pollInterval);
        
        // Set a reasonable timeout for the overall process (3 minutes)
        setTimeout(() => {
            // Only show timeout message if we're still in the "Authentication in progress" state
            if ($('#auth_status').text() === 'Authentication in progress...') {
                console.warn('Character Distributor UI: Auth process timed out after 3 minutes');
                $('#auth_status').text('Authentication timed out').removeClass('success').addClass('error');
                toastr.warning('Authentication process timed out after 3 minutes', 'Authentication Timeout');
                
                // Clear the interval if it's still running
                clearInterval(pollForToken);
                
                // Clear the auth in progress flag
                sessionStorage.removeItem('dropbox_auth_in_progress');
            }
        }, 180000);
    } catch (error) {
        console.error('Character Distributor UI: Authentication error', error);
        $('#auth_status').text('Authentication error').removeClass('success').addClass('error');
        toastr.error(`Error during authentication process: ${error.message}`, 'Authentication Failed');
        
        // Clear the auth in progress flag
        sessionStorage.removeItem('dropbox_auth_in_progress');
    }
}

/**
 * Logout from Dropbox
 * @returns {Promise<boolean>} Success status
 */
export async function logoutFromDropbox() {
    try {
        const response = await fetch('/api/plugins/character-distributor/logout', {
            method: 'POST',
            headers: getRequestHeaders()
        });
        
        if (response.ok) {
            $('#auth_status').text('Not authenticated');
            $('#auth_status').removeClass('success error');
            toastr.success('Logged out from Dropbox');
            
            // Dispatch auth state changed event
            const authStateEvent = new CustomEvent(AUTH_STATE_CHANGED_EVENT, {
                detail: { authenticated: false }
            });
            document.dispatchEvent(authStateEvent);
            
            return true;
        } else {
            toastr.error('Failed to logout from Dropbox');
            return false;
        }
    } catch (error) {
        console.error('Character Distributor UI: Error logging out', error);
        toastr.error('Error logging out from Dropbox');
        return false;
    }
}

/**
 * Send a token to the server for Dropbox authentication
 * @param {Object} [tokenData] - Authentication data (optional, will use global authData if not provided)
 * @returns {Promise<boolean>} Success status
 */
export async function sendTokenToServer(tokenData) {
    try {
        console.log('Character Distributor UI: Sending token to server');
        
        // Update UI to show token being sent
        $('#auth_status').text('Sending token to server...');
        
        // Use provided token data or global authData
        const authDataToUse = tokenData || authData;
        
        // Validate authData
        if (!authDataToUse || !authDataToUse.accessToken) {
            console.error('Character Distributor UI: No valid token data available');
            $('#auth_status').text('Authentication failed: No valid token').removeClass('success').addClass('error');
            toastr.error('No valid authentication token available', 'Authentication Failed');
            return false;
        }
        
        // Prepare the request
        const requestBody = {
            accessToken: authDataToUse.accessToken,
            tokenType: authDataToUse.tokenType || 'bearer',
            expiresIn: authDataToUse.expiresIn || 14400,
            refreshToken: authDataToUse.refreshToken
        };
        
        // Log sanitized details
        console.log('Character Distributor UI: Token length:', authDataToUse.accessToken?.length || 0);
        console.log('Character Distributor UI: Token type:', authDataToUse.tokenType || 'bearer');
        console.log('Character Distributor UI: Expires in:', authDataToUse.expiresIn || 14400);
        console.log('Character Distributor UI: Refresh token provided:', !!authDataToUse.refreshToken);
        
        // Check if the app keys are set in the UI/settings
        const appKey = $('#dropbox_app_key').val() || extension_settings?.[MODULE_NAME]?.dropboxAppKey;
        const appSecret = $('#dropbox_app_secret').val() || extension_settings?.[MODULE_NAME]?.dropboxAppSecret;
        
        if (!appKey || !appSecret) {
            console.error('Character Distributor UI: App key or secret is missing');
            $('#auth_status').text('Authentication failed: Missing app credentials').removeClass('success').addClass('error');
            toastr.error('Dropbox App Key and Secret must be configured', 'Authentication Failed');
            return false;
        }
        
        // Ensure settings are saved and sent to server before proceeding
        if (!extension_settings[MODULE_NAME]) {
            extension_settings[MODULE_NAME] = {};
        }
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
                return false;
            }
        } catch (settingsError) {
            console.error('Character Distributor UI: Error sending settings to server:', settingsError);
            $('#auth_status').text('Authentication failed: Configuration error').removeClass('success').addClass('error');
            toastr.error('Error configuring server with app credentials', 'Authentication Failed');
            return false;
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
                    storeAuthToken(authDataToUse.accessToken, authDataToUse.tokenType, authDataToUse.expiresIn, authDataToUse.refreshToken);
                    
                    // Check server status after a short delay to confirm
                    setTimeout(refreshAuthStatus, 2000);
                    
                    // Dispatch a custom event to notify the application that auth state has changed
                    // This allows components to refresh without page reload
                    const authStateEvent = new CustomEvent(AUTH_STATE_CHANGED_EVENT, {
                        detail: { authenticated: true }
                    });
                    document.dispatchEvent(authStateEvent);
                    
                    // Refresh any UI components that need to be updated
                    setTimeout(() => {
                        // If there's a refresh method defined elsewhere in the app, call it
                        if (typeof window.characterDistributor !== 'undefined' && 
                            typeof window.characterDistributor.refreshAfterAuth === 'function') {
                            window.characterDistributor.refreshAfterAuth();
                        }
                        
                        // Force refresh of key UI components
                        try {
                            // Try to trigger any initialization functions or UI refreshes
                            // that should happen after authentication
                            if (typeof initializeUI === 'function') {
                                initializeUI();
                            }
                        } catch (refreshErr) {
                            console.warn('Character Distributor UI: Error refreshing UI after auth:', refreshErr);
                        }
                    }, 1000);
                    
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

/**
 * Refresh authentication status from server
 * @returns {Promise<Object|null>} Authentication status or null if failed
 */
export async function refreshAuthStatus() {
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
                
                // Dispatch auth state changed event
                const authStateEvent = new CustomEvent(AUTH_STATE_CHANGED_EVENT, {
                    detail: { authenticated: true }
                });
                document.dispatchEvent(authStateEvent);
            } else {
                $('#auth_status').text('Not authenticated');
                $('#auth_status').removeClass('success error');
                toastr.info('Not authenticated with Dropbox');
                
                // Dispatch auth state changed event
                const authStateEvent = new CustomEvent(AUTH_STATE_CHANGED_EVENT, {
                    detail: { authenticated: false }
                });
                document.dispatchEvent(authStateEvent);
            }
            
            // Update the server status UI
            if (typeof updateServerStatus === 'function') {
                updateServerStatus(status);
            }
            
            return status;
        } else {
            console.error('Character Distributor UI: Auth status check failed');
            toastr.error('Failed to check authentication status');
            return null;
        }
    } catch (error) {
        console.error('Character Distributor UI: Error checking auth status', error);
        toastr.error('Error checking authentication status');
        return null;
    } finally {
        $('#refresh_auth_status').prop('disabled', false);
    }
}

/**
 * Check localStorage for auth token and restore authentication if available
 * @returns {Promise<boolean>} Success status
 */
export async function checkLocalStorageForToken() {
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
    const appKey = $('#dropbox_app_key').val() || extension_settings?.[MODULE_NAME]?.dropboxAppKey;
    const appSecret = $('#dropbox_app_secret').val() || extension_settings?.[MODULE_NAME]?.dropboxAppSecret;
    
    if (!appKey || !appSecret) {
        console.warn('Character Distributor UI: App Key or Secret not configured. Cannot use saved token.');
        clearLocalStorageTokens();
        return false;
    }
    
    // Make sure settings are saved with the current app key/secret
    if (!extension_settings[MODULE_NAME]) {
        extension_settings[MODULE_NAME] = {};
    }
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
        return false;
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
                return false;
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
            return true;
        } catch (error) {
            console.error('Character Distributor UI: Error sending saved token to server:', error);
            $('#auth_status').text('Failed to restore authentication').removeClass('success').addClass('error');
            toastr.error('Could not restore authentication from saved token', 'Authentication Failed');
            
            // Clear the invalid saved token
            clearLocalStorageTokens();
            return false;
        }
    } else {
        console.log('Character Distributor UI: No saved token found in localStorage');
        return false;
    }
}

/**
 * Clear tokens from localStorage
 * @returns {boolean} Success status
 */
export function clearLocalStorageTokens() {
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

// Helper function to store authentication token in localStorage for persistence
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

/**
 * Handle the OAuth callback message from the popup window (legacy - kept for backward compatibility)
 * @param {MessageEvent} event - The postMessage event containing auth data
 * @returns {void}
 */
export function handleDropboxAuthCallback(event) {
    console.log('Character Distributor UI: Received postMessage event, but it is no longer used');
    // This function is now just a stub for backward compatibility
    // All authentication is now handled via polling localStorage
}

/**
 * Listen for auth state change events
 * @param {Function} callback - Function to call when auth state changes
 * @returns {Function} - Function to remove the event listener
 */
export function onAuthStateChanged(callback) {
    if (typeof callback !== 'function') {
        console.error('Character Distributor UI: onAuthStateChanged requires a function callback');
        return () => {};
    }
    
    const handler = (event) => callback(event.detail);
    document.addEventListener(AUTH_STATE_CHANGED_EVENT, handler);
    
    // Return a function to remove the listener
    return () => document.removeEventListener(AUTH_STATE_CHANGED_EVENT, handler);
} 