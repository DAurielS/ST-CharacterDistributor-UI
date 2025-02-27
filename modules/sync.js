/**
 * ST-CharacterDistributor-UI - Sync Module
 * Contains functions for synchronizing with the server and checking server status
 */

/**
 * Check server status and update UI accordingly
 * @returns {Promise<Object>} Server status
 */
async function checkServerStatus() {
    try {
        console.log('Character Distributor UI: Checking server status...');
        
        // Add a unique timestamp to prevent caching
        const timestamp = Date.now();
        const url = `/api/plugins/character-distributor/status?t=${timestamp}`;
        
        // Set up a timeout for the request
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5-second timeout
        
        try {
            const response = await fetch(url, {
                method: 'GET',
                headers: getRequestHeaders(),
                signal: controller.signal
            });
            
            // Clear timeout since the request completed
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                console.error(`Character Distributor UI: Server status check failed with status ${response.status}`);
                updateServerStatus({
                    status: 'error',
                    message: `Error: Server returned ${response.status} ${response.statusText}`
                });
                return null;
            }
            
            const status = await response.json();
            console.log('Character Distributor UI: Server status:', status);
            
            // Update the UI with the server status
            updateServerStatus(status);
            
            // If authenticated, check for authentication status
            if (status.authenticated === true) {
                updateAuthUI(true, status.user);
            } else {
                updateAuthUI(false);
            }
            
            // Return the status for further processing
            return status;
        } catch (fetchError) {
            // Clear timeout to prevent memory leaks
            clearTimeout(timeoutId);
            
            // Handle abort/timeout separately
            if (fetchError.name === 'AbortError') {
                console.error('Character Distributor UI: Status request timed out after 5 seconds');
                updateServerStatus({
                    status: 'error',
                    message: 'Error: Request timed out. Server not responding.'
                });
            } else {
                console.error('Character Distributor UI: Fetch error during status check:', fetchError.message);
                updateServerStatus({
                    status: 'error',
                    message: `Error: ${fetchError.message}`
                });
            }
            
            return null;
        }
    } catch (error) {
        console.error('Character Distributor UI: Error checking server status:', error);
        updateServerStatus({
            status: 'error',
            message: `Error: ${error.message}`
        });
        return null;
    }
}

/**
 * Update server status in UI
 * @param {Object} status - Server status object
 */
function updateServerStatus(status) {
    try {
        const statusElement = $('#server-status');
        const statusIconElement = $('#server-status-icon');
        const statusTextElement = $('#server-status-text');
        
        // Default to unknown status if no status provided
        if (!status) {
            statusElement.removeClass('status-ok status-warning status-error').addClass('status-unknown');
            statusIconElement.removeClass().addClass('fa fa-question-circle');
            statusTextElement.text('Unknown');
            return;
        }
        
        // Update status based on the status object
        switch (status.status) {
            case 'ok':
                statusElement.removeClass('status-unknown status-warning status-error').addClass('status-ok');
                statusIconElement.removeClass().addClass('fa fa-check-circle');
                statusTextElement.text('Connected');
                break;
                
            case 'warning':
                statusElement.removeClass('status-unknown status-ok status-error').addClass('status-warning');
                statusIconElement.removeClass().addClass('fa fa-exclamation-triangle');
                statusTextElement.text(status.message || 'Warning');
                break;
                
            case 'error':
                statusElement.removeClass('status-unknown status-ok status-warning').addClass('status-error');
                statusIconElement.removeClass().addClass('fa fa-times-circle');
                statusTextElement.text(status.message || 'Error');
                break;
                
            default:
                statusElement.removeClass('status-ok status-warning status-error').addClass('status-unknown');
                statusIconElement.removeClass().addClass('fa fa-question-circle');
                statusTextElement.text('Unknown');
        }
        
        // Update authentication UI elements if status includes auth info
        if (status.hasOwnProperty('authenticated')) {
            updateAuthUI(status.authenticated, status.user);
            
            // If authenticated, update last sync info if available
            if (status.authenticated && status.lastSync) {
                updateLastSyncInfo(status.lastSync);
            }
        }
        
        // Update diagnostics if available
        if (status.diagnostics) {
            updateDiagnostics(status.diagnostics);
        }
    } catch (error) {
        console.error('Character Distributor UI: Error updating server status UI:', error);
    }
}

