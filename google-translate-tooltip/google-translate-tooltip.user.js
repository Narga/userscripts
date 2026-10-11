// ==UserScript==
// @name         Google Translate Tooltip
// @namespace    CustomScripts
// @version      1.1.1
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
// @connect      api.dictionaryapi.dev
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
        hideDetailsDefault: false, // Ẩn chi tiết từ điển theo mặc định
        showAlternatives: true,    // Hiển thị các bản dịch thay thế
        showSynonyms: true,        // Hiển thị từ đồng nghĩa trong định nghĩa
        enableIpa: true,           // Bật/tắt hiển thị ký âm / phiên âm (IPA/Pinyin/Romaji)
        ipaWordLimit: 5,           // Áp dụng ký âm cho từ đơn hoặc câu dưới số từ này
        fontSize: '14px',
        theme: 'light',            // light hoặc dark
        requireCtrl: false,
        requireAlt: false,
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
            color: #5f6368;
            font-style: italic;
            margin-top: 2px;
            margin-left: 2px;
            font-family: "Lucida Sans Unicode", "DejaVu Sans", "Segoe UI", sans-serif;
        }
        .gtt-dark .gtt-ipa-subline {
            color: #9aa0a6;
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
            margin-left: 4px;
            transition: color 0.15s ease, background 0.15s ease, transform 0.1s ease;
        }
        .gtt-tts-btn:hover {
            color: #1a73e8;
            background: rgba(26,115,232,0.1);
            transform: scale(1.1);
        }
        .gtt-dark .gtt-tts-btn {
            color: #9aa0a6;
        }
        .gtt-dark .gtt-tts-btn:hover {
            color: #8ab4f8;
            background: rgba(138,180,248,0.15);
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

    // ============================================================
    // STATE & DOM NODES
    // ============================================================
    let currentSelectedText = '';
    let iconBtn = null;
    let popupEl = null;
    let hoverTimer = null;
    let isShowingSettings = false;
    let isDetailsExpanded = false;

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
    // dt=at (bản dịch thay thế), dt=md (định nghĩa), dt=ss (từ đồng nghĩa)
    // ============================================================
    function fetchTranslation(text, sl, tl) {
        return new Promise((resolve, reject) => {
            const encodedText = encodeURIComponent(text);
            const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sl}&tl=${tl}&dt=t&dt=bd&dt=rm&dt=at&dt=md&dt=ss&q=${encodedText}`;

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
                            resolve(data);
                        } catch (err) {
                            reject(err);
                        }
                    } else {
                        reject(new Error(`HTTP error ${response.status}`));
                    }
                },
                ontimeout: () => reject(new Error('Hết thời gian chờ (Timeout 5s)')),
                onerror: (err) => reject(err)
            });
        });
    }

    // ============================================================
    // TRA CỨU KÍ ÂM IPA BỔ SUNG (ENGLISH PHONETICS API)
    // Non-blocking, có timeout ngắn để tránh treo hoàn toàn giao diện
    // ============================================================
    function fetchEnglishIpa(word) {
        const clean = word.toLowerCase().trim();
        if (ipaCache.has(clean)) {
            return Promise.resolve(ipaCache.get(clean));
        }

        return new Promise((resolve) => {
            GM_xmlhttpRequest({
                method: 'GET',
                url: `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(clean)}`,
                timeout: 2500,
                onload: (resp) => {
                    if (resp.status === 200) {
                        try {
                            const res = JSON.parse(resp.responseText);
                            if (Array.isArray(res) && res[0]) {
                                let phonetic = res[0].phonetic || '';
                                if (!phonetic && Array.isArray(res[0].phonetics)) {
                                    const withText = res[0].phonetics.find(p => p.text);
                                    if (withText) phonetic = withText.text;
                                }
                                if (phonetic) {
                                    phonetic = phonetic.replace(/^\/|\/$/g, '').trim();
                                    ipaCache.set(clean, phonetic);
                                    resolve(phonetic);
                                    return;
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

    // ============================================================
    // TEXT TO SPEECH (Phát âm giọng đọc chuẩn cho từng ngôn ngữ)
    // ============================================================
    function playTTS(text, lang) {
        if (!text) return;
        const targetLang = (!lang || lang === 'auto') ? 'en' : lang;

        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = targetLang;

            let hasSpoken = false;
            utterance.onstart = () => { hasSpoken = true; };

            const fallbackTimer = setTimeout(() => {
                if (!hasSpoken) {
                    playGoogleAudioTTS(text, targetLang);
                }
            }, 600);

            utterance.onend = () => clearTimeout(fallbackTimer);
            utterance.onerror = () => {
                clearTimeout(fallbackTimer);
                playGoogleAudioTTS(text, targetLang);
            };

            window.speechSynthesis.speak(utterance);
            return;
        }

        playGoogleAudioTTS(text, targetLang);
    }

    function playGoogleAudioTTS(text, lang) {
        const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=${encodeURIComponent(lang)}&client=tw-ob&q=${encodeURIComponent(text)}`;
        const audio = new Audio(ttsUrl);
        audio.play().catch(e => console.warn('[GTT] Lỗi phát âm audio:', e));
    }

    // ============================================================
    // TRÍCH XUẤT KÍ ÂM (IPA / PHONETIC TRANSLITERATION TỪ GOOGLE)
    // ============================================================
    function extractPhonetics(data, isSource = false) {
        if (!data || !Array.isArray(data[0])) return '';
        const items = data[0];

        // 1. Kiểm tra dòng phiên âm tổng kết ở cuối data[0] (thường item[0] === null)
        for (let i = items.length - 1; i >= 0; i--) {
            const item = items[i];
            if (Array.isArray(item)) {
                if (isSource && item[3] && typeof item[3] === 'string') {
                    return item[3].trim();
                }
                if (!isSource && item[2] && typeof item[2] === 'string') {
                    return item[2].trim();
                }
            }
        }

        // 2. Kiểm tra trong từng đoạn dịch
        for (const item of items) {
            if (Array.isArray(item)) {
                if (isSource && item[3] && typeof item[3] === 'string' && item[3] !== item[1]) {
                    return item[3].trim();
                }
                if (!isSource && item[2] && typeof item[2] === 'string' && item[2] !== item[0]) {
                    return item[2].trim();
                }
            }
        }
        return '';
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

                // Progressive IPA: Nếu bật ký âm và là từ đơn tiếng Anh chưa có phiên âm từ Google,
                // tải ngầm bổ sung mà tuyệt đối KHÔNG chặn hiển thị popup
                const numWords = countWords(currentSelectedText);
                const shouldGetIpa = getConfig('enableIpa') && numWords <= parseInt(getConfig('ipaWordLimit'), 10);
                if (shouldGetIpa && numWords === 1 && /^[a-zA-Z'-]+$/.test(currentSelectedText)) {
                    const srcIpaEl = popupEl ? popupEl.querySelector('#gtt-src-ipa') : null;
                    if (srcIpaEl && !srcIpaEl.textContent.trim()) {
                        fetchEnglishIpa(currentSelectedText).then(ipa => {
                            if (ipa && popupEl) {
                                const el = popupEl.querySelector('#gtt-src-ipa');
                                if (el) {
                                    el.textContent = `/${ipa}/`;
                                    el.style.display = 'block';
                                }
                            }
                        });
                    }
                }
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
                    <button class="gtt-btn-icon" id="gtt-btn-settings" title="Cài đặt">⚙️</button>
                    <button class="gtt-btn-icon" id="gtt-btn-close" title="Đóng">✕</button>
                </div>
            </div>
            <div id="gtt-body" style="text-align:center;padding:12px 0;">
                <div class="gtt-spinner"></div>
            </div>
        `;

        document.body.appendChild(popupEl);

        document.getElementById('gtt-btn-close').addEventListener('click', removePopup);
        document.getElementById('gtt-btn-settings').addEventListener('click', toggleSettings);

        enableDrag(popupEl, document.getElementById('gtt-drag-handle'));
    }

    function renderTranslationResults(results) {
        if (!popupEl) return;
        const bodyEl = popupEl.querySelector('#gtt-body');
        if (!bodyEl) return;

        bodyEl.style.textAlign = 'left';
        bodyEl.style.padding = '0';

        const mainData = results[0];
        let detectedLang = mainData[2] || getConfig('from');
        let fullTranslatedText = '';

        if (mainData[0] && Array.isArray(mainData[0])) {
            fullTranslatedText = mainData[0].map(item => item[0]).filter(Boolean).join('');
        }

        const numWords = countWords(currentSelectedText);
        const allowIpa = getConfig('enableIpa') && numWords <= parseInt(getConfig('ipaWordLimit'), 10);

        // Tìm phiên âm gốc và phiên âm bản dịch từ Google (dt=rm)
        let srcPronounce = extractPhonetics(mainData, true);
        let tgtPronounce = extractPhonetics(mainData, false);

        let html = '';

        // 1. DÒNG VĂN BẢN GỐC (có nút phát âm và phiên âm gốc)
        html += `
            <div class="gtt-source-row">
                <span class="gtt-lang-tag">${escapeHtml(detectedLang)}</span>
                <span class="gtt-orig-text">${escapeHtml(currentSelectedText)}</span>
                ${getConfig('tts') ? `<button class="gtt-tts-btn" data-tts-text="${escapeHtml(currentSelectedText)}" data-tts-lang="${escapeHtml(detectedLang)}" title="Phát âm câu gốc (${escapeHtml(detectedLang)})">${SPEAKER_ICON_SVG}</button>` : ''}
                <span class="gtt-ipa-subline" id="gtt-src-ipa" style="${allowIpa && srcPronounce ? 'display:block;' : 'display:none;'}">${srcPronounce ? `/${escapeHtml(srcPronounce)}/` : ''}</span>
            </div>
        `;

        // 2. BẢN DỊCH CHÍNH (có nút phát âm và phiên âm bản dịch)
        html += `
            <div class="gtt-translation-row">
                <span class="gtt-lang-tag">${escapeHtml(getConfig('to'))}</span>
                <span class="gtt-trans-text">${escapeHtml(fullTranslatedText)}</span>
                ${getConfig('tts') ? `<button class="gtt-tts-btn" data-tts-text="${escapeHtml(fullTranslatedText)}" data-tts-lang="${escapeHtml(getConfig('to'))}" title="Phát âm bản dịch (${escapeHtml(getConfig('to'))})">${SPEAKER_ICON_SVG}</button>` : ''}
                ${allowIpa && tgtPronounce ? `<span class="gtt-ipa-subline">${escapeHtml(tgtPronounce)}</span>` : ''}
            </div>
        `;

        // 3. NGÔN NGỮ DỊCH PHỤ 1 (nếu bật)
        if (results[1]) {
            const data2 = results[1];
            const text2 = data2[0] ? data2[0].map(item => item[0]).filter(Boolean).join('') : '';
            const pron2 = extractPhonetics(data2, false);
            html += `
                <div class="gtt-translation-row" style="opacity:0.95;">
                    <span class="gtt-lang-tag">${escapeHtml(getConfig('to2'))}</span>
                    <span class="gtt-trans-text">${escapeHtml(text2)}</span>
                    ${getConfig('tts') ? `<button class="gtt-tts-btn" data-tts-text="${escapeHtml(text2)}" data-tts-lang="${escapeHtml(getConfig('to2'))}" title="Phát âm bản dịch (${escapeHtml(getConfig('to2'))})">${SPEAKER_ICON_SVG}</button>` : ''}
                    ${allowIpa && pron2 ? `<span class="gtt-ipa-subline">${escapeHtml(pron2)}</span>` : ''}
                </div>
            `;
        }

        // 4. NGÔN NGỮ DỊCH PHỤ 2 (nếu bật)
        if (results[2]) {
            const data3 = results[2];
            const text3 = data3[0] ? data3[0].map(item => item[0]).filter(Boolean).join('') : '';
            const pron3 = extractPhonetics(data3, false);
            html += `
                <div class="gtt-translation-row" style="opacity:0.95;">
                    <span class="gtt-lang-tag">${escapeHtml(getConfig('to3'))}</span>
                    <span class="gtt-trans-text">${escapeHtml(text3)}</span>
                    ${getConfig('tts') ? `<button class="gtt-tts-btn" data-tts-text="${escapeHtml(text3)}" data-tts-lang="${escapeHtml(getConfig('to3'))}" title="Phát âm bản dịch (${escapeHtml(getConfig('to3'))})">${SPEAKER_ICON_SVG}</button>` : ''}
                    ${allowIpa && pron3 ? `<span class="gtt-ipa-subline">${escapeHtml(pron3)}</span>` : ''}
                </div>
            `;
        }

        // 5. XÂY DỰNG NỘI DUNG CHI TIẾT (Details): Từ loại, Bản dịch thay thế, Định nghĩa & Từ đồng nghĩa
        let detailsHtml = '';
        const hasGrammar = Array.isArray(mainData[1]) && mainData[1].length > 0;
        const hasAlternatives = getConfig('showAlternatives') && Array.isArray(mainData[5]) && mainData[5].length > 0;
        const hasDefinitions = Array.isArray(mainData[12]) && mainData[12].length > 0;

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

        // Gắn sự kiện phát âm cho TẤT CẢ các nút TTS (từ gốc & các bản dịch)
        bodyEl.querySelectorAll('.gtt-tts-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const text = btn.getAttribute('data-tts-text');
                const lang = btn.getAttribute('data-tts-lang');
                playTTS(text, lang);
            });
        });

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
                <div class="gtt-field-row">
                    <label><input type="checkbox" id="gtt-set-ctrl" ${getConfig('requireCtrl') ? 'checked' : ''}/> Giữ Ctrl khi bôi đen</label>
                    <label><input type="checkbox" id="gtt-set-alt" ${getConfig('requireAlt') ? 'checked' : ''}/> Giữ Alt khi bôi đen</label>
                </div>

                <div class="gtt-settings-footer">
                    <button class="gtt-btn-secondary" id="gtt-btn-cancel">Hủy</button>
                    <button class="gtt-btn-primary" id="gtt-btn-save">Lưu</button>
                </div>
            </div>
        `;

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
            setConfig('requireCtrl', document.getElementById('gtt-set-ctrl').checked);
            setConfig('requireAlt', document.getElementById('gtt-set-alt').checked);

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

})();
