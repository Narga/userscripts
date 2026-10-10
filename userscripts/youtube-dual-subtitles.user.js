// ==UserScript==
// @name         YouTube Dual Subtitles Pro
// @namespace    https://www.narga.net/
// @version      1.2.4
// @description  Hiển thị phụ đề song ngữ (Dual Subtitles) chuẩn xác trên YouTube với DeepL API (VI, EN, DE, SK, CS - Tùy chỉnh vị trí, font, màu sắc & Chống 429)
// @author       narga
// @homepageURL  https://www.narga.net/
// @supportURL   https://www.narga.net/
// @match        *://*.youtube.com/*
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        unsafeWindow
// @connect      api-free.deepl.com
// @connect      api.deepl.com
// @connect      www.youtube.com
// @connect      youtube.com
// @run-at       document-start
// ==/UserScript==

(function () {
  'use strict';

  console.log('[YT-DualSub] Khởi động YouTube Dual Subtitles Pro v1.2.4 (DeepL Engine)...');

  // =========================================================================
  // 1. CẤU HÌNH HỆ THỐNG (PIPELINE CONFIGURATION)
  // =========================================================================
  const CONFIG = {
    maxCueDurationMs: 7000,
    mergeGapMs: 650,
    minOverlapGapMs: -200,
    maxMergedChars: 120,
    defaultCueDurationMs: 2500,

    batchSize: 8,
    requestTimeoutMs: 7000,
    maxRetries: 2,
    minRequestIntervalMs: 250,

    prefetchLeadSeconds: 12,
    maxCacheEntries: 500,
    overlayThrottleMs: 80,

    // 5 ngôn ngữ đích cốt lõi
    supportedLanguages: [
      { code: 'vi', name: 'Tiếng Việt', deeplCode: 'VI' },
      { code: 'en', name: 'English', deeplCode: 'EN-US' },
      { code: 'de', name: 'Deutsch', deeplCode: 'DE' },
      { code: 'sk', name: 'Slovenčina', deeplCode: 'SK' },
      { code: 'cs', name: 'Čeština', deeplCode: 'CS' }
    ],

    // 5 bảng màu phụ đề dịch
    colorPalette: [
      { code: '#fef08a', name: 'Vàng nhạt (Mặc định)' },
      { code: '#ffffff', name: 'Trắng sáng' },
      { code: '#86efac', name: 'Xanh lục nhạt' },
      { code: '#93c5fd', name: 'Xanh lơ nhạt' },
      { code: '#fed7aa', name: 'Cam nhạt' }
    ]
  };

  const pageWindow = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;

  // Tiện ích quản lý DeepL API Key (dual-store: GM + localStorage để luôn persist)
  function getDeepLApiKey() {
    try {
      const v = (GM_getValue('yt_dualsub_deepl_key', '') || '').trim();
      if (v) return v;
    } catch (e) {}
    try {
      return (localStorage.getItem('yt_dualsub_deepl_key') || '').trim();
    } catch (e) {
      return '';
    }
  }

  function setDeepLApiKey(key) {
    const v = (key || '').trim();
    try {
      GM_setValue('yt_dualsub_deepl_key', v);
    } catch (e) {}
    // ponytail: mirror sang localStorage để key存 trong localdb, đọc được khi GM bị chặn
    try {
      if (v) localStorage.setItem('yt_dualsub_deepl_key', v);
      else localStorage.removeItem('yt_dualsub_deepl_key');
    } catch (e) {}
  }

  function isValidCssColor(s) {
    if (!s || typeof s !== 'string') return false;
    const o = new Option().style;
    o.color = '';
    o.color = s.trim();
    return !!o.color;
  }

  function getInitialTargetLang() {
    const validCodes = CONFIG.supportedLanguages.map(l => l.code);
    const saved = GM_getValue('yt_dualsub_target_lang', 'vi');
    return validCodes.includes(saved) ? saved : 'vi';
  }

  // Trạng thái lưu trữ ứng dụng
  const STATE = {
    enabled: GM_getValue('yt_dualsub_enabled', true),
    targetLang: getInitialTargetLang(),
    showOriginal: GM_getValue('yt_dualsub_show_original', true),
    originalPosition: GM_getValue('yt_dualsub_orig_pos', 'bottom'), // 'bottom' (Stacked) | 'top' (Đỉnh video)
    fontSize: GM_getValue('yt_dualsub_font_size', 28), // mặc định 28px, chỉnh qua input
    transColor: GM_getValue('yt_dualsub_trans_color', '#fef08a'),
    deeplApiType: GM_getValue('yt_dualsub_deepl_type', 'auto'), // 'auto' | 'free' | 'pro'
    currentVideoId: '',
    sourceLang: '',
    cues: [],
    translatedMap: new Map(),
    lastHandledSignature: '',
    sessionId: 0
  };

  // Quản lý chống spam request và khóa Rate-limit
  const ANTI_SPAM = {
    isPrefetching: false,
    inFlightKeys: new Set(),
    rateLimitCooldownUntil: 0,
    consecutive429Count: 0,
    lastPrefetchedIndex: -1
  };

  // Nhận diện giao diện YouTube Sáng (Light) / Tối (Dark)
  function isDarkTheme() {
    return document.documentElement.hasAttribute('dark') ||
           document.querySelector('html[dark]') !== null ||
           document.querySelector('ytd-app[dark]') !== null ||
           (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  }

  // Giới hạn bộ nhớ đệm bản dịch theo LRU/FIFO (CONFIG.maxCacheEntries: 500)
  function setCacheEntry(key, text) {
    if (STATE.translatedMap.size >= CONFIG.maxCacheEntries) {
      const oldestKey = STATE.translatedMap.keys().next().value;
      if (oldestKey) STATE.translatedMap.delete(oldestKey);
    }
    STATE.translatedMap.set(key, text);
  }

  // Tự động nhận diện hoặc xác định endpoint DeepL API
  function getDeepLEndpoint(apiKey) {
    const type = STATE.deeplApiType || 'auto';
    if (type === 'free') return 'https://api-free.deepl.com/v2/translate';
    if (type === 'pro') return 'https://api.deepl.com/v2/translate';
    return (apiKey && apiKey.endsWith(':fx'))
      ? 'https://api-free.deepl.com/v2/translate'
      : 'https://api.deepl.com/v2/translate';
  }

  // =========================================================================
  // 2. TIỆN ÍCH CHUNG (UTILS)
  // =========================================================================
  function decodeHTMLEntities(str) {
    if (!str) return '';
    return str
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, ' ');
  }

  function abortableDelay(ms, signal) {
    return new Promise((resolve, reject) => {
      if (signal && signal.aborted) {
        return reject(new DOMException('Aborted', 'AbortError'));
      }
      const timer = setTimeout(resolve, ms);
      if (signal) {
        signal.addEventListener('abort', () => {
          clearTimeout(timer);
          reject(new DOMException('Aborted', 'AbortError'));
        }, { once: true });
      }
    });
  }

  function getQueryParam(url, param) {
    try {
      const u = new URL(url, location.origin);
      return u.searchParams.get(param);
    } catch (e) {
      return null;
    }
  }

  function getVideoId() {
    return getQueryParam(location.href, 'v') || '';
  }

  function getMainPlayerElement() {
    return document.querySelector('#movie_player:not(.ytp-miniplayer)') ||
           document.querySelector('.html5-video-player:not(.ytp-miniplayer)') ||
           document.querySelector('#movie_player') ||
           document.querySelector('.html5-video-player');
  }

  // =========================================================================
  // 3. NETWORK INTERCEPTOR (TRỰC TIẾP QUA unsafeWindow - KHÔNG DÙNG <script>)
  // =========================================================================
  function setupNetworkInterceptor() {
    try {
      const origFetch = pageWindow.fetch;
      if (typeof origFetch === 'function') {
        pageWindow.fetch = async function (...args) {
          const res = await origFetch.apply(this, args);
          try {
            const url = typeof args[0] === 'string' ? args[0] : (args[0] && args[0].url);
            if (url && typeof url === 'string' && url.includes('/api/timedtext')) {
              res.clone().text().then((text) => {
                if (text && text.length > 0) {
                  handleRawTimedTextContent(text, url);
                }
              }).catch(() => {});
            }
          } catch (e) {}
          return res;
        };
        console.log('[YT-DualSub] Đã hook pageWindow.fetch thành công.');
      }
    } catch (e) {
      console.warn('[YT-DualSub] Không thể hook fetch:', e);
    }

    try {
      const origOpen = pageWindow.XMLHttpRequest && pageWindow.XMLHttpRequest.prototype && pageWindow.XMLHttpRequest.prototype.open;
      const origSend = pageWindow.XMLHttpRequest && pageWindow.XMLHttpRequest.prototype && pageWindow.XMLHttpRequest.prototype.send;
      if (origOpen && origSend) {
        pageWindow.XMLHttpRequest.prototype.open = function (method, url, ...rest) {
          this.__yt_dualsub_url__ = url;
          return origOpen.call(this, method, url, ...rest);
        };
        pageWindow.XMLHttpRequest.prototype.send = function (...args) {
          this.addEventListener('load', function () {
            try {
              const url = this.__yt_dualsub_url__;
              if (url && typeof url === 'string' && url.includes('/api/timedtext')) {
                if (this.responseText) {
                  handleRawTimedTextContent(this.responseText, url);
                }
              }
            } catch (e) {}
          });
          return origSend.apply(this, args);
        };
        console.log('[YT-DualSub] Đã hook pageWindow.XMLHttpRequest thành công.');
      }
    } catch (e) {
      console.warn('[YT-DualSub] Không thể hook XHR:', e);
    }
  }

  setupNetworkInterceptor();

  // =========================================================================
  // 4. PARSER PHỤ ĐỀ (JSON3 & XML VỚI BẢO VỆ PARSERERROR)
  // =========================================================================
  function parseTimedText(content) {
    if (!content || typeof content !== 'string') return [];
    const trimmed = content.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        return parseJSON3(JSON.parse(trimmed));
      } catch (e) {
        console.warn('[YT-DualSub] Lỗi parse JSON3, chuyển sang XML:', e);
      }
    }
    return parseXMLTimedText(trimmed);
  }

  function parseJSON3(data) {
    const cues = [];
    if (!data || !Array.isArray(data.events)) return cues;

    for (const evt of data.events) {
      if (!evt || evt.tStartMs === undefined) continue;
      const tStartMs = Math.round(evt.tStartMs);
      const dDurationMs = evt.dDurationMs ? Math.round(evt.dDurationMs) : 0;

      let fullText = '';
      const segs = [];

      if (Array.isArray(evt.segs)) {
        for (const seg of evt.segs) {
          if (!seg || !seg.utf8) continue;
          const cleanUtf8 = decodeHTMLEntities(seg.utf8);
          fullText += cleanUtf8;
          segs.push({
            utf8: cleanUtf8,
            tOffsetMs: seg.tOffsetMs !== undefined ? Math.round(seg.tOffsetMs) : 0
          });
        }
      }

      fullText = fullText.trim();
      if (!fullText) continue;

      cues.push({
        tStartMs,
        dDurationMs,
        text: fullText,
        segs: segs.length > 0 ? segs : [{ utf8: fullText, tOffsetMs: 0 }]
      });
    }

    return cues;
  }

  function parseXMLTimedText(xmlStr) {
    const cues = [];
    try {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlStr, 'text/xml');
      if (xmlDoc.querySelector('parsererror')) {
        console.warn('[YT-DualSub] Lỗi cú pháp XML parsererror');
        return [];
      }

      const textNodes = xmlDoc.getElementsByTagName('text');
      for (let i = 0; i < textNodes.length; i++) {
        const node = textNodes[i];
        const rawText = decodeHTMLEntities(node.textContent || '').trim();
        if (!rawText) continue;

        const startSec = parseFloat(node.getAttribute('start') || '0');
        const durAttr = node.getAttribute('dur');
        const durSec = durAttr ? parseFloat(durAttr) : undefined;

        const tStartMs = Math.round(startSec * 1000);
        const dDurationMs = durSec !== undefined ? Math.round(durSec * 1000) : 0;

        cues.push({
          tStartMs,
          dDurationMs,
          text: rawText,
          segs: [{ utf8: rawText, tOffsetMs: 0 }]
        });
      }
    } catch (e) {
      console.warn('[YT-DualSub] Ngoại lệ khi parse XML:', e);
    }
    return cues;
  }

  // =========================================================================
  // 5. CHUẨN HÓA THỜI LƯỢNG & GỘP CÂU (SEMANTIC CHUNKING)
  // =========================================================================
  function computeEffectiveDuration(curCue, nextCue) {
    if (curCue.dDurationMs && curCue.dDurationMs > 0) {
      return Math.min(curCue.dDurationMs, CONFIG.maxCueDurationMs);
    }
    if (nextCue && nextCue.tStartMs > curCue.tStartMs) {
      const gapToNext = nextCue.tStartMs - curCue.tStartMs;
      return Math.min(gapToNext, CONFIG.maxCueDurationMs);
    }
    return CONFIG.defaultCueDurationMs;
  }

  function semanticChunkCues(rawCues) {
    if (!rawCues || rawCues.length === 0) return [];

    rawCues.sort((a, b) => a.tStartMs - b.tStartMs);

    const merged = [];
    let current = null;

    for (let i = 0; i < rawCues.length; i++) {
      const cue = rawCues[i];
      const nextCue = rawCues[i + 1];
      const effDur = computeEffectiveDuration(cue, nextCue);
      const cueWithDur = {
        tStartMs: cue.tStartMs,
        dDurationMs: effDur,
        text: cue.text,
        segs: [...cue.segs]
      };

      if (!current) {
        current = cueWithDur;
        continue;
      }

      const gap = cue.tStartMs - (current.tStartMs + current.dDurationMs);
      const endCurrent = current.tStartMs + current.dDurationMs;
      const endCue = cue.tStartMs + effDur;
      const mergedEndMs = Math.max(endCurrent, endCue);
      const potentialDuration = mergedEndMs - current.tStartMs;
      const mergedText = `${current.text} ${cue.text}`;

      const isOverlapAllowed = gap >= CONFIG.minOverlapGapMs && gap <= CONFIG.mergeGapMs;
      const isDurationAllowed = potentialDuration <= CONFIG.maxCueDurationMs;
      const isCharCountAllowed = mergedText.length <= CONFIG.maxMergedChars;
      const isNotPunctuationEnd = !/[.?!。？！]$/.test(current.text);

      if (isOverlapAllowed && isDurationAllowed && isCharCountAllowed && isNotPunctuationEnd) {
        const mergedStart = current.tStartMs;
        for (const seg of cue.segs) {
          const rebasedOffset = cue.tStartMs + (seg.tOffsetMs || 0) - mergedStart;
          current.segs.push({
            utf8: seg.utf8,
            tOffsetMs: Math.max(0, rebasedOffset)
          });
        }
        current.dDurationMs = potentialDuration;
        current.text = mergedText;
      } else {
        merged.push(current);
        current = cueWithDur;
      }
    }

    if (current) merged.push(current);
    return merged;
  }

  // =========================================================================
  // 6. DỊCH THUẬT DEEPL API (ARRAY BATCH, CHỐNG 429 & SEQUENTIAL LOCK)
  // =========================================================================
  class TranslationService {
    constructor() {
      this.abortController = new AbortController();
      this.currentSessionId = 0;
      this.throttleChain = Promise.resolve();
    }

    resetSession() {
      this.currentSessionId++;
      this.abortController.abort();
      this.abortController = new AbortController();
      this.throttleChain = Promise.resolve();
      ANTI_SPAM.isPrefetching = false;
      ANTI_SPAM.inFlightKeys.clear();
      ANTI_SPAM.lastPrefetchedIndex = -1;
      return this.currentSessionId;
    }

    getSessionId() {
      return this.currentSessionId;
    }

    acquireThrottleLock(signal) {
      const previous = this.throttleChain;
      let release;
      this.throttleChain = new Promise((resolve) => { release = resolve; });

      return previous
        .then(() => abortableDelay(CONFIG.minRequestIntervalMs, signal))
        .finally(() => { if (release) release(); });
    }

    async translateBatch(texts, targetLangCode, expectedSessionId) {
      if (expectedSessionId !== this.currentSessionId || !Array.isArray(texts) || texts.length === 0) {
        return { ok: false, translations: [] };
      }

      const apiKey = getDeepLApiKey();
      if (!apiKey) {
        return { ok: false, translations: [] };
      }

      // Kiểm tra Cooldown khi bị 429
      if (Date.now() < ANTI_SPAM.rateLimitCooldownUntil) {
        console.warn('[YT-DualSub] Đang trong thời gian Cooldown 429, tạm dừng gọi DeepL API.');
        return { ok: false, translations: [] };
      }

      const langObj = CONFIG.supportedLanguages.find(l => l.code === targetLangCode);
      const targetLang = langObj ? langObj.deeplCode : 'VI';
      const endpoint = getDeepLEndpoint(apiKey);

      const requestBody = JSON.stringify({
        text: texts,
        target_lang: targetLang
      });

      for (let attempt = 0; attempt <= CONFIG.maxRetries; attempt++) {
        try {
          await this.acquireThrottleLock(this.abortController.signal);

          const res = await new Promise((resolve, reject) => {
            if (this.abortController.signal.aborted) {
              return reject(new DOMException('Aborted', 'AbortError'));
            }

            const req = GM_xmlhttpRequest({
              method: 'POST',
              url: endpoint,
              data: requestBody,
              headers: {
                'Authorization': `DeepL-Auth-Key ${apiKey}`,
                'Content-Type': 'application/json'
              },
              timeout: CONFIG.requestTimeoutMs,
              onload: (r) => resolve(r),
              onerror: (err) => reject(err),
              ontimeout: () => reject(new Error('DeepL Request Timeout'))
            });

            this.abortController.signal.addEventListener('abort', () => {
              try { req.abort(); } catch (e) {}
              reject(new DOMException('Aborted', 'AbortError'));
            }, { once: true });
          });

          if (res.status === 403) {
            console.error('[YT-DualSub] DeepL HTTP 403: API Key không hợp lệ hoặc bị vô hiệu hóa.');
            return { ok: false, translations: [] };
          }

          if (res.status === 456) {
            console.error('[YT-DualSub] DeepL HTTP 456: Đã dùng hết hạn mức ký tự miễn phí của tháng (Quota exceeded).');
            return { ok: false, translations: [] };
          }

          if (res.status === 400 || res.status === 404) {
            console.warn(`[YT-DualSub] Lỗi DeepL HTTP ${res.status}, bỏ qua retry:`, res.responseText);
            return { ok: false, translations: [] };
          }

          if (res.status === 429) {
            ANTI_SPAM.consecutive429Count++;
            let retryAfterSec = 0;
            if (res.responseHeaders) {
              const match = res.responseHeaders.match(/retry-after:\s*(\d+)/i);
              if (match && match[1]) {
                retryAfterSec = parseInt(match[1], 10);
              }
            }
            const cooldownSec = retryAfterSec > 0
              ? retryAfterSec
              : (ANTI_SPAM.consecutive429Count > 1 ? 60 : 30);
            ANTI_SPAM.rateLimitCooldownUntil = Date.now() + (cooldownSec * 1000);
            console.warn(`[YT-DualSub] DeepL HTTP 429 (Too Many Requests)! Cooldown trong ${cooldownSec} giây (Lần ${ANTI_SPAM.consecutive429Count}).`);
            return { ok: false, translations: [] };
          }

          if (res.status < 200 || res.status >= 300) {
            throw new Error(`HTTP Error ${res.status}`);
          }

          if (expectedSessionId !== this.currentSessionId) {
            return { ok: false, translations: [] };
          }

          const data = JSON.parse(res.responseText);
          if (data && Array.isArray(data.translations)) {
            const results = data.translations.map(t => (t && t.text ? t.text.trim() : ''));
            if (results.length === texts.length) {
              // CHỈ reset bộ đếm 429 khi parse thành công và số lượng câu khớp tuyệt đối!
              ANTI_SPAM.consecutive429Count = 0;
              return { ok: true, translations: results };
            }
          }

          console.warn('[YT-DualSub] DeepL trả về kết quả nhưng số câu không khớp:', data);
          return { ok: false, translations: [] };

        } catch (err) {
          if (err.name === 'AbortError' || expectedSessionId !== this.currentSessionId) {
            return { ok: false, translations: [] };
          }
          if (attempt === CONFIG.maxRetries) {
            console.warn('[YT-DualSub] Vượt quá số lần thử DeepL:', err);
            return { ok: false, translations: [] };
          }
          await abortableDelay(1000 * Math.pow(2, attempt), this.abortController.signal);
        }
      }

      return { ok: false, translations: [] };
    }
  }

  const translator = new TranslationService();

  function makeCacheKey(videoId, sourceLang, targetLang, cue) {
    const safeText = cue.text.slice(0, 32).replace(/[\s:]+/g, '_');
    return `${videoId}:${sourceLang}:${targetLang}:${cue.tStartMs}:${safeText}`;
  }

  // ponytail: xuất SRT song ngữ từ dữ liệu sẵn có (cues + translatedMap), không thêm dependency
  function toSrtTime(ms) {
    const t = Math.max(0, Math.round(ms));
    const h = String(Math.floor(t / 3600000)).padStart(2, '0');
    const m = String(Math.floor((t % 3600000) / 60000)).padStart(2, '0');
    const s = String(Math.floor((t % 60000) / 1000)).padStart(2, '0');
    const z = String(t % 1000).padStart(3, '0');
    return `${h}:${m}:${s},${z}`;
  }

  function downloadBilingualSrt() {
    if (!STATE.cues.length) return false;
    let out = '';
    for (let i = 0; i < STATE.cues.length; i++) {
      const cue = STATE.cues[i];
      const key = makeCacheKey(STATE.currentVideoId, STATE.sourceLang, STATE.targetLang, cue);
      const trans = STATE.translatedMap.get(key);
      out += `${i + 1}\n${toSrtTime(cue.tStartMs)} --> ${toSrtTime(cue.tStartMs + cue.dDurationMs)}\n${cue.text}\n`;
      if (trans) out += `${trans}\n`;
      out += '\n';
    }
    const blob = new Blob(['\ufeff' + out], { type: 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    const base = (document.title || STATE.currentVideoId || 'subtitles').replace(/[\\/:*?"<>|]+/g, '_').slice(0, 80);
    a.download = `${base}.${STATE.targetLang}.srt`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    return true;
  }

  // =========================================================================
  // 7. TIẾP NHẬN PHỤ ĐỀ & PREFETCH (CÓ DEDUPLICATION)
  // =========================================================================
  async function handleRawTimedTextContent(content, url) {
    const videoId = getVideoId();
    if (!videoId || !content) return;

    // Chống nhận trùng triệt để từ cả fetch, XHR lẫn fallback
    // ĐẶC BIỆT: Chỉ chặn nếu STATE.cues đã có nội dung; nếu cues đang rỗng, BẮT BUỘC phải parse!
    const signature = `${videoId}:${content.length}:${content.slice(0, 80)}`;
    if (STATE.lastHandledSignature === signature && STATE.cues.length > 0) {
      return;
    }
    STATE.lastHandledSignature = signature;

    STATE.currentVideoId = videoId;
    STATE.sourceLang = getQueryParam(url, 'lang') || 'auto';

    console.log(`[YT-DualSub] Nhận phụ đề video [${videoId}], ngôn ngữ: [${STATE.sourceLang}]`);
    const parsed = parseTimedText(content);
    if (!parsed || parsed.length === 0) return;

    STATE.cues = semanticChunkCues(parsed);
    console.log(`[YT-DualSub] Đã chuẩn hóa: ${STATE.cues.length} câu phụ đề.`);

    ANTI_SPAM.lastPrefetchedIndex = -1;

    // Nạp batch đầu tiên
    prefetchTranslations(0);
  }

  async function prefetchTranslations(startIndex) {
    if (!STATE.enabled || STATE.cues.length === 0 || ANTI_SPAM.isPrefetching) return;
    if (Date.now() < ANTI_SPAM.rateLimitCooldownUntil) return;

    const apiKey = getDeepLApiKey();
    if (!apiKey) return;

    const sessionId = translator.getSessionId();
    const batch = [];
    const batchIndices = [];
    const batchKeys = []; // Mảng chứa các key tĩnh đã tính trước để dọn dẹp inFlight an toàn

    const endIndex = Math.min(STATE.cues.length, startIndex + CONFIG.batchSize);
    for (let i = startIndex; i < endIndex; i++) {
      const cue = STATE.cues[i];
      const key = makeCacheKey(STATE.currentVideoId, STATE.sourceLang, STATE.targetLang, cue);
      if (!STATE.translatedMap.has(key) && !ANTI_SPAM.inFlightKeys.has(key)) {
        batch.push(cue.text);
        batchIndices.push(i);
        batchKeys.push(key);
        ANTI_SPAM.inFlightKeys.add(key);
      }
    }

    if (batch.length === 0) return;

    ANTI_SPAM.isPrefetching = true;
    try {
      const res = await translator.translateBatch(batch, STATE.targetLang, sessionId);
      // ĐẢM BẢO CHỈ LƯU VÀO CACHE KHI DỊCH THÀNH CÔNG VÀ KHỚP ĐỦ SỐ LƯỢNG!
      if (sessionId === translator.getSessionId() && res.ok && Array.isArray(res.translations) && res.translations.length === batch.length) {
        for (let j = 0; j < batchKeys.length; j++) {
          const key = batchKeys[j];
          const translatedText = res.translations[j];
          if (translatedText) {
            setCacheEntry(key, translatedText);
          }
        }

        // P1 FIX 1: CHỈ CẬP NHẬT lastPrefetchedIndex KHI DỊCH THÀNH CÔNG!
        if (batchIndices.length > 0) {
          const highestBatchIdx = batchIndices[batchIndices.length - 1];
          if (highestBatchIdx > ANTI_SPAM.lastPrefetchedIndex) {
            ANTI_SPAM.lastPrefetchedIndex = highestBatchIdx;
          }
        }
      }
    } finally {
      // P1 FIX 2: Dọn dẹp inFlight keys AN TOÀN bằng batchKeys, không đọc lại STATE.cues!
      for (let j = 0; j < batchKeys.length; j++) {
        ANTI_SPAM.inFlightKeys.delete(batchKeys[j]);
      }
      ANTI_SPAM.isPrefetching = false;
    }
  }

  // Fallback đọc captionTracks từ player API theo đúng thứ tự ưu tiên
  function checkPlayerCaptionsFallback() {
    if (STATE.cues.length > 0) return;

    try {
      const player = document.getElementById('movie_player') || pageWindow.movie_player;
      
      let tracks = null;
      if (player && typeof player.getPlayerResponse === 'function') {
        const pr = player.getPlayerResponse();
        tracks = pr?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
      }
      if (!tracks && pageWindow.ytInitialPlayerResponse) {
        tracks = pageWindow.ytInitialPlayerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
      }
      if (!tracks && window.ytInitialPlayerResponse) {
        tracks = window.ytInitialPlayerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
      }
      if (!tracks && player && typeof player.getOption === 'function') {
        const trackList = player.getOption('captions', 'tracklist');
        if (Array.isArray(trackList) && trackList.length > 0) {
          tracks = trackList;
        }
      }

      if (!Array.isArray(tracks) || tracks.length === 0) return;

      // 1. Kiểm tra track đang active từ API của YouTube player
      let activeTrack = null;
      try {
        const trackInfo = player && typeof player.getOption === 'function' ? player.getOption('captions', 'track') : null;
        if (trackInfo && trackInfo.languageCode) {
          activeTrack = tracks.find(t => t.languageCode === trackInfo.languageCode && (!trackInfo.vssId || t.vssId === trackInfo.vssId));
        }
      } catch (e) {}

      let selectedTrack = activeTrack ||
                          tracks.find(t => t.kind !== 'asr' && !t.vssId?.includes('.translate/')) ||
                          tracks.find(t => !t.vssId?.includes('.translate/')) ||
                          tracks[0];

      if (!selectedTrack || !selectedTrack.baseUrl) return;

      const url = selectedTrack.baseUrl + (selectedTrack.baseUrl.includes('?') ? '&' : '?') + 'fmt=json3';
      console.log('[YT-DualSub] Tự động tải captionTrack:', selectedTrack.name?.simpleText || selectedTrack.languageCode);

      GM_xmlhttpRequest({
        method: 'GET',
        url,
        onload: (res) => {
          if (res.status === 200 && res.responseText) {
            handleRawTimedTextContent(res.responseText, url);
          }
        }
      });
    } catch (e) {
      console.warn('[YT-DualSub] Lỗi fallback captionTracks:', e);
    }
  }

  // =========================================================================
  // 8. RENDERER PHỤ ĐỀ (SHADOW DOM - 100% TRUSTED TYPES SAFE)
  // =========================================================================
  class OverlayRenderer {
    constructor() {
      this.activePlayerEl = null;
      this.hostEl = null;
      this.shadowRoot = null;
      this.topContainer = null;
      this.bottomContainer = null;
      this.origSubtitleEl = null;
      this.transSubtitleEl = null;
      this.adObserver = null;
      this.rafId = null;
      this.lastRenderTime = 0;
      this.lastActiveIndex = -1;
    }

    init(playerEl) {
      if (this.activePlayerEl === playerEl && this.shadowRoot) return;

      this.destroy();
      this.activePlayerEl = playerEl;

      this.hostEl = document.createElement('div');
      this.hostEl.id = 'yt-dualsub-overlay-host';
      this.hostEl.style.cssText = 'position:absolute; inset:0; pointer-events:none; z-index:40; overflow:hidden;';
      playerEl.appendChild(this.hostEl);

      this.shadowRoot = this.hostEl.attachShadow({ mode: 'open' });

      // Hai container: Top (cho câu gốc nếu muốn đưa lên đỉnh) và Bottom (đáy video)
      this.topContainer = document.createElement('div');
      this.topContainer.className = 'dualsub-top-container';
      this.topContainer.id = 'topContainer';

      this.bottomContainer = document.createElement('div');
      this.bottomContainer.className = 'dualsub-bottom-container';
      this.bottomContainer.id = 'bottomContainer';

      this.origSubtitleEl = document.createElement('div');
      this.origSubtitleEl.className = 'sub-line sub-original sub-hidden';
      this.origSubtitleEl.id = 'origText';

      this.transSubtitleEl = document.createElement('div');
      this.transSubtitleEl.className = 'sub-line sub-translated sub-hidden';
      this.transSubtitleEl.id = 'transText';

      this.applyStyles();
      this.mountSubtitleElements();

      this.shadowRoot.appendChild(this.topContainer);
      this.shadowRoot.appendChild(this.bottomContainer);

      // Theo dõi quảng cáo
      this.adObserver = new MutationObserver(() => {
        const isAd = playerEl.classList.contains('ad-showing');
        if (this.hostEl) this.hostEl.style.display = isAd ? 'none' : 'block';
      });
      this.adObserver.observe(playerEl, { attributes: true, attributeFilter: ['class'] });

      this.startLoop();
      console.log('[YT-DualSub] OverlayRenderer đã gắn vào player chính.');
    }

    applyStyles() {
      if (!this.shadowRoot) return;
      let styleEl = this.shadowRoot.querySelector('style');
      if (!styleEl) {
        styleEl = document.createElement('style');
        this.shadowRoot.appendChild(styleEl);
      }

      const baseFont = STATE.fontSize || 20;
      const origFont = baseFont;
      const transFont = Math.max(13, Math.round(baseFont * 0.82));
      const transColor = STATE.transColor || '#fef08a';

      styleEl.textContent = `
        :host {
          all: initial;
          pointer-events: none;
        }
        .dualsub-top-container {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          padding-top: 24px;
          pointer-events: none;
          z-index: 41;
        }
        .dualsub-bottom-container {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          padding-bottom: 60px;
          pointer-events: none;
          z-index: 41;
          transition: padding-bottom 0.2s ease;
        }
        .sub-line {
          line-height: 1.35;
          padding: 3px 10px;
          border-radius: 4px;
          background: rgba(0, 0, 0, 0.75);
          text-shadow: 0 0 4px #000, 0 1px 3px #000, 0 2px 4px #000;
          box-decoration-break: clone;
          -webkit-box-decoration-break: clone;
          margin: 2px 0;
          max-width: 90%;
          text-align: center;
          word-break: break-word;
          transition: all 0.15s ease-out;
        }
        .sub-original {
          color: #ffffff;
          font-size: ${origFont}px;
          font-weight: 600;
          font-family: "YouTube Noto", Roboto, "Segoe UI", Arial, sans-serif;
        }
        .sub-translated {
          color: ${transColor};
          font-size: ${transFont}px;
          font-weight: 500;
          font-family: "YouTube Noto", Roboto, "Segoe UI", Arial, sans-serif;
        }
        .sub-hidden {
          display: none !important;
        }
      `;
    }

    mountSubtitleElements() {
      if (!this.topContainer || !this.bottomContainer || !this.origSubtitleEl || !this.transSubtitleEl) return;

      this.origSubtitleEl.remove();
      this.transSubtitleEl.remove();

      if (STATE.originalPosition === 'top') {
        // Đưa câu gốc lên ĐỈNH màn hình để không làm loãng video
        this.topContainer.appendChild(this.origSubtitleEl);
        this.bottomContainer.appendChild(this.transSubtitleEl);
      } else {
        // 'bottom' (Stacked) - Xếp chồng truyền thống ở đáy video
        this.bottomContainer.appendChild(this.origSubtitleEl);
        this.bottomContainer.appendChild(this.transSubtitleEl);
      }
    }

    startLoop() {
      const render = () => {
        const now = performance.now();
        if (now - this.lastRenderTime >= CONFIG.overlayThrottleMs) {
          this.lastRenderTime = now;
          this.updateSubtitles();
        }
        this.rafId = requestAnimationFrame(render);
      };
      this.rafId = requestAnimationFrame(render);
    }

    updateSubtitles() {
      if (!STATE.enabled || STATE.cues.length === 0 || !this.origSubtitleEl || !this.transSubtitleEl) {
        if (this.origSubtitleEl) this.origSubtitleEl.textContent = '';
        if (this.transSubtitleEl) this.transSubtitleEl.textContent = '';
        return;
      }

      const video = (this.activePlayerEl && this.activePlayerEl.querySelector('video')) || document.querySelector('video');
      if (!video) return;

      const currentMs = Math.round(video.currentTime * 1000);

      let activeIndex = -1;
      for (let i = 0; i < STATE.cues.length; i++) {
        const c = STATE.cues[i];
        if (currentMs >= c.tStartMs && currentMs < (c.tStartMs + c.dDurationMs)) {
          activeIndex = i;
          break;
        }
      }

      if (activeIndex === -1) {
        this.origSubtitleEl.textContent = '';
        this.transSubtitleEl.textContent = '';
        this.origSubtitleEl.classList.add('sub-hidden');
        this.transSubtitleEl.classList.add('sub-hidden');
        return;
      }

      const activeCue = STATE.cues[activeIndex];
      const key = makeCacheKey(STATE.currentVideoId, STATE.sourceLang, STATE.targetLang, activeCue);
      const translatedText = STATE.translatedMap.get(key);

      // Cập nhật phụ đề gốc (có thể tắt nếu STATE.showOriginal === false)
      if (STATE.showOriginal) {
        this.origSubtitleEl.textContent = activeCue.text;
        this.origSubtitleEl.classList.remove('sub-hidden');
      } else {
        this.origSubtitleEl.textContent = '';
        this.origSubtitleEl.classList.add('sub-hidden');
      }

      // Cập nhật phụ đề dịch
      if (translatedText) {
        this.transSubtitleEl.textContent = translatedText;
        this.transSubtitleEl.classList.remove('sub-hidden');
      } else if (ANTI_SPAM.inFlightKeys.has(key)) {
        this.transSubtitleEl.textContent = '…';
        this.transSubtitleEl.classList.remove('sub-hidden');
      } else {
        // Chưa có bản dịch (hoặc lỗi dịch/429/chưa nhập key) -> ẩn dòng dịch, TUYỆT ĐỐI không lặp lại câu gốc!
        this.transSubtitleEl.textContent = '';
        this.transSubtitleEl.classList.add('sub-hidden');
      }

      // CHỐNG SPAM PREFETCH:
      // 1. Chỉ gọi khi activeIndex thay đổi (không chạy mỗi frame RAF)
      // 2. Nhận diện tua xa hoặc nạp đón đầu thông minh
      if (activeIndex !== this.lastActiveIndex) {
        this.lastActiveIndex = activeIndex;

        const isFarJump = (activeIndex > ANTI_SPAM.lastPrefetchedIndex + CONFIG.batchSize) ||
                          (activeIndex < ANTI_SPAM.lastPrefetchedIndex - (CONFIG.batchSize * 2));

        if (isFarJump) {
          prefetchTranslations(activeIndex);
        } else if (activeIndex + Math.floor(CONFIG.batchSize / 2) >= ANTI_SPAM.lastPrefetchedIndex) {
          const nextStart = Math.max(0, ANTI_SPAM.lastPrefetchedIndex + 1);
          if (nextStart < STATE.cues.length) {
            prefetchTranslations(nextStart);
          }
        }
      }
    }

    destroy() {
      if (this.rafId) {
        cancelAnimationFrame(this.rafId);
        this.rafId = null;
      }
      if (this.adObserver) {
        this.adObserver.disconnect();
        this.adObserver = null;
      }
      if (this.hostEl) {
        this.hostEl.remove();
        this.hostEl = null;
      }

      this.shadowRoot = null;
      this.topContainer = null;
      this.bottomContainer = null;
      this.activePlayerEl = null;
      this.lastActiveIndex = -1;
      ANTI_SPAM.lastPrefetchedIndex = -1;
    }
  }

  const renderer = new OverlayRenderer();

  // Dialog nhập DeepL API Key thân thiện
  function promptForApiKey(currentKey) {
    const input = prompt(
      'Vui lòng nhập DeepL API Key (Free hoặc Pro) để sử dụng phụ đề song ngữ:\n(Ví dụ: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx:fx)\nKhóa được lưu cục bộ trong trình duyệt của bạn (Tampermonkey/Violentmonkey).',
      currentKey !== undefined ? currentKey : getDeepLApiKey()
    );
    if (input !== null) {
      const trimmed = input.trim();
      setDeepLApiKey(trimmed);
      translator.resetSession();
      STATE.translatedMap.clear();
      ANTI_SPAM.rateLimitCooldownUntil = 0;
      ANTI_SPAM.consecutive429Count = 0;
      updateChannelButtonState();
      if (trimmed) {
        console.log('[YT-DualSub] Đã lưu DeepL API Key.');
        prefetchTranslations(0);
      } else {
        console.log('[YT-DualSub] Đã xóa DeepL API Key.');
      }
    }
  }

  // =========================================================================
  // 9. NÚT ĐIỀU KHIỂN ĐỘC LẬP BÊN CẠNH CHUÔNG THÔNG BÁO KÊNH (CÙNG HÀNG NGANG)
  // Vị trí: [Avatar Kênh] [Tên Kênh] [Đăng ký / Chuông] [CC² | ⁝]
  // =========================================================================
  function buildChannelButtonDOM(btn) {
    while (btn.firstChild) btn.removeChild(btn.firstChild);

    // 1. Phân đoạn Bật/Tắt (Toggle Segment)
    const toggleSegment = document.createElement('div');
    toggleSegment.className = 'yt-dualsub-toggle-segment';
    toggleSegment.title = 'Click để Bật / Tắt phụ đề song ngữ';
    toggleSegment.style.cssText = 'display:inline-flex; align-items:center; gap:6px; height:100%; padding:0 8px 0 12px; cursor:pointer; border-radius:18px 0 0 18px; user-select:none;';

    const badge = document.createElement('span');
    badge.className = 'yt-dualsub-badge';
    badge.textContent = 'CC²';
    toggleSegment.appendChild(badge);

    const label = document.createElement('span');
    label.className = 'yt-dualsub-label';
    label.textContent = STATE.enabled ? 'Song ngữ' : 'Tắt';
    toggleSegment.appendChild(label);

    toggleSegment.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      STATE.enabled = !STATE.enabled;
      GM_setValue('yt_dualsub_enabled', STATE.enabled);
      updateChannelButtonState(btn);
      console.log(`[YT-DualSub] Trạng thái song ngữ: ${STATE.enabled ? 'BẬT' : 'TẮT'}`);
      if (STATE.enabled && !getDeepLApiKey()) {
        promptForApiKey();
      }
      if (STATE.enabled && STATE.cues.length === 0) {
        checkPlayerCaptionsFallback();
      }
    };

    btn.appendChild(toggleSegment);

    // 2. Vạch phân cách tinh tế
    const divider = document.createElement('div');
    divider.className = 'yt-dualsub-divider';
    divider.style.cssText = 'width:1px; height:16px; background:currentColor; opacity:0.25; margin:0; flex-shrink:0;';
    btn.appendChild(divider);

    // 3. Phân đoạn Mở Cài Đặt (Menu Segment - Icon 3 chấm)
    const menuSegment = document.createElement('div');
    menuSegment.className = 'yt-dualsub-menu-segment';
    menuSegment.title = 'Cài đặt phụ đề song ngữ (Ngôn ngữ, Vị trí, Font, Màu, API Key)';
    menuSegment.style.cssText = 'display:inline-flex; align-items:center; justify-content:center; width:30px; height:100%; cursor:pointer; border-radius:0 18px 18px 0; user-select:none; flex-shrink:0;';

    const dotsSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    dotsSvg.setAttribute('width', '16');
    dotsSvg.setAttribute('height', '16');
    dotsSvg.setAttribute('viewBox', '0 0 24 24');
    dotsSvg.setAttribute('fill', 'currentColor');
    const dotsPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    dotsPath.setAttribute('d', 'M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z');
    dotsSvg.appendChild(dotsPath);
    menuSegment.appendChild(dotsSvg);

    menuSegment.onmouseenter = () => { menuSegment.style.background = 'rgba(128,128,128,0.2)'; };
    menuSegment.onmouseleave = () => { menuSegment.style.background = 'transparent'; };

    // BẤM VÀO 3 CHẤM BẰNG CHUỘT TRÁI ĐỂ MỞ CÀI ĐẶT
    menuSegment.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggleSettingsMenu(btn);
    };

    btn.appendChild(menuSegment);

    // Chuột phải vào bất kỳ vị trí nào trên nút cũng mở Cài Đặt
    btn.oncontextmenu = (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggleSettingsMenu(btn);
    };
  }

  function updateChannelButtonState(btn) {
    if (!btn) btn = document.getElementById('yt-dualsub-channel-btn');
    if (!btn) return;

    const isDark = isDarkTheme();

    // Màu sắc thích ứng hoàn hảo với giao diện Sáng / Tối của YouTube:
    // Chế độ sáng: nền xám nhạt #f2f2f2, chữ đen #0f0f0f, viền mỏng
    // Chế độ tối: nền mờ rgba(255,255,255,0.1), chữ trắng #ffffff, viền mờ
    const bgColor = isDark
      ? (STATE.enabled ? 'rgba(255, 255, 255, 0.2)' : 'rgba(255, 255, 255, 0.1)')
      : (STATE.enabled ? 'rgba(0, 0, 0, 0.1)' : '#f2f2f2');

    const textColor = isDark
      ? '#ffffff'
      : (STATE.enabled ? '#0f0f0f' : '#606060');

    const borderColor = isDark
      ? (STATE.enabled ? 'rgba(255, 255, 255, 0.35)' : 'rgba(255, 255, 255, 0.15)')
      : (STATE.enabled ? 'rgba(0, 0, 0, 0.25)' : 'rgba(0, 0, 0, 0.12)');

    btn.style.cssText = `
      display: inline-flex !important;
      flex-direction: row !important;
      align-items: center !important;
      height: 36px !important;
      margin-left: 8px !important;
      vertical-align: middle !important;
      border-radius: 18px !important;
      background: ${bgColor} !important;
      color: ${textColor} !important;
      border: 1px solid ${borderColor} !important;
      font-family: "YouTube Noto", Roboto, "Segoe UI", Arial, sans-serif !important;
      font-size: 13px !important;
      font-weight: 500 !important;
      transition: all 0.2s ease !important;
      user-select: none !important;
      box-sizing: border-box !important;
      flex-shrink: 0 !important;
      white-space: nowrap !important;
      position: relative !important;
      z-index: 10 !important;
    `;

    // Cập nhật Badge CC²
    const badge = btn.querySelector('.yt-dualsub-badge');
    if (badge) {
      if (STATE.enabled) {
        badge.style.cssText = isDark
          ? 'font-size:11px; font-weight:700; line-height:1.1; padding:1px 4px; border:1.5px solid #fef08a; border-radius:3px; color:#fef08a; background:rgba(254,240,138,0.18);'
          : 'font-size:11px; font-weight:700; line-height:1.1; padding:1px 4px; border:1.5px solid #ca8a04; border-radius:3px; color:#000000; background:#fef08a;';
      } else {
        badge.style.cssText = isDark
          ? 'font-size:11px; font-weight:700; line-height:1.1; padding:1px 4px; border:1.5px solid #888888; border-radius:3px; color:#888888; background:transparent;'
          : 'font-size:11px; font-weight:700; line-height:1.1; padding:1px 4px; border:1.5px solid #aaaaaa; border-radius:3px; color:#717171; background:transparent;';
      }
    }

    // Cập nhật Label trạng thái
    const label = btn.querySelector('.yt-dualsub-label');
    if (label) {
      label.textContent = STATE.enabled ? 'Song ngữ' : 'Tắt';
      label.style.cssText = `font-size:13px; font-weight:500; color:${textColor};`;
    }
  }

  function injectChannelControls() {
    let btn = document.getElementById('yt-dualsub-channel-btn');

    // 1. Tìm container #subscribe-button bên trong ytd-video-owner-renderer hoặc #owner
    // Điều này đảm bảo nút [CC²] nằm trên CÙNG HÀNG NGANG bên phải nút Chuông/Đăng ký, KHÔNG RƠI XUỐNG DƯỚI!
    const subContainer = document.querySelector(
      'ytd-watch-metadata ytd-video-owner-renderer #subscribe-button, ' +
      'ytd-video-owner-renderer #subscribe-button, ' +
      '#owner #subscribe-button, ' +
      'ytd-watch-metadata #subscribe-button'
    );

    if (!subContainer || !subContainer.parentNode) return;

    if (!btn) {
      btn = document.createElement('div');
      btn.id = 'yt-dualsub-channel-btn';
      btn.className = 'yt-dualsub-chip-container';

      buildChannelButtonDOM(btn);
      subContainer.parentNode.insertBefore(btn, subContainer.nextSibling);
      updateChannelButtonState(btn);
      console.log('[YT-DualSub] Đã gắn nút [CC²] bên cạnh chuông thông báo (cùng hàng ngang).');
    } else if (btn.previousElementSibling !== subContainer) {
      subContainer.parentNode.insertBefore(btn, subContainer.nextSibling);
      updateChannelButtonState(btn);
    }
  }

  // =========================================================================
  // BẢNG CÀI ĐẶT MODAL CHÍNH GIỮA MÀN HÌNH (CENTERED SETTINGS MODAL)
  // =========================================================================
  function toggleSettingsMenu(anchorEl) {
    let existingBackdrop = document.getElementById('yt-dualsub-modal-backdrop');
    if (existingBackdrop) {
      existingBackdrop.remove();
      return;
    }

    const isDark = isDarkTheme();

    // 1. Lớp phủ nền mờ (Backdrop Overlay) bao phủ toàn màn hình
    const backdrop = document.createElement('div');
    backdrop.id = 'yt-dualsub-modal-backdrop';
    backdrop.style.cssText = `
      position: fixed;
      inset: 0;
      z-index: 9999999;
      background: rgba(0, 0, 0, 0.65);
      backdrop-filter: blur(6px);
      -webkit-backdrop-filter: blur(6px);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
      box-sizing: border-box;
      opacity: 0;
      transition: opacity 0.2s ease;
    `;

    // 2. Hộp thoại Cài đặt (Modal Card) căn chính giữa màn hình
    const modal = document.createElement('div');
    modal.id = 'yt-dualsub-settings-modal';
    modal.style.cssText = `
      position: relative;
      width: 380px;
      max-width: calc(100vw - 32px);
      max-height: min(85vh, 680px);
      display: flex;
      flex-direction: column;
      background: ${isDark ? 'rgba(28, 28, 30, 0.98)' : '#ffffff'};
      color: ${isDark ? '#ffffff' : '#0f0f0f'};
      border: 1px solid ${isDark ? 'rgba(255, 255, 255, 0.16)' : 'rgba(0, 0, 0, 0.12)'};
      border-radius: 16px;
      box-shadow: 0 24px 50px rgba(0, 0, 0, 0.55), 0 6px 16px rgba(0, 0, 0, 0.2);
      font-family: "YouTube Noto", Roboto, "Segoe UI", Arial, sans-serif;
      box-sizing: border-box;
      overflow: hidden;
      transform: scale(0.96);
      transition: transform 0.2s ease;
    `;

    // Đóng Modal an toàn & mượt mà
    const closeModal = () => {
      window.removeEventListener('keydown', escHandler);
      backdrop.style.opacity = '0';
      modal.style.transform = 'scale(0.96)';
      setTimeout(() => {
        if (backdrop.parentNode) backdrop.remove();
      }, 150);
    };

    const escHandler = (e) => {
      if (e.key === 'Escape' || e.key === 'Esc') {
        e.preventDefault();
        closeModal();
      }
    };
    window.addEventListener('keydown', escHandler);

    backdrop.onclick = (e) => {
      if (e.target === backdrop) closeModal();
    };

    // Chống nổi bọt sự kiện cuộn lên trang YouTube phía sau
    modal.addEventListener('wheel', (e) => {
      e.stopPropagation();
    }, { passive: true });

    // HEADER CỐ ĐỊNH
    const headerRow = document.createElement('div');
    headerRow.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 14px 18px;
      border-bottom: 1px solid ${isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)'};
      background: ${isDark ? 'rgba(39, 39, 42, 0.7)' : 'rgba(249, 250, 251, 0.9)'};
      flex-shrink: 0;
    `;

    const titleEl = document.createElement('div');
    titleEl.textContent = '⚙️ Cài đặt Dual Subtitles Pro';
    titleEl.style.cssText = `
      font-size: 15px;
      font-weight: 700;
      color: ${isDark ? '#fef08a' : '#ca8a04'};
      letter-spacing: 0.3px;
    `;

    const closeBtn = document.createElement('button');
    closeBtn.textContent = '✕';
    closeBtn.title = 'Đóng (Esc)';
    closeBtn.style.cssText = `
      background: transparent;
      border: none;
      color: ${isDark ? '#9ca3af' : '#6b7280'};
      font-size: 16px;
      font-weight: 700;
      cursor: pointer;
      padding: 4px 8px;
      border-radius: 6px;
      transition: all 0.15s;
    `;
    closeBtn.onmouseenter = () => {
      closeBtn.style.background = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)';
      closeBtn.style.color = isDark ? '#ffffff' : '#0f0f0f';
    };
    closeBtn.onmouseleave = () => {
      closeBtn.style.background = 'transparent';
      closeBtn.style.color = isDark ? '#9ca3af' : '#6b7280';
    };
    closeBtn.onclick = closeModal;

    headerRow.appendChild(titleEl);
    headerRow.appendChild(closeBtn);
    modal.appendChild(headerRow);

    // BODY CUỘN MƯỢT MÀ
    const modalBody = document.createElement('div');
    modalBody.style.cssText = `
      padding: 16px 18px;
      overflow-y: auto;
      overscroll-behavior: contain;
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 16px;
      box-sizing: border-box;
    `;

    // 1. Chọn Ngôn ngữ dịch (DeepL)
    const langSection = document.createElement('div');
    const langSectionTitle = document.createElement('div');
    langSectionTitle.textContent = 'NGÔN NGỮ DỊCH (DEEPL)';
    langSectionTitle.style.cssText = `font-size:11px; font-weight:700; color:${isDark ? '#9ca3af' : '#6b7280'}; margin-bottom:8px; letter-spacing:0.5px;`;
    langSection.appendChild(langSectionTitle);

    const langSelect = document.createElement('select');
    langSelect.style.cssText = `
      width: 100%;
      padding: 8px 10px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      background: ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'};
      color: ${isDark ? '#fef08a' : '#0f0f0f'};
      border: 1px solid ${isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)'};
      outline: none;
      box-sizing: border-box;
    `;

    for (const lang of CONFIG.supportedLanguages) {
      const opt = document.createElement('option');
      opt.value = lang.code;
      opt.textContent = `${lang.name} (${lang.deeplCode})`;
      langSelect.appendChild(opt);
    }
    langSelect.value = STATE.targetLang;
    langSelect.onchange = () => {
      const code = langSelect.value;
      if (code && code !== STATE.targetLang) {
        STATE.targetLang = code;
        try { GM_setValue('yt_dualsub_target_lang', code); } catch (e) {}
        translator.resetSession();
        STATE.translatedMap.clear();
        prefetchTranslations(0);
        console.log(`[YT-DualSub] Đã chuyển ngôn ngữ dịch sang: ${code}`);
      }
    };
    langSection.appendChild(langSelect);
    modalBody.appendChild(langSection);

    // 2. Tùy chọn Phụ đề gốc
    const origSection = document.createElement('div');
    const origSectionTitle = document.createElement('div');
    origSectionTitle.textContent = 'TÙY CHỌN PHỤ ĐỀ GỐC';
    origSectionTitle.style.cssText = `font-size:11px; font-weight:700; color:${isDark ? '#9ca3af' : '#6b7280'}; margin-bottom:8px; letter-spacing:0.5px;`;
    origSection.appendChild(origSectionTitle);

    // Switch Hiện/Ẩn câu gốc
    const toggleOrigRow = document.createElement('div');
    toggleOrigRow.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 6px 0;
      margin-bottom: 8px;
      font-size: 13px;
    `;
    const toggleOrigLabel = document.createElement('span');
    toggleOrigLabel.textContent = 'Hiển thị câu gốc tiếng Anh:';
    const toggleOrigBtn = document.createElement('button');
    function updateToggleOrigBtn() {
      toggleOrigBtn.textContent = STATE.showOriginal ? 'BẬT' : 'TẮT';
      toggleOrigBtn.style.background = STATE.showOriginal ? '#22c55e' : (isDark ? '#4b5563' : '#9ca3af');
      toggleOrigBtn.style.color = '#ffffff';
    }
    toggleOrigBtn.style.cssText = 'padding:4px 12px; border-radius:12px; font-size:11px; font-weight:700; cursor:pointer; border:none; transition:background 0.15s;';
    updateToggleOrigBtn();
    toggleOrigBtn.onclick = () => {
      STATE.showOriginal = !STATE.showOriginal;
      GM_setValue('yt_dualsub_show_original', STATE.showOriginal);
      updateToggleOrigBtn();
    };
    toggleOrigRow.appendChild(toggleOrigLabel);
    toggleOrigRow.appendChild(toggleOrigBtn);
    origSection.appendChild(toggleOrigRow);

    // Vị trí câu gốc: Đáy (Stacked) vs Đỉnh (Top)
    const posRow = document.createElement('div');
    const posLabel = document.createElement('div');
    posLabel.textContent = 'Vị trí câu gốc (Tách lên đỉnh để không loãng video):';
    posLabel.style.cssText = `font-size:12px; color:${isDark ? '#9ca3af' : '#6b7280'}; margin-bottom:6px;`;
    posRow.appendChild(posLabel);

    const posBtnGroup = document.createElement('div');
    posBtnGroup.style.cssText = 'display:flex; gap:8px;';

    const posOptions = [
      { id: 'bottom', label: 'Đáy (Stacked)' },
      { id: 'top', label: 'Đỉnh video (Top)' }
    ];
    const posButtons = [];
    function refreshPosSelection() {
      posButtons.forEach(({ btn, opt }) => {
        const isSel = STATE.originalPosition === opt.id;
        btn.style.border = `1px solid ${isSel ? (isDark ? '#fef08a' : '#ca8a04') : (isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)')}`;
        btn.style.background = isSel
          ? (isDark ? 'rgba(254, 240, 138, 0.22)' : 'rgba(202, 138, 4, 0.16)')
          : (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)');
        btn.style.color = isSel
          ? (isDark ? '#fef08a' : '#ca8a04')
          : (isDark ? '#d1d5db' : '#374151');
      });
    }

    for (const opt of posOptions) {
      const pBtn = document.createElement('button');
      pBtn.textContent = opt.label;
      pBtn.style.cssText = 'flex:1; padding:7px 10px; border-radius:8px; font-size:12px; font-weight:600; cursor:pointer; transition:all 0.15s;';
      pBtn.onclick = () => {
        STATE.originalPosition = opt.id;
        GM_setValue('yt_dualsub_orig_pos', opt.id);
        renderer.mountSubtitleElements();
        refreshPosSelection();
      };
      posButtons.push({ btn: pBtn, opt });
      posBtnGroup.appendChild(pBtn);
    }
    refreshPosSelection();
    posRow.appendChild(posBtnGroup);
    origSection.appendChild(posRow);
    modalBody.appendChild(origSection);

    // 3. Cỡ chữ & Bảng màu dịch
    const styleSection = document.createElement('div');
    const styleSectionTitle = document.createElement('div');
    styleSectionTitle.textContent = 'CỠ CHỮ & MÀU SẮC DỊCH';
    styleSectionTitle.style.cssText = `font-size:11px; font-weight:700; color:${isDark ? '#9ca3af' : '#6b7280'}; margin-bottom:8px; letter-spacing:0.5px;`;
    styleSection.appendChild(styleSectionTitle);

    // Font size: input nhập trực tiếp (mặc định 28px)
    const fontRow = document.createElement('div');
    fontRow.style.cssText = 'display:flex; justify-content:space-between; align-items:center; gap:10px; margin-bottom:12px; font-size:13px;';
    const fontLabel = document.createElement('span');
    fontLabel.textContent = 'Kích cỡ chữ:';
    fontLabel.style.whiteSpace = 'nowrap';

    const fontInput = document.createElement('input');
    fontInput.type = 'number';
    fontInput.min = '10';
    fontInput.max = '48';
    fontInput.step = '1';
    fontInput.value = String(STATE.fontSize || 28);
    fontInput.style.cssText = `
      width: 90px;
      padding: 6px 8px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 600;
      text-align: center;
      background: ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'};
      color: ${isDark ? '#ffffff' : '#0f0f0f'};
      border: 1px solid ${isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)'};
      outline: none;
    `;
    function applyFontInput() {
      let v = Math.round(Number(fontInput.value) || 28);
      v = Math.max(10, Math.min(48, v));
      fontInput.value = String(v);
      if (v !== STATE.fontSize) {
        STATE.fontSize = v;
        try { GM_setValue('yt_dualsub_font_size', v); } catch (e) {}
        renderer.applyStyles();
      }
    }
    fontInput.onchange = applyFontInput;
    fontInput.oninput = applyFontInput;
    fontRow.appendChild(fontLabel);
    fontRow.appendChild(fontInput);
    styleSection.appendChild(fontRow);

    // Color selector
    const colorRow = document.createElement('div');
    const colorLabel = document.createElement('div');
    colorLabel.textContent = 'Màu sắc dòng phụ đề dịch:';
    colorLabel.style.cssText = `font-size:12px; color:${isDark ? '#9ca3af' : '#6b7280'}; margin-bottom:8px;`;
    colorRow.appendChild(colorLabel);

    const colorGroup = document.createElement('div');
    colorGroup.style.cssText = 'display:flex; gap:10px; align-items:center;';
    const colorBoxes = [];

    function refreshColorSelection() {
      colorBoxes.forEach(({ box, c }) => {
        const isC = STATE.transColor === c.code;
        box.style.border = isC
          ? (isDark ? '2.5px solid #ffffff' : '2.5px solid #0f0f0f')
          : '2px solid transparent';
        box.style.transform = isC ? 'scale(1.15)' : 'scale(1)';
        box.style.boxShadow = isC ? '0 0 8px rgba(0,0,0,0.4)' : 'none';
      });
    }

    for (const c of CONFIG.colorPalette) {
      const cBox = document.createElement('div');
      cBox.title = c.name;
      cBox.style.cssText = `
        width: 26px;
        height: 26px;
        border-radius: 50%;
        background: ${c.code};
        cursor: pointer;
        transition: transform 0.15s, border 0.15s;
        box-sizing: border-box;
      `;
      cBox.onclick = () => {
        STATE.transColor = c.code;
        GM_setValue('yt_dualsub_trans_color', c.code);
        renderer.applyStyles();
        refreshColorSelection();
      };
      colorBoxes.push({ box: cBox, c });
      colorGroup.appendChild(cBox);
    }
    refreshColorSelection();
    colorRow.appendChild(colorGroup);

    // ponytail: input màu CSS tùy ý (hex / tên màu / rgb...), đồng bộ với color picker
    const customColorRow = document.createElement('div');
    customColorRow.style.cssText = 'display:flex; gap:8px; align-items:center; margin-top:10px;';
    const colorPicker = document.createElement('input');
    colorPicker.type = 'color';
    colorPicker.value = /^#[0-9a-fA-F]{6}$/.test(STATE.transColor || '') ? STATE.transColor : '#fef08a';
    colorPicker.title = 'Chọn màu tùy ý';
    colorPicker.style.cssText = 'width:34px; height:28px; padding:0; border:none; border-radius:6px; cursor:pointer; background:transparent; flex-shrink:0;';
    const colorTextInput = document.createElement('input');
    colorTextInput.type = 'text';
    colorTextInput.placeholder = '#fef08a / red / rgb(...)';
    colorTextInput.value = STATE.transColor || '';
    colorTextInput.spellcheck = false;
    colorTextInput.style.cssText = `
      flex: 1;
      padding: 6px 8px;
      border-radius: 8px;
      font-size: 12px;
      font-family: monospace;
      background: ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'};
      color: ${isDark ? '#ffffff' : '#0f0f0f'};
      border: 1px solid ${isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)'};
      outline: none;
      box-sizing: border-box;
    `;
    function applyCustomColor(v, syncPicker) {
      v = (v || '').trim();
      if (!isValidCssColor(v)) return;
      STATE.transColor = v;
      try { GM_setValue('yt_dualsub_trans_color', v); } catch (e) {}
      renderer.applyStyles();
      refreshColorSelection();
      if (colorTextInput.value !== v) colorTextInput.value = v;
      if (syncPicker && /^#[0-9a-fA-F]{6}$/.test(v)) colorPicker.value = v;
    }
    colorPicker.oninput = () => applyCustomColor(colorPicker.value, false);
    colorTextInput.onchange = () => applyCustomColor(colorTextInput.value, true);
    customColorRow.appendChild(colorPicker);
    customColorRow.appendChild(colorTextInput);
    colorRow.appendChild(customColorRow);
    styleSection.appendChild(colorRow);
    modalBody.appendChild(styleSection);

    // 4. Cấu hình DeepL API Key & Gói API
    const apiSection = document.createElement('div');
    const apiSectionTitle = document.createElement('div');
    apiSectionTitle.textContent = 'CẤU HÌNH DEEPL API';
    apiSectionTitle.style.cssText = `font-size:11px; font-weight:700; color:${isDark ? '#9ca3af' : '#6b7280'}; margin-bottom:8px; letter-spacing:0.5px;`;
    apiSection.appendChild(apiSectionTitle);

    const keyRow = document.createElement('div');
    keyRow.style.cssText = 'display:flex; justify-content:space-between; align-items:center; padding:6px 0; margin-bottom:10px; font-size:12px;';

    const keyInfo = document.createElement('span');
    function updateKeyInfo() {
      const curKey = getDeepLApiKey();
      keyInfo.textContent = curKey ? `🔑 Key: ••••${curKey.slice(-4)}` : '🔑 Chưa có API Key';
      keyInfo.style.color = curKey ? '#22c55e' : (isDark ? '#fef08a' : '#ca8a04');
      keyInfo.style.fontWeight = '600';
    }
    updateKeyInfo();

    const keyEditBtn = document.createElement('button');
    function updateKeyEditBtn() {
      const curKey = getDeepLApiKey();
      keyEditBtn.textContent = curKey ? 'Đổi Key' : 'Nhập Key';
    }
    updateKeyEditBtn();
    keyEditBtn.style.cssText = `
      padding: 5px 12px;
      border-radius: 8px;
      font-size: 11px;
      font-weight: 600;
      cursor: pointer;
      background: ${isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.06)'};
      color: ${isDark ? '#ffffff' : '#0f0f0f'};
      border: 1px solid ${isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)'};
      transition: background 0.15s;
    `;
    keyEditBtn.onclick = () => {
      keyInput.focus();
      keyInput.select();
    };

    keyRow.appendChild(keyInfo);
    keyRow.appendChild(keyEditBtn);
    apiSection.appendChild(keyRow);

    // ponytail: input inline thay prompt() (prompt hay bị chặn + không thấy localdb) — Lưu gọi setDeepLApiKey dual-store
    const keyInputRow = document.createElement('div');
    keyInputRow.style.cssText = 'display:flex; gap:8px; margin-bottom:10px;';
    const keyInput = document.createElement('input');
    keyInput.type = 'password';
    keyInput.placeholder = 'Dán DeepL key ...:fx';
    keyInput.value = getDeepLApiKey();
    keyInput.autocomplete = 'off';
    keyInput.spellcheck = false;
    keyInput.style.cssText = `
      flex: 1;
      padding: 7px 10px;
      border-radius: 8px;
      font-size: 12px;
      font-family: monospace;
      background: ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'};
      color: ${isDark ? '#ffffff' : '#0f0f0f'};
      border: 1px solid ${isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)'};
      outline: none;
      box-sizing: border-box;
    `;
    const keySaveBtn = document.createElement('button');
    keySaveBtn.textContent = 'Lưu';
    keySaveBtn.style.cssText = `
      padding: 7px 14px;
      border-radius: 8px;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
      border: none;
      background: ${isDark ? '#fef08a' : '#ca8a04'};
      color: ${isDark ? '#000000' : '#ffffff'};
      flex-shrink: 0;
    `;
    function saveKeyFromInput() {
      const v = (keyInput.value || '').trim();
      setDeepLApiKey(v);
      // đọc lại để xác nhận đã persist (GM + localStorage)
      keyInput.value = getDeepLApiKey();
      translator.resetSession();
      STATE.translatedMap.clear();
      ANTI_SPAM.rateLimitCooldownUntil = 0;
      ANTI_SPAM.consecutive429Count = 0;
      updateChannelButtonState();
      updateKeyInfo();
      updateKeyEditBtn();
      if (getDeepLApiKey()) prefetchTranslations(0);
    }
    keySaveBtn.onclick = saveKeyFromInput;
    keyInput.onkeydown = (e) => {
      if (e.key === 'Enter') { e.preventDefault(); saveKeyFromInput(); }
      e.stopPropagation();
    };
    keyInputRow.appendChild(keyInput);
    keyInputRow.appendChild(keySaveBtn);
    apiSection.appendChild(keyInputRow);

    // Loại API Endpoint: Auto / Free / Pro
    const typeRow = document.createElement('div');
    typeRow.style.cssText = 'display:flex; justify-content:space-between; align-items:center; font-size:12px;';
    const typeLabel = document.createElement('span');
    typeLabel.textContent = 'Gói API:';
    typeLabel.style.color = isDark ? '#9ca3af' : '#6b7280';

    const typeGroup = document.createElement('div');
    typeGroup.style.cssText = 'display:flex; gap:6px;';
    const apiTypes = [
      { id: 'auto', label: 'Auto' },
      { id: 'free', label: 'Free' },
      { id: 'pro', label: 'Pro' }
    ];
    const typeButtons = [];

    function refreshApiTypeSelection() {
      typeButtons.forEach(({ btn, at }) => {
        const isAt = STATE.deeplApiType === at.id;
        btn.style.border = `1px solid ${isAt ? (isDark ? '#fef08a' : '#ca8a04') : (isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)')}`;
        btn.style.background = isAt
          ? (isDark ? 'rgba(254, 240, 138, 0.25)' : 'rgba(202, 138, 4, 0.16)')
          : (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)');
        btn.style.color = isAt
          ? (isDark ? '#fef08a' : '#ca8a04')
          : (isDark ? '#ffffff' : '#0f0f0f');
        btn.style.fontWeight = isAt ? '700' : '500';
      });
    }

    for (const at of apiTypes) {
      const atBtn = document.createElement('button');
      atBtn.textContent = at.label;
      atBtn.style.cssText = 'padding:4px 10px; border-radius:6px; font-size:11px; cursor:pointer; transition:all 0.15s;';
      atBtn.onclick = () => {
        STATE.deeplApiType = at.id;
        GM_setValue('yt_dualsub_deepl_type', at.id);
        refreshApiTypeSelection();
      };
      typeButtons.push({ btn: atBtn, at });
      typeGroup.appendChild(atBtn);
    }
    refreshApiTypeSelection();
    typeRow.appendChild(typeLabel);
    typeRow.appendChild(typeGroup);
    apiSection.appendChild(typeRow);
    modalBody.appendChild(apiSection);

    modal.appendChild(modalBody);

    // FOOTER CỐ ĐỊNH
    const footer = document.createElement('div');
    footer.style.cssText = `
      padding: 12px 18px;
      border-top: 1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'};
      background: ${isDark ? 'rgba(39, 39, 42, 0.5)' : 'rgba(249, 250, 251, 0.8)'};
      display: flex;
      flex-direction: column;
      gap: 8px;
      flex-shrink: 0;
    `;

    const tipText = document.createElement('div');
    tipText.textContent = '💡 Phím tắt Alt + D để Bật/Tắt nhanh khi xem video.';
    tipText.style.cssText = `font-size:11px; color:${isDark ? '#9ca3af' : '#6b7280'}; text-align:center;`;
    footer.appendChild(tipText);

    const srtBtn = document.createElement('button');
    srtBtn.textContent = STATE.cues.length ? `💾 Tải SRT song ngữ (${STATE.cues.length} câu)` : '💾 Tải SRT song ngữ';
    srtBtn.title = 'Xuất file .srt gồm câu gốc + câu dịch (câu chưa dịch chỉ có câu gốc)';
    srtBtn.style.cssText = `
      width: 100%;
      padding: 8px 0;
      border-radius: 20px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      background: transparent;
      color: ${isDark ? '#fef08a' : '#ca8a04'};
      border: 1px solid ${isDark ? 'rgba(254,240,138,0.4)' : 'rgba(202,138,4,0.5)'};
      transition: opacity 0.15s;
    `;
    srtBtn.onmouseenter = () => srtBtn.style.opacity = '0.85';
    srtBtn.onmouseleave = () => srtBtn.style.opacity = '1';
    srtBtn.onclick = () => {
      if (!downloadBilingualSrt()) {
        srtBtn.textContent = '⏳ Chưa có phụ đề — hãy bật CC và chờ tải xong';
        setTimeout(() => { srtBtn.textContent = '💾 Tải SRT song ngữ'; }, 2000);
      }
    };
    footer.appendChild(srtBtn);

    const doneBtn = document.createElement('button');
    doneBtn.textContent = 'Hoàn tất & Đóng';
    doneBtn.style.cssText = `
      width: 100%;
      padding: 8px 0;
      border-radius: 20px;
      border: none;
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
      background: ${isDark ? '#fef08a' : '#ca8a04'};
      color: ${isDark ? '#000000' : '#ffffff'};
      transition: opacity 0.15s;
    `;
    doneBtn.onmouseenter = () => doneBtn.style.opacity = '0.9';
    doneBtn.onmouseleave = () => doneBtn.style.opacity = '1';
    doneBtn.onclick = closeModal;
    footer.appendChild(doneBtn);

    modal.appendChild(footer);

    backdrop.appendChild(modal);
    document.body.appendChild(backdrop);

    requestAnimationFrame(() => {
      backdrop.style.opacity = '1';
      modal.style.transform = 'scale(1)';
    });
  }

  // Phím tắt bàn phím Alt + D bật/tắt nhanh
  window.addEventListener('keydown', (e) => {
    const tag = (e.target && e.target.tagName) ? e.target.tagName.toLowerCase() : '';
    if (tag === 'input' || tag === 'textarea' || (e.target && e.target.isContentEditable)) return;

    if (e.altKey && (e.key === 'd' || e.key === 'D')) {
      e.preventDefault();
      STATE.enabled = !STATE.enabled;
      GM_setValue('yt_dualsub_enabled', STATE.enabled);
      updateChannelButtonState();
      console.log(`[YT-DualSub] Phím tắt Alt+D: Song ngữ ${STATE.enabled ? 'BẬT' : 'TẮT'}`);
      if (STATE.enabled && STATE.cues.length === 0) {
        checkPlayerCaptionsFallback();
      }
    }
  });

  // =========================================================================
  // 10. VÒNG ĐỜI ỨNG DỤNG & SPA NAVIGATION
  // =========================================================================
  function onVideoChange() {
    const videoId = getVideoId();
    if (!videoId) return;

    console.log(`[YT-DualSub] Phát hiện video mới: [${videoId}]`);
    translator.resetSession();
    STATE.currentVideoId = videoId;
    STATE.cues = [];
    STATE.translatedMap.clear();
    STATE.lastHandledSignature = '';
    ANTI_SPAM.lastPrefetchedIndex = -1;

    const playerEl = getMainPlayerElement();
    if (playerEl) {
      renderer.init(playerEl);
    }

    // Tự động tải captionTrack liên tục cho tới khi nhận được phụ đề
    setTimeout(checkPlayerCaptionsFallback, 400);
    setTimeout(checkPlayerCaptionsFallback, 1200);
    setTimeout(checkPlayerCaptionsFallback, 2500);

    setTimeout(injectChannelControls, 300);
    setTimeout(injectChannelControls, 1000);
    setTimeout(injectChannelControls, 2000);
  }

  window.addEventListener('yt-navigate-finish', onVideoChange);

  // Theo dõi sự kiện thay đổi Theme của YouTube để cập nhật nút tức thì
  const themeObserver = new MutationObserver(() => {
    updateChannelButtonState();
  });
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['dark'] });

  // Vòng lặp giám sát đảm bảo overlay và nút điều khiển luôn hiện diện trên hàng kênh
  setInterval(() => {
    const playerEl = getMainPlayerElement();
    if (playerEl && playerEl !== renderer.activePlayerEl) {
      renderer.init(playerEl);
    }

    // Đảm bảo phụ đề được nạp tự động mà không cần bật/tắt YouTube CC
    if (STATE.enabled && STATE.cues.length === 0) {
      checkPlayerCaptionsFallback();
    }

    injectChannelControls();
  }, 1000);

  // Gắn listener lắng nghe video play để đảm bảo phụ đề nạp ngay khi bấm Play
  document.addEventListener('play', () => {
    if (STATE.enabled && STATE.cues.length === 0) {
      checkPlayerCaptionsFallback();
    }
  }, true);

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    onVideoChange();
  } else {
    document.addEventListener('DOMContentLoaded', onVideoChange);
  }

  console.log('[YT-DualSub] Sẵn sàng phục vụ.');
})();