/**
 * Update auth-related UI elements
 * @param {boolean} isAuthenticated - Whether the user is authenticated
 * @param {Object} user - User information (optional)
 */
function updateAuthUI(isAuthenticated, user = null) {
    try {
        // Get UI elements
        const authStatusElement = $('#auth-status');
        const authButtonsElement = $('#auth-buttons');
        const userInfoElement = $('#user-info');
        const syncButtonElement = $('#trigger-sync-btn');
        
        if (isAuthenticated) {
            // User is authenticated
            authStatusElement.removeClass('status-error').addClass('status-ok');
            authStatusElement.find('.fa').removeClass('fa-times-circle').addClass('fa-check-circle');
            authStatusElement.find('.status-text').text('Authenticated');
            
            // Hide auth buttons and show logout button
            $('#auth-login-btn').hide();
            $('#auth-token-btn').hide();
            $('#auth-logout-btn').show();
            
            // Update user info if available
            if (user) {
                userInfoElement.show();
                $('#user-name').text(user.name || 'Unknown');
                $('#user-email').text(user.email || 'N/A');
                $('#user-account-type').text(user.accountType || 'Basic');
            } else {
                userInfoElement.hide();
            }
            
            // Enable sync button
            syncButtonElement.prop('disabled', false);
        } else {
            // User is not authenticated
            authStatusElement.removeClass('status-ok').addClass('status-error');
            authStatusElement.find('.fa').removeClass('fa-check-circle').addClass('fa-times-circle');
            authStatusElement.find('.status-text').text('Not Authenticated');
            
            // Show auth buttons and hide logout button
            $('#auth-login-btn').show();
            $('#auth-token-btn').show();
            $('#auth-logout-btn').hide();
            
            // Hide user info
            userInfoElement.hide();
            
            // Disable sync button
            syncButtonElement.prop('disabled', true);
        }
    } catch (error) {
        console.error('Character Distributor UI: Error updating auth UI:', error);
    }
}

/**
 * Update last sync information in the UI
 * @param {Object} syncInfo - Sync information
 */
function updateLastSyncInfo(syncInfo) {
    try {
        const lastSyncElement = $('#last-sync-info');
        
        if (!syncInfo) {
            lastSyncElement.hide();
            return;
        }
        
        // Format the sync timestamp
        let syncTimeDisplay = 'Never';
        if (syncInfo.timestamp) {
            try {
                const syncDate = new Date(syncInfo.timestamp);
                syncTimeDisplay = syncDate.toLocaleString();
            } catch (dateError) {
                console.error('Character Distributor UI: Error formatting sync date:', dateError);
                syncTimeDisplay = String(syncInfo.timestamp);
            }
        }
        
        // Update UI elements
        $('#last-sync-time').text(syncTimeDisplay);
        $('#last-sync-status').text(syncInfo.status || 'Unknown');
        
        // Set status-specific styling
        const statusElement = $('#last-sync-status');
        statusElement.removeClass('text-success text-warning text-danger');
        
        switch (syncInfo.status) {
            case 'success':
                statusElement.addClass('text-success');
                break;
            case 'warning':
                statusElement.addClass('text-warning');
                break;
            case 'error':
                statusElement.addClass('text-danger');
                break;
        }
        
        // Show additional details if available
        if (syncInfo.details) {
            $('#last-sync-details').text(syncInfo.details).parent().show();
        } else {
            $('#last-sync-details').parent().hide();
        }
        
        // Show the sync info section
        lastSyncElement.show();
    } catch (error) {
        console.error('Character Distributor UI: Error updating last sync info:', error);
    }
}

/**
 * Update diagnostics information in UI
 * @param {Object} diagnostics - Diagnostics information
 */
