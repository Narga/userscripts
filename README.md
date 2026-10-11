# Userscripts Collection

Bộ sưu tập userscripts giúp tối ưu hóa và cải thiện trải nghiệm duyệt web hàng ngày (YouTube, Facebook, chặn quảng cáo/popup,...).

## 📑 Danh sách Scripts

1. [YouTube Dual Subtitles Pro](#1-youtube-dual-subtitles-pro) (`youtube-dual-subtitles`) - Phụ đề song ngữ YouTube thông minh với DeepL API.
2. [Google SSO Popup Blocker](#2-google-sso-popup-blocker) (`anti-google-sso-login`) - Tự động chặn các popup / iframe Google One Tap gây phiền phức.
3. [Facebook Comment Sorter](#3-facebook-comment-sorter) (`facebook-comments-sorter`) - Tự động chuyển thứ tự bình luận Facebook sang "Tất cả bình luận" hoặc "Mới nhất".
4. [Google Translate Tooltip](#4-google-translate-tooltip) (`google-translate-tooltip`) - Tra từ và hiển thị tooltip dịch nhanh kèm phát âm khi bôi đen văn bản.

---


## 1. YouTube Dual Subtitles Pro

Userscript hiển thị phụ đề song ngữ mượt mà trên YouTube, sử dụng trực tiếp DeepL API chất lượng cao thay vì Google Translate không ổn định.

- **Thư mục:** [`youtube-dual-subtitles/`](youtube-dual-subtitles/)
- **Script cài đặt:** [`youtube-dual-subtitles.user.js`](youtube-dual-subtitles/youtube-dual-subtitles.user.js)
- **Tài liệu chi tiết:** [Xem README riêng](youtube-dual-subtitles/README.md)
- **Lịch sử thay đổi:** [Xem CHANGELOG](youtube-dual-subtitles/CHANGELOG.md)

### Tính năng chính
- ✅ Hỗ trợ DeepL API (cả Free key `:fx` và Pro key).
- ✅ Batching JSON mảng gốc, không lo lệch câu hoặc lỗi HTTP 429.
- ✅ Tùy biến vị trí phụ đề gốc (lên đỉnh video hoặc ẩn hẳn), chỉnh cỡ chữ, 5 bảng màu cinema.
- ✅ Nút điều khiển `[CC²]` native nằm cạnh nút Subscribe/Bell không xung đột player context menu.
- ✅ Hỗ trợ xuất file phụ đề `.srt` song ngữ.

---

## 2. Google SSO Popup Blocker

Tự động chặn popup đăng nhập Google One Tap (Google Identity Services) xuất hiện trên các website bên thứ ba.

- **Thư mục:** [`anti-google-sso-login/`](anti-google-sso-login/)
- **Script cài đặt:** [`anti-google-sso-login.user.js`](anti-google-sso-login/anti-google-sso-login.user.js)
- **Lịch sử thay đổi:** [Xem CHANGELOG](anti-google-sso-login/CHANGELOG.md)

### Tính năng chính (v2.0)
- ✅ Chặn triệt để popup One Tap và iframe Google Identity Services.
- ✅ Duy trì MutationObserver suốt phiên trang kèm cơ chế quét dự phòng định kỳ.
- ✅ Tự động bỏ qua localhost, private IP và các domain an toàn (`github.com`, `gitlab.com`).
- ✅ Không ghi đè API `window.google`, tránh gây lỗi hoặc xung đột chức năng website.
- ✅ Bảo toàn các nút đăng nhập tiêu chuẩn (không chặn nhầm `.g_id_signin`).

### Cấu hình nhanh
```javascript
const CONFIG = {
    debug: false,              // true = hiển thị log trong DevTools Console
    removeStandardButton: false // true nếu muốn ẩn cả nút đăng nhập Google thông thường
};
```

---

## 3. Facebook Comment Sorter

Tự động tìm và chuyển bộ lọc bình luận Facebook sang **"Tất cả bình luận" (All Comments)** hoặc **"Mới nhất" (Newest)** khi mở bài viết hoặc hộp thoại bình luận.

- **Thư mục:** [`facebook-comments-sorter/`](facebook-comments-sorter/)
- **Script cài đặt:** [`fb-comments-sorter.user.js`](facebook-comments-sorter/fb-comments-sorter.user.js)
- **Lịch sử thay đổi:** [Xem CHANGELOG](facebook-comments-sorter/CHANGELOG.md)

### Tính năng chính (v2.0)
- ✅ Tự động nhận diện và click menu sắp xếp bình luận khi cuộn feed, mở permalink hoặc mở popup modal.
- ✅ Xử lý độc lập theo từng vùng bình luận/dialog, không bị kẹt cờ trạng thái toàn trang.
- ✅ Chuẩn hóa văn bản và hỗ trợ nhận diện đa ngôn ngữ (Tiếng Việt, Tiếng Anh,...).
- ✅ Giới hạn số lần thử lại (`maxAttempts`) và quét theo sự kiện DOM, tránh lag trang.
- ✅ Hỗ trợ tùy chọn tự động mở rộng phản hồi (expand replies).

### Cấu hình nhanh
```javascript
const CONFIG = {
    sortPreference: 'all',    // 'all' (Tất cả bình luận) hoặc 'newest' (Mới nhất)
    debug: false,             // Bật log kiểm tra trong console
    expandReplies: false,     // Tự động mở các nhóm phản hồi bị ẩn
    maxAttempts: 4            // Số lần thử tối đa cho mỗi nút
};
```

---

## 4. Google Translate Tooltip

Hiển thị tooltip dịch tức thì kèm phát âm (Text-to-Speech) và định nghĩa từ điển khi bôi đen văn bản trên bất kỳ trang web nào.

- **Thư mục:** [`google-translate-tooltip/`](google-translate-tooltip/)
- **Script cài đặt:** [`google-translate-tooltip.user.js`](google-translate-tooltip/google-translate-tooltip.user.js)
- **Lịch sử thay đổi:** [Xem CHANGELOG](google-translate-tooltip/CHANGELOG.md)

### Tính năng chính (v1.0.0)
- ✅ Bôi đen văn bản hiện icon Google Translate nhỏ gọn, bấm hoặc hover để hiển thị bản dịch.
- ✅ Sử dụng Google Translate API (`client=gtx`) trực tiếp, không phụ thuộc token cũ, không lo lỗi kết nối.
- ✅ Tích hợp phát âm (TTS) mượt mà qua Web Speech API / Google Audio.
- ✅ Hỗ trợ dịch song song tối đa 3 ngôn ngữ đích cùng lúc.
- ✅ Xem chi tiết từ điển (từ loại, từ đồng nghĩa) cho các từ đơn.
- ✅ Giao diện thẻ nổi hiện đại, hỗ trợ cả Light Mode và Dark Mode, hỗ trợ kéo thả vị trí (drag & drop).
- ✅ Tùy chọn phím bổ trợ: Chỉ kích hoạt khi giữ phím `Ctrl` hoặc `Alt`.

---

## 🚀 Hướng dẫn Cài đặt Chung


1. Cài đặt tiện ích mở rộng quản lý userscript trên trình duyệt:
   - [Tampermonkey](https://www.tampermonkey.net/) (Khuyến nghị cho Chrome, Firefox, Edge, Safari)
   - [Violentmonkey](https://violentmonkey.github.io/) (Mã nguồn mở, nhẹ)
2. Bấm vào đường dẫn file `.user.js` tương ứng ở trên để cài đặt.
3. Tải lại trang web mục tiêu để userscript bắt đầu hoạt động.

---

## 📄 Bản quyền & Tác giả

- **Tác giả:** [narga](https://github.com/narga)
- **Giấy phép:** [MIT](LICENSE)
