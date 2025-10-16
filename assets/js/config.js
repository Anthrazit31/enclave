// Phoenix Industries - Configuration
const CONFIG = {
    // Discord Webhook for security logging
    WEBHOOK_URL: 'https://discord.com/api/webhooks/1366237046670102621/Qme-enwqBGenG2VSB9DHwt4r3z8zQKiOsV8KKOspPXt72gcfZh28oRLd9jq1r9vwUzqV',
    
    // Session timeout in milliseconds (30 minutes)
    SESSION_TIMEOUT: 30 * 60 * 1000,
    
    // Audio settings
    AUDIO: {
        background_volume: 0.2,
        access_granted_volume: 0.5,
        warning_volume: 0.1
    },
    
    // Security thresholds
    SECURITY: {
        devtools_threshold: 160,
        devtools_check_interval: 500
    },
    
    // Password identifiers
    PASSWORDS: {
        "enclave": {
            identifier: "military_enclave",
            type: "military",
            redirect: "terminal.html",
            message: "ACCESS GRANTED - MILITARY PERSONNEL"
        },
        "arastirma": {
            identifier: "researcher_arastirma",
            type: "researcher",
            securityLevel: "high",
            redirect: "terminal2.html",
            message: "ACCESS GRANTED - RESEARCHER"
        },
        "fppwjfucxymwi22mwfzzrg0bvmt6yu8svu0mb1fc": {
            identifier: "kemal",
            type: "militaryresearcher",
            securityLevel: "low",
            redirect: "terminal.html",
            message: "ACCESS GRANTED - ROMAN MITCHEL // MILITARY PERSONNEL"
        },
        "1561": {
            identifier: "bokkafa",
            type: "arastirmacimicheal",
            securityLevel: "low",
            redirect: "terminal2.html",
            message: "ACCESS GRANTED - MICHEAL SCHOFIELD // RESEARCHER"
        },
        "1603": {
            identifier: "çiş",
            type: "arastirmacijohn",
            securityLevel: "high",
            redirect: "terminal2.html",
            message: "ACCESS GRANTED - JOHN SMITH // RESEARCHER"
        }
    },
    
    // Loading sequence timing
    TIMING: {
        loading_screen_duration: 3000,
        loading_fade_duration: 1000,
        access_overlay_duration: 2000
    }
};

// Freeze config to prevent modifications
Object.freeze(CONFIG);
Object.freeze(CONFIG.AUDIO);
Object.freeze(CONFIG.SECURITY);
Object.freeze(CONFIG.PASSWORDS);
Object.freeze(CONFIG.TIMING);
