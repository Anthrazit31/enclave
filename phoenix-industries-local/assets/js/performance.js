// Phoenix Industries - Performance Monitoring
(function() {
    'use strict';
    
    // Lazy load images
    function lazyLoadImages() {
        const images = document.querySelectorAll('img[data-src]');
        
        const imageObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    img.src = img.dataset.src;
                    img.removeAttribute('data-src');
                    observer.unobserve(img);
                }
            });
        });
        
        images.forEach(img => imageObserver.observe(img));
    }
    
    // Preload critical assets
    function preloadCriticalAssets() {
        const criticalAssets = [
            'sounds/background.mp3',
            'sounds/accessgranted.mp3',
            'sounds/debugtools.mp3'
        ];
        
        criticalAssets.forEach(asset => {
            const link = document.createElement('link');
            link.rel = 'preload';
            link.as = asset.endsWith('.mp3') ? 'audio' : 'fetch';
            link.href = asset;
            document.head.appendChild(link);
        });
    }
    
    // Defer non-critical scripts
    function deferNonCriticalScripts() {
        const scripts = document.querySelectorAll('script[data-defer]');
        scripts.forEach(script => {
            const newScript = document.createElement('script');
            newScript.src = script.dataset.src;
            newScript.defer = true;
            document.body.appendChild(newScript);
        });
    }
    
    // Monitor performance
    function monitorPerformance() {
        if ('performance' in window) {
            window.addEventListener('load', () => {
                const perfData = performance.timing;
                const pageLoadTime = perfData.loadEventEnd - perfData.navigationStart;
                const connectTime = perfData.responseEnd - perfData.requestStart;
                const renderTime = perfData.domComplete - perfData.domLoading;
                
                console.log('Performance Metrics:');
                console.log(`Page Load Time: ${pageLoadTime}ms`);
                console.log(`Server Connect Time: ${connectTime}ms`);
                console.log(`Render Time: ${renderTime}ms`);
                
                // Send to analytics if available
                if (window.analytics) {
                    window.analytics.track('Performance', {
                        pageLoadTime,
                        connectTime,
                        renderTime
                    });
                }
            });
        }
    }
    
    // Optimize animations for performance
    function optimizeAnimations() {
        // Use requestAnimationFrame for smoother animations
        const animatedElements = document.querySelectorAll('[data-animate]');
        
        animatedElements.forEach(element => {
            element.style.willChange = element.dataset.animate;
        });
    }
    
    // Debounce function for performance
    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
    
    // Throttle function for performance
    function throttle(func, limit) {
        let inThrottle;
        return function(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }
    
    // Initialize on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            lazyLoadImages();
            preloadCriticalAssets();
            optimizeAnimations();
            monitorPerformance();
        });
    } else {
        lazyLoadImages();
        preloadCriticalAssets();
        optimizeAnimations();
        monitorPerformance();
    }
    
    // Export utilities
    window.Performance = {
        debounce,
        throttle
    };
    
})();
