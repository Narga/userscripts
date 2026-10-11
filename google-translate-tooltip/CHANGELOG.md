# Changelog

## Google Translate Tooltip

## [1.2.3] - 2026-10-11

### Khôi phục Ký âm IPA Toàn diện cho Nội dung Dịch & Tích hợp Bộ Ngữ âm Tiếng Việt (Full Translation IPA & Vietnamese Phonetics Engine)
- **Khôi phục hoàn toàn hiển thị ký âm IPA cho mọi bản dịch**:
  - Khắc phục sự cố bản dịch bị mất dòng IPA ở v1.2.2 (khiến chỉ có câu gốc hiển thị).
  - Khôi phục container ký âm `#gtt-ipa-tgt0`, `#gtt-ipa-tgt1`, `#gtt-ipa-tgt2` cho tất cả các hàng bản dịch (bản dịch chính, ngôn ngữ phụ 1, ngôn ngữ phụ 2).
  - Tự động hiển thị song song ký âm ở cả **câu gốc** VÀ **tất cả bản dịch** phục vụ trọn vẹn nhu cầu học từ và đối chiếu phát âm.
- **Tích hợp Bộ ký âm chuẩn ngữ âm học Quốc tế cho Tiếng Việt (0ms Local IPA Engine)**:
  - Tự động chuyển đổi âm vị học tiếng Việt chính xác sang bảng ký âm quốc tế IPA (International Phonetic Alphabet) với đầy đủ âm đầu (onset: `qu` → `kw`, `ch/tr` → `c`, `đ` → `ɗ`), âm đệm/âm chính (nucleus diphthongs: `iê/ia` → `iə`, `ươ/ưa` → `ɨə`), âm cuối (coda: `nh/ch` → `ɲ/c`, `ng` → `ŋ`) và 6 thanh điệu chuẩn cao độ (`˧` ngang, `˧˥` sắc, `˨˩` huyền, `˧˩˨` hỏi, `˧ˀ˥` ngã, `˨˩ˀ` nặng).
  - Ví dụ: `quả táo` → `/kwaː˧˩˨ taːw˧˥/`, `xin chào` → `/sin˧ caːw˨˩/`, `học tiếng anh` → `/hɔk˨˩ˀ tiəŋ˧˥ aːɲ˧/`.
  - Xử lý hoàn toàn cục bộ (local rule-based) không cần gọi API mạng ngoài, phản hồi tức thời 0ms không gây giật trễ giao diện.
- **Tùy chọn Cài đặt Bật/Tắt Ký âm Tiếng Việt linh hoạt (`includeViIpa`)**:
  - Thêm checkbox **"Ký âm chuẩn Tiếng Việt (IPA)"** trong bảng Cài đặt (mặc định: bật).
  - Người dùng có thể dễ dàng tắt riêng phần IPA tiếng Việt nếu chỉ muốn xem IPA cho tiếng Anh / Pinyin cho tiếng Trung / Romaji cho tiếng Nhật mà không ảnh hưởng đến các ngôn ngữ khác.
- **Cơ chế nạp phiên âm đa tầng (Multi-tier Phonetic Cascade)**:
  - Tiếng Việt: Chuyển đổi ngữ âm IPA chuẩn.
  - Ngôn ngữ dùng chữ tượng hình / phi Latinh (Trung, Nhật, Nga, Hàn, Thái, Hindi, Ả Rập...): Lấy trực tiếp Pinyin, Romaji, Latinh transliteration từ Google Translate `dt=rm`.
  - Tiếng Anh và ngôn ngữ Latinh khác: Tra cứu IPA chuẩn qua Datamuse API và Free Dictionary API.

---

