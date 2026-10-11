// ==UserScript==
// @name         Google Translate Tooltip
// @namespace    CustomScripts
// @version      1.0.0
// @description  Display instant Google translation and text-to-speech tooltip when selecting text
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
// @license      MIT
// @downloadURL  https://raw.githubusercontent.com/Narga/userscripts/refs/heads/main/google-translate-tooltip/google-translate-tooltip.user.js
// @updateURL    https://raw.githubusercontent.com/Narga/userscripts/refs/heads/main/google-translate-tooltip/google-translate-tooltip.user.js
// ==/UserScript==

(function () {
    'use strict';

    // ============================================================
    // CONFIGURATION & PERSISTENCE
    // ============================================================
    const DEFAULT_CONFIG = {
        from: 'auto',
        to: 'vi',
        to2: 'Disabled',
        to3: 'Disabled',
        tts: true,
        details: true,
        alternatives: true,
        synonyms: true,
        fontSize: '14px',
        theme: 'light', // light or dark
        requireCtrl: false,
        requireAlt: false,
        delay: 0 // ms delay before translating on icon hover
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
    // STYLES (Scoped injected CSS)
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
            min-width: 280px;
            max-width: 440px;
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
        .gtt-tts-btn {
            background: none;
            border: none;
            cursor: pointer;
            padding: 0 4px;
            vertical-align: middle;
            color: #5f6368;
            display: inline-flex;
            align-items: center;
        }
        .gtt-tts-btn:hover {
            color: #1a73e8;
        }

        .gtt-details-section {
            margin-top: 8px;
            padding-top: 6px;
            border-top: 1px dashed var(--gtt-border, #dadce0);
            font-size: 13px;
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
            margin-left: 12px;
            color: var(--gtt-fg, #202124);
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
        .gtt-field-row select, .gtt-field-row input[type="text"] {
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

    // Google Translate Logo SVG
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

    // ============================================================
    // SELECTION HANDLING
    // ============================================================
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
        // Ignore clicks inside our popup or button
        if (popupEl && popupEl.contains(e.target)) return;
        if (iconBtn && iconBtn.contains(e.target)) return;

        // Key modifier checks
        if (getConfig('requireCtrl') && !e.ctrlKey) return;
        if (getConfig('requireAlt') && !e.altKey) return;

        setTimeout(() => {
            const text = getSelectedText();
            if (!text || text.length === 0) {
                removeIcon();
                return;
            }

            // URL check - do not translate pure URLs
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
        iconBtn.title = 'Click or hover to translate';
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
    // TRANSLATION API (client=gtx)
    // ============================================================
    function fetchTranslation(text, sl, tl) {
        return new Promise((resolve, reject) => {
            const encodedText = encodeURIComponent(text);
            const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sl}&tl=${tl}&dt=t&dt=bd&dt=rm&dt=at&q=${encodedText}`;

            GM_xmlhttpRequest({
                method: 'GET',
                url: url,
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
                onerror: (err) => reject(err)
            });
        });
    }

    // ============================================================
    // TEXT TO SPEECH (Web Speech API or Google TTS)
    // ============================================================
    function playTTS(text, lang) {
        if (!text) return;

        // Native SpeechSynthesis if available
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = lang === 'auto' ? 'en-US' : lang;
            window.speechSynthesis.speak(utterance);
            return;
        }

        // Fallback to HTMLAudioElement
        const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=${lang}&client=gtx&q=${encodeURIComponent(text)}`;
        const audio = new Audio(ttsUrl);
        audio.play().catch(e => console.warn('[GTT] Audio playback failed:', e));
    }

    // ============================================================
    // POPUP RENDERING
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

        Promise.all(promises)
            .then(results => {
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

        // Keep within viewport boundary
        const adjustedX = Math.min(posX, window.innerWidth + window.scrollX - 460);
        popupEl.style.left = `${Math.max(10, adjustedX)}px`;
        popupEl.style.top = `${posY}px`;

        popupEl.innerHTML = `
            <div class="gtt-header" id="gtt-drag-handle">
                <div class="gtt-header-title">
                    <span style="display:flex;align-items:center;width:14px;height:14px;">${GOOGLE_ICON_SVG}</span>
                    <span>Google Translate</span>
                </div>
                <div class="gtt-header-actions">
                    <button class="gtt-btn-icon" id="gtt-btn-settings" title="Settings">⚙️</button>
                    <button class="gtt-btn-icon" id="gtt-btn-close" title="Close">✕</button>
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

        let html = `
            <div class="gtt-translation-row">
                <span class="gtt-lang-tag">${detectedLang} → ${getConfig('to')}</span>
                <span class="gtt-trans-text">${escapeHtml(fullTranslatedText)}</span>
                ${getConfig('tts') ? `<button class="gtt-tts-btn" id="gtt-tts-target" title="Phát âm">${SPEAKER_ICON_SVG}</button>` : ''}
            </div>
        `;

        // Secondary language 1
        if (results[1]) {
            const data2 = results[1];
            const text2 = data2[0] ? data2[0].map(item => item[0]).filter(Boolean).join('') : '';
            html += `
                <div class="gtt-translation-row" style="opacity:0.9;">
                    <span class="gtt-lang-tag">${getConfig('to2')}</span>
                    <span class="gtt-trans-text">${escapeHtml(text2)}</span>
                </div>
            `;
        }

        // Secondary language 2
        if (results[2]) {
            const data3 = results[2];
            const text3 = data3[0] ? data3[0].map(item => item[0]).filter(Boolean).join('') : '';
            html += `
                <div class="gtt-translation-row" style="opacity:0.9;">
                    <span class="gtt-lang-tag">${getConfig('to3')}</span>
                    <span class="gtt-trans-text">${escapeHtml(text3)}</span>
                </div>
            `;
        }

        // Detailed dictionary definitions if available
        if (getConfig('details') && mainData[1] && Array.isArray(mainData[1])) {
            html += `<div class="gtt-details-section">`;
            mainData[1].forEach(group => {
                const pos = group[0]; // noun, verb, adjective
                const terms = group[1]; // array of words
                if (terms && terms.length > 0) {
                    html += `
                        <div class="gtt-dict-group">
                            <div class="gtt-dict-pos">${escapeHtml(pos)}</div>
                            <div class="gtt-dict-terms">${escapeHtml(terms.slice(0, 5).join(', '))}</div>
                        </div>
                    `;
                }
            });
            html += `</div>`;
        }

        bodyEl.innerHTML = html;

        // TTS Listener
        const ttsBtn = bodyEl.querySelector('#gtt-tts-target');
        if (ttsBtn) {
            ttsBtn.addEventListener('click', () => {
                playTTS(fullTranslatedText, getConfig('to'));
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
    // SETTINGS PANEL
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
                <div class="gtt-field-row">
                    <label><input type="checkbox" id="gtt-set-tts" ${getConfig('tts') ? 'checked' : ''}/> Nút phát âm (TTS)</label>
                    <label><input type="checkbox" id="gtt-set-details" ${getConfig('details') ? 'checked' : ''}/> Xem từ điển</label>
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
            setConfig('tts', document.getElementById('gtt-set-tts').checked);
            setConfig('details', document.getElementById('gtt-set-details').checked);
            setConfig('requireCtrl', document.getElementById('gtt-set-ctrl').checked);
            setConfig('requireAlt', document.getElementById('gtt-set-alt').checked);

            isShowingSettings = false;
            startLookup(parseInt(popupEl.style.left, 10), parseInt(popupEl.style.top, 10));
        });
    }

    // ============================================================
    // DRAG AND DROP
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
    // INIT
    // ============================================================
    document.addEventListener('mouseup', onMouseUp, false);
    document.addEventListener('mousedown', onMouseDown, false);

})();
