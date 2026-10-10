# Changelog: YouTube Dual Subtitles Pro

Toàn bộ các thay đổi đáng chú ý của dự án **YouTube Dual Subtitles Pro** được ghi lại tại tệp này theo định dạng [Keep a Changelog](https://keepachangelog.com/vi/1.0.0/).

---

## [1.2.3] - 2026-10-10

### 🛠️ Sửa lỗi & Gọn Modal (Fixed & Compact Settings)
- **DeepL Key persist dual-store + input inline:** `set/getDeepLApiKey` mirror `GM_setValue` + `localStorage` (đọc GM trước, fallback localStorage); modal thêm ô input password + nút Lưu (Enter để lưu), khắc phục `prompt()` bị chặn/không thấy persist.
- **Ngôn ngữ đích dạng dropdown:** thay danh sách 5 hàng chiếm diện tích bằng `<select>` gọn 1 dòng.
- **Font mặc định 28px + input số:** thay 4 nút cứng bằng `<input type="number" min="10" max="48">`, clamp + apply real-time.
- **Màu CSS tùy ý:** giữ 5 màu preset, thêm `<input type="color">` + ô text (hex/tên màu/rgb), validate qua `CSS.supports`-tương đương (`new Option().style`), sync 2 chiều.

---

## [1.2.4] - 2026-10-10

### 📥 Tính năng Mới (Added)
- **Tải SRT song ngữ:** nút 💾 trong footer modal xuất `.srt` (câu gốc + câu dịch, BOM UTF-8, tên file theo tiêu đề video + mã ngôn ngữ). Câu chưa dịch chỉ xuất câu gốc, không bao giờ ghi câu gốc giả làm bản dịch.

---

## [1.2.2] - 2026-10-10

### 🚀 Nâng cấp & Hoàn thiện Trải nghiệm (UX Improvements & Centered Modal)
- **Hộp thoại Cài đặt Modal Chính giữa màn hình (Centered Modal Dialog):**
  - Chuyển toàn bộ popup cài đặt từ vị trí neo gần con trỏ chuột sang **chính giữa màn hình** với lớp phủ mờ (Backdrop Overlay) hiện đại (`rgba(0, 0, 0, 0.65)`, `backdrop-filter: blur(6px)`).
  - Khắc phục triệt để lỗi menu bị neo lệch mép màn hình, bị trôi mất hoặc không thể cuộn xuống xem các tùy chọn bên dưới.
- **Cuộn nội dung độc lập & Mượt mà:**
  - Phần thân modal có `overflow-y: auto`, `overscroll-behavior: contain` và chặn sự kiện cuộn lan ra ngoài trang (`wheel stop-propagation`), giúp người dùng cuộn mượt qua tất cả mục cài đặt mà không làm trôi video YouTube phía sau.
- **Khắc phục lỗi tự động đóng khi click tùy chọn (Persistent Multi-option Config):**
  - Loại bỏ hoàn toàn hành vi tự đóng menu (`menu.remove()`) mỗi khi click chọn ngôn ngữ, cỡ chữ, màu sắc, vị trí hoặc gói API.
  - Khi người dùng click, hệ thống áp dụng thay đổi tức thì (real-time) và cập nhật highlight lựa chọn ngay trên modal, cho phép người dùng tùy chỉnh liên tục nhiều mục cùng lúc ("bấm thêm tùy chọn thoải mái").
- **Đóng Modal trực quan & Linh hoạt:**
  - Hỗ trợ đóng qua 4 cách:
    1. Bấm nút ✕ ở góc trên bên phải Header.
    2. Bấm nút "Hoàn tất & Đóng" ở Footer.
    3. Click vào vùng nền tối mờ (Backdrop) bên ngoài hộp thoại.
    4. Nhấn phím `Escape` (`ESC`) trên bàn phím.

---

## [1.2.1] - 2026-10-10

### 🛠️ Sửa lỗi & Hoàn thiện Giao diện (Fixed & UI Improvements)
- **Căn chỉnh Nút [CC²] cùng hàng ngang (Horizontal Alignment):**
  - Khắc phục lỗi nút bị rớt xuống dòng thứ 2 bên dưới nút Chuông thông báo/Đăng ký kênh.
  - Neo nút vào trực tiếp `ytd-video-owner-renderer` ngay sau `#subscribe-button` với `flex-shrink: 0`, đảm bảo nằm cùng một hàng ngang thẳng hàng với avatar, tên kênh và cụm Đăng ký / Chuông.
- **Tương phản Màu sắc Chế độ Sáng & Tối (Light & Dark Theme Adaptive):**
  - Tự động nhận diện theme của YouTube qua thuộc tính `dark` trên `<html>` và cập nhật tức thì qua `MutationObserver`.
  - **Chế độ Sáng (Light Mode):** Nền chip màu xám nhạt `#f2f2f2` / `rgba(0,0,0,0.1)`, chữ đen `#0f0f0f`, badge `CC²` nền vàng `#fef08a` viền đậm `#ca8a04` chữ đen đậm nét. Loại bỏ hoàn toàn tình trạng nền trắng mờ không nhìn thấy gì.
  - **Chế độ Tối (Dark Mode):** Nền mờ kính tối `rgba(255,255,255,0.15)`, chữ trắng sáng, badge `CC²` viền vàng `#fef08a`.
  - **Bảng Cài đặt:** Tự chuyển đổi phong cách nền sáng/tối sắc nét, chữ rõ ràng dễ đọc.
- **Phân đoạn Nút & Click 3 chấm (Segmented Pill Button & 3-dots Trigger):**
  - Tách nút thành 2 phân đoạn độc lập:
    - *Phân đoạn Trái (`[CC² Song ngữ]`):* Click chuột trái để Bật / Tắt nhanh phụ đề song ngữ.
    - *Phân đoạn Phải (Biểu tượng 3 chấm):* Có `onclick` riêng biệt, click chuột trái mở trực tiếp Bảng cài đặt tùy chọn (Settings Menu) thay vì nhầm với bật/tắt.
    - Chuột phải vào bất kỳ vị trí nào trên nút cũng mở Bảng cài đặt.
- **Tự động Hiển thị Phụ đề không cần tắt bật CC của YouTube:**
  - Sửa lỗi điều kiện chặn `handleRawTimedTextContent`: nếu `STATE.cues` đang rỗng, luôn xử lý và phân tích phụ đề, không bị return sớm.
  - Tự động nạp caption track qua `checkPlayerCaptionsFallback()` với 3 mốc retry thông minh (400ms, 1200ms, 2500ms) sau khi đổi video và lặp lại định kỳ khi cues rỗng, tự bắt ngay cả khi player chưa kịp phát request `timedtext`.

---

## [1.2.0] - 2026-10-10

### 🚀 Tính năng Mới (Added)
- **Nút `[CC²]` độc lập cạnh chuông thông báo kênh:**
  - Chuyển nút điều khiển ra ngoài video player, đặt ngay bên phải nút Chuông thông báo / Đăng ký kênh.
  - Loại bỏ hoàn toàn lỗi xung đột context menu khi click chuột phải trên video player.
  - Thiết kế theo phong cách chip button chuẩn YouTube (bo tròn 18px, hiệu ứng kính mờ, badge `CC²` sáng rõ).
- **Tùy chọn đưa phụ đề gốc lên Đỉnh video (Top position):**
  - Cho phép tách câu gốc tiếng Anh lên mép trên màn hình, giữ dòng dịch tiếng Việt ở đáy màn hình.
  - Phù hợp với người xem giải trí muốn tập trung vào phụ đề dịch mà không bị rối mắt hoặc che mất nội dung chính của video.
- **Tùy chọn ẩn hoàn toàn câu gốc:**
  - Chế độ xem thuần bản dịch cho người dùng chỉ có nhu cầu xem phụ đề tiếng Việt.
- **Tùy biến Cỡ chữ & Màu sắc trực quan:**
  - Hỗ trợ 4 mức font chữ: `16px` (Nhỏ), `20px` (Chuẩn), `24px` (Lớn), `28px` (Rất lớn).
  - Hỗ trợ 5 bảng màu phụ đề dịch: Vàng nhạt (mặc định), Trắng sáng, Xanh lục nhạt, Xanh lơ nhạt, Cam nhạt.
- **Tùy chọn Gói DeepL API (Auto / Free / Pro):**
  - Tự động nhận diện endpoint qua hậu tố `:fx` hoặc cho phép người dùng ép chọn rõ ràng (`api-free.deepl.com` hoặc `api.deepl.com`).
- **Phím tắt Bàn phím `Alt + D`:**
  - Bật / Tắt nhanh phụ đề song ngữ khi đang xem ở chế độ Toàn màn hình (Fullscreen).
- **Bảng Cài đặt Popup (Settings Panel):**
  - Giao diện glassmorphism hiện đại, mở tức thì bằng chuột phải hoặc icon 3 chấm trên nút `[CC²]`.

### 🛠️ Sửa lỗi & Tối ưu (Fixed & Optimized)
- **P1: Sửa lỗi đánh dấu prefetch sớm:**
  - Không còn cập nhật `lastPrefetchedIndex` trước khi request dịch thành công.
  - Chỉ cập nhật mốc khi `res.ok === true` và số câu trả về khớp chính xác. Khi gặp 429 hoặc lỗi mạng, mốc cũ được giữ nguyên để tự động retry sau khi hết cooldown.
- **P1: Khắc phục Race Condition khi đổi video:**
  - Lưu sẵn danh sách `batchKeys` trước khi dispatch request.
  - Khối `finally` dọn dẹp trực tiếp từ `batchKeys` thay vì đọc lại `STATE.cues`, loại bỏ hoàn toàn lỗi `TypeError: cannot read property of undefined` khi `STATE.cues` bị reset về rỗng lúc đổi video.
- **P2: Giới hạn Cache FIFO (LRU):**
  - Triển khai hàm `setCacheEntry()` tự động evict các entry cũ nhất khi số lượng câu dịch vượt ngưỡng `CONFIG.maxCacheEntries: 500`.
- **P2: Bổ sung URL vào chữ ký Deduplication timedtext:**
  - Chữ ký `signature` kết hợp cả `videoId:url:length:snippet`, tránh bỏ qua nhầm các track phụ đề khác nhau của cùng một video.
- **P3: Dọn dẹp mã nguồn & Tối ưu:**
  - Nhận diện chính xác active track từ API của YouTube player (`player.getOption('captions', 'track')`).
  - Xóa bỏ các dòng lệnh lặp thừa (`fullText.trim()`, `adObserver.disconnect()`).
  - Cập nhật thông báo lưu API key cục bộ an toàn trong trình duyệt.

---

## [1.1.0] - 2026-10-10

### 🚀 Tính năng Mới (Added)
- **Chuyển đổi hoàn toàn sang DeepL API:**
  - Thay thế endpoint không chính thức Google GTX bằng DeepL REST API chính thức.
  - Gửi mảng chuỗi JSON nguyên bản (`text: string[]`), không sử dụng ký tự phân tách sentinel `⟦§§⟧`.
  - Hỗ trợ 5 ngôn ngữ đích cốt lõi: Tiếng Việt (`VI`), English (`EN-US`), Deutsch (`DE`), Slovenčina (`SK`), Čeština (`CS`).
- **Quản lý DeepL API Key bảo mật:**
  - Lưu trữ khóa cục bộ trong trình duyệt bằng `GM_setValue('yt_dualsub_deepl_key')`, không hardcode vào mã nguồn.

### 🛠️ Sửa lỗi (Fixed)
- **Sửa lỗi phụ đề 2 lặp tiếng Anh khi gặp HTTP 429:**
  - `translateBatch()` trả về `{ ok: false, translations: [] }` khi gặp lỗi, không bao giờ trả về câu gốc tiếng Anh.
  - Chỉ lưu vào cache dịch khi số lượng bản dịch trả về khớp chính xác với số câu gửi đi.
- **Xử lý mã lỗi HTTP từ DeepL:**
  - Xử lý riêng HTTP 403 (khóa không hợp lệ), 456 (hết hạn mức ký tự tháng Quota Exceeded).
  - Đọc header `Retry-After` khi gặp HTTP 429 và kích hoạt exponential backoff (30s – 60s).

---

## [1.0.2] - 2026-10-09

### 🛠️ Sửa lỗi (Fixed)
- Sửa lỗi `#No Name` khi cài đặt trên Tampermonkey do thẻ đóng metadata sai cú pháp (`// ==/UserScript==`).
- Khắc phục vi phạm Trusted Types CSP của YouTube: loại bỏ toàn bộ việc inject `<script>` và `.innerHTML`, chuyển đổi 100% sang DOM API thuần (`createElement`, `textContent`, `attachShadow`).

---

## [1.0.0] - 2026-10-08

### 🎉 Khởi tạo (Initial Release)
- Bản phát hành ban đầu của Userscript hiển thị phụ đề song ngữ trên YouTube.
- Thuật toán gộp câu ngữ nghĩa (Semantic Chunking) dựa trên khoảng cách thời gian và dấu kết câu.
- Hiển thị phụ đề trên Shadow DOM cách ly với player chính.
