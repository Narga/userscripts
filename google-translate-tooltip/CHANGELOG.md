# Changelog

## Google Translate Tooltip

## [1.2.0] - 2026-10-11

### Tính năng Mới & Nâng cấp Phát âm - Phiên âm (TTS & IPA Upgrade)
- **Hỗ trợ Đọc Chậm (Slow Speech Playback)**:
  - **Bấm lần 2 để đọc chậm**: Khi bấm nút loa phát âm 🔊 lần thứ 2 liên tiếp (trong vòng 4.5 giây), script tự động chuyển sang tốc độ đọc chậm (0.5x) với hiệu ứng animation đổi màu vàng cam trực quan.
  - **Biểu tượng đọc chậm riêng biệt**: Thêm nút biểu tượng 🐢 ngay cạnh nút loa chính ở tất cả các dòng (từ gốc và từng bản dịch), cho phép bấm 1 chạm để nghe đọc chậm tức thì.
- **Tùy chọn Nguồn Phát âm Google Translate TTS chuẩn**:
  - Mặc định sử dụng công cụ phát âm chính thức của **Google Translate** (`client=tw-ob`) mang lại giọng đọc bản xứ tự nhiên, phát âm chuẩn xác vượt trội so với giọng mặc định của trình duyệt/hệ thống.
  - Tích hợp cơ chế tự động chuyển đổi Blob Audio qua `GM_xmlhttpRequest`, đảm bảo phát âm mượt mà trên mọi trang web có chính sách bảo mật CSP khắt khe.
  - Bổ sung tùy chọn trong bảng Cài đặt: cho phép linh hoạt chuyển đổi giữa **Google Translate** và **Hệ thống / Trình duyệt**.
- **Chuyển sang Nguồn Ký âm IPA Datamuse API siêu tốc**:
  - Thay thế hoàn toàn API cũ (`dictionaryapi.dev` thường xuyên bị treo mạng).
  - Tích hợp **Datamuse API** (Đại học Carnegie Mellon) hoàn toàn miễn phí, phản hồi siêu tốc (< 100ms) và ổn định 100%.
  - Hỗ trợ ký âm IPA chuẩn quốc tế cho cả từ đơn lẫn cụm từ (ví dụ: `hello`, `thank you`, `how are you`).

---

## [1.1.1] - 2026-10-11

### Sửa lỗi & Tối ưu Trải nghiệm (Bug Fixes & Speed Optimization)
- **Khắc phục triệt để lỗi treo loading / chậm khi tra từ**:
  - Không còn bị nghẽn bởi Dictionary API bên ngoài; chuyển sang mô hình **hiển thị tức thời (Non-blocking Progressive Enhancement)**.
  - Phản hồi bản dịch và chi tiết từ điển trả về siêu tốc (< 200ms) như bản cũ.
  - Thêm timeout an toàn: 5.000ms cho Google API và 2.500ms cho Dictionary API (không bao giờ treo vô hạn).
- **Mở rộng nút phát âm (TTS) cho toàn bộ ngôn ngữ**:
  - Bổ sung nút phát âm 🔊 cho **từ gốc** (nghe giọng đọc bản xứ của câu gốc).
  - Bổ sung nút phát âm 🔊 riêng biệt cho **từng bản dịch đích** (bản dịch chính, ngôn ngữ phụ 1 và ngôn ngữ phụ 2) để đọc và học theo đa ngôn ngữ.
  - Hỗ trợ giọng đọc chuẩn kết hợp Web Speech API và fallback Google TTS Audio (`client=tw-ob`).
- **Chuẩn hóa URL cập nhật**:
  - Thiết lập `@downloadURL` và `@updateURL` trỏ trực tiếp đến `https://raw.githubusercontent.com/...` (chuẩn GitHub raw, không bị chuyển hướng 302).

---

## [1.1.0] - 2026-10-11

### Tính năng Mới & Khôi phục Tính năng Hữu ích
- **Khôi phục "Ẩn chi tiết mặc định" (`hideDetailsDefault`)**:
  - Tùy chọn ẩn hoặc hiện khối từ điển chi tiết lúc mở popup.
  - Có nút bấm **"▼ Xem chi tiết từ điển"** / **"▲ Ẩn chi tiết"** linh hoạt, tiết kiệm không gian màn hình khi chỉ cần xem bản dịch nhanh.
- **Khôi phục "Bản dịch thay thế" (`showAlternatives`)**:
  - Trích xuất và hiển thị danh sách các cách dịch thay thế (`dt=at`) của từ/cụm từ.
- **Khôi phục "Từ đồng nghĩa trong định nghĩa" (`showSynonyms`)**:
  - Bóc tách cấu trúc `dt=ss` (synonyms) liên kết với từng nhóm định nghĩa `dt=md`, hiển thị danh sách từ đồng nghĩa trực quan ngay dưới từng nghĩa.
- **Tính năng Mới: Hiển thị Kí âm / Phiên âm (IPA / Phonetics Subline)**:
  - Tự động hiển thị một dòng phụ cỡ chữ nhỏ (`gtt-ipa-subline`) ở dưới từ gốc và các ngôn ngữ đích tương ứng.
  - **Nguồn ký âm kết hợp thông minh**:
    - Tự động lấy phiên âm Latinh / Pinyin / Romaji trực tiếp từ Google API (`dt=rm`).
    - Kết nối với Free Dictionary API (`api.dictionaryapi.dev`) để lấy chuẩn ký âm quốc tế IPA (International Phonetic Alphabet, ví dụ: `/həˈloʊ/`) cho từ tiếng Anh.
  - **Tùy biến ngưỡng số từ**:
    - Tùy chọn bật/tắt ký âm (`enableIpa`).
    - Tùy chọn giới hạn độ dài câu (`ipaWordLimit`, mặc định: dưới 5 từ) để chỉ ký âm cho từ đơn hoặc cụm từ ngắn, tránh làm rối mắt khi dịch đoạn văn dài.

---

## [1.0.0] - 2026-10-11

### Viết mới hoàn toàn (Clean Architecture)
- Đổi tên file chuẩn userscript: `google-translate-tooltip.user.js`.
- Sử dụng Google Translate API `client=gtx` trực tiếp không cần token cũ.
- Tích hợp phát âm TTS qua Web Speech API.
- Giao diện thẻ nổi bo tròn, hỗ trợ kéo thả vị trí, Light & Dark mode, dịch đa ngôn ngữ song song.
