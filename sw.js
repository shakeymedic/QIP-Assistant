// ==========================================================================
// RCEM QIP ASSISTANT - SERVICE WORKER
// Version: 3.2.0
// ==========================================================================

const CACHE_NAME = 'rcem-qip-v3.2.0';
const STATIC_CACHE = 'rcem-qip-static-v3.2.0';
const DYNAMIC_CACHE = 'rcem-qip-dynamic-v3.2.0';

// Files to cache immediately on install
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/app.js',
    '/charts.js',
    '/renderers.js',
    '/export.js',
    '/state.js',
    '/utils.js',
    '/config.js',
    '/ai.js',
    '/styles.css',
    '/manifest.json'
];

// External CDN resources to cache
const CDN_ASSETS = [
    'https://cdn.tailwindcss.com',
    'https://unpkg.com/lucide@latest',
    'https://cdn.jsdelivr.net/npm/chart.js',
    'https://cdn.jsdelivr.net/npm/chartjs-plugin-annotation@3.0.1/dist/chartjs-plugin-annotation.min.js',
    'https://cdn.jsdelivr.net/npm/mermaid@10.9.0/dist/mermaid.min.js',
    'https://cdn.jsdelivr.net/npm/pptxgenjs@3.12.0/dist/pptxgen.bundle.js',
    'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js',
    'https://cdn.jsdelivr.net/npm/driver.js@1.0.1/dist/driver.css',
    'https://cdn.jsdelivr.net/npm/driver.js@1.0.1/dist/driver.js.iife.js',
    'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Merriweather:wght@300;400;700&display=swap'
];

// ==========================================================================
// INSTALL EVENT
// ==========================================================================

self.addEventListener('install', (event) => {
    console.log('[SW] Installing service worker v3.2.0...');
    
    event.waitUntil(
        Promise.all([
            // Cache static assets
            caches.open(STATIC_CACHE).then((cache) => {
                console.log('[SW] Caching static assets');
                return cache.addAll(STATIC_ASSETS).catch(err => {
                    console.warn('[SW] Some static assets failed to cache:', err);
                });
            }),
            // Cache CDN assets (with error handling for cross-origin)
            caches.open(DYNAMIC_CACHE).then((cache) => {
                console.log('[SW] Caching CDN assets');
                return Promise.allSettled(
                    CDN_ASSETS.map(url => 
                        fetch(url, { mode: 'cors' })
                            .then(response => {
                                if (response.ok) {
                                    return cache.put(url, response);
                                }
                            })
                            .catch(err => {
                                console.warn(`[SW] Failed to cache ${url}:`, err);
                            })
                    )
                );
            })
        ]).then(() => {
            console.log('[SW] Installation complete');
            return self.skipWaiting();
        })
    );
});

// ==========================================================================
// ACTIVATE EVENT
// ==========================================================================

self.addEventListener('activate', (event) => {
    console.log('[SW] Activating service worker...');
    
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames
                    .filter((cacheName) => {
                        // Delete old caches
                        return cacheName !== STATIC_CACHE && 
                               cacheName !== DYNAMIC_CACHE &&
                               cacheName.startsWith('rcem-qip-');
                    })
                    .map((cacheName) => {
                        console.log('[SW] Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    })
            );
        }).then(() => {
            console.log('[SW] Activation complete');
            return self.clients.claim();
        })
    );
});

// ==========================================================================
// FETCH EVENT
// ==========================================================================

self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);
    
    // Skip non-GET requests
    if (request.method !== 'GET') {
        return;
    }
    
    // Skip Firebase requests (always network)
    if (url.hostname.includes('firebaseio.com') || 
        url.hostname.includes('googleapis.com') ||
        url.hostname.includes('firebase') ||
        url.hostname.includes('gstatic.com') ||
        url.hostname.includes('identitytoolkit')) {
        return;
    }
    
    // Skip chrome extension requests
    if (url.protocol === 'chrome-extension:') {
        return;
    }
    
    // Handle navigation requests (HTML pages)
    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request)
                .then((response) => {
                    // Cache successful responses
                    if (response.ok) {
                        const responseClone = response.clone();
                        caches.open(STATIC_CACHE).then((cache) => {
                            cache.put(request, responseClone);
                        });
                    }
                    return response;
                })
                .catch(() => {
                    // Return cached index.html for offline
                    return caches.match('/index.html');
                })
        );
        return;
    }
    
    // Handle static assets (JS, CSS, images)
    if (STATIC_ASSETS.some(asset => url.pathname.endsWith(asset.replace('/', '')))) {
        event.respondWith(
            caches.match(request)
                .then((cachedResponse) => {
                    if (cachedResponse) {
                        // Return cached version, but fetch update in background
                        fetch(request).then((response) => {
                            if (response.ok) {
                                caches.open(STATIC_CACHE).then((cache) => {
                                    cache.put(request, response);
                                });
                            }
                        }).catch(() => {});
                        return cachedResponse;
                    }
                    
                    // Not in cache, fetch from network
                    return fetch(request).then((response) => {
                        if (response.ok) {
                            const responseClone = response.clone();
                            caches.open(STATIC_CACHE).then((cache) => {
                                cache.put(request, responseClone);
                            });
                        }
                        return response;
                    });
                })
        );
        return;
    }
    
    // Handle CDN/external resources
    event.respondWith(
        caches.match(request)
            .then((cachedResponse) => {
                if (cachedResponse) {
                    return cachedResponse;
                }
                
                return fetch(request)
                    .then((response) => {
                        // Only cache successful responses
                        if (response.ok && (url.protocol === 'https:')) {
                            const responseClone = response.clone();
                            caches.open(DYNAMIC_CACHE).then((cache) => {
                                cache.put(request, responseClone);
                            });
                        }
                        return response;
                    })
                    .catch(() => {
                        // Return cached version if network fails
                        return caches.match(request);
                    });
            })
    );
});

// ==========================================================================
// MESSAGE EVENT
// ==========================================================================

self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
    
    if (event.data && event.data.type === 'CLEAR_CACHE') {
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => caches.delete(cacheName))
            );
        }).then(() => {
            if (event.ports && event.ports[0]) {
                event.ports[0].postMessage({ success: true });
            }
        });
    }
    
    if (event.data && event.data.type === 'GET_VERSION') {
        if (event.ports && event.ports[0]) {
            event.ports[0].postMessage({ version: CACHE_NAME });
        }
    }
});

// ==========================================================================
// BACKGROUND SYNC (for offline data saving)
// ==========================================================================

self.addEventListener('sync', (event) => {
    if (event.tag === 'sync-data') {
        console.log('[SW] Background sync triggered');
        // This could be used to sync data when coming back online
        // For now, the app handles this with Firebase's built-in sync
    }
});

// ==========================================================================
// PUSH NOTIFICATIONS (future use)
// ==========================================================================

self.addEventListener('push', (event) => {
    if (event.data) {
        const data = event.data.json();
        const options = {
            body: data.body || 'QIP Assistant notification',
            icon: 'https://iili.io/KGQOvkl.md.png',
            badge: 'https://iili.io/KGQOvkl.md.png',
            vibrate: [100, 50, 100],
            data: {
                dateOfArrival: Date.now(),
                primaryKey: 1
            }
        };
        
        event.waitUntil(
            self.registration.showNotification(data.title || 'RCEM QIP Assistant', options)
        );
    }
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil(
        clients.openWindow('/')
    );
});

console.log('[SW] Service worker loaded - v3.2.0');
