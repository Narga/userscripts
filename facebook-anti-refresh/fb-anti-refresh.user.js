// ==UserScript==
// @name         Facebook Anti-Refresh
// @namespace    CustomScripts
// @description  Reduce unwanted Facebook feed refresh requests while inactive
// @author       narga
// @version      2.1.0
// @license      MIT
// @homepage     https://github.com/narga
// @icon         https://www.google.com/s2/favicons?sz=64&domain=facebook.com
// @match        *://*.facebook.com/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    // ============================================================
    // CONFIGURATION
    // ============================================================
    const CONFIG = {
        enabled: true,

        // Block matching requests after this much inactivity.
        inactivityThreshold: 90_000,

        debug: false,

        // XHR cancellation is inherently less reliable than
        // preventing a fetch from being dispatched.
        // Keep false unless you specifically need XHR interception.
        interceptXHR: false,

        // Exact operation names only.
        // Review these names in your own Facebook session.
        blockedOperations: [
            'CometFeedQuery',
            'CometModernHomeFeedQuery',
            'NewsFeedQuery',
            'HomeRequestQuery',
            'CometFeedUnitContainerSectionQuery',
            'useCometFeedStoryMatchDebugger',
            'CometFeedStoryStrategy'
        ]
    };

    if (!CONFIG.enabled) return;

    const PREFIX = '[FB Anti-Refresh]';
    const blockedNames = new Set(CONFIG.blockedOperations);

    const state = {
        lastActivity: Date.now(),
        blockedCount: 0
    };

    const log = (...args) => {
        if (CONFIG.debug) console.log(PREFIX, ...args);
    };

    // ============================================================
    // USER ACTIVITY
    // ============================================================
    const activityEvents = [
        'pointerdown',
        'keydown',
        'scroll',
        'touchstart',
        'input',
        'focus'
    ];

    function markActivity() {
        state.lastActivity = Date.now();
    }

    for (const eventName of activityEvents) {
        window.addEventListener(eventName, markActivity, {
            capture: true,
            passive: true
        });
    }

    // Avoid treating every tiny mouse movement as meaningful activity.
    let lastPointerMove = 0;

    window.addEventListener('pointermove', () => {
        const now = Date.now();

        if (now - lastPointerMove >= 250) {
            lastPointerMove = now;
            markActivity();
        }
    }, { capture: true, passive: true });

    function getIdleSeconds() {
        return Math.floor((Date.now() - state.lastActivity) / 1000);
    }

    function isInactive() {
        return Date.now() - state.lastActivity >=
            CONFIG.inactivityThreshold;
    }

    // ============================================================
    // GRAPHQL OPERATION EXTRACTION
    // ============================================================
    function fromObject(value) {
        if (!value || typeof value !== 'object') return '';

        // Only use actual operation-name fields.
        // doc_id is a document identifier, not an operation name.
        const name =
            value.fb_api_req_friendly_name ??
            value.operationName ??
            '';

        if (typeof name === 'string') return name;

        return '';
    }

    function extractOperationName(body) {
        if (body == null) return '';

        try {
            if (typeof body === 'string') {
                const trimmed = body.trim();

                if (!trimmed) return '';

                // JSON payload
                if (trimmed.startsWith('{')) {
                    return fromObject(JSON.parse(trimmed));
                }

                // Form URL-encoded payload
                const params = new URLSearchParams(trimmed);

                const friendlyName =
                    params.get('fb_api_req_friendly_name');

                if (friendlyName) return friendlyName;

                const operationName = params.get('operationName');

                if (operationName) return operationName;

                // Some GraphQL payloads include the operation
                // name only inside the query string.
                const query = params.get('query');

                if (query) {
                    const match = query.match(
                        /\b(?:query|mutation|subscription)\s+([A-Za-z_]\w*)/
                    );

                    if (match) return match[1];
                }

                return '';
            }

            if (
                typeof FormData !== 'undefined' &&
                body instanceof FormData
            ) {
                return (
                    body.get('fb_api_req_friendly_name') ||
                    body.get('operationName') ||
                    ''
                ).toString();
            }

            if (body instanceof URLSearchParams) {
                return (
                    body.get('fb_api_req_friendly_name') ||
                    body.get('operationName') ||
                    ''
                ).toString();
            }
        } catch (error) {
            log('Unable to parse request body:', error);
        }

        // Blob, ReadableStream, ArrayBuffer and other bodies
        // are deliberately not consumed or modified.
        return '';
    }

    function shouldBlock(url, body, transport) {
        if (typeof url !== 'string') return false;
        if (!url.includes('/api/graphql/')) return false;

        const operation = extractOperationName(body);

        // Fail open: unknown operations are always allowed.
        if (!operation || !blockedNames.has(operation)) return false;

        if (!isInactive()) return false;

        state.blockedCount++;

        log(
            'Blocked request',
            '#' + state.blockedCount,
            'operation=' + operation,
            'transport=' + transport,
            'idle=' + getIdleSeconds() + 's'
        );

        return true;
    }

    // ============================================================
    // FETCH INTERCEPTION
    // ============================================================
    const originalFetch = window.fetch;

    if (typeof originalFetch === 'function') {
        window.fetch = function (resource, init) {
            let url = '';
            let body = init?.body ?? null;

            try {
                if (typeof resource === 'string') {
                    url = resource;
                } else if (resource instanceof URL) {
                    url = resource.href;
                } else if (resource instanceof Request) {
                    url = resource.url;
                }
            } catch {
                // If the request cannot be inspected, allow it.
                return originalFetch.apply(this, arguments);
            }

            // Request bodies are not available synchronously through
            // Request.body. Clone and inspect only GraphQL Requests
            // whose body was not overridden in init.
            if (
                resource instanceof Request &&
                init?.body == null &&
                url.includes('/api/graphql/')
            ) {
                let clone;

                try {
                    clone = resource.clone();
                } catch {
                    return originalFetch.apply(this, arguments);
                }

                return clone.text().then(text => {
                    if (shouldBlock(url, text, 'fetch')) {
                        throw new TypeError(
                            PREFIX + ' blocked inactive feed request'
                        );
                    }

                    return originalFetch.apply(this, arguments);
                });
            }

            if (shouldBlock(url, body, 'fetch')) {
                return Promise.reject(
                    new TypeError(
                        PREFIX + ' blocked inactive feed request'
                    )
                );
            }

            return originalFetch.apply(this, arguments);
        };
    }

    // ============================================================
    // OPTIONAL XHR INTERCEPTION
    // ============================================================
    if (CONFIG.interceptXHR) {
        const xhrOpen = XMLHttpRequest.prototype.open;
        const xhrSend = XMLHttpRequest.prototype.send;
        const xhrAbort = XMLHttpRequest.prototype.abort;

        XMLHttpRequest.prototype.open = function (method, url, ...rest) {
            this.__fbAntiRefreshUrl =
                typeof url === 'string' ? url : '';

            return xhrOpen.call(this, method, url, ...rest);
        };

        XMLHttpRequest.prototype.send = function (body) {
            if (
                shouldBlock(
                    this.__fbAntiRefreshUrl,
                    body,
                    'xhr'
                )
            ) {
                // Native abort is preferable to manually invoking
                // onabort. It may still race with request dispatch.
                try {
                    xhrAbort.call(this);
                } catch (error) {
                    log('XHR abort failed:', error);
                }

                return;
            }

            return xhrSend.call(this, body);
        };
    }

    log('Initialized');
    log('Inactivity threshold:', CONFIG.inactivityThreshold, 'ms');
    log('XHR interception:', CONFIG.interceptXHR);
})();
