# Changelog

## Facebook Anti-Refresh

## [2.1] - 2026-10-11

### Tối ưu hóa & Chặn thận trọng (Fail-Open)
- **So khớp chính xác operation name**: Thay thế `includes()` bằng `Set.has()` đối chiếu chính xác tên GraphQL operation, tránh chặn nhầm các truy vấn con hoặc mutation khác.
- **Không nhầm lẫn `doc_id`**: Chỉ trích xuất từ các trường định danh tên operation (`fb_api_req_friendly_name`, `operationName`, hoặc regex từ `query`), không coi `doc_id` là tên operation.
- **Cập nhật thời gian hoạt động tức thì**: Bỏ timer debounce 500 ms; ghi nhận `lastActivity` ngay khi có tương tác người dùng (`pointerdown`, `keydown`, `scroll`, `input`, `focus`). Riêng `pointermove` được kiểm soát theo ngưỡng 250 ms.
- **Hỗ trợ Fetch với đối tượng `Request`**: Tự động clone và trích xuất text bất đồng bộ khi payload nằm trong đối tượng `Request`.
- **Tắt can thiệp XHR mặc định (`interceptXHR: false`)**: Tránh giả lập `onabort` thiếu chuẩn xác; nếu bật XHR thì sử dụng phương thức `abort()` gốc của trình duyệt.
- **Nguyên tắc Fail-Open**: Các request không rõ tên operation hoặc dùng body dạng Stream/Blob sẽ luôn được phép đi qua bình thường.

### Cấu hình (`CONFIG`)

| Mục | Giá trị mặc định | Ý nghĩa |
| --- | --- | --- |
| `enabled` | `true` | Bật/tắt userscript |
| `inactivityThreshold` | `90000` (90s) | Ngưỡng thời gian không tương tác trước khi chặn |
| `debug` | `false` | Bật/tắt thông báo log trong console |
| `interceptXHR` | `false` | Mặc định tắt can thiệp XHR để đảm bảo độ tin cậy |
| `blockedOperations` | Mảng 7 operations | Danh sách tên operation chính xác cần chặn khi inactive |

---

## [2.0] - 2026-10-11

### Cải tiến ban đầu
- Hỗ trợ bóc tách tên operation từ `application/x-www-form-urlencoded` và `FormData`.
- Thử nghiệm chặn GraphQL Feed khi không có tương tác người dùng.
- Loại bỏ MutationObserver quét `<meta refresh>` dư thừa.
