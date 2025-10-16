// Phoenix Industries - Access Control Module
function checkAccess() {
    const userIdentifier = localStorage.getItem('userIdentifier');
    const userPassword = localStorage.getItem('userPassword');
    const userType = localStorage.getItem('userType');
    
    // Check if user is authenticated
    if (!userIdentifier || !userPassword || !userType) {
        alert('⚠️ Unauthorized access! Please login.');
        window.location.replace('index.html');
        return false;
    }
    
    // Session timeout check (30 minutes)
    const loginTime = localStorage.getItem('loginTime');
    if (loginTime) {
        const currentTime = new Date().getTime();
        const sessionDuration = 30 * 60 * 1000; // 30 minutes
        
        if (currentTime - parseInt(loginTime) > sessionDuration) {
            alert('⏰ Session expired. Please login again.');
            localStorage.clear();
            window.location.replace('index.html');
            return false;
        }
    }
    
    // Update login time
    localStorage.setItem('loginTime', new Date().getTime().toString());
    return true;
}

// Set security-based access for terminal2.html
function setSecurityBasedAccess(securityLevel) {
    const securedButtons = document.querySelectorAll('[data-security]');
    
    if (securityLevel === 'low') {
        // Low security level: No access to secured buttons
        securedButtons.forEach(button => {
            button.classList.add('permanently-locked');
            button.style.opacity = '0.3';
            button.style.cursor = 'not-allowed';
            button.title = 'Insufficient Security Clearance';
            
            // Disable button functionality
            button.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                alert('⛔ Access Denied: Insufficient Security Clearance');
            }, true);
        });
    } else if (securityLevel === 'high') {
        // High security level: Full access
        securedButtons.forEach(button => {
            button.classList.remove('permanently-locked');
            button.style.opacity = '1';
            button.style.cursor = 'pointer';
        });
    }
}

// Initialize access control
(function() {
    'use strict';
    
    // Check access on page load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            if (checkAccess()) {
                const securityLevel = localStorage.getItem('securityLevel');
                if (securityLevel) {
                    setSecurityBasedAccess(securityLevel);
                }
            }
        });
    } else {
        if (checkAccess()) {
            const securityLevel = localStorage.getItem('securityLevel');
            if (securityLevel) {
                setSecurityBasedAccess(securityLevel);
            }
        }
    }
})();