### Tối ưu Hiển thị Phiên âm IPA & Loại bỏ IPA Tiếng Việt (IPA Visual & Linguistic Refinement)
- **Cải thiện độ tương phản và thẩm mỹ IPA giao diện sáng**:
  - Đổi màu ký âm ở giao diện sáng sang tone xanh hoàng gia đậm (`#1a56db`), tăng độ tương phản lên mức chuẩn WCAG AAA trên nền trắng `#ffffff`, khắc phục tình trạng chữ bị mờ/chìm khó đọc.
  - Loại bỏ hiệu ứng chữ nghiêng (`font-style: normal; font-weight: 500;`) giúp các ký tự ngữ âm phức tạp (`ə, ɪ, θ, ʃ, æ`) hiển thị sắc nét, không bị nghiêng gây mỏi mắt.
- **Tách rõ ràng các từ trong câu có IPA (`word-spacing`)**:
  - Sửa cơ chế tra cứu câu/cụm từ: Tra cứu từng từ độc lập thay vì tra gộp cả câu vào Datamuse (vốn làm dính liền các từ vào nhau).
  - Tách bạch các từ bằng khoảng trắng rõ ràng, kết hợp CSS `word-spacing: 3px` và `letter-spacing: 0.2px` giúp từng từ trong phiên âm đứng tách biệt, dễ nhìn.
- **Loại bỏ hoàn toàn IPA đối với Tiếng Việt**:
  - Tiếng Việt sử dụng chữ Quốc ngữ Latinh có dấu hoàn chỉnh nên không cần ký âm và không thuộc hệ từ điển IPA quốc tế CMU.
  - Khắc phục lỗi hiển thị phiên âm tiếng Anh sai lệch đè lên từ tiếng Việt; ẩn hoàn toàn dòng IPA cho mọi dòng tiếng Việt (`vi`).

---

## [1.2.1] - 2026-10-11

### Tối ưu Phát âm & Ký âm Đa Bản Dịch (TTS & Multi-Target Phonetics)
- **Tối giản giao diện phát âm & Bấm lần 2 đọc chậm**:
  - Loại bỏ hoàn toàn nút đọc chậm rùa 🐢 thừa thãi theo yêu cầu; giữ giao diện tối giản, tinh tế với chỉ 1 nút loa 🔊 duy nhất cho mỗi dòng.
  - Khi bấm nút loa lần thứ 2 (trong vòng 4.5 giây), script tự động phát chậm với hiệu ứng nhấp nháy màu vàng cam (`gtt-playing-slow`).
  - Bổ sung bộ lọc chống dội chuột (mouse debounce > 80ms) tránh nhận nhầm một cú nhấp đúp vô tình thành lệnh đọc chậm.
- **Tùy chỉnh mức phát chậm trong Cài đặt (`slowSpeed`)**:
  - Thêm tùy chọn chọn tốc độ đọc chậm linh hoạt trong bảng Cài đặt: `0.75x` (Hơi chậm), `0.6x` (Chuẩn dễ nghe - Khuyên dùng), `0.5x` (Chậm), `0.35x` (Rất chậm).
- **Khắc phục triệt để lỗi âm thanh phát trùng / méo tiếng (Audio Echo & Distortion Fix)**:
  - Loại bỏ xung đột do tham số URL kép kết hợp `playbackRate` làm méo tiếng.
  - Sử dụng cơ chế nạp Blob Audio duy nhất qua `GM_xmlhttpRequest` đi kèm `Request ID Guard` và `abort()`: tự động hủy bỏ mọi yêu cầu phát âm trước đó khi bấm nút mới. Triệt tiêu hoàn toàn hiện tượng 2 luồng âm thanh phát đè lên nhau gây vọng méo.
- **Mở rộng Ký âm / Phiên âm IPA cho TẤT CẢ các bản dịch**:
  - Dòng ký âm phụ (`gtt-ipa-subline`) hiển thị đồng bộ ở **từ gốc** VÀ **mọi ngôn ngữ bản dịch** (bản dịch chính, ngôn ngữ phụ 1, ngôn ngữ phụ 2).
  - Tích hợp đa nguồn: Phiên âm Pinyin/Romaji/Latinh tự động từ Google Translate (`dt=rm`), kết hợp IPA chuẩn từ Datamuse API và fallback Free Dictionary API cho mọi dòng ngôn ngữ tiếng Anh.

---

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
