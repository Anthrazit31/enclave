# Phoenix Industries - ENCLAVE Access Control System

A secure, cyberpunk-themed access control interface for Phoenix Industries.

## Features

- 🔐 **Multi-level Authentication**: Different access levels for military and research personnel
- 🎨 **Retro CRT Effect**: Authentic terminal aesthetics with scan lines and flicker effects
- 🔊 **Audio Integration**: Background music and sound effects for enhanced immersion
- 🛡️ **Security Protection**: DevTools detection and unauthorized access prevention
- 📱 **Responsive Design**: Works across all devices
- ⚡ **Performance Optimized**: Fast loading with efficient code structure

## File Structure

```
enclave/
├── assets/
│   ├── css/
│   │   └── common.css          # Shared styles
│   ├── js/
│   │   ├── security.js         # Security & DevTools protection
│   │   └── access-control.js   # Session & access management
│   └── images/                 # Image assets
├── sounds/                     # Audio files
├── community/                  # Community content
├── communityleaders/          # Community leaders content
├── drones/                    # Drone content
├── index.html                 # Login page
├── terminal.html              # Military terminal
├── terminal2.html             # Research terminal
├── raiden3.html              # Raiden3 content
├── zero.html                 # Zero content
├── genz.html                 # GenZ content
├── manifest.json             # PWA manifest
├── robots.txt                # SEO configuration
└── .htaccess                 # Server configuration

## Access Codes

### Military Personnel
- **Code**: `enclave`
- **Access**: Military Terminal
- **Type**: Standard Military

- **Code**: `fppwjfucxymwi22mwfzzrg0bvmt6yu8svu0mb1fc`
- **Access**: Military Terminal
- **User**: Roman Mitchell
- **Security**: Low

### Research Personnel
- **Code**: `arastirma`
- **Access**: Research Terminal
- **Security**: High

- **Code**: `1603`
- **Access**: Research Terminal
- **User**: John Smith
- **Security**: High

- **Code**: `1561`
- **Access**: Research Terminal
- **User**: Michael Schofield
- **Security**: Low

## Security Features

1. **Session Management**: 30-minute timeout
2. **DevTools Detection**: Alerts and logs unauthorized access attempts
3. **Discord Webhook**: Security event logging
4. **Keyboard Shortcuts Disabled**: F12, Ctrl+Shift+I, Ctrl+U, etc.
5. **Right-click Protection**: Context menu disabled
6. **Print Protection**: Printing blocked

## Performance Optimizations

- CSS variables for theming
- Optimized animations with `will-change`
- GZIP compression enabled
- Browser caching configured
- Lazy loading for audio
- Reduced motion support for accessibility

## Browser Support

- ✅ Chrome/Edge (latest)
- ✅ Firefox (latest)
- ✅ Safari (latest)
- ✅ Opera (latest)

## Installation

1. Upload all files to your web server
2. Ensure `.htaccess` is enabled (Apache servers)
3. Configure SSL certificate for HTTPS (recommended)
4. Update Discord webhook URL in `assets/js/security.js`

## Development

To modify:
- **Styles**: Edit `assets/css/common.css`
- **Security**: Edit `assets/js/security.js`
- **Access Control**: Edit `assets/js/access-control.js`

## License

© Phoenix Industries. All rights reserved.

## Support

For issues or questions, contact the development team.