function updateDiagnostics(diagnostics) {
    try {
        if (!diagnostics) {
            $('#diagnostics-container').hide();
            return;
        }
        
        // Update plugin version
        if (diagnostics.version) {
            $('#plugin-version').text(diagnostics.version);
        }
        
        // Update storage stats if available
        if (diagnostics.storage) {
            $('#storage-usage').text(
                `${formatBytes(diagnostics.storage.used || 0)} / ${formatBytes(diagnostics.storage.total || 0)}`
            );
            
            // Calculate and show percentage
            if (diagnostics.storage.total && diagnostics.storage.total > 0) {
                const usagePercent = Math.round((diagnostics.storage.used / diagnostics.storage.total) * 100);
                $('#storage-percent').text(`${usagePercent}%`);
                
                // Update progress bar
                const progressBar = $('#storage-progress');
                progressBar.css('width', `${usagePercent}%`);
                
                // Set color based on usage
                progressBar.removeClass('bg-success bg-warning bg-danger');
                if (usagePercent < 70) {
                    progressBar.addClass('bg-success');
                } else if (usagePercent < 90) {
                    progressBar.addClass('bg-warning');
                } else {
                    progressBar.addClass('bg-danger');
                }
            }
            
            // Show storage section
            $('#storage-stats').show();
        } else {
            $('#storage-stats').hide();
        }
        
        // Show the diagnostics container
        $('#diagnostics-container').show();
    } catch (error) {
        console.error('Character Distributor UI: Error updating diagnostics:', error);
    }
}

/**
 * Format bytes to human-readable format
 * @param {number} bytes - Number of bytes
 * @param {number} decimals - Decimal places (default: 2)
 * @returns {string} Formatted string
 */
function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Trigger manual synchronization
 */
async function triggerSync() {
    try {
        console.log('Character Distributor UI: Triggering manual sync...');
        
        // Update UI to show sync in progress
        const syncButton = $('#trigger-sync-btn');
        const originalButtonText = syncButton.text();
        
        syncButton.prop('disabled', true).text('Syncing...');
        $('#sync-spinner').show();
        
        // Get request headers
        const headers = getRequestHeaders();
        headers['Content-Type'] = 'application/json';
        
        // Make the API call with timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30-second timeout for sync
        
        try {
            const response = await fetch('/api/plugins/character-distributor/sync', {
                method: 'POST',
                headers: headers,
                signal: controller.signal
            });
            
            // Clear timeout since the request completed
            clearTimeout(timeoutId);
            
            // Process response
            if (response.ok) {
                const result = await response.json();
                console.log('Character Distributor UI: Sync result:', result);
                
                if (result.success) {
                    toastr.success(result.message || 'Synchronization completed successfully', 'Success');
                    
                    // Update sync status if provided
                    if (result.syncInfo) {
                        updateLastSyncInfo(result.syncInfo);
                    }
                    
                    // Refresh character list after successful sync
                    setTimeout(() => {
                        loadCharacterList();
                    }, 1000);
                } else {
                    console.error('Character Distributor UI: Sync failed:', result.error || 'Unknown error');
                    toastr.error(result.error || 'Synchronization failed', 'Error');
                }
            } else {
                let errorMessage = `Sync failed (Status: ${response.status})`;
                
                try {
                    const errorData = await response.json();
                    errorMessage = errorData.error || errorMessage;
                } catch (parseError) {
                    try {
                        errorMessage = await response.text() || errorMessage;
                    } catch (textError) {
                        console.error('Character Distributor UI: Could not parse error response', textError);
                    }
                }
                
                console.error(`Character Distributor UI: Sync API call failed: ${errorMessage}`);
                toastr.error(errorMessage, 'Sync Error');
            }
        } catch (fetchError) {
            // Always clear the timeout to prevent memory leaks
            clearTimeout(timeoutId);
            
            // Handle abort/timeout separately
            if (fetchError.name === 'AbortError') {
                console.error('Character Distributor UI: Sync request timed out after 30 seconds');
                toastr.error('Sync operation timed out. This might be normal for large libraries.', 'Timeout');
            } else {
                console.error('Character Distributor UI: Fetch error during sync:', fetchError.message);
                toastr.error(`Network error: ${fetchError.message}`, 'Sync Error');
            }
        }
    } catch (error) {
        console.error('Character Distributor UI: Error during sync operation:', error);
        toastr.error(`Error: ${error.message}`, 'Sync Error');
    } finally {
        // Reset UI state
        $('#trigger-sync-btn').prop('disabled', false).text('Sync Now');
        $('#sync-spinner').hide();
        
        // Refresh server status after sync attempt
        setTimeout(checkServerStatus, 1000);
    }
}

/**
 * Update sync status in UI
 * @param {Object} status - Sync status information
 */
