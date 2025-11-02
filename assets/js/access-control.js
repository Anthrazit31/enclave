// Phoenix Industries - Access Control Module
function checkAccess() {
    const userIdentifier = localStorage.getItem('userIdentifier');
    const userPassword = localStorage.getItem('userPassword');
    const userType = localStorage.getItem('userType');
    const accessLevel = localStorage.getItem('accessLevel');
    
    // Check if user is authenticated
    if (!userIdentifier || !userPassword || !userType) {
        console.log('Kimlik doğrulama başarısız: Eksik kullanıcı bilgileri');
        alert('⚠️ Yetkisiz erişim! Lütfen giriş yapın.');
        window.location.replace('index.html');
        return false;
    }
    
    // Session timeout check (30 minutes)
    const loginTime = localStorage.getItem('loginTime');
    if (loginTime) {
        const currentTime = new Date().getTime();
        const sessionDuration = 30 * 60 * 1000; // 30 minutes
        
        if (currentTime - parseInt(loginTime) > sessionDuration) {
            console.log('Oturum süresi doldu');
            alert('⏰ Oturum süresi doldu. Lütfen tekrar giriş yapın.');
            logoutUser();
            return false;
        }
    }
    
    // Admin kontrolü
    if (accessLevel === 'ADMIN') {
        console.log('Admin erişimi doğrulandı');
    }
    
    // Update login time
    localStorage.setItem('loginTime', new Date().getTime().toString());
    return true;
}

// Kullanıcı çıkış fonksiyonu
function logoutUser() {
    // Tüm oturum verilerini temizle
    localStorage.clear();
    sessionStorage.clear();
    
    // Çerezleri temizle
    document.cookie.split(";").forEach(function(c) {
        document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
    });
    
    // Ana sayfaya yönlendir
    window.location.replace('index.html');
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
