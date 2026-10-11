// ==UserScript==
// @name         Google SSO Popup Blocker
// @namespace    CustomScripts
// @version      1.1
// @description  Chặn popup đăng nhập Google SSO (Google One Tap)
// @author       narga
// @homepage     https://github.com/narga
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

    // ===== CẤU HÌNH =====
    const CONFIG = {
        debug: false,               // Bật/tắt debug logs
        autoStop: true,             // Tự động dừng sau khi chặn thành công
        observerTimeout: 60000,     // Timeout observer (60s)
        checkInterval: 3000,        // Interval kiểm tra (3s)
        maxChecks: 20               // Số lần check tối đa
    };

    const log = CONFIG.debug ? console.log.bind(console, '[SSO Blocker]') : () => { };

    // ===== STATE =====
    let blocked = false;
    let checkCount = 0;
    let intervalId = null;
    let observerTimeout = null;
    const processedElements = new WeakSet();

    // ===== CSS HIDING =====
    GM_addStyle(`
        #credential_picker_container,
        #g_id_onload,
        #g_id_intermediate_iframe,
        iframe[src*="accounts.google.com/gsi/iframe"] {
            display: none !important;
            visibility: hidden !important;
        }
    `);

    // ===== DISABLE GOOGLE SSO API =====
    window.google = window.google || {};
    window.google.accounts = {
        id: {
            initialize: () => { },
            prompt: () => { },
            renderButton: () => { },
            revoke: () => { },
            cancel: () => { }
        }
    };

    // ===== CLEANUP FUNCTION =====
    function cleanup() {
        if (intervalId) {
            clearInterval(intervalId);
            intervalId = null;
        }
        if (observerTimeout) {
            clearTimeout(observerTimeout);
        }
        if (observer) {
            observer.disconnect();
        }
        log('Cleaned up, stopped all checks');
    }

    // ===== DISABLE CONTAINERS =====
    function disableContainers() {
        if (blocked) return false;

        checkCount++;
        let found = false;

        // Remove Google SSO containers
        const containerIds = ['g_id_onload', 'g_id_intermediate_iframe', 'credential_picker_container', 'g_id_signin'];

        containerIds.forEach(id => {
            const el = document.getElementById(id);
            if (el && !processedElements.has(el)) {
                processedElements.add(el);
                el.remove();
                found = true;
                log('Removed container:', id);
            }
        });

        // Remove Google iframes
        const iframes = document.querySelectorAll('iframe[src*="accounts.google.com"]');
        iframes.forEach(iframe => {
            if (!processedElements.has(iframe)) {
                processedElements.add(iframe);
                iframe.remove();
                found = true;
                log('Removed Google iframe');
            }
        });

        // Auto-stop nếu đã block thành công
        // Nhưng KHÔNG stop nếu chỉ đạt maxChecks (để bảo vệ lâu dài)
        if (CONFIG.autoStop && found) {
            blocked = true;
            cleanup();
            log(`Blocked and stopped after ${checkCount} checks`);
        }

        return found;
    }

    // ===== MUTATION OBSERVER =====
    const observer = new MutationObserver(() => {
        if (!blocked) {
            disableContainers();
        }
    });

    // ===== INITIALIZATION =====
    let initialized = false;

    function init() {
        if (initialized) {
            log('Already initialized, skipping');
            return;
        }
        initialized = true;
        log('Initialized');

        // Initial cleanup
        disableContainers();

        // Start observer với auto-timeout
        observer.observe(document.documentElement, {
            childList: true,
            subtree: true
        });

        // Auto-disconnect observer after timeout
        observerTimeout = setTimeout(() => {
            if (!blocked) {
                log('Observer timeout reached');
                observer.disconnect();
            }
        }, CONFIG.observerTimeout);

        // Periodic check
        intervalId = setInterval(() => {
            if (!disableContainers() && checkCount >= CONFIG.maxChecks) {
                cleanup();
            }
        }, CONFIG.checkInterval);
    }

    // ===== START =====
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    log('SSO Blocker loaded');

})();