function updateSyncStatus(status) {
    try {
        const syncStatusElement = $('#sync-status');
        
        // Hide if no status provided
        if (!status) {
            syncStatusElement.hide();
            return;
        }
        
        // Update state indicator
        const syncStateElement = $('#sync-state');
        syncStateElement.removeClass('text-success text-warning text-danger text-info');
        
        switch (status.state) {
            case 'idle':
                syncStateElement.addClass('text-success').text('Idle');
                break;
            case 'syncing':
                syncStateElement.addClass('text-info').text('Syncing');
                break;
            case 'error':
                syncStateElement.addClass('text-danger').text('Error');
                break;
            default:
                syncStateElement.addClass('text-warning').text('Unknown');
        }
        
        // Update progress if available
        if (status.progress !== undefined) {
            const progressPercent = Math.round(status.progress * 100);
            $('#sync-progress-bar').css('width', `${progressPercent}%`).text(`${progressPercent}%`);
            $('#sync-progress-container').show();
        } else {
            $('#sync-progress-container').hide();
        }
        
        // Update message if available
        if (status.message) {
            $('#sync-message').text(status.message).show();
        } else {
            $('#sync-message').hide();
        }
        
        // Show sync status section
        syncStatusElement.show();
    } catch (error) {
        console.error('Character Distributor UI: Error updating sync status UI:', error);
    }
}

/**
 * Start auto-sync interval
 */
function startAutoSyncInterval() {
    // Clear any existing interval
    if (window.charDistAutoSyncInterval) {
        clearInterval(window.charDistAutoSyncInterval);
    }
    
    // Check if auto-sync is enabled
    if (!extension_settings[MODULE_NAME].autoSync) {
        console.log('Character Distributor UI: Auto-sync is disabled');
        return;
    }
    
    // Get sync interval in milliseconds
    const syncIntervalMs = (extension_settings[MODULE_NAME].syncInterval || 3600) * 1000;
    console.log(`Character Distributor UI: Starting auto-sync interval (${syncIntervalMs}ms)`);
    
    // Set interval
    window.charDistAutoSyncInterval = setInterval(async () => {
        console.log('Character Distributor UI: Auto-sync interval triggered');
        
        // Check if we're authenticated before triggering sync
        const status = await checkServerStatus();
        
        if (status && status.authenticated) {
            console.log('Character Distributor UI: Authenticated, triggering auto-sync');
            triggerSync();
        } else {
            console.warn('Character Distributor UI: Not authenticated, skipping auto-sync');
        }
    }, syncIntervalMs);
}

/**
 * Generate a shareable link for the current character
 */
function generateShareLink() {
    try {
        const characterId = $('#character-dropdown').val();
        
        if (!characterId) {
            toastr.warning('Please select a character first', 'No Character Selected');
            return;
        }
        
        // Create share link
        const baseUrl = window.location.origin;
        const shareUrl = `${baseUrl}/api/plugins/character-distributor/share/${characterId}`;
        
        // Update UI
        $('#share-link-input').val(shareUrl);
        $('#share-link-container').show();
        $('#copy-link-btn').prop('disabled', false);
        
        console.log('Character Distributor UI: Generated share link:', shareUrl);
    } catch (error) {
        console.error('Character Distributor UI: Error generating share link:', error);
        toastr.error('Error generating share link', 'Error');
    }
}

/**
 * Copy share link to clipboard
 */
function copyShareLink() {
    try {
        const shareLink = $('#share-link-input').val();
        
        if (!shareLink) {
            toastr.warning('No share link to copy', 'Warning');
            return;
        }
        
        // Copy to clipboard
        navigator.clipboard.writeText(shareLink)
            .then(() => {
                console.log('Character Distributor UI: Share link copied to clipboard');
                toastr.success('Link copied to clipboard', 'Success');
                
                // Flash the copy button
                const copyButton = $('#copy-link-btn');
                copyButton.text('Copied!');
                setTimeout(() => {
                    copyButton.text('Copy Link');
                }, 2000);
            })
            .catch(error => {
                console.error('Character Distributor UI: Error copying to clipboard:', error);
                toastr.error('Could not copy to clipboard', 'Error');
                
                // Fallback: select text for manual copy
                $('#share-link-input').select();
            });
    } catch (error) {
        console.error('Character Distributor UI: Error copying share link:', error);
        toastr.error('Error copying share link', 'Error');
    }
}

// Export functions
export {
    checkServerStatus,
    updateServerStatus,
    updateAuthUI,
    updateLastSyncInfo,
    updateDiagnostics,
    formatBytes,
    triggerSync,
    updateSyncStatus,
    startAutoSyncInterval,
    generateShareLink,
    copyShareLink
}; 