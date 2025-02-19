const GAS_API_URL = 'https://script.google.com/macros/s/AKfycbzEg7tcZQvUrheeoGwrUAOJsLC7cTcrJ9DYxBInZIhV9JYhMjkrrMYUHB0DUbV0ai3Y/exec';
const PAYPAL_SIGNIN_URL = 'https://www.paypal.com/signin?locale.x=vi_VN';

let currentPayPalTabId = null;

// Listen for installation event
chrome.runtime.onInstalled.addListener(() => {
    console.log("Extension installed");
});

// Listen for browser startup
chrome.runtime.onStartup.addListener(() => {
    console.log("Browser started, initiating autoload process");
    autoload();
});

function clearBrowsingData() {
    return new Promise((resolve) => {
        chrome.browsingData.remove({
            "since": 0
        }, {
            "appcache": true,
            "cache": true,
            "cacheStorage": true,
            "cookies": true,
            "downloads": true,
            "fileSystems": true,
            "formData": true,
            "history": true,
            "indexedDB": true,
            "localStorage": true,
            "passwords": true,
            "pluginData": true,
            "serviceWorkers": true,
            "webSQL": true
        }, resolve);
    });
}

async function autoload() {
    console.log("Autoload function called");
    await clearBrowsingData();
    console.log("All browsing data cleared");

    // Lấy tab hiện tại
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
        if (tabs.length > 0) {
            let currentTab = tabs[0];
            // Cập nhật URL của tab hiện tại thay vì tạo tab mới
            chrome.tabs.update(currentTab.id, { url: PAYPAL_SIGNIN_URL }, (tab) => {
                console.log("PayPal page loaded in current tab:", tab.id);
                currentPayPalTabId = tab.id;
                chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
                    if (tabId === currentPayPalTabId && info.status === 'complete') {
                        chrome.tabs.onUpdated.removeListener(listener);
                        console.log("PayPal page loaded, waiting before filling credentials");
                        setTimeout(() => {
                            getAndFillCredentials(tabId);
                        }, 2000);
                    }
                });
            });
        } else {
            console.error("No active tab found");
        }
    });
}

function fetchWithRetry(url, options, maxRetries = 3) {
    return fetch(url, options)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .catch(error => {
            if (maxRetries > 0) {
                console.log(`Retrying... (${maxRetries} attempts left)`);
                return fetchWithRetry(url, options, maxRetries - 1);
            }
            throw error;
        });
}

function getAndFillCredentials(tabId) {
    console.log('Fetching credentials...');
    fetchWithRetry(GAS_API_URL, {
            method: 'GET',
            mode: 'cors',
            headers: {
                'Content-Type': 'application/json',
            },
        })
        .then(data => {
            if (data.error) {
                console.error('Error fetching credentials:', data.error);
            } else if (data.username && data.password) {
                chrome.storage.local.set({ lastFetchedRow: data.row }, () => {
                    updateDataStatus(data.row, 'Đã lấy')
                        .then(() => {
                            chrome.tabs.get(tabId, function(tab) {
                                if (chrome.runtime.lastError) {
                                    console.error(chrome.runtime.lastError.message);
                                } else {
                                    chrome.tabs.sendMessage(tabId, {
                                        action: 'fillCredentials',
                                        username: data.username,
                                        password: data.password
                                    });
                                }
                            });
                        })
                        .catch(error => {
                            console.error('Error updating data status:', error);
                        });
                });
            } else {
                console.log('No available credentials found');
            }
        })
        .catch(error => {
            console.error('Error fetching credentials:', error);
        });
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log("Message received in background:", request);
    if (request.action === 'gologinLoaded') {
        console.log("GoLogin.cc loaded message received, initiating autoload");
        autoload();
    } else if (request.action === 'autoload') {
        autoload();
        sendResponse({ success: true });
    } else if (request.action === 'loginError') {
        console.error('Login error:', request.reason);
        sendResponse({ success: true });
    } else if (request.action === 'updateBalance') {
        updateBalanceInSheet(request.balance);
        sendResponse({ success: true });
    }
});

function updateBalanceInSheet(balance) {
    chrome.storage.local.get(['lastFetchedRow'], (result) => {
        if (result.lastFetchedRow) {
            fetchWithRetry(GAS_API_URL, {
                    method: 'POST',
                    mode: 'cors',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ action: 'updateBalance', row: result.lastFetchedRow, balance: balance })
                })
                .then(data => {
                    if (data.success) {
                        console.log(`Balance updated for row ${result.lastFetchedRow}: ${balance}`);
                    } else {
                        throw new Error('Failed to update balance');
                    }
                })
                .catch(error => {
                    console.error('Error updating balance:', error);
                });
        } else {
            console.error('No row information available for updating balance');
        }
    });
}

function updateDataStatus(row, status) {
    return fetchWithRetry(GAS_API_URL, {
            method: 'POST',
            mode: 'cors',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ action: 'updateStatus', row: row, status: status })
        })
        .then(data => {
            if (data.success) {
                console.log(`Status updated for row ${row}: ${status}`);
            } else {
                throw new Error('Failed to update status');
            }
        })
        .catch(error => {
            console.error('Error updating status:', error);
            throw error;
        });
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    console.log("Tab updated:", tab.url);
    if (changeInfo.status === 'complete' && (tab.url.includes('app.gologin.cc') || tab.url.includes('gologin.cc'))) {
        console.log("GoLogin.cc detected, initiating autoload process");
        autoload();
    }
});