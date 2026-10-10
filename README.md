# YouTube Dual Subtitles Pro (DeepL Engine)

> **Userscript hiển thị phụ đề song ngữ thông minh, mượt mà trên YouTube với DeepL API.**  
> Tác giả: **narga** — [https://www.narga.net/](https://www.narga.net/)  
> Phiên bản: **v1.2.2**  
> Mã nguồn script: [`userscripts/youtube-dual-subtitles.user.js`](file:///Users/narga/Briefcase/Projects/dual-subtitles/userscripts/youtube-dual-subtitles.user.js)

---

## 🌟 Giới thiệu

**YouTube Dual Subtitles Pro** là giải pháp phụ đề song ngữ thế hệ mới dành cho YouTube, được thiết kế chuyên sâu cho cả người xem phim/giải trí lẫn người học ngoại ngữ. 

Khác biệt với các extension và userscript truyền thống thường dùng Google Translate không chính thức (GTX) hay bị lỗi HTTP 429 (Too Many Requests), script sử dụng **DeepL API chính thức** với chất lượng dịch tự nhiên, mượt mà, cấu trúc mảng JSON nguyên bản không lo vỡ chuỗi và kiến trúc chống spam thông minh.

---

## ✨ Tính năng Nổi bật

### 1. Dịch thuật Đỉnh cao với DeepL API
- **Native JSON Array Batching:** Dịch cùng lúc 6–8 câu phụ đề trong một request dạng mảng chuỗi nguyên bản, loại bỏ hoàn toàn các ký tự sentinel lạ (`⟦§§⟧`), đảm bảo thứ tự câu luôn chính xác 100%.
- **5 Ngôn ngữ đích cốt lõi:**
  - 🇻🇳 **Tiếng Việt (`VI`)** — *Mặc định*
  - 🇬🇧 **English (`EN-US`)**
  - 🇩🇪 **Deutsch (`DE`)**
  - 🇸🇰 **Slovenčina (`SK`)**
  - 🇨🇿 **Čeština (`CS`)**
- **Hỗ trợ cả DeepL Free và Pro:** Tự động nhận diện khóa Free (hậu tố `:fx`) hoặc Pro, cho phép người dùng tùy chọn endpoint (Auto / Free / Pro).

### 2. Tùy biến Hiển thị & Chống Loãng Video
- **Đưa câu gốc lên đỉnh video (Top position):** Tách câu gốc tiếng Anh lên mép trên màn hình, giữ dòng dịch tiếng Việt ở đáy màn hình. Phù hợp khi bạn muốn xem phim/nội dung mà không muốn bị hai dòng phụ đề đè lên nhau gây rối mắt.
- **Tắt phụ đề gốc:** Chế độ xem thuần bản dịch — ẩn hoàn toàn câu gốc tiếng Anh, chỉ hiển thị dòng dịch tiếng Việt.
- **Tăng giảm cỡ chữ:** 4 mức kích thước linh hoạt: `16px` (Nhỏ), `20px` (Chuẩn), `24px` (Lớn), `28px` (Rất lớn).
- **5 Bảng màu phụ đề sắc nét:**
  - 🟡 **Vàng nhạt (`#fef08a`)** — *Mặc định chuẩn cinema*
  - ⚪ **Trắng sáng (`#ffffff`)**
  - 🟢 **Xanh lục nhạt (`#86efac`)**
  - 🔵 **Xanh lơ nhạt (`#93c5fd`)**
  - 🟠 **Cam nhạt (`#fed7aa`)**

### 3. Vị trí Nút Điều khiển Tối ưu (UX Chuẩn Native)
- **Nằm cạnh biểu tượng chuông thông báo kênh:** Nút `[CC²]` được chèn độc lập ngay bên phải nút Đăng ký / Chuông thông báo của kênh (bên ngoài video player).
- **Không xung đột context menu:** Khắc phục triệt để lỗi khi click chuột phải vào nút trong player bị trùng lặp với menu chuột phải mặc định của YouTube.
- **Thao tác 1-chạm:**
  - **Click chuột trái:** Bật / Tắt nhanh phụ đề song ngữ.
  - **Click chuột phải (hoặc icon 3 chấm):** Mở Bảng cài đặt trực quan (Settings Panel) dạng popup kính mờ hiện đại.

### 4. Kiến trúc Bền bỉ & Chống HTTP 429
- **Không đánh dấu prefetch sớm:** Chỉ cập nhật mốc `lastPrefetchedIndex` sau khi request dịch thành công. Nếu gặp lỗi mạng hoặc 429, hệ thống tự động giữ mốc để retry sau khi hết cooldown.
- **An toàn Race Condition:** Khóa cache key tĩnh trước khi dispatch, bảo vệ `finally` không bị crash khi chuyển video giữa chừng.
- **Tuân thủ `Retry-After`:** Tự động đọc header `Retry-After` từ DeepL khi quá tải; áp dụng exponential backoff (30s – 60s) và tạm ẩn dòng dịch để bảo vệ IP người dùng.
- **Bảo toàn Cache:** Tuyệt đối không lưu câu gốc tiếng Anh vào cache dịch khi thất bại.
- **Bộ nhớ đệm FIFO (LRU):** Tự động dọn dẹp theo ngưỡng `maxCacheEntries: 500` câu, tối ưu RAM cho các video dài nhiều giờ.
- **Tương thích 100% Trusted Types:** Hoàn toàn dùng DOM API (`createElement`, `textContent`), không sử dụng `innerHTML` hay `<script>` injection, chạy mượt mà không bị YouTube CSP chặn.

---

## 🚀 Hướng dẫn Cài đặt

1. **Cài đặt tiện ích quản lý Userscript:**
   - [Tampermonkey](https://www.tampermonkey.net/) (Khuyến nghị cho Chrome, Edge, Firefox, Brave).
   - Hoặc [Violentmonkey](https://violentmonkey.github.io/).
2. **Cài đặt Userscript:**
   - Mở Tampermonkey dashboard -> **Utilities** -> **Import from file** hoặc tạo script mới.
   - Sao chép toàn bộ nội dung từ file [`userscripts/youtube-dual-subtitles.user.js`](file:///Users/narga/Briefcase/Projects/dual-subtitles/userscripts/youtube-dual-subtitles.user.js) và dán vào, sau đó nhấn **Save**.

---

## 🔑 Hướng dẫn lấy DeepL API Key (Miễn phí)

DeepL cung cấp gói **DeepL API Free** miễn phí **500,000 ký tự mỗi tháng** (đủ để xem hàng chục giờ video phụ đề mỗi tháng):

1. Truy cập [DeepL API Free Signup](https://www.deepl.com/pro-api).
2. Tạo tài khoản miễn phí.
3. Vào mục **Account** -> **Authentication Key**.
4. Sao chép khóa có dạng: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx:fx`.
5. Mở một video bất kỳ trên YouTube:
   - Click chuột phải vào nút `[CC²]` cạnh chuông thông báo kênh.
   - Nhấn **Nhập Key** và dán khóa API của bạn vào.
   - Khóa được lưu trữ cục bộ trong trình duyệt của bạn thông qua `GM_setValue`.

---

## ⌨️ Phím tắt & Thao tác

| Thao tác | Chức năng |
| :--- | :--- |
| **Click trái vào nút `[CC²]`** | Bật / Tắt tức thì phụ đề song ngữ |
| **Click phải vào nút `[CC²]`** | Mở Bảng Cài đặt (Ngôn ngữ, Vị trí, Font, Màu, API Key) |
| **`Alt + D`** | Phím tắt bật / tắt song ngữ nhanh khi đang xem toàn màn hình (Fullscreen) |

---

## 📂 Cấu trúc Thư mục Dự án

```
dual-subtitles/
├── README.md                                    # Tài liệu hướng dẫn chính
├── CHANGELOG.md                                 # Nhật ký phiên bản chi tiết
├── KE_HOACH_THUC_THI_DUAL_SUBTITLES.md          # Đặc tả kiến trúc kỹ thuật (v2.6)
├── KE_HOACH_PHAT_TRIEN_USERSCRIPT_DUAL_SUBTITLES.md
├── BAO_CAO_TONG_HOP_MA_NGUON.md
└── userscripts/
    └── youtube-dual-subtitles.user.js           # Mã nguồn Userscript chính (v1.2.0)
```

---

## 📄 Bản quyền & Tác giả

- Dự án được phát triển và duy trì bởi **narga**.
- Website cá nhân: [https://www.narga.net/](https://www.narga.net/)
- Mã nguồn mở phục vụ mục đích học tập và trải nghiệm cá nhân.
