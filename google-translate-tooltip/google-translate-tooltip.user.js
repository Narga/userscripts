// ==UserScript==
// @name         Google Translate Tooltip
// @namespace    CustomScripts
// @version      1.3.2
// @description  Display instant Google translation, pronunciation/phonetics, synonyms, and text-to-speech tooltip when selecting text
// @author       narga
// @homepage     https://github.com/narga
// @icon         https://translate.google.com/favicon.ico
// @match        *://*/*
// @exclude      *://localhost/*
// @exclude      *://127.0.0.1/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @grant        GM_xmlhttpRequest
// @connect      translate.googleapis.com
// @connect      translate.google.com
// @connect      api.datamuse.com
// @connect      api.dictionaryapi.dev
// @connect      api.openai.com
// @license      MIT
// @downloadURL  https://raw.githubusercontent.com/Narga/userscripts/refs/heads/main/google-translate-tooltip/google-translate-tooltip.user.js
// @updateURL    https://raw.githubusercontent.com/Narga/userscripts/refs/heads/main/google-translate-tooltip/google-translate-tooltip.user.js
// ==/UserScript==

(function () {
    'use strict';

    // ============================================================
    // CẤU HÌNH & LƯU TRỮ (CONFIGURATION & PERSISTENCE)
    // ============================================================
    const DEFAULT_CONFIG = {
        from: 'auto',
        to: 'vi',
        to2: 'Disabled',
        to3: 'Disabled',
        tts: true,
        ttsEngine: 'google',       // 'google' (Google Translate chuẩn) hoặc 'system' (Web Speech API)
        slowSpeed: '0.6',          // Mức tốc độ khi phát chậm (bấm lần 2): '0.75', '0.6', '0.5', '0.35'
        hideDetailsDefault: false, // Ẩn chi tiết từ điển theo mặc định
        showAlternatives: true,    // Hiển thị các bản dịch thay thế
        showSynonyms: true,        // Hiển thị từ đồng nghĩa trong định nghĩa
        enableIpa: true,           // Bật/tắt hiển thị ký âm / phiên âm (IPA/Pinyin/Romaji)
        ipaWordLimit: 5,           // Áp dụng ký âm cho từ đơn hoặc câu dưới số từ này
        fontSize: '14px',
        theme: 'light',            // light hoặc dark
        requireCtrl: false,
        requireAlt: false,
        hotkey: '',                // Phím tắt dịch nhanh (vd: 'KeyQ', 'KeyT', 'F2')
        aiIpa: false,
        aiEndpoint: 'https://api.openai.com/v1/chat/completions',
        aiModel: '',
        aiApiKey: '',
        aiDebug: false,
        aiDetailsPrompt: 'Explain the translated text in its target language. Return concise structured details as JSON with fields: meaning, usage, examples. The source text is context only.',
        aiPrompt: 'The sourceLanguage field identifies the original language. For each target, use its own language field. Return only a JSON object keyed by the supplied ids, with IPA strings as values, e.g. {"gtt-ipa-src":"/aɪ/","gtt-ipa-tgt0":"/aʊt/","gtt-ipa-tgt1":"/aʊs/","gtt-ipa-tgt2":"/fɔn/"}. Include each supplied id; omit ids not supplied.',
        delay: 0                   // ms độ trễ trước khi dịch lúc rê chuột vào icon
    };

    function getConfig(key) {
        return GM_getValue(key, DEFAULT_CONFIG[key]);
    }

    function setConfig(key, val) {
        GM_setValue(key, val);
    }

    const LANGUAGES = [
        { code: 'auto', name: 'Phát hiện ngôn ngữ (Auto)' },
        { code: 'vi', name: 'Tiếng Việt' },
        { code: 'en', name: 'English' },
        { code: 'zh-CN', name: 'Chinese (Simplified)' },
        { code: 'zh-TW', name: 'Chinese (Traditional)' },
        { code: 'ja', name: 'Japanese' },
        { code: 'ko', name: 'Korean' },
        { code: 'fr', name: 'French' },
        { code: 'de', name: 'German' },
        { code: 'es', name: 'Spanish' },
        { code: 'ru', name: 'Russian' },
        { code: 'it', name: 'Italian' },
        { code: 'pt', name: 'Portuguese' },
        { code: 'th', name: 'Thai' },
        { code: 'id', name: 'Indonesian' },
        { code: 'ar', name: 'Arabic' },
        { code: 'hi', name: 'Hindi' },
        { code: 'cs', name: 'Czech' },
        { code: 'sk', name: 'Slovak' },
        { code: 'pl', name: 'Polish' },
        { code: 'uk', name: 'Ukrainian' },
        { code: 'nl', name: 'Dutch' },
        { code: 'sv', name: 'Swedish' },
        { code: 'tr', name: 'Turkish' }
    ];

    function getLanguageName(code) {
        const normalized = String(code || '').trim();
        if (!normalized || normalized.toLowerCase() === 'auto') return 'Phát hiện tự động';

        const exact = LANGUAGES.find(lang => lang.code.toLowerCase() === normalized.toLowerCase());
        if (exact) return exact.name;

        const baseCode = normalized.split('-')[0].toLowerCase();
        const base = LANGUAGES.find(lang => lang.code.split('-')[0].toLowerCase() === baseCode);
        return base ? base.name : normalized.toUpperCase();
    }

    // ============================================================
    // STYLES (Scoped CSS)
    // ============================================================
    const STYLES = `
        #gtt-icon-btn {
            position: absolute;
            z-index: 2147483646;
            width: 24px;
            height: 24px;
            background: #ffffff;
            border: 1px solid #d0d7de;
            border-radius: 50%;
            box-shadow: 0 2px 8px rgba(0,0,0,0.15);
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 3px;
            box-sizing: border-box;
            transition: transform 0.15s ease, box-shadow 0.15s ease;
            user-select: none;
        }
        #gtt-icon-btn:hover {
            transform: scale(1.15);
            box-shadow: 0 3px 12px rgba(0,0,0,0.25);
        }
        #gtt-icon-btn svg {
            width: 100%;
            height: 100%;
            fill: #1a73e8;
        }

        #gtt-popup {
            position: absolute;
            z-index: 2147483647;
            min-width: 290px;
            max-width: 460px;
            background: var(--gtt-bg, #ffffff);
            color: var(--gtt-fg, #202124);
            border: 1px solid var(--gtt-border, #dadce0);
            border-radius: 8px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.2);
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            font-size: var(--gtt-fs, 14px);
            line-height: 1.5;
            padding: 12px 14px;
            box-sizing: border-box;
            text-align: left;
        }
        #gtt-popup.gtt-dark {
            --gtt-bg: #292a2d;
            --gtt-fg: #e8eaed;
            --gtt-border: #3c4043;
            box-shadow: 0 4px 24px rgba(0,0,0,0.5);
        }

        .gtt-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 8px;
            padding-bottom: 6px;
            border-bottom: 1px solid var(--gtt-border, #dadce0);
            font-size: 12px;
            color: #5f6368;
            cursor: move;
            user-select: none;
        }
        .gtt-dark .gtt-header {
            color: #9aa0a6;
        }
        .gtt-header-title {
            display: flex;
            align-items: center;
            gap: 6px;
            font-weight: 600;
        }
        .gtt-header-actions {
            display: flex;
            align-items: center;
            gap: 6px;
        }
        .gtt-btn-icon {
            background: none;
            border: none;
            cursor: pointer;
            padding: 2px 4px;
            border-radius: 4px;
            color: inherit;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 12px;
            line-height: 1;
        }
        .gtt-btn-icon:hover {
            background: rgba(0,0,0,0.08);
        }
        .gtt-dark .gtt-btn-icon:hover {
            background: rgba(255,255,255,0.12);
        }

        .gtt-source-row {
            margin-bottom: 8px;
            padding-bottom: 6px;
            border-bottom: 1px dashed var(--gtt-border, #dadce0);
        }
        .gtt-orig-text {
            font-weight: 600;
            color: var(--gtt-fg, #202124);
        }
        .gtt-translation-row {
            margin-bottom: 8px;
        }
        .gtt-lang-tag {
            font-size: 11px;
            font-weight: 600;
            text-transform: uppercase;
            padding: 1px 4px;
            background: #e8f0fe;
            color: #1a73e8;
            border-radius: 3px;
            margin-right: 6px;
            display: inline-block;
        }
        .gtt-reverse-btn {
            background: none;
            border: none;
            color: #5f6368;
            cursor: pointer;
            display: inline-flex;
            align-items: center;
            padding: 1px 4px;
            border-radius: 3px;
            margin-left: 2px;
        }
        .gtt-reverse-btn:hover {
            background: rgba(26, 115, 232, 0.1);
            color: #1a73e8;
        }
        .gtt-dark .gtt-lang-tag {
            background: #394457;
            color: #8ab4f8;
        }
        .gtt-trans-text {
            font-weight: 500;
            color: var(--gtt-fg, #202124);
        }
        .gtt-ipa-subline {
            display: block;
            font-size: 12px;
            color: #1a56db;
            font-weight: 500;
            font-style: normal;
            margin-top: 3px;
            margin-left: 2px;
            word-spacing: 3px;
            letter-spacing: 0.2px;
            font-family: "Lucida Sans Unicode", "DejaVu Sans", "Segoe UI", sans-serif;
        }
        .gtt-dark .gtt-ipa-subline {
            color: #8ab4f8;
        }
        .gtt-tts-btn {
            background: none;
            border: none;
            cursor: pointer;
            padding: 1px 4px;
            vertical-align: middle;
            color: #5f6368;
            display: inline-flex;
            align-items: center;
            border-radius: 3px;
            margin-left: 3px;
            transition: color 0.15s ease, background 0.15s ease, transform 0.15s ease;
        }
        .gtt-tts-btn:hover {
            color: #1a73e8;
            background: rgba(26,115,232,0.1);
            transform: scale(1.12);
        }
        .gtt-dark .gtt-tts-btn {
            color: #9aa0a6;
        }
        .gtt-dark .gtt-tts-btn:hover {
            color: #8ab4f8;
            background: rgba(138,180,248,0.15);
        }
        .gtt-tts-btn.gtt-playing {
            color: #1a73e8 !important;
            animation: gtt-pulse 1s ease infinite;
        }
        .gtt-tts-btn.gtt-playing-slow {
            color: #ea8600 !important;
            animation: gtt-pulse 1.3s ease infinite;
        }
        .gtt-dark .gtt-tts-btn.gtt-playing-slow {
            color: #fdd663 !important;
        }
        @keyframes gtt-pulse {
            0% { transform: scale(1); }
            50% { transform: scale(1.22); }
            100% { transform: scale(1); }
        }

        /* Copy Button */
        .gtt-copy-btn {
            background: none;
            border: none;
            cursor: pointer;
            padding: 1px 4px;
            vertical-align: middle;
            color: #5f6368;
            display: inline-flex;
            align-items: center;
            border-radius: 3px;
            margin-left: 2px;
            transition: color 0.15s ease, background 0.15s ease;
            font-size: 12px;
        }
        .gtt-copy-btn:hover {
            color: #1a73e8;
            background: rgba(26,115,232,0.1);
        }
        .gtt-dark .gtt-copy-btn {
            color: #9aa0a6;
        }
        .gtt-dark .gtt-copy-btn:hover {
            color: #8ab4f8;
            background: rgba(138,180,248,0.15);
        }
        .gtt-copy-btn.gtt-copied {
            color: #34a853 !important;
        }

        /* Pin Button */
        .gtt-btn-pin {
            background: none;
            border: none;
            cursor: pointer;
            padding: 2px 4px;
            border-radius: 4px;
            color: inherit;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 12px;
            line-height: 1;
            transition: color 0.15s ease;
        }
        .gtt-btn-pin:hover {
            background: rgba(0,0,0,0.08);
        }
        .gtt-dark .gtt-btn-pin:hover {
            background: rgba(255,255,255,0.12);
        }
        .gtt-btn-pin.gtt-pinned {
            color: #1a73e8 !important;
        }
        .gtt-dark .gtt-btn-pin.gtt-pinned {
            color: #8ab4f8 !important;
        }

        /* Toggle Details Button */
        .gtt-toggle-details-btn {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            background: none;
            border: none;
            color: #1a73e8;
            cursor: pointer;
            font-size: 12px;
            padding: 2px 0;
            margin-top: 4px;
            font-weight: 500;
        }
        .gtt-dark .gtt-toggle-details-btn {
            color: #8ab4f8;
        }
        .gtt-toggle-details-btn:hover {
            text-decoration: underline;
        }

        /* Details Section */
        .gtt-details-section {
            margin-top: 6px;
            padding-top: 6px;
            border-top: 1px dashed var(--gtt-border, #dadce0);
            font-size: 13px;
        }
        .gtt-section-title {
            font-weight: 600;
            font-size: 12px;
            color: #5f6368;
            margin: 6px 0 3px 0;
            text-transform: uppercase;
        }
        .gtt-dark .gtt-section-title {
            color: #9aa0a6;
        }
        .gtt-dict-group {
            margin-bottom: 6px;
        }
        .gtt-dict-pos {
            font-style: italic;
            font-weight: 600;
            color: #1a73e8;
            margin-bottom: 2px;
        }
        .gtt-dark .gtt-dict-pos {
            color: #8ab4f8;
        }
        .gtt-dict-terms {
            margin-left: 10px;
            color: var(--gtt-fg, #202124);
        }
        .gtt-alt-item {
            margin-left: 10px;
            color: var(--gtt-fg, #202124);
        }
        .gtt-synonym-tag {
            color: #5f6368;
            font-style: italic;
            font-size: 12px;
            margin-left: 10px;
            display: block;
        }
        .gtt-dark .gtt-synonym-tag {
            color: #9aa0a6;
        }

        /* Settings Form inside popup */
        .gtt-settings-panel {
            font-size: 13px;
            padding: 4px 0;
        }
        .gtt-field-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 8px;
        }
        .gtt-field-row label {
            font-weight: 500;
        }
        .gtt-field-row select, .gtt-field-row input[type="text"], .gtt-field-row input[type="number"] {
            border: 1px solid var(--gtt-border, #dadce0);
            border-radius: 4px;
            padding: 3px 6px;
            font-size: 12px;
            background: var(--gtt-bg, #ffffff);
            color: var(--gtt-fg, #202124);
        }
        .gtt-settings-footer {
            display: flex;
            justify-content: flex-end;
            gap: 8px;
            margin-top: 10px;
        }
        .gtt-btn-primary {
            background: #1a73e8;
            color: #ffffff;
            border: none;
            border-radius: 4px;
            padding: 4px 10px;
            font-size: 12px;
            cursor: pointer;
        }
        .gtt-btn-secondary {
            background: transparent;
            border: 1px solid var(--gtt-border, #dadce0);
            border-radius: 4px;
            padding: 4px 10px;
            font-size: 12px;
            cursor: pointer;
            color: inherit;
        }

        /* Loading spinner */
        .gtt-spinner {
            display: inline-block;
            width: 18px;
            height: 18px;
            border: 2px solid rgba(26,115,232,0.2);
            border-top-color: #1a73e8;
            border-radius: 50%;
            animation: gtt-spin 0.8s linear infinite;
            margin: 10px auto;
        }
        @keyframes gtt-spin {
            to { transform: rotate(360deg); }
        }
    `;

    function injectStyles() {
        if (document.getElementById('gtt-styles')) return;
        const styleEl = document.createElement('style');
        styleEl.id = 'gtt-styles';
        styleEl.textContent = STYLES;
        (document.head || document.documentElement).appendChild(styleEl);
    }

    const GOOGLE_ICON_SVG = `<svg viewBox="0 0 24 24"><path d="M12.87 15.07l-2.54-2.51.03-.08c1.77-1.97 3.05-4.24 3.79-6.62H17V4h-6V2h-2v2H3v1.85h8.33c-.7 2.01-1.8 3.93-3.23 5.58-.94-1.07-1.74-2.28-2.37-3.58l-1.73.71c.77 1.59 1.76 3.07 2.92 4.38L2.09 21.7 3.5 23.1l6.83-6.83 3.54 3.54 1.41-1.41-2.41-2.41-.01-.01zM18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2l-4.5-12zm-2.62 7l1.62-4.33L19.12 17h-3.24z"/></svg>`;
    const SPEAKER_ICON_SVG = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>`;
    const COPY_ICON_SVG = `<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>`;

    function copyToClipboard(text, btn) {
        navigator.clipboard.writeText(text).then(() => {
            btn.classList.add('gtt-copied');
            const origHTML = btn.innerHTML;
            btn.innerHTML = '✓';
            setTimeout(() => {
                btn.classList.remove('gtt-copied');
                btn.innerHTML = origHTML;
            }, 1200);
        }).catch(() => {
            // Fallback cho trình duyệt không hỗ trợ clipboard API
            const ta = document.createElement('textarea');
            ta.value = text;
            ta.style.cssText = 'position:fixed;left:-9999px;';
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
            btn.classList.add('gtt-copied');
            const origHTML = btn.innerHTML;
            btn.innerHTML = '✓';
            setTimeout(() => {
                btn.classList.remove('gtt-copied');
                btn.innerHTML = origHTML;
            }, 1200);
        });
    }

    // ============================================================
    // STATE & DOM NODES
    // ============================================================
    let currentSelectedText = '';
    let lastAiExchange = 'Chưa có request AI.';
    let iconBtn = null;
    let popupEl = null;
    let hoverTimer = null;
    let isShowingSettings = false;
    let isDetailsExpanded = false;
    let isPinned = false;
    let lastTtsClick = { text: '', lang: '', time: 0, isSlow: false };
    let currentAudio = null;
    let currentBlobUrl = null;
    let currentTtsRequestId = 0;
    let currentAudioRequest = null;

    // Cache kết quả tra cứu IPA cho từ đơn tiếng Anh
    const ipaCache = new Map();

    // ============================================================
    // SELECTION HANDLING
    // ============================================================
    function countWords(str) {
        if (!str) return 0;
        return str.trim().split(/\s+/).filter(Boolean).length;
    }

    function getSelectedText() {
        let text = '';
        const activeEl = document.activeElement;

        if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) {
            const start = activeEl.selectionStart;
            const end = activeEl.selectionEnd;
            if (typeof start === 'number' && typeof end === 'number') {
                text = activeEl.value.substring(start, end);
            }
        }

        if (!text && window.getSelection) {
            text = window.getSelection().toString();
        }

        return text ? text.trim() : '';
    }

    function removeIcon() {
        if (iconBtn && iconBtn.parentNode) {
            iconBtn.parentNode.removeChild(iconBtn);
        }
        iconBtn = null;
        if (hoverTimer) {
            clearTimeout(hoverTimer);
            hoverTimer = null;
        }
    }

    function removePopup() {
        if (popupEl && popupEl.parentNode) {
            popupEl.parentNode.removeChild(popupEl);
        }
        popupEl = null;
        isShowingSettings = false;
    }

    function onMouseUp(e) {
        if (popupEl && popupEl.contains(e.target)) return;
        if (iconBtn && iconBtn.contains(e.target)) return;

        if (getConfig('requireCtrl') && !e.ctrlKey) return;
        if (getConfig('requireAlt') && !e.altKey) return;

        setTimeout(() => {
            const text = getSelectedText();
            if (!text || text.length === 0) {
                removeIcon();
                return;
            }

            if (/^https?:\/\/\S+$/i.test(text)) {
                return;
            }

            currentSelectedText = text;
            showIcon(e.pageX, e.pageY);
        }, 50);
    }

    function onMouseDown(e) {
        if (popupEl && popupEl.contains(e.target)) return;
        if (iconBtn && iconBtn.contains(e.target)) return;

        removeIcon();
        // Nếu popup đang được ghim, không tự đóng khi bấm ngoài
        if (isPinned) return;
        removePopup();
    }

    // ============================================================
    // ICON TRIGGER
    // ============================================================
    function showIcon(pageX, pageY) {
        removeIcon();
        injectStyles();

        iconBtn = document.createElement('div');
        iconBtn.id = 'gtt-icon-btn';
        iconBtn.innerHTML = GOOGLE_ICON_SVG;
        iconBtn.title = 'Bấm hoặc rê chuột để dịch';
        iconBtn.style.left = `${pageX + 10}px`;
        iconBtn.style.top = `${pageY + 10}px`;

        iconBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            startLookup(pageX + 10, pageY + 10);
        });

        const delay = parseInt(getConfig('delay'), 10) || 0;
        iconBtn.addEventListener('mouseenter', () => {
            hoverTimer = setTimeout(() => {
                startLookup(pageX + 10, pageY + 10);
            }, delay);
        });

        iconBtn.addEventListener('mouseleave', () => {
            if (hoverTimer) {
                clearTimeout(hoverTimer);
                hoverTimer = null;
            }
        });

        document.body.appendChild(iconBtn);
    }

    // ============================================================
    // TRANSLATION API (client=gtx đầy đủ thông tin từ điển)
    // dt=t (bản dịch), dt=bd (từ điển), dt=rm (phiên âm romaji/pinyin/latin),
    // dt=at (bản dịch thay thế), dt=md (định nghĩa), dt=ss (từ đồng nghĩa), dt=ex (ví dụ)
    // ============================================================
    const TRANSLATION_CACHE_KEY = 'gtt_translation_cache_v1';
    const MAX_TRANSLATION_CACHE_ENTRIES = 120;
    const AI_DETAILS_CACHE_KEY = 'gtt_ai_details_v1';
    const MAX_AI_DETAILS_CACHE_ENTRIES = 300;

    function getAiDetailsCache() {
        try { const cache = GM_getValue(AI_DETAILS_CACHE_KEY, {}); return cache && typeof cache === 'object' ? cache : {}; }
        catch (_) { return {}; }
    }

    function getTranslationCache() {
        try {
            const stored = GM_getValue(TRANSLATION_CACHE_KEY, {});
            if (typeof stored === 'string') {
                const parsed = JSON.parse(stored);
                return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
            }
            return stored && typeof stored === 'object' && !Array.isArray(stored) ? stored : {};
        } catch (_) {
            return {};
        }
    }

    function getTranslationCacheKey(text, sl, tl) {
        return `${sl}->${tl}:${String(text).trim().toLowerCase()}`;
    }

    function getCachedTranslation(text, sl, tl) {
        try {
            const cache = getTranslationCache();
            const key = getTranslationCacheKey(text, sl, tl);
            const entry = cache[key];
            if (!entry || !Array.isArray(entry.data)) return null;

            entry.timestamp = Date.now();
            GM_setValue(TRANSLATION_CACHE_KEY, cache);
            return entry.data;
        } catch (_) {
            return null;
        }
    }

    function saveTranslationToCache(text, sl, tl, data) {
        if (!Array.isArray(data)) return;
        try {
            const cache = getTranslationCache();
            const key = getTranslationCacheKey(text, sl, tl);
            cache[key] = { data, timestamp: Date.now() };

            const keys = Object.keys(cache);
            keys.sort((a, b) => (cache[a].timestamp || 0) - (cache[b].timestamp || 0));
            while (keys.length > MAX_TRANSLATION_CACHE_ENTRIES) {
                delete cache[keys.shift()];
            }
            GM_setValue(TRANSLATION_CACHE_KEY, cache);
        } catch (_) {}
    }

    function fetchTranslation(text, sl, tl) {
        return new Promise((resolve, reject) => {
            const resolveWithCacheOrReject = (error) => {
                const cached = getCachedTranslation(text, sl, tl);
                if (cached) {
                    resolve(cached);
                } else {
                    reject(error);
                }
            };
            const encodedText = encodeURIComponent(text);
            const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sl}&tl=${tl}&dt=t&dt=bd&dt=rm&dt=at&dt=md&dt=ss&dt=ex&q=${encodedText}`;

            GM_xmlhttpRequest({
                method: 'GET',
                url: url,
                timeout: 5000,
                headers: {
                    'Accept': 'application/json'
                },
                onload: (response) => {
                    if (response.status >= 200 && response.status < 300) {
                        try {
                            const data = JSON.parse(response.responseText);
                            saveTranslationToCache(text, sl, tl, data);
                            resolve(data);
                        } catch (err) {
                            resolveWithCacheOrReject(err);
                        }
                    } else {
                        resolveWithCacheOrReject(new Error(`HTTP error ${response.status}`));
                    }
                },
                ontimeout: () => resolveWithCacheOrReject(new Error('Hết thời gian chờ (Timeout 5s)')),
                onerror: (err) => resolveWithCacheOrReject(err)
            });
        });
    }

    // ============================================================
    // TRA CỨU KÍ ÂM IPA BẰNG DATAMUSE API & FREE DICTIONARY API
    // Tích hợp từ điển ngữ âm CMU + IPA quốc tế miễn phí
    // ============================================================
    function fetchDatamuseSingle(clean) {
        return new Promise((resolve) => {
            GM_xmlhttpRequest({
                method: 'GET',
                url: `https://api.datamuse.com/words?sp=${encodeURIComponent(clean)}&qe=sp&md=r&ipa=1`,
                timeout: 3000,
                headers: { 'Accept': 'application/json' },
                onload: (resp) => {
                    if (resp.status === 200) {
                        try {
                            const res = JSON.parse(resp.responseText);
                            if (Array.isArray(res) && res.length > 0) {
                                for (const item of res) {
                                    if (Array.isArray(item.tags)) {
                                        const ipaTag = item.tags.find(t => t.startsWith('ipa_pron:'));
                                        if (ipaTag) {
                                            const ipa = ipaTag.substring(9).trim();
                                            if (ipa) {
                                                resolve(ipa);
                                                return;
                                            }
                                        }
                                    }
                                }
                            }
                        } catch (_) {}
                    }
                    resolve('');
                },
                ontimeout: () => resolve(''),
                onerror: () => resolve('')
            });
        });
    }

    function fetchDatamuseRelation(clean, relation) {
        return new Promise((resolve) => {
            GM_xmlhttpRequest({
                method: 'GET',
                url: `https://api.datamuse.com/words?${relation}=${encodeURIComponent(clean)}&max=6`,
                timeout: 3000,
                headers: { 'Accept': 'application/json' },
                onload: (resp) => {
                    if (resp.status === 200) {
                        try {
                            const items = JSON.parse(resp.responseText);
                            if (Array.isArray(items)) {
                                resolve([...new Set(items
                                    .map(item => item && item.word)
                                    .filter(word => word && word.toLowerCase() !== clean.toLowerCase()))].slice(0, 5));
                                return;
                            }
                        } catch (_) {}
                    }
                    resolve([]);
                },
                ontimeout: () => resolve([]),
                onerror: () => resolve([])
            });
        });
    }

    function fetchRelatedWords(clean) {
        return Promise.all([
            fetchDatamuseRelation(clean, 'rel_syn'),
            fetchDatamuseRelation(clean, 'rel_ant')
        ]).then(([synonyms, antonyms]) => ({ synonyms, antonyms }));
    }

    function fetchFreeDictSingle(clean) {
        return new Promise((resolve) => {
            GM_xmlhttpRequest({
                method: 'GET',
                url: `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(clean)}`,
                timeout: 3000,
                headers: { 'Accept': 'application/json' },
                onload: (resp) => {
                    if (resp.status === 200) {
                        try {
                            const res = JSON.parse(resp.responseText);
                            if (Array.isArray(res) && res[0] && Array.isArray(res[0].phonetics)) {
                                for (const p of res[0].phonetics) {
                                    if (p.text) {
                                        const ipa = p.text.replace(/^\/+|\/+$/g, '').trim();
                                        if (ipa) {
                                            resolve(ipa);
                                            return;
                                        }
                                    }
                                }
                            }
                        } catch (_) {}
                    }
                    resolve('');
                },
                ontimeout: () => resolve(''),
                onerror: () => resolve('')
            });
        });
    }

    async function fetchWordIpa(word) {
        const clean = word.toLowerCase().trim();
        if (!clean) return '';
        if (ipaCache.has(clean)) return ipaCache.get(clean);

        let ipa = await fetchDatamuseSingle(clean);
        if (!ipa) {
            ipa = await fetchFreeDictSingle(clean);
        }
        if (ipa) {
            ipaCache.set(clean, ipa);
        }
        return ipa;
    }

    async function getPhoneticIpa(text) {
        const clean = text.toLowerCase().replace(/[^\w\s'-]/g, '').trim();
        if (!clean) return '';
        if (ipaCache.has(clean)) return ipaCache.get(clean);

        let ipa = '';
        if (clean.includes(' ')) {
            const words = clean.split(/\s+/).filter(Boolean);
            if (words.length <= parseInt(getConfig('ipaWordLimit'), 10)) {
                const parts = await Promise.all(words.map(async w => {
                    const wIpa = await fetchWordIpa(w);
                    return wIpa || w;
                }));
                if (parts.some((p, idx) => p !== words[idx])) {
                    ipa = parts.join(' ');
                }
            }
        } else {
            ipa = await fetchWordIpa(clean);
        }

        if (ipa) {
            ipaCache.set(clean, ipa);
        }
        return ipa || '';
    }

    // ============================================================
    // TEXT TO SPEECH (Hỗ trợ đọc chậm & chọn nguồn Google Translate)
    // ============================================================
    function stopCurrentAudio() {
        currentTtsRequestId++;
        if (currentAudioRequest && typeof currentAudioRequest.abort === 'function') {
            try { currentAudioRequest.abort(); } catch (_) {}
            currentAudioRequest = null;
        }
        if (currentAudio) {
            try {
                currentAudio.pause();
                currentAudio.currentTime = 0;
            } catch (_) {}
            currentAudio = null;
        }
        if (currentBlobUrl) {
            try { URL.revokeObjectURL(currentBlobUrl); } catch (_) {}
            currentBlobUrl = null;
        }
        if ('speechSynthesis' in window) {
            try { window.speechSynthesis.cancel(); } catch (_) {}
        }
    }

    function playTTS(text, lang, isSlow = false, onEndCallback = null) {
        if (!text) return;
        stopCurrentAudio();
        const targetLang = lang && lang !== 'auto' ? lang : '';
        if (!targetLang) return;
        const engine = getConfig('ttsEngine');

        if (engine === 'system' && 'speechSynthesis' in window) {
            playSystemTTS(text, targetLang, isSlow, onEndCallback);
        } else {
            playGoogleAudioTTS(text, targetLang, isSlow, onEndCallback);
        }
    }

    function playGoogleAudioTTS(text, lang, isSlow = false, onEndCallback = null) {
        stopCurrentAudio();
        const requestId = currentTtsRequestId;

        const slowRate = parseFloat(getConfig('slowSpeed')) || 0.6;
        const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=${encodeURIComponent(lang)}&client=tw-ob&q=${encodeURIComponent(text)}`;

        // Dùng duy nhất luồng GM_xmlhttpRequest tải Blob kèm request ID guard để tránh trùng lặp
        currentAudioRequest = GM_xmlhttpRequest({
            method: 'GET',
            url: ttsUrl,
            responseType: 'blob',
            onload: (res) => {
                if (requestId !== currentTtsRequestId) return;
                currentAudioRequest = null;

                if (res.response) {
                    stopCurrentAudio();
                    currentTtsRequestId = requestId;
                    currentBlobUrl = URL.createObjectURL(res.response);
                    const audio = new Audio(currentBlobUrl);
                    if (isSlow) audio.playbackRate = slowRate;

                    audio.onended = () => {
                        stopCurrentAudio();
                        if (onEndCallback) onEndCallback();
                    };
                    audio.onerror = () => {
                        stopCurrentAudio();
                        if (onEndCallback) onEndCallback();
                    };

                    currentAudio = audio;
                    audio.play().catch(e => {
                        console.warn('[GTT] Lỗi phát audio:', e);
                        stopCurrentAudio();
                        if (onEndCallback) onEndCallback();
                    });
                } else if (onEndCallback) {
                    onEndCallback();
                }
            },
            onerror: () => {
                if (requestId !== currentTtsRequestId) return;
                currentAudioRequest = null;
                stopCurrentAudio();
                if (onEndCallback) onEndCallback();
            },
            ontimeout: () => {
                if (requestId !== currentTtsRequestId) return;
                currentAudioRequest = null;
                stopCurrentAudio();
                if (onEndCallback) onEndCallback();
            }
        });
    }

    function playSystemTTS(text, lang, isSlow = false, onEndCallback = null) {
        stopCurrentAudio();
        if (!('speechSynthesis' in window)) {
            playGoogleAudioTTS(text, lang, isSlow, onEndCallback);
            return;
        }

        const slowRate = parseFloat(getConfig('slowSpeed')) || 0.6;
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = lang;
        utterance.rate = isSlow ? slowRate : 1.0;

        utterance.onend = () => {
            if (onEndCallback) onEndCallback();
        };
        utterance.onerror = () => {
            if (onEndCallback) onEndCallback();
        };

        window.speechSynthesis.speak(utterance);
    }

    // ============================================================
    // TRÍCH XUẤT KÍ ÂM (IPA / PHONETIC TRANSLITERATION TỪ GOOGLE)
    // ============================================================
    function extractPhonetics(data, isSource = false) {
        if (!data || !Array.isArray(data[0])) return '';
        const items = data[0];

        // Ưu tiên dòng tổng kết (item[0] === null). item[3] ở các đoạn dịch
        // có thể là phiên âm nguồn, không được dùng thay cho IPA đích.
        for (let i = items.length - 1; i >= 0; i--) {
            const item = items[i];
            if (!Array.isArray(item)) continue;

            if (item[0] !== null) continue;
            const value = isSource ? (item[3] || item[2]) : item[2];
            if (typeof value === 'string' && value.trim() && value !== item[0] && value !== item[1]) {
                return value.trim();
            }
        }
        return '';
    }

    function extractExampleSentences(data) {
        const examples = [];
        const visit = (node) => {
            if (!Array.isArray(node)) return;
            if (typeof node[0] === 'string') {
                const text = node[0].replace(/<[^>]*>/g, '').trim();
                if (text && !examples.includes(text)) examples.push(text);
            }
            node.forEach(visit);
        };

        visit(data && data[13]);
        return examples.slice(0, 3);
    }

    function fetchAiIpa(items, sourceText, sourceLang) {
        const endpoint = String(getConfig('aiEndpoint') || '').trim();
        const model = String(getConfig('aiModel') || '').trim();
        const apiKey = String(getConfig('aiApiKey') || '').trim();
        if (!endpoint || !model || !apiKey || !items.length) return Promise.resolve([]);

        const prompt = String(getConfig('aiPrompt') || DEFAULT_CONFIG.aiPrompt);
        const payload = {
            model,
            temperature: 0,
            messages: [
                { role: 'system', content: prompt },
                { role: 'system', content: 'MANDATORY OUTPUT CONTRACT: Return valid JSON only, using each input id as a top-level key and the IPA string as its value. Example: {"gtt-ipa-src":"/.../","gtt-ipa-tgt0":"/.../"}. Use sourceLanguage for the source item; use each target item language for that translation. Do not return an items array or extra text.' },
                { role: 'user', content: JSON.stringify({ source: sourceText, sourceLanguage: sourceLang, targets: items }) }
            ],
            response_format: { type: 'json_object' }
        };
        lastAiExchange = JSON.stringify({ request: payload, response: 'Đang chờ phản hồi…' }, null, 2);

        return new Promise(resolve => GM_xmlhttpRequest({
            method: 'POST', url: endpoint, timeout: 20000,
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
            data: JSON.stringify(payload),
            onload: response => {
                lastAiExchange = JSON.stringify({ request: payload, status: response.status, response: response.responseText }, null, 2);
                try {
                    if (response.status < 200 || response.status >= 300) return resolve({});
                    const content = JSON.parse(response.responseText).choices?.[0]?.message?.content;
                    const parsed = typeof content === 'string' ? JSON.parse(content) : content;
                    resolve(parsed && typeof parsed === 'object' ? parsed : {});
                } catch (error) { lastAiExchange += `\n\nParse error: ${error.message}`; resolve({}); }
            },
            onerror: error => { lastAiExchange = JSON.stringify({ request: payload, error: String(error) }, null, 2); resolve({}); },
            ontimeout: () => { lastAiExchange = JSON.stringify({ request: payload, error: 'Request timeout' }, null, 2); resolve({}); }
        }));
    }

    // ============================================================
    // POPUP RENDERING (Hiển thị tức thời, không nghẽn luồng)
    // ============================================================
    function startLookup(posX, posY) {
        removeIcon();
        renderPopupShell(posX, posY);

        const sl = getConfig('from');
        const tl = getConfig('to');
        const tl2 = getConfig('to2');
        const tl3 = getConfig('to3');

        const promises = [fetchTranslation(currentSelectedText, sl, tl)];

        if (tl2 && tl2 !== 'Disabled') {
            promises.push(fetchTranslation(currentSelectedText, sl, tl2));
        }
        if (tl3 && tl3 !== 'Disabled') {
            promises.push(fetchTranslation(currentSelectedText, sl, tl3));
        }

        // Hiển thị ngay tức thì khi Google Translate phản hồi (~100-200ms)
        Promise.all(promises)
            .then((results) => {
                renderTranslationResults(results);
            })
            .catch(error => {
                renderError(error);
            });
    }

    function renderPopupShell(posX, posY) {
        removePopup();
        injectStyles();

        popupEl = document.createElement('div');
        popupEl.id = 'gtt-popup';
        if (getConfig('theme') === 'dark') {
            popupEl.classList.add('gtt-dark');
        }
        popupEl.style.setProperty('--gtt-fs', getConfig('fontSize'));

        const adjustedX = Math.min(posX, window.innerWidth + window.scrollX - 480);
        popupEl.style.left = `${Math.max(10, adjustedX)}px`;
        popupEl.style.top = `${posY}px`;

        popupEl.innerHTML = `
            <div class="gtt-header" id="gtt-drag-handle">
                <div class="gtt-header-title">
                    <span style="display:flex;align-items:center;width:14px;height:14px;">${GOOGLE_ICON_SVG}</span>
                    <span>Google Translate</span>
                </div>
                <div class="gtt-header-actions">
                    <button class="gtt-btn-pin ${isPinned ? 'gtt-pinned' : ''}" id="gtt-btn-pin" title="Ghim popup (không tự đóng khi bấm ngoài)">📌</button>
                    <button class="gtt-btn-icon" id="gtt-btn-settings" title="Cài đặt">⚙️</button>
                    <button class="gtt-btn-icon" id="gtt-btn-close" title="Đóng">✕</button>
                </div>
            </div>
            <div id="gtt-body" style="text-align:center;padding:12px 0;">
                <div class="gtt-spinner"></div>
            </div>
        `;

        document.body.appendChild(popupEl);

        document.getElementById('gtt-btn-close').addEventListener('click', () => { isPinned = false; removePopup(); });
        document.getElementById('gtt-btn-settings').addEventListener('click', toggleSettings);
        document.getElementById('gtt-btn-pin').addEventListener('click', () => {
            isPinned = !isPinned;
            const pinBtn = document.getElementById('gtt-btn-pin');
            if (pinBtn) {
                pinBtn.classList.toggle('gtt-pinned', isPinned);
                pinBtn.title = isPinned ? 'Bỏ ghim (popup sẽ tự đóng khi bấm ngoài)' : 'Ghim popup (không tự đóng khi bấm ngoài)';
            }
        });

        enableDrag(popupEl, document.getElementById('gtt-drag-handle'));
    }

    function renderTranslationResults(results) {
        if (!popupEl) return;
        const bodyEl = popupEl.querySelector('#gtt-body');
        if (!bodyEl) return;

        bodyEl.style.textAlign = 'left';
        bodyEl.style.padding = '0';

        const mainData = results[0];
        // Google trả mã ngôn ngữ đã phát hiện ở data[2] khi sl=auto.
        // Không dùng ngôn ngữ cấu hình làm fallback, vì có thể biến Auto thành English.
        const detectedLang = mainData[2] || 'auto';
        let fullTranslatedText = '';

        if (mainData[0] && Array.isArray(mainData[0])) {
            fullTranslatedText = mainData[0].map(item => item[0]).filter(Boolean).join('');
        }

        const numWords = countWords(currentSelectedText);
        const allowIpa = getConfig('enableIpa') && numWords <= parseInt(getConfig('ipaWordLimit'), 10);

        // Tìm phiên âm gốc và phiên âm bản dịch từ Google (dt=rm)
        const srcPronounce = extractPhonetics(mainData, true);
        const tgtPronounce = extractPhonetics(mainData, false);

        let html = '';

        // 1. DÒNG VĂN BẢN GỐC (có nút phát âm, sao chép và phiên âm gốc)
        html += `
            <div class="gtt-source-row">
                <span class="gtt-lang-tag" title="Mã ngôn ngữ: ${escapeHtml(detectedLang)}">${escapeHtml(getLanguageName(detectedLang))}</span>
                <span class="gtt-orig-text">${escapeHtml(currentSelectedText)}</span>
                ${getConfig('tts') ? `<button class="gtt-tts-btn" data-tts-text="${escapeHtml(currentSelectedText)}" data-tts-lang="${escapeHtml(detectedLang)}" title="Phát âm (Bấm lần 2 để đọc chậm)">${SPEAKER_ICON_SVG}</button>` : ''}
                <button class="gtt-copy-btn" data-copy-text="${escapeHtml(currentSelectedText)}" title="Sao chép">${COPY_ICON_SVG}</button>
                <span class="gtt-ipa-subline" id="gtt-ipa-src" style="${allowIpa && srcPronounce ? 'display:block;' : 'display:none;'}">${srcPronounce ? `/${escapeHtml(srcPronounce)}/` : ''}</span>
            </div>
        `;

        // 2. BẢN DỊCH CHÍNH (có nút phát âm, sao chép và phiên âm bản dịch)
        html += `
            <div class="gtt-translation-row">
                <span class="gtt-lang-tag">${escapeHtml(getConfig('to'))}</span>
                <span class="gtt-trans-text">${escapeHtml(fullTranslatedText)}</span>
                ${fullTranslatedText ? '<button class="gtt-reverse-btn" id="gtt-btn-reverse" title="Đảo chiều dịch">🔄</button>' : ''}
                ${getConfig('tts') ? `<button class="gtt-tts-btn" data-tts-text="${escapeHtml(fullTranslatedText)}" data-tts-lang="${escapeHtml(getConfig('to'))}" title="Phát âm (Bấm lần 2 để đọc chậm)">${SPEAKER_ICON_SVG}</button>` : ''}
                <button class="gtt-copy-btn" data-copy-text="${escapeHtml(fullTranslatedText)}" title="Sao chép">${COPY_ICON_SVG}</button>
                <span class="gtt-ipa-subline" id="gtt-ipa-tgt0" style="${allowIpa && tgtPronounce ? 'display:block;' : 'display:none;'}">${tgtPronounce ? `/${escapeHtml(tgtPronounce)}/` : ''}</span>
            </div>
        `;

        // 3. NGÔN NGỮ DỊCH PHỤ 1 (nếu bật)
        let pron2 = '';
        if (results[1]) {
            const data2 = results[1];
            const text2 = data2[0] ? data2[0].map(item => item[0]).filter(Boolean).join('') : '';
            pron2 = extractPhonetics(data2, false);
            html += `
                <div class="gtt-translation-row" style="opacity:0.95;">
                    <span class="gtt-lang-tag">${escapeHtml(getConfig('to2'))}</span>
                    <span class="gtt-trans-text">${escapeHtml(text2)}</span>
                    ${getConfig('tts') ? `<button class="gtt-tts-btn" data-tts-text="${escapeHtml(text2)}" data-tts-lang="${escapeHtml(getConfig('to2'))}" title="Phát âm (Bấm lần 2 để đọc chậm)">${SPEAKER_ICON_SVG}</button>` : ''}
                    <button class="gtt-copy-btn" data-copy-text="${escapeHtml(text2)}" title="Sao chép">${COPY_ICON_SVG}</button>
                    <span class="gtt-ipa-subline" id="gtt-ipa-tgt1" style="${allowIpa && pron2 ? 'display:block;' : 'display:none;'}">${pron2 ? `/${escapeHtml(pron2)}/` : ''}</span>
                </div>
            `;
        }

        // 4. NGÔN NGỮ DỊCH PHỤ 2 (nếu bật)
        let pron3 = '';
        if (results[2]) {
            const data3 = results[2];
            const text3 = data3[0] ? data3[0].map(item => item[0]).filter(Boolean).join('') : '';
            pron3 = extractPhonetics(data3, false);
            html += `
                <div class="gtt-translation-row" style="opacity:0.95;">
                    <span class="gtt-lang-tag">${escapeHtml(getConfig('to3'))}</span>
                    <span class="gtt-trans-text">${escapeHtml(text3)}</span>
                    ${getConfig('tts') ? `<button class="gtt-tts-btn" data-tts-text="${escapeHtml(text3)}" data-tts-lang="${escapeHtml(getConfig('to3'))}" title="Phát âm (Bấm lần 2 để đọc chậm)">${SPEAKER_ICON_SVG}</button>` : ''}
                    <button class="gtt-copy-btn" data-copy-text="${escapeHtml(text3)}" title="Sao chép">${COPY_ICON_SVG}</button>
                    <span class="gtt-ipa-subline" id="gtt-ipa-tgt2" style="${allowIpa && pron3 ? 'display:block;' : 'display:none;'}">${pron3 ? `/${escapeHtml(pron3)}/` : ''}</span>
                </div>
            `;
        }

        const targetDetails = [
            { id: 'tgt0', text: fullTranslatedText, lang: getConfig('to') },
            ...(results[1] ? [{ id: 'tgt1', text: results[1][0]?.map(item => item[0]).filter(Boolean).join('') || '', lang: getConfig('to2') }] : []),
            ...(results[2] ? [{ id: 'tgt2', text: results[2][0]?.map(item => item[0]).filter(Boolean).join('') || '', lang: getConfig('to3') }] : [])
        ].filter(item => item.text && item.lang && item.lang !== 'Disabled');
        // 5. XÂY DỰNG NỘI DUNG CHI TIẾT (Details): Từ loại, Bản dịch thay thế, Định nghĩa & Từ đồng nghĩa
        let detailsHtml = '';
        const hasGrammar = Array.isArray(mainData[1]) && mainData[1].length > 0;
        const hasAlternatives = getConfig('showAlternatives') && Array.isArray(mainData[5]) && mainData[5].length > 0;
        const hasDefinitions = Array.isArray(mainData[12]) && mainData[12].length > 0;
        const showRelatedWords = countWords(currentSelectedText) === 1
            && String(detectedLang).toLowerCase().startsWith('en');

        if (hasGrammar || hasAlternatives || hasDefinitions) {
            // Nhóm từ loại & nghĩa tương đương (Grammar)
            if (hasGrammar) {
                detailsHtml += `<div class="gtt-section-title">Từ loại & Bản dịch</div>`;
                mainData[1].forEach(group => {
                    const pos = group[0];
                    const words = group[1] || [];
                    if (words.length > 0) {
                        detailsHtml += `
                            <div class="gtt-dict-group">
                                <div class="gtt-dict-pos">${escapeHtml(pos)}</div>
                                <div class="gtt-dict-terms">${escapeHtml(words.slice(0, 6).join(', '))}</div>
                            </div>
                        `;
                    }
                });
            }

            // Bản dịch thay thế (Show alternatives in details)
            if (hasAlternatives) {
                detailsHtml += `<div class="gtt-section-title">Bản dịch thay thế</div>`;
                mainData[5].forEach(item => {
                    if (item[2] && Array.isArray(item[2])) {
                        const alts = item[2].map(x => x[0]).filter(Boolean);
                        if (alts.length > 0) {
                            detailsHtml += `<div class="gtt-alt-item">• ${escapeHtml(alts.slice(0, 5).join(', '))}</div>`;
                        }
                    }
                });
            }

            // Định nghĩa & Từ đồng nghĩa (Show synonyms in definitions)
            if (hasDefinitions) {
                detailsHtml += `<div class="gtt-section-title">Định nghĩa & Từ đồng nghĩa</div>`;
                const synonymsMap = new Map();

                if (getConfig('showSynonyms') && Array.isArray(mainData[11])) {
                    mainData[11].forEach(synGroup => {
                        if (Array.isArray(synGroup[1])) {
                            synGroup[1].forEach(synItem => {
                                if (synItem[1] && Array.isArray(synItem[0])) {
                                    synonymsMap.set(synItem[1], synItem[0]);
                                }
                            });
                        }
                    });
                }

                mainData[12].forEach(defGroup => {
                    const pos = defGroup[0];
                    if (Array.isArray(defGroup[1])) {
                        detailsHtml += `<div class="gtt-dict-pos" style="margin-top:4px;">${escapeHtml(pos)}</div>`;
                        defGroup[1].slice(0, 3).forEach(defItem => {
                            const defText = defItem[0];
                            const defId = defItem[1];
                            detailsHtml += `<div class="gtt-dict-terms">- ${escapeHtml(defText)}</div>`;

                            if (getConfig('showSynonyms') && defId && synonymsMap.has(defId)) {
                                const syns = synonymsMap.get(defId);
                                detailsHtml += `<span class="gtt-synonym-tag">Đồng nghĩa: ${escapeHtml(syns.slice(0, 5).join(', '))}</span>`;
                            }
                        });
                    }
                });
            }
        }

        if (showRelatedWords) {
            detailsHtml += `
                <div class="gtt-related-block" id="gtt-related-words">
                    <div class="gtt-section-title">Từ liên quan & Trái nghĩa</div>
                    <div style="color:#5f6368;font-size:12px;">Đang tải...</div>
                </div>
            `;
        }

        const examples = extractExampleSentences(mainData);
        if (examples.length) {
            detailsHtml += `<div class="gtt-examples-block"><div class="gtt-section-title">Ví dụ câu</div>`;
            examples.forEach(example => {
                detailsHtml += `<div class="gtt-dict-terms" style="font-style:italic;margin-bottom:3px;">“${escapeHtml(example)}”</div>`;
            });
            detailsHtml += '</div>';
        }

        detailsHtml += `<div class="gtt-ai-details-controls" style="margin-top:10px;border-top:1px dashed var(--gtt-border,#dadce0);padding-top:6px;">${targetDetails.map(item => `<button class="gtt-btn-secondary" data-ai-detail-id="${item.id}" data-ai-detail-text="${escapeHtml(item.text)}" data-ai-detail-lang="${escapeHtml(item.lang)}" style="margin-right:4px;">${escapeHtml(item.lang)}</button>`).join('')}<div id="gtt-ai-details-result"></div></div>`;

        // Tích hợp toggle chi tiết
        if (detailsHtml) {
            const hideDefault = getConfig('hideDetailsDefault');
            isDetailsExpanded = !hideDefault;

            html += `
                <div>
                    <button class="gtt-toggle-details-btn" id="gtt-toggle-details">
                        ${isDetailsExpanded ? '▲ Ẩn chi tiết' : '▼ Xem chi tiết từ điển'}
                    </button>
                    <div class="gtt-details-section" id="gtt-details-box" style="display:${isDetailsExpanded ? 'block' : 'none'};">
                        ${detailsHtml}
                    </div>
                </div>
            `;
        }

        bodyEl.innerHTML = html;

        bodyEl.querySelectorAll('[data-ai-detail-id]').forEach(button => button.addEventListener('click', async () => {
            const lang = button.dataset.aiDetailLang;
            const text = button.dataset.aiDetailText;
            const cache = getAiDetailsCache();
            const key = `${lang}:${text.trim().toLowerCase()}`;
            const result = bodyEl.querySelector('#gtt-ai-details-result');
            const renderDetail = value => {
                let data = value;
                if (typeof value === 'string') {
                    try { data = JSON.parse(value); } catch (_) { data = { meaning: value }; }
                }
                if (!data || typeof data !== 'object') data = { meaning: String(data || '') };
                const examples = Array.isArray(data.examples) ? data.examples : [];
                result.innerHTML = `<div class="gtt-section-title">${escapeHtml(lang)} — ${escapeHtml(text)}</div>${data.meaning ? `<div class="gtt-dict-terms"><strong>Nghĩa:</strong> ${escapeHtml(data.meaning)}</div>` : ''}${data.usage ? `<div class="gtt-dict-terms"><strong>Cách dùng:</strong> ${escapeHtml(data.usage)}</div>` : ''}${examples.length ? `<div class="gtt-dict-terms"><strong>Ví dụ:</strong><ul>${examples.map(example => `<li>${escapeHtml(example)}</li>`).join('')}</ul></div>` : ''}`;
            };
            if (cache[key]) { renderDetail(cache[key].data); return; }
            result.textContent = 'Đang tải chi tiết…';
            const endpoint = String(getConfig('aiEndpoint') || '').trim();
            const model = String(getConfig('aiModel') || '').trim();
            const apiKey = String(getConfig('aiApiKey') || '').trim();
            if (!endpoint || !model || !apiKey) { result.textContent = 'Cần cấu hình endpoint, model và API key.'; return; }
            const payload = { model, temperature: 0, messages: [
                { role: 'system', content: getConfig('aiDetailsPrompt') || DEFAULT_CONFIG.aiDetailsPrompt },
                { role: 'user', content: JSON.stringify({ source: currentSelectedText, sourceLanguage: detectedLang, target: text, targetLanguage: lang }) }
            ], response_format: { type: 'json_object' } };
            GM_xmlhttpRequest({ method: 'POST', url: endpoint, timeout: 20000, headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` }, data: JSON.stringify(payload),
                onload: response => {
                    try {
                        if (response.status < 200 || response.status >= 300) throw new Error(`HTTP ${response.status}: ${response.responseText.slice(0, 250)}`);
                        const content = JSON.parse(response.responseText).choices?.[0]?.message?.content;
                        const data = typeof content === 'string' ? JSON.parse(content) : content;
                        cache[key] = { data, timestamp: Date.now() };
                        const keys = Object.keys(cache).sort((a, b) => cache[a].timestamp - cache[b].timestamp);
                        while (keys.length > MAX_AI_DETAILS_CACHE_ENTRIES) delete cache[keys.shift()];
                        GM_setValue(AI_DETAILS_CACHE_KEY, cache);
                        renderDetail(data);
                    } catch (error) { result.textContent = error.message; }
                }, onerror: () => { result.textContent = 'Lỗi kết nối AI'; }, ontimeout: () => { result.textContent = 'AI request timeout'; }
            });
        }));

        if (showRelatedWords) {
            const lookupPopup = popupEl;
            fetchRelatedWords(currentSelectedText.trim().toLowerCase()).then(({ synonyms, antonyms }) => {
                if (popupEl !== lookupPopup) return;
                const relatedEl = popupEl.querySelector('#gtt-related-words');
                if (!relatedEl) return;
                if (!synonyms.length && !antonyms.length) {
                    relatedEl.remove();
                    return;
                }
                relatedEl.innerHTML = `
                    <div class="gtt-section-title">Từ liên quan & Trái nghĩa</div>
                    ${synonyms.length ? `<div class="gtt-dict-terms"><strong>Đồng nghĩa:</strong> ${escapeHtml(synonyms.join(', '))}</div>` : ''}
                    ${antonyms.length ? `<div class="gtt-dict-terms"><strong>Trái nghĩa:</strong> ${escapeHtml(antonyms.join(', '))}</div>` : ''}
                `;
            });
        }

        const reverseBtn = bodyEl.querySelector('#gtt-btn-reverse');
        if (reverseBtn) {
            reverseBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const targetLang = getConfig('to');
                const sourceLang = detectedLang && detectedLang !== 'auto' ? detectedLang : '';
                if (!sourceLang || !targetLang || targetLang === 'Disabled') return;
                setConfig('from', targetLang);
                setConfig('to', sourceLang);
                currentSelectedText = fullTranslatedText;
                startLookup(parseInt(popupEl.style.left, 10), parseInt(popupEl.style.top, 10));
            });
        }

        // Gắn sự kiện phát âm: Bấm lần 1 tốc độ chuẩn, bấm lần 2 liên tiếp phát chậm theo mức cấu hình
        bodyEl.querySelectorAll('.gtt-tts-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const text = btn.getAttribute('data-tts-text');
                const lang = btn.getAttribute('data-tts-lang');

                const now = Date.now();
                let isSlow = false;
                const elapsed = now - lastTtsClick.time;
                // Nếu bấm cùng 1 nút lần 2 trong vòng 4.5 giây (cách ít nhất 80ms tránh dội chuột) -> tự động phát chậm!
                if (lastTtsClick.text === text && elapsed > 80 && elapsed < 4500 && !lastTtsClick.isSlow) {
                    isSlow = true;
                } else {
                    isSlow = false;
                }

                lastTtsClick = { text, lang, time: now, isSlow };

                // Hiệu ứng animation hiển thị trạng thái đang phát
                bodyEl.querySelectorAll('.gtt-tts-btn').forEach(b => b.classList.remove('gtt-playing', 'gtt-playing-slow'));
                btn.classList.add(isSlow ? 'gtt-playing-slow' : 'gtt-playing');

                playTTS(text, lang, isSlow, () => {
                    btn.classList.remove('gtt-playing', 'gtt-playing-slow');
                });
            });
        });

        // Gắn sự kiện sao chép nhanh cho tất cả nút copy
        bodyEl.querySelectorAll('.gtt-copy-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const text = btn.getAttribute('data-copy-text');
                if (text) copyToClipboard(text, btn);
            });
        });

        // Bổ sung ký âm IPA cho câu gốc VÀ TẤT CẢ các bản dịch
        if (allowIpa) {
            const limit = parseInt(getConfig('ipaWordLimit'), 10) || 5;
            const itemsToCheck = [
                { id: '#gtt-ipa-src', text: currentSelectedText, lang: detectedLang, hasPron: Boolean(srcPronounce), source: true },
                { id: '#gtt-ipa-tgt0', text: fullTranslatedText, lang: getConfig('to'), hasPron: Boolean(tgtPronounce), source: false }
            ];
            if (results[1]) {
                const text2 = results[1][0] ? results[1][0].map(item => item[0]).filter(Boolean).join('') : '';
                itemsToCheck.push({ id: '#gtt-ipa-tgt1', text: text2, lang: getConfig('to2'), hasPron: Boolean(pron2), source: false });
            }
            if (results[2]) {
                const text3 = results[2][0] ? results[2][0].map(item => item[0]).filter(Boolean).join('') : '';
                itemsToCheck.push({ id: '#gtt-ipa-tgt2', text: text3, lang: getConfig('to3'), hasPron: Boolean(pron3), source: false });
            }

            itemsToCheck.forEach(item => {
                if (!item.text || countWords(item.text) > limit) return;
                const el = bodyEl.querySelector(item.id);
                if (!el) return;
                if (getConfig('aiIpa')) return;
                if (item.hasPron || item.lang !== 'en') return;
                getPhoneticIpa(item.text).then(ipa => {
                    if (ipa && popupEl) {
                        const targetEl = popupEl.querySelector(item.id);
                        if (targetEl) {
                            targetEl.textContent = `/${ipa}/`;
                            targetEl.style.display = 'block';
                        }
                    }
                });
            });

            if (getConfig('aiIpa')) {
                const aiItems = itemsToCheck.filter(item => item.lang && item.lang !== 'Disabled' && item.text);
                fetchAiIpa(aiItems.map(item => ({ id: item.id.replace('#', ''), text: item.text, language: item.lang })), currentSelectedText, detectedLang).then(results => {
                    aiItems.forEach(item => {
                        const ipa = results[item.id.replace('#', '')];
                        if (!item || typeof ipa !== 'string' || !ipa.trim() || !popupEl) return;
                        const target = popupEl.querySelector(item.id);
                        if (target) { target.textContent = `/${ipa.trim().replace(/^\/+|\/+$/g, '')}/`; target.style.display = 'block'; }
                    });
                });
            }
        }

        // Listener toggle chi tiết
        const toggleBtn = bodyEl.querySelector('#gtt-toggle-details');
        const detailsBox = bodyEl.querySelector('#gtt-details-box');
        if (toggleBtn && detailsBox) {
            toggleBtn.addEventListener('click', () => {
                isDetailsExpanded = !isDetailsExpanded;
                detailsBox.style.display = isDetailsExpanded ? 'block' : 'none';
                toggleBtn.textContent = isDetailsExpanded ? '▲ Ẩn chi tiết' : '▼ Xem chi tiết từ điển';
            });
        }
    }

    function renderError(err) {
        if (!popupEl) return;
        const bodyEl = popupEl.querySelector('#gtt-body');
        if (!bodyEl) return;
        bodyEl.style.textAlign = 'center';
        bodyEl.innerHTML = `
            <div style="color:#d93025;padding:8px 0;">
                Không thể tải bản dịch (${escapeHtml(err.message || 'Lỗi mạng')}).
            </div>
        `;
    }

    // ============================================================
    // BẢNG CÀI ĐẶT TRỰC QUAN (SETTINGS PANEL)
    // ============================================================
    function toggleSettings() {
        if (!popupEl) return;
        const bodyEl = popupEl.querySelector('#gtt-body');
        if (!bodyEl) return;

        if (isShowingSettings) {
            isShowingSettings = false;
            startLookup(parseInt(popupEl.style.left, 10), parseInt(popupEl.style.top, 10));
            return;
        }

        isShowingSettings = true;
        bodyEl.style.textAlign = 'left';

        const langOptions = (selected) => LANGUAGES.map(l =>
            `<option value="${l.code}" ${l.code === selected ? 'selected' : ''}>${l.name}</option>`
        ).join('');

        const disabledOption = (selected) =>
            `<option value="Disabled" ${selected === 'Disabled' ? 'selected' : ''}>(Tắt)</option>` + langOptions(selected);

        bodyEl.innerHTML = `
            <div class="gtt-settings-panel">
                <div class="gtt-field-row">
                    <label>Từ ngôn ngữ:</label>
                    <select id="gtt-set-from">${langOptions(getConfig('from'))}</select>
                </div>
                <div class="gtt-field-row">
                    <label>Dịch sang:</label>
                    <select id="gtt-set-to">${langOptions(getConfig('to'))}</select>
                </div>
                <div class="gtt-field-row">
                    <label>Dịch thêm 1:</label>
                    <select id="gtt-set-to2">${disabledOption(getConfig('to2'))}</select>
                </div>
                <div class="gtt-field-row">
                    <label>Dịch thêm 2:</label>
                    <select id="gtt-set-to3">${disabledOption(getConfig('to3'))}</select>
                </div>
                <div class="gtt-field-row">
                    <label>Cỡ chữ:</label>
                    <select id="gtt-set-fs">
                        <option value="12px" ${getConfig('fontSize') === '12px' ? 'selected' : ''}>Nhỏ (12px)</option>
                        <option value="14px" ${getConfig('fontSize') === '14px' ? 'selected' : ''}>Chuẩn (14px)</option>
                        <option value="16px" ${getConfig('fontSize') === '16px' ? 'selected' : ''}>Lớn (16px)</option>
                    </select>
                </div>
                <div class="gtt-field-row">
                    <label>Giao diện:</label>
                    <select id="gtt-set-theme">
                        <option value="light" ${getConfig('theme') === 'light' ? 'selected' : ''}>Sáng</option>
                        <option value="dark" ${getConfig('theme') === 'dark' ? 'selected' : ''}>Tối (Dark)</option>
                    </select>
                </div>

                <div class="gtt-field-row" style="border-top:1px dashed var(--gtt-border, #dadce0);padding-top:6px;">
                    <label><input type="checkbox" id="gtt-set-hide-details" ${getConfig('hideDetailsDefault') ? 'checked' : ''}/> Ẩn chi tiết từ điển mặc định</label>
                </div>
                <div class="gtt-field-row">
                    <label><input type="checkbox" id="gtt-set-alts" ${getConfig('showAlternatives') ? 'checked' : ''}/> Hiện bản dịch thay thế</label>
                </div>
                <div class="gtt-field-row">
                    <label><input type="checkbox" id="gtt-set-syns" ${getConfig('showSynonyms') ? 'checked' : ''}/> Hiện từ đồng nghĩa (synonyms)</label>
                </div>

                <div class="gtt-field-row" style="border-top:1px dashed var(--gtt-border, #dadce0);padding-top:6px;">
                    <label><input type="checkbox" id="gtt-set-ipa" ${getConfig('enableIpa') ? 'checked' : ''}/> Kí âm / phiên âm (IPA/Pinyin)</label>
                    <span style="font-size:11px;color:#5f6368;">
                        Dưới <input type="number" id="gtt-set-ipa-limit" value="${getConfig('ipaWordLimit')}" min="1" max="20" style="width:38px;padding:1px 3px;"/> từ
                    </span>
                </div>

                <div class="gtt-field-row">
                    <label><input type="checkbox" id="gtt-set-tts" ${getConfig('tts') ? 'checked' : ''}/> Nút phát âm (TTS)</label>
                </div>
                <div class="gtt-field-row" style="margin-left: 18px; margin-top: -4px;">
                    <label style="font-size:12px;color:#5f6368;">Nguồn phát âm:</label>
                    <select id="gtt-set-tts-engine">
                        <option value="google" ${getConfig('ttsEngine') === 'google' ? 'selected' : ''}>Google Translate (Chuẩn, Tự nhiên)</option>
                        <option value="system" ${getConfig('ttsEngine') === 'system' ? 'selected' : ''}>Trình duyệt (Web Speech API)</option>
                    </select>
                </div>
                <div class="gtt-field-row" style="margin-left: 18px; margin-top: -4px;">
                    <label style="font-size:12px;color:#5f6368;">Tốc độ đọc chậm (lần 2):</label>
                    <select id="gtt-set-slow-speed">
                        <option value="0.75" ${getConfig('slowSpeed') === '0.75' ? 'selected' : ''}>0.75x (Hơi chậm)</option>
                        <option value="0.6" ${getConfig('slowSpeed') === '0.6' ? 'selected' : ''}>0.6x (Khuyên dùng)</option>
                        <option value="0.5" ${getConfig('slowSpeed') === '0.5' ? 'selected' : ''}>0.5x (Chậm)</option>
                        <option value="0.35" ${getConfig('slowSpeed') === '0.35' ? 'selected' : ''}>0.35x (Rất chậm)</option>
                    </select>
                </div>
                <div class="gtt-field-row">
                    <label><input type="checkbox" id="gtt-set-ctrl" ${getConfig('requireCtrl') ? 'checked' : ''}/> Giữ Ctrl khi bôi đen</label>
                    <label><input type="checkbox" id="gtt-set-alt" ${getConfig('requireAlt') ? 'checked' : ''}/> Giữ Alt khi bôi đen</label>
                </div>
                <div class="gtt-field-row">
                    <label>Phím tắt dịch nhanh:</label>
                    <div style="display:flex;align-items:center;gap:4px;">
                        <input type="text" id="gtt-set-hotkey" value="${escapeHtml(getConfig('hotkey') || '')}" placeholder="Bấm phím..." readonly style="width:90px;text-align:center;cursor:pointer;" title="Bôi đen văn bản rồi bấm phím này để dịch nhanh."/>
                        <button type="button" id="gtt-btn-clear-hotkey" class="gtt-btn-secondary" style="font-size:11px;padding:2px 5px;">Xóa</button>
                    </div>
                </div>
                <div class="gtt-field-row" style="border-top:1px dashed var(--gtt-border, #dadce0);padding-top:6px;">
                    <label><input type="checkbox" id="gtt-set-ai-ipa" ${getConfig('aiIpa') ? 'checked' : ''}/> Dùng AI bổ sung IPA</label>
                </div>
                <div class="gtt-field-row"><label>OpenAI API endpoint:</label><input type="text" id="gtt-set-ai-endpoint" value="${escapeHtml(getConfig('aiEndpoint'))}" style="width:220px;"/></div>
                <div class="gtt-field-row"><label>Model:</label><button type="button" id="gtt-btn-load-models" class="gtt-btn-secondary" title="Tải danh sách model">↻</button><select id="gtt-set-ai-model" style="max-width:210px;margin-left:auto;text-align:right;"><option value="${escapeHtml(getConfig('aiModel'))}">${escapeHtml(getConfig('aiModel') || 'Tải model để chọn')}</option></select><span id="gtt-model-status" style="font-size:11px;"></span></div>
                <div class="gtt-field-row"><label>API key:</label><input type="password" id="gtt-set-ai-key" value="${escapeHtml(getConfig('aiApiKey'))}" autocomplete="off" style="width:180px;"/></div>
                <div class="gtt-field-row" style="display:block;"><div style="display:flex;align-items:center;justify-content:flex-end;gap:6px;margin-bottom:4px;"><button type="button" id="gtt-btn-reset-ai-prompt" class="gtt-btn-secondary">Prompt mặc định</button><label>Prompt:</label></div><textarea id="gtt-set-ai-prompt" rows="4" style="width:100%;">${escapeHtml(getConfig('aiPrompt'))}</textarea></div>
                <div class="gtt-field-row" style="display:block;"><div style="display:flex;align-items:center;justify-content:flex-end;gap:6px;margin-bottom:4px;"><button type="button" id="gtt-btn-refresh-ai-debug" class="gtt-btn-secondary">Tải lại</button><label>Request/response AI gần nhất:</label><label style="margin-left:auto;"><input type="checkbox" id="gtt-set-ai-debug" ${getConfig('aiDebug') ? 'checked' : ''}/> Debug</label></div><textarea id="gtt-ai-debug" rows="8" readonly style="width:100%;font-family:monospace;font-size:10px;display:${getConfig('aiDebug') ? 'block' : 'none'};">${escapeHtml(lastAiExchange)}</textarea></div>

                <div class="gtt-settings-footer">
                    <button class="gtt-btn-secondary" id="gtt-btn-cancel">Hủy</button>
                    <button class="gtt-btn-primary" id="gtt-btn-save">Lưu</button>
                </div>
            </div>
        `;

        const hotkeyInput = document.getElementById('gtt-set-hotkey');
        hotkeyInput.addEventListener('keydown', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (e.key !== 'Escape' && !e.ctrlKey && !e.altKey && !e.metaKey) {
                hotkeyInput.value = e.code;
            }
        });
        document.getElementById('gtt-btn-clear-hotkey').addEventListener('click', () => {
            hotkeyInput.value = '';
        });
        document.getElementById('gtt-btn-reset-ai-prompt').addEventListener('click', () => {
            document.getElementById('gtt-set-ai-prompt').value = DEFAULT_CONFIG.aiPrompt;
        });
        document.getElementById('gtt-btn-refresh-ai-debug').addEventListener('click', () => {
            document.getElementById('gtt-ai-debug').value = lastAiExchange;
        });
        document.getElementById('gtt-set-ai-debug').addEventListener('change', (e) => {
            const debug = document.getElementById('gtt-ai-debug');
            debug.style.display = e.target.checked ? 'block' : 'none';
            setConfig('aiDebug', e.target.checked);
        });

        document.getElementById('gtt-btn-load-models').addEventListener('click', () => {
            const endpoint = document.getElementById('gtt-set-ai-endpoint').value.trim().replace(/\/+$/, '').replace(/\/chat\/completions$/, '');
            const apiKey = document.getElementById('gtt-set-ai-key').value.trim();
            const modelSelect = document.getElementById('gtt-set-ai-model');
            const status = document.getElementById('gtt-model-status');
            if (!endpoint || !apiKey) { status.textContent = 'Nhập endpoint và API key trước'; return; }
            status.textContent = 'Đang tải…';
            GM_xmlhttpRequest({
                method: 'GET', url: `${endpoint}/models`, timeout: 15000,
                headers: { 'Authorization': `Bearer ${apiKey}`, 'Accept': 'application/json' },
                onload: response => {
                    try {
                        if (response.status < 200 || response.status >= 300) throw new Error(`HTTP ${response.status}`);
                        const models = JSON.parse(response.responseText).data;
                        if (!Array.isArray(models)) throw new Error('Phản hồi không có danh sách model');
                        const selected = modelSelect.value;
                        modelSelect.replaceChildren(...models.filter(model => model && model.id).map(model => new Option(model.id, model.id)));
                        if (selected && !models.some(model => model.id === selected)) modelSelect.add(new Option(selected, selected));
                        if (selected) modelSelect.value = selected;
                        status.textContent = models.length ? `${models.length} model` : 'Không có model';
                    } catch (error) { status.textContent = error.message || 'Không tải được model'; }
                },
                onerror: () => { status.textContent = 'Lỗi kết nối'; },
                ontimeout: () => { status.textContent = 'Hết thời gian chờ'; }
            });
        });

        document.getElementById('gtt-btn-cancel').addEventListener('click', () => {
            isShowingSettings = false;
            startLookup(parseInt(popupEl.style.left, 10), parseInt(popupEl.style.top, 10));
        });

        document.getElementById('gtt-btn-save').addEventListener('click', () => {
            setConfig('from', document.getElementById('gtt-set-from').value);
            setConfig('to', document.getElementById('gtt-set-to').value);
            setConfig('to2', document.getElementById('gtt-set-to2').value);
            setConfig('to3', document.getElementById('gtt-set-to3').value);
            setConfig('fontSize', document.getElementById('gtt-set-fs').value);
            setConfig('theme', document.getElementById('gtt-set-theme').value);
            setConfig('hideDetailsDefault', document.getElementById('gtt-set-hide-details').checked);
            setConfig('showAlternatives', document.getElementById('gtt-set-alts').checked);
            setConfig('showSynonyms', document.getElementById('gtt-set-syns').checked);
            setConfig('enableIpa', document.getElementById('gtt-set-ipa').checked);
            setConfig('ipaWordLimit', parseInt(document.getElementById('gtt-set-ipa-limit').value, 10) || 5);
            setConfig('tts', document.getElementById('gtt-set-tts').checked);
            setConfig('ttsEngine', document.getElementById('gtt-set-tts-engine').value);
            setConfig('slowSpeed', document.getElementById('gtt-set-slow-speed').value);
            setConfig('requireCtrl', document.getElementById('gtt-set-ctrl').checked);
            setConfig('requireAlt', document.getElementById('gtt-set-alt').checked);
            setConfig('hotkey', hotkeyInput.value.trim());
            setConfig('aiIpa', document.getElementById('gtt-set-ai-ipa').checked);
            setConfig('aiDebug', document.getElementById('gtt-set-ai-debug').checked);
            setConfig('aiEndpoint', document.getElementById('gtt-set-ai-endpoint').value.trim());
            setConfig('aiModel', document.getElementById('gtt-set-ai-model').value.trim());
            setConfig('aiApiKey', document.getElementById('gtt-set-ai-key').value.trim());
            setConfig('aiPrompt', document.getElementById('gtt-set-ai-prompt').value.trim());

            isShowingSettings = false;
            startLookup(parseInt(popupEl.style.left, 10), parseInt(popupEl.style.top, 10));
        });
    }

    // ============================================================
    // KÉO THẢ DI CHUYỂN (DRAG AND DROP)
    // ============================================================
    function enableDrag(element, handle) {
        let offsetX = 0, offsetY = 0, isDragging = false;

        handle.addEventListener('mousedown', (e) => {
            if (e.target.tagName === 'BUTTON') return;
            isDragging = true;
            offsetX = e.clientX - element.offsetLeft;
            offsetY = e.clientY - element.offsetTop;

            const onMouseMove = (moveEvent) => {
                if (!isDragging) return;
                element.style.left = `${moveEvent.clientX - offsetX}px`;
                element.style.top = `${moveEvent.clientY - offsetY}px`;
            };

            const onMouseUp = () => {
                isDragging = false;
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
            };

            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        });
    }

    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    // ============================================================
    // KHỞI CHẠY LẮNG NGHE SỰ KIỆN
    // ============================================================
    document.addEventListener('mouseup', onMouseUp, false);
    document.addEventListener('mousedown', onMouseDown, false);

    // Phím tắt tùy chỉnh: dịch nhanh văn bản đang chọn
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && popupEl) {
            isPinned = false;
            removePopup();
            return;
        }

        const hotkey = getConfig('hotkey');
        if (!hotkey || e.repeat || e.code !== hotkey) return;

        const text = getSelectedText();
        if (!text) return;

        e.preventDefault();
        currentSelectedText = text;
        const sel = window.getSelection();
        const activeEl = document.activeElement;
        const rect = sel && sel.rangeCount > 0
            ? sel.getRangeAt(0).getBoundingClientRect()
            : activeEl && typeof activeEl.getBoundingClientRect === 'function'
                ? activeEl.getBoundingClientRect()
                : null;
        if (rect) {
            startLookup(rect.left + window.scrollX, rect.bottom + window.scrollY + 5);
        }
    }, false);

})();
