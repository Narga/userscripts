// ==UserScript==
// @name          Facebook Comment Sorter
// @namespace     CustomScripts
// @description   Tự động sắp xếp comment "All Comments" hoặc "Newest" (chỉ hoạt động khi bấm vào link ngày tháng)
// @author        narga
// @match         *://*.facebook.com/*
// @version       1.0
// @license       MIT
// @homepage      https://github.com/narga
// @icon          https://www.google.com/s2/favicons?sz=64&domain=facebook.com
// @run-at        document-start
// @grant         none
// ==/UserScript==

(function () {
    'use strict';

    // ================== CẤU HÌNH (Chỉnh sửa tại đây) ===================
    const CONFIG = {
        sortPreference: "all",      // "newest" hoặc "all"  
        debug: false,                // true = bật console log, false = tắt
        expandReplies: false         // true = tự động mở replies, false = không
    };
    // ===================================================================

    let processedButtons = new WeakSet();
    let processedModals = new WeakSet();
    let hasRun = false;

    function log(msg, data) {
        if (CONFIG.debug) {
            console.log('[FB Sorter]', msg, data || '');
        }
    }

    // Check if we should run (individual post URL or modal)
    function shouldRun() {
        const pathname = window.location.pathname;
        const isPost = /\/(posts|photos|videos|watch|reel)\//.test(pathname) ||
            pathname.includes('/permalink.php');
        const hasModal = !!document.querySelector('[role="dialog"][aria-modal="true"]');

        return isPost || hasModal;
    }

    const sortTexts = {
        newest: ['newest', 'terbaru', 'most recent', 'más recientes', 'plus récents', 'neueste', 'mais recentes', 'più recenti', 'nieuwste', 'новейшие', '最新'],
        all: ['all comments', 'semua komentar', 'todos los comentarios', 'tous les commentaires', 'alle kommentare', 'todos os comentários', 'tutti i commenti', 'alle reacties', 'все комментарии', '所有评论']
    };

    function findAndSort() {
        if (!shouldRun() || hasRun) return;

        const buttons = document.querySelectorAll('[role="button"]');

        for (const button of buttons) {
            if (processedButtons.has(button)) continue;

            const text = button.textContent.toLowerCase();
            if (!text.includes('most relevant') && !text.includes('phù hợp nhất')) continue;

            processedButtons.add(button);
            log('Found sort button');
            button.click();

            setTimeout(() => {
                const menu = document.querySelectorAll('[role="menuitem"], [role="menuitemradio"]');
                const targetTexts = CONFIG.sortPreference === "newest" ? sortTexts.newest : sortTexts.all;

                for (const item of menu) {
                    const itemText = item.textContent.toLowerCase();
                    for (const target of targetTexts) {
                        if (itemText.startsWith(target)) {
                            log('Clicking:', itemText);
                            item.click();
                            hasRun = true; // Mark as complete
                            return;
                        }
                    }
                }
            }, 500);
            break;
        }
    }

    function expandReplies() {
        if (!CONFIG.expandReplies || !shouldRun()) return;

        const replyButtons = document.querySelectorAll('[role="button"]');
        let count = 0;

        for (const button of replyButtons) {
            const text = button.textContent.toLowerCase();
            if ((text.includes('repl') || text.includes('phản hồi')) &&
                !text.includes('write') &&
                !text.includes('viết')) {
                button.click();
                count++;
                if (count >= 5) break; // Limit to 5 per run
            }
        }

        if (count > 0) log('Expanded', count, 'replies');
    }

    // Run on page load
    function init() {
        setTimeout(() => {
            findAndSort();
            if (CONFIG.expandReplies) {
                setTimeout(expandReplies, 2000);
            }
        }, 3000);
    }

    // Reset when URL changes
    let lastURL = location.href;
    setInterval(() => {
        if (location.href !== lastURL) {
            lastURL = location.href;
            hasRun = false;
            log('URL changed, resetting');
            setTimeout(() => {
                findAndSort();
                if (CONFIG.expandReplies) {
                    setTimeout(expandReplies, 2000);
                }
            }, 2000);
        }
    }, 1000);

    // Watch for modals opening
    let modalCheckTimeout;
    let observerRunCount = 0;
    const modalObserver = new MutationObserver(() => {
        observerRunCount++;
        if (observerRunCount % 100 === 0) {
            log(`Observer runs: ${observerRunCount}`);
        }

        clearTimeout(modalCheckTimeout);
        modalCheckTimeout = setTimeout(() => {
            const modal = document.querySelector('[role="dialog"][aria-modal="true"]');
            if (modal) {
                log('Modal found in DOM, checking if processed...');
                if (!processedModals.has(modal)) {
                    processedModals.add(modal);
                    log('✅ NEW MODAL! Starting sort...');

                    // Wait for modal content to load
                    setTimeout(() => {
                        findAndSort();
                        if (CONFIG.expandReplies) {
                            setTimeout(expandReplies, 2000);
                        }
                    }, 2000);
                } else {
                    log('Modal already processed, skipping');
                }
            }
        }, 300); // Debounce
    });

    modalObserver.observe(document.body, {
        childList: true,
        subtree: true
    });
    log('Modal observer setup complete');

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    log('FB Comment Sorter v1.0 loaded');

})();