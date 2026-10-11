
// ==UserScript==
// @name         Facebook Comment Sorter
// @namespace    CustomScripts
// @description  Automatically sort Facebook comments by All Comments or Newest
// @author       narga
// @match        *://*.facebook.com/*
// @version      2.0.0
// @license      MIT
// @homepage     https://github.com/narga
// @downloadURL  https://github.com/Narga/userscripts/raw/refs/heads/main/facebook-comments-sorter/fb-comments-sorter.user.js
// @updateURL    https://github.com/Narga/userscripts/raw/refs/heads/main/facebook-comments-sorter/fb-comments-sorter.user.js
// @icon         https://www.google.com/s2/favicons?sz=64&domain=facebook.com
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    // ============================================================
    // CONFIGURATION
    // ============================================================
    const CONFIG = {
        sortPreference: 'all', // 'all' or 'newest'
        debug: false,
        expandReplies: false,

        // Retry and observer settings
        debounceMs: 180,
        menuWaitMs: 1800,
        maxAttempts: 4,
        maxReplies: 5,
        maxPendingMs: 6000
    };

    // ============================================================
    // TEXT MATCHING
    // ============================================================
    const normalize = (value) => String(value || '')
        .normalize('NFKC')
        .toLocaleLowerCase()
        .replace(/[\u200B-\u200D\uFEFF]/g, '')
        .replace(/\s+/g, ' ')
        .trim();

    const SORT_LABELS = {
        trigger: [
            'most relevant',
            'most recent',
            'newest',
            'all comments',
            'relevant comments',
            'phù hợp nhất',
            'bình luận phù hợp nhất',
            'tất cả bình luận',
            'mới nhất',
            'semua komentar',
            'komentar paling relevan',
            'terbaru',
            'todos los comentarios',
            'más relevantes',
            'más recientes',
            'tous les commentaires',
            'plus pertinents',
            'plus récents',
            'alle kommentare',
            'neueste',
            'mais recentes',
            'todos os comentários',
            'più recenti',
            'tutti i commenti',
            'alle reacties',
            'nieuwste',
            'все комментарии',
            '最新',
            '全部评论',
            '所有评论'
        ],

        all: [
            'all comments',
            'tất cả bình luận',
            'semua komentar',
            'todos los comentarios',
            'tous les commentaires',
            'alle kommentare',
            'todos os comentários',
            'tutti i commenti',
            'alle reacties',
            'все комментарии',
            '所有评论',
            '全部评论'
        ],

        newest: [
            'newest',
            'most recent',
            'mới nhất',
            'terbaru',
            'más recientes',
            'plus récents',
            'neueste',
            'mais recentes',
            'più recenti',
            'nieuwste',
            'новейшие',
            '最新',
            '最新留言'
        ]
    };

    const REPLY_LABELS = [
        /^(?:view|see|show)\s+(?:\d+\s+)?(?:more\s+)?(?:previous\s+)?repl(?:y|ies)\b/i,
        /^(?:\d+\s+)?repl(?:y|ies)\b/i,
        /^(?:xem|hiển thị)\s+(?:\d+\s+)?(?:thêm\s+)?(?:các\s+)?phản hồi\b/i,
        /^xem\s+\d+\s+phản hồi\b/i
    ];

    // ============================================================
    // STATE
    // ============================================================
    const buttonStates = new WeakMap();
    const processedReplies = new WeakSet();

    let activeButton = null;
    let activeState = null;
    let observer = null;
    let scheduled = false;
    let replyCount = 0;
    let lastURL = location.href;

    function log(...args) {
        if (CONFIG.debug) {
            console.log('[FB Sorter]', ...args);
        }
    }

    function getState(button) {
        let state = buttonStates.get(button);

        if (!state) {
            state = {
                status: 'idle',
                attempts: 0,
                lastAction: 0
            };

            buttonStates.set(button, state);
        }

        return state;
    }

    function resetActive() {
        activeButton = null;
        activeState = null;
    }

    // ============================================================
    // PAGE AND SCOPE DETECTION
    // ============================================================
    function isPostPage() {
        const path = location.pathname;

        return /\/(?:posts|photos|videos|watch|reel)\//i.test(path) ||
            /\/permalink\.php$/i.test(path) ||
            /\/photo(?:\.php)?$/i.test(path) ||
            /\/story\.php$/i.test(path);
    }

    function getDialogs() {
        return [...document.querySelectorAll(
            '[role="dialog"][aria-modal="true"], [role="dialog"]'
        )].filter(isVisible);
    }

    function isVisible(element) {
        if (!element || !element.isConnected) return false;

        if (element.hidden || element.getAttribute('aria-hidden') === 'true') {
            return false;
        }

        return element.getClientRects().length > 0;
    }

    function getSearchRoots() {
        const dialogs = getDialogs();

        if (dialogs.length) {
            return dialogs;
        }

        return isPostPage() ? [document] : [];
    }

    function isAllowed(button) {
        if (!isVisible(button)) return false;

        const dialogs = getDialogs();

        if (dialogs.length) {
            return dialogs.some(dialog => dialog.contains(button));
        }

        return isPostPage();
    }

    // ============================================================
    // SORT BUTTON DETECTION
    // ============================================================
    function getElementText(element) {
        return normalize([
            element.innerText,
            element.getAttribute('aria-label'),
            element.getAttribute('title')
        ].filter(Boolean).join(' '));
    }

    function containsAny(text, labels) {
        return labels.some(label => text.includes(normalize(label)));
    }

    function getTargetLabels() {
        return CONFIG.sortPreference === 'newest'
            ? SORT_LABELS.newest
            : SORT_LABELS.all;
    }

    function isTargetAlreadySelected(button) {
        return containsAny(getElementText(button), getTargetLabels());
    }

    function isSortTrigger(button) {
        if (button.getAttribute('aria-disabled') === 'true') {
            return false;
        }

        const text = getElementText(button);

        return containsAny(text, SORT_LABELS.trigger);
    }

    function findSortButtons() {
        const roots = getSearchRoots();
        const results = [];

        for (const root of roots) {
            const buttons = root.querySelectorAll(
                '[role="button"], button'
            );

            for (const button of buttons) {
                if (!isAllowed(button)) continue;
                if (!isSortTrigger(button)) continue;

                results.push(button);
            }
        }

        return [...new Set(results)];
    }

    // ============================================================
    // MENU DETECTION
    // ============================================================
    function hasVisibleMenu() {
        return [...document.querySelectorAll(
            '[role="menu"], [role="listbox"]'
        )].some(isVisible);
    }

    function findTargetMenuItem() {
        const labels = getTargetLabels();

        const items = [...document.querySelectorAll(
            '[role="menuitemradio"], [role="menuitem"], ' +
            '[role="option"], [role="radio"]'
        )].filter(isVisible);

        // Prefer exact matches to avoid clicking unrelated menu items.
        for (const item of items) {
            const text = getElementText(item);

            if (labels.some(label => text === normalize(label))) {
                return item;
            }
        }

        // Allow additional counts or short descriptive suffixes.
        for (const item of items) {
            const text = getElementText(item);

            if (labels.some(label =>
                text.startsWith(normalize(label) + ' ') ||
                text.startsWith(normalize(label) + '(')
            )) {
                return item;
            }
        }

        return null;
    }

    function finishActive(button, state, success) {
        state.status = success ? 'done' : 'idle';

        if (activeButton === button) {
            resetActive();
        }

        log(success ? 'Sorting completed' : 'Sorting attempt ended');
        scheduleScan();
    }

    function handleActiveMenu() {
        if (!activeButton || !activeState) return false;

        const button = activeButton;
        const state = activeState;

        if (!button.isConnected || !isAllowed(button)) {
            finishActive(button, state, false);
            return true;
        }

        if (isTargetAlreadySelected(button)) {
            finishActive(button, state, true);
            return true;
        }

        const item = findTargetMenuItem();

        if (item) {
            log('Selecting menu item:', getElementText(item));

            state.status = 'selecting';

            try {
                item.click();
                finishActive(button, state, true);
            } catch (error) {
                log('Menu click failed:', error);
                finishActive(button, state, false);
            }

            return true;
        }

        const elapsed = Date.now() - state.lastAction;

        if (elapsed > CONFIG.maxPendingMs) {
            log('Menu timed out; stopping this attempt');
            finishActive(button, state, false);
            return true;
        }

        // If the menu exists but the requested option is missing,
        // wait for further DOM changes instead of clicking repeatedly.
        if (hasVisibleMenu()) {
            return true;
        }

        if (elapsed > CONFIG.menuWaitMs) {
            if (state.attempts >= CONFIG.maxAttempts) {
                log('Maximum attempts reached');
                finishActive(button, state, false);
                return true;
            }

            log('Menu did not open; allowing another attempt');
            finishActive(button, state, false);
            return true;
        }

        return true;
    }

    // ============================================================
    // SORTING
    // ============================================================
    function trySort() {
        if (activeButton) {
            handleActiveMenu();

            if (activeButton) return;
        }

        for (const button of findSortButtons()) {
            const state = getState(button);

            if (state.status === 'done') continue;
            if (state.status === 'selecting') continue;

            if (isTargetAlreadySelected(button)) {
                state.status = 'done';
                log('Desired sort already selected');
                continue;
            }

            if (state.attempts >= CONFIG.maxAttempts) {
                state.status = 'failed';
                continue;
            }

            state.attempts++;
            state.status = 'opening';
            state.lastAction = Date.now();

            activeButton = button;
            activeState = state;

            log(
                'Opening sort menu, attempt',
                state.attempts,
                '/',
                CONFIG.maxAttempts
            );

            try {
                button.click();
            } catch (error) {
                log('Sort button click failed:', error);
                finishActive(button, state, false);
            }

            // Handle synchronous DOM updates immediately.
            handleActiveMenu();

            if (activeButton) {
                scheduleScan(CONFIG.debounceMs);
            }

            return;
        }
    }

    // ============================================================
    // OPTIONAL: EXPAND REPLIES
    // ============================================================
    function expandReplies() {
        if (!CONFIG.expandReplies) return;
        if (replyCount >= CONFIG.maxReplies) return;

        const roots = getSearchRoots();

        for (const root of roots) {
            const buttons = root.querySelectorAll(
                '[role="button"], button'
            );

            for (const button of buttons) {
                if (!isVisible(button)) continue;
                if (!isAllowed(button)) continue;
                if (processedReplies.has(button)) continue;

                const text = normalize(button.innerText);

                if (!REPLY_LABELS.some(pattern => pattern.test(text))) {
                    continue;
                }

                // Mark before clicking to prevent duplicate clicks.
                processedReplies.add(button);

                try {
                    button.click();
                    replyCount++;

                    log('Expanded replies:', text);

                    if (replyCount >= CONFIG.maxReplies) {
                        return;
                    }
                } catch (error) {
                    log('Expand replies failed:', error);
                }
            }
        }
    }

    // ============================================================
    // SCAN SCHEDULING
    // ============================================================
    let scanTimer = null;

    function scheduleScan(delay = CONFIG.debounceMs) {
        if (scanTimer !== null) {
            clearTimeout(scanTimer);
        }

        scanTimer = setTimeout(() => {
            scanTimer = null;
            scan();
        }, delay);
    }

    function scan() {
        scheduled = false;

        // Reset per-navigation state.
        if (location.href !== lastURL) {
            lastURL = location.href;
            resetActive();
            replyCount = 0;

            log('Navigation detected:', lastURL);
        }

        trySort();
        expandReplies();

        // Keep pending menu operations alive even if Facebook
        // stops generating DOM mutations temporarily.
        if (activeButton) {
            scheduleScan(CONFIG.debounceMs);
        }
    }

    // ============================================================
    // MUTATION OBSERVER
    // ============================================================
    function onMutations(mutations) {
        // Ignore irrelevant changes when possible.
        const relevant = mutations.some(mutation => {
            const target = mutation.target;

            if (!(target instanceof Element)) {
                return true;
            }

            return !target.closest(
                '[data-fb-sorter-ignore]'
            );
        });

        if (!relevant || scheduled) return;

        scheduled = true;
        scheduleScan();
    }

    function startObserver() {
        if (observer || !document.documentElement) return;

        observer = new MutationObserver(onMutations);

        observer.observe(document.documentElement, {
            childList: true,
            subtree: true,
            characterData: true
        });

        log('DOM observer started');
    }

    // ============================================================
    // INITIALIZATION
    // ============================================================
    function init() {
        startObserver();
        scheduleScan(300);

        // Handle SPA navigation and delayed UI changes.
        window.addEventListener('popstate', () => {
            scheduleScan(100);
        });

        window.addEventListener('pageshow', () => {
            scheduleScan(100);
        });

        // Lightweight fallback for URL changes that do not emit
        // popstate, which is common in client-side applications.
        setInterval(() => {
            if (location.href !== lastURL) {
                scheduleScan(100);
            }
        }, 1000);

        log('Facebook Comment Sorter v2.0 loaded');
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
