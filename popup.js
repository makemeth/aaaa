document.getElementById('autoLoginBtn').addEventListener('click', function() {
    chrome.runtime.sendMessage({ action: 'autoload' }, function(response) {
        window.close();
    });
});