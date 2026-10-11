
// ==UserScript==
// @name         Google SSO Popup Blocker
// @namespace    CustomScripts
// @version      2.0.0
// @description  Block Google One Tap / GIS sign-in prompts
// @author       narga
// @homepage     https://github.com/narga
// @downloadURL  https://raw.githubusercontent.com/Narga/userscripts/refs/heads/main/anti-google-sso-login/anti-google-sso-login.user.js
// @updateURL    https://raw.githubusercontent.com/Narga/userscripts/refs/heads/main/anti-google-sso-login/anti-google-sso-login.user.js
// @match        *://*/*
// @exclude      *://localhost/*
// @exclude      *://127.0.0.1/*
// @exclude      *://192.168.*/*
// @exclude      *://10.*/*
// @exclude      *://172.16.*/*
// @exclude      *://*.local/*
// @exclude      *://github.com/*
// @exclude      *://gitlab.com/*
// @run-at       document-start
// @grant        GM_addStyle
// @license      MIT
// ==/UserScript==

(function () {
    'use strict';

    // ============================================================
    // CONFIGURATION
    // ============================================================
    const CONFIG = {
        debug: false,

        // Keep observing for the lifetime of the page.
        // Do not stop after the first successful removal.
        persistent: true,

        // Remove matching popup elements rather than only hiding them.
        removeElements: true,

        // Safety sweep for delayed or recreated elements.
        fallbackIntervalMs: 2500,

        // Set true only if you also want to hide Google's
        // explicitly embedded sign-in buttons.
        blockInlineSignInButtons: false
    };

    const log = (...args) => {
        if (CONFIG.debug) {
            console.log('[SSO Blocker]', ...args);
        }
    };

    // ============================================================
    // SELECTORS
    // ============================================================
    const POPUP_SELECTORS = [
        '#credential_picker_container',
        '#g_id_intermediate_iframe',
        '#credential_picker_iframe',
        'iframe[src*="accounts.google.com/gsi/"]',
        'iframe[src*="accounts.google.com/gsi/iframe"]',
        'iframe[src*="smartlock.google.com/iframe/"]'
    ];

    const CONFIG_SELECTORS = [
        '#g_id_onload'
    ];

    const INLINE_SELECTORS = [
        '.g_id_signin'
    ];

    const ALL_SELECTORS = [
        ...POPUP_SELECTORS,
        ...CONFIG_SELECTORS,
        ...(CONFIG.blockInlineSignInButtons ? INLINE_SELECTORS : [])
    ];

    // ============================================================
    // CSS FALLBACK
    // ============================================================
    const cssSelectors = [
        ...POPUP_SELECTORS,
        ...(CONFIG.blockInlineSignInButtons ? INLINE_SELECTORS : [])
    ];

    GM_addStyle(`
        ${cssSelectors.join(',\n')} {
            display: none !important;
            visibility: hidden !important;
            opacity: 0 !important;
            pointer-events: none !important;
        }
    `);

    // ============================================================
    // ELEMENT HANDLING
    // ============================================================
    const removedElements = new WeakSet();

    function matchesTarget(element) {
        if (!(element instanceof Element)) return false;

        return ALL_SELECTORS.some(selector => {
            try {
                return element.matches(selector);
            } catch {
                return false;
            }
        });
    }

    function processElement(element) {
        if (!(element instanceof Element)) return 0;

        let count = 0;

        if (matchesTarget(element)) {
            if (!removedElements.has(element)) {
                removedElements.add(element);

                if (CONFIG.removeElements) {
                    element.remove();
                    log('Removed:', describeElement(element));
                } else {
                    element.style.setProperty('display', 'none', 'important');
                    element.style.setProperty('visibility', 'hidden', 'important');
                    log('Hidden:', describeElement(element));
                }

                count++;
            }

            // The target itself has been handled. Its descendants
            // do not need to be processed after removal.
            return count;
        }

        // Process matching descendants of newly inserted elements.
        for (const selector of ALL_SELECTORS) {
            let descendants;

            try {
                descendants = element.querySelectorAll(selector);
            } catch {
                continue;
            }

            for (const child of descendants) {
                if (removedElements.has(child)) continue;

                removedElements.add(child);

                if (CONFIG.removeElements) {
                    child.remove();
                    log('Removed descendant:', describeElement(child));
                } else {
                    child.style.setProperty('display', 'none', 'important');
                    child.style.setProperty('visibility', 'hidden', 'important');
                    log('Hidden descendant:', describeElement(child));
                }

                count++;
            }
        }

        return count;
    }

    function describeElement(element) {
        const id = element.id ? `#${element.id}` : '';
        const classes = typeof element.className === 'string'
            ? element.className.trim().split(/\s+/).filter(Boolean)
                .slice(0, 3).map(name => `.${name}`).join('')
            : '';

        return `${element.tagName.toLowerCase()}${id}${classes}`;
    }

    function sweepDocument() {
        if (!document.documentElement) return;

        let count = 0;

        for (const selector of ALL_SELECTORS) {
            let elements;

            try {
                elements = document.querySelectorAll(selector);
            } catch {
                continue;
            }

            for (const element of elements) {
                count += processElement(element);
            }
        }

        if (count > 0) {
            log(`Sweep complete: handled ${count} element(s)`);
        }
    }

    // ============================================================
    // MUTATION OBSERVER
    // ============================================================
    let observer = null;
    let pendingTimer = null;

    function scheduleSweep() {
        if (pendingTimer !== null) return;

        pendingTimer = setTimeout(() => {
            pendingTimer = null;
            sweepDocument();
        }, 50);
    }

    function onMutations(mutations) {
        for (const mutation of mutations) {
            if (mutation.type === 'attributes') {
                const target = mutation.target;

                if (target instanceof Element) {
                    processElement(target);

                    // src may be assigned after an iframe is inserted.
                    if (
                        target.tagName === 'IFRAME' &&
                        matchesTarget(target)
                    ) {
                        processElement(target);
                    }
                }

                continue;
            }

            for (const node of mutation.addedNodes) {
                if (node instanceof Element) {
                    processElement(node);
                }
            }
        }
    }

    function startObserver() {
        if (observer || !document.documentElement) return;

        observer = new MutationObserver(onMutations);

        observer.observe(document.documentElement, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['src', 'id', 'class']
        });

        log('Persistent DOM observer started');
    }

    // ============================================================
    // INITIALIZATION
    // ============================================================
    function init() {
        if (!document.documentElement) return;

        // Remove anything that already exists.
        sweepDocument();

        // Catch elements inserted after initialization.
        startObserver();

        // A periodic fallback catches unusual cases where a site's
        // UI is recreated or attributes change in an unexpected way.
        if (CONFIG.persistent) {
            setInterval(sweepDocument, CONFIG.fallbackIntervalMs);
        }

        log('Google SSO Popup Blocker v2.0 loaded');
    }

    if (document.documentElement) {
        init();
    } else {
        const startupObserver = new MutationObserver(() => {
            if (!document.documentElement) return;

            startupObserver.disconnect();
            init();
        });

        startupObserver.observe(document, {
            childList: true,
            subtree: true
        });
    }
})();
