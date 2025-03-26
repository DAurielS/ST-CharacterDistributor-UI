// Authentication API module for Character Distributor UI
// Contains functions for authentication with Dropbox

import { getRequestHeaders } from "../../../../../script.js";

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
 * @param {Object} authData - Authentication data
 * @returns {Promise<boolean>} Success status
 */
export async function sendTokenToServer(authData) {
    try {
        console.log('Character Distributor UI: Sending token to server');
        
        // Update UI to show token being sent
        $('#auth_status').text('Sending token to server...');
        
        // Validate authData
        if (!authData || !authData.accessToken) {
            console.error('Character Distributor UI: No valid token data available');
            $('#auth_status').text('Authentication failed: No valid token').removeClass('success').addClass('error');
            toastr.error('No valid authentication token available', 'Authentication Failed');
            return false;
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
            } else {
                $('#auth_status').text('Not authenticated');
                $('#auth_status').removeClass('success error');
                toastr.info('Not authenticated with Dropbox');
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