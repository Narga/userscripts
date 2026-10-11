# Changelog

## Google Translate Tooltip

## [1.0.0] - 2026-10-11

### Viết mới hoàn toàn (Clean Architecture)
- **Đổi tên file chuẩn**: Đổi thành `google-translate-tooltip.user.js` tương thích hoàn toàn với trình quản lý Tampermonkey, Violentmonkey.
- **Engine dịch Google API mới (`client=gtx`)**:
  - Loại bỏ hoàn toàn thuật toán tính token `googleTK()` cũ kỹ và không ổn định.
  - Sử dụng API Google Translate endpoint `gtx` trực tiếp, gửi request qua `GM_xmlhttpRequest` an toàn, dịch tức thì không lo lỗi mã token hay hết hạn.
- **Loại bỏ 100% mã rác và bloat**:
  - Cắt giảm dung lượng từ **61 KB (hơn 1000 dòng)** xuống chỉ còn **~17 KB (dưới 450 dòng)**.
  - Xóa chuỗi base64 GIF khổng lồ và toàn bộ CSS ColorPicker cũ thời 2012.
  - Xóa bỏ việc bóp méo ký tự (`replace & -> æ, + -> ➕`) gây sai nghĩa câu dịch.
- **Hỗ trợ phát âm Text-to-Speech (TTS) an toàn**:
  - Tích hợp chuẩn Web Speech API (`speechSynthesis`) hiện đại của trình duyệt kèm fallback HTMLAudioElement, loại bỏ tình trạng rò rỉ bộ nhớ `AudioContext`.
- **Giao diện hiện đại (Modern UI)**:
  - Thiết kế tooltip dạng thẻ nổi cao cấp (glass-like card shadow, bo tròn góc, typography sắc nét).
  - Hỗ trợ cả **Chế độ Sáng (Light)** và **Chế độ Tối (Dark)**.
  - Hỗ trợ hiển thị dịch đa ngôn ngữ (tối đa 3 ngôn ngữ đích song song).
  - Có phần xem chi tiết từ điển (từ loại, từ đồng nghĩa).
  - Tích hợp bảng cài đặt nhanh (Settings modal) ngay trên tooltip và tính năng kéo thả (drag & drop) di chuyển vị trí.
