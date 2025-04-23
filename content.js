/*!
 * FJ Auto Connect - Financial Juice Voice Player Auto-Connection Extension
 * Copyright (c) 2025. All Rights Reserved.
 * 
 * PROPRIETARY AND CONFIDENTIAL
 * This is proprietary software. Any unauthorized copying, modification,
 * distribution, or use is strictly prohibited. All rights reserved.
 * 
 * This software is protected by copyright law and international treaties.
 * Unauthorized reproduction or distribution of this software, or any portion
 * of it, may result in severe civil and criminal penalties.
 */

// Configuration
const CONFIG = {
    checkInterval: 3000,    // Check every 3 seconds
    maxRetries: 5,         // Maximum number of retry attempts
    retryDelay: 2000,      // Delay between retries in milliseconds
    initialDelay: 3000,    // Delay before first connection attempt
    debounceDelay: 5000    // Minimum time between connection attempts
};

let retryCount = 0;
let isInitialLoad = true;
let lastConnectionAttempt = 0;
let lastKnownState = null;
let isConnecting = false;

// Function to check if voice player exists
function findVoicePlayer() {
    return document.querySelector('.voice-player');
}

// Function to find the launch button
function findLaunchButton() {
    return document.querySelector('.player-left');
}

// Function to get player status
function getPlayerStatus() {
    const playerStatus = document.querySelector('#player-status');
    const playerPlaying = document.querySelector('#player-playing');
    const launchText = document.querySelector('#player-launch');
    const oscilloscope = document.querySelector('#oscilloscopezz');
    
    return {
        statusText: playerStatus ? playerStatus.textContent : '',
        isPlaying: playerPlaying ? playerPlaying.style.display === 'block' : false,
        launchText: launchText ? launchText.textContent : '',
        hasOscilloscope: oscilloscope ? true : false,
        oscilloscopeVisible: oscilloscope ? window.getComputedStyle(oscilloscope).display !== 'none' : false
    };
}

// Function to check if voice player is disconnected or not connected
function isVoicePlayerDisconnected() {
    const voicePlayer = findVoicePlayer();
    if (!voicePlayer) return true;

    const status = getPlayerStatus();
    
    // Debug logging
    console.log('FJ Auto Connect: Current state:', {
        statusText: status.statusText,
        isPlaying: status.isPlaying,
        launchText: status.launchText,
        hasOscilloscope: status.hasOscilloscope,
        oscilloscopeVisible: status.oscilloscopeVisible
    });

    // If we're in the process of connecting, don't consider it disconnected
    if (isConnecting) {
        return false;
    }

    // Check for definitely connected state
    if (status.isPlaying && status.oscilloscopeVisible) {
        lastKnownState = false;
        return false;
    }

    // Check various states that might indicate disconnection
    const isDisconnected = (
        status.statusText === 'VOICE NEWS' ||    // Initial state
        status.launchText === 'LAUNCH' ||        // Launch button visible
        !status.isPlaying ||                     // Player not playing
        !status.oscilloscopeVisible ||           // Oscilloscope not visible
        (status.hasOscilloscope && !status.oscilloscopeVisible) // Has oscilloscope but not visible
    );

    // If state has changed or it's been disconnected for a while
    if (isDisconnected !== lastKnownState || (isDisconnected && Date.now() - lastConnectionAttempt > CONFIG.debounceDelay)) {
        console.log('FJ Auto Connect: State changed from', lastKnownState, 'to', isDisconnected);
        lastKnownState = isDisconnected;
        return isDisconnected;
    }

    return lastKnownState || false;
}

// Function to attempt connection
function attemptConnect() {
    const now = Date.now();
    if (now - lastConnectionAttempt < CONFIG.debounceDelay) {
        console.log('FJ Auto Connect: Skipping connection attempt (debounce)');
        return false;
    }

    const launchButton = findLaunchButton();
    if (!launchButton) return false;

    console.log('FJ Auto Connect: Attempting to connect...');
    lastConnectionAttempt = now;
    isConnecting = true;

    // Try to use the website's function first
    if (typeof ToggleVoice === 'function') {
        try {
            ToggleVoice(false);
        } catch (e) {
            console.log('FJ Auto Connect: ToggleVoice failed, falling back to click');
            launchButton.click();
        }
    } else {
        launchButton.click();
    }

    // Reset connecting state after a delay
    setTimeout(() => {
        isConnecting = false;
        // Check if we successfully connected
        const status = getPlayerStatus();
        if (!status.isPlaying || !status.oscilloscopeVisible) {
            console.log('FJ Auto Connect: Connection attempt may have failed, will retry if needed');
            lastKnownState = true; // Force another check
        }
    }, 3000);
    
    retryCount++;
    return true;
}

// Main monitoring function
function monitorConnection() {
    if (isVoicePlayerDisconnected()) {
        console.log('FJ Auto Connect: Disconnection detected');
        
        if (retryCount < CONFIG.maxRetries) {
            setTimeout(() => {
                if (attemptConnect()) {
                    console.log('FJ Auto Connect: Connection attempt made');
                }
            }, isInitialLoad ? CONFIG.initialDelay : CONFIG.retryDelay);
        } else {
            console.log('FJ Auto Connect: Maximum retry attempts reached, resetting and waiting');
            retryCount = 0;
            isInitialLoad = false;
            // Reset last known state to allow new attempts after a break
            setTimeout(() => {
                lastKnownState = null;
            }, CONFIG.debounceDelay);
        }
    } else {
        console.log('FJ Auto Connect: Connection active');
        retryCount = 0;
        isInitialLoad = false;
    }
}

// Function to handle initial connection
function handleInitialConnection() {
    console.log('FJ Auto Connect: Checking initial connection state');
    monitorConnection();
}

// Start monitoring
setInterval(monitorConnection, CONFIG.checkInterval);

// Initial connection attempts
window.addEventListener('load', () => {
    console.log('FJ Auto Connect: Extension activated');
    setTimeout(handleInitialConnection, CONFIG.initialDelay);
});

// Monitor for DOM changes that might indicate player state changes
const observer = new MutationObserver((mutations) => {
    let shouldCheck = false;
    
    for (const mutation of mutations) {
        const target = mutation.target;
        if (target.matches('.voice-player') || 
            target.closest('.voice-player') ||
            target.id === 'player-status' ||
            target.id === 'player-launch' ||
            target.id === 'player-playing' ||
            target.id === 'oscilloscopezz') {
            
            shouldCheck = true;
            break;
        }
    }

    if (shouldCheck) {
        requestAnimationFrame(() => {
            monitorConnection();
        });
    }
});

// Start observing once the player is found
function startObserving() {
    const voicePlayer = findVoicePlayer();
    if (voicePlayer) {
        observer.observe(document.body, {
            attributes: true,
            childList: true,
            subtree: true
        });
        handleInitialConnection();
    } else {
        setTimeout(startObserving, 1000);
    }
}

startObserving(); 