# Changelog


## [2.0] - 2026-10-11

- Thay các khoảng chờ cố định bằng cơ chế theo dõi DOM và thử lại có giới hạn.
- Chỉ đánh dấu hoàn tất sau khi xác định được mục tiêu cần chọn.
- Xử lý riêng từng vùng bình luận và dialog, tránh dùng một biến hasRun cho toàn trang.
- Nhận diện nhãn giao diện bằng cách chuẩn hóa văn bản và hỗ trợ nhiều ngôn ngữ hơn.
- Tránh quét toàn bộ trang liên tục khi không cần thiết.
- Giữ tùy chọn mở replies, nhưng mặc định tắt để tránh click nhầm.

### Cấu hình nên dùng

Ở đầu script, chỉnh phần `CONFIG`:

| Mục              | Giá trị    | Ý nghĩa                           |
| ---------------- | ---------- | --------------------------------- |
| `sortPreference` | `'all'`    | Chọn tất cả bình luận             |
| `sortPreference` | `'newest'` | Chọn bình luận mới nhất           |
| `debug`          | `true`     | Ghi nhật ký xử lý trong console   |
| `expandReplies`  | `false`    | Không tự mở replies               |
| `maxAttempts`    | `4`        | Số lần thử tối đa cho mỗi nút     |
| `maxReplies`     | `5`        | Giới hạn số nhóm phản hồi được mở |
| `maxPendingMs`   | `6000`     | Thời gian tối đa chờ xử lý menu   |

### Cách kiểm tra nếu vẫn không hoạt động

1. Lưu script và tải lại trang Facebook.
2. Mở một bài viết có bình luận.
3. Tạm đặt `debug: true`.
4. Mở Developer Tools bằng `F12` hoặc `Cmd + Option + K` trên Firefox, chọn Console.
5. Kiểm tra các thông báo bắt đầu bằng `[FB Sorter]`.

Các thông báo như `Opening sort menu` nhưng không có `Selecting menu item` thường cho biết script đã tìm thấy nút nhưng không nhận diện được mục tiêu trong menu. Khi đó, cần bổ sung nhãn hoặc điều chỉnh selector dựa trên HTML thực tế của Facebook.


## [1.0] - 2024-12-24

### Thêm mới
- Tự động sắp xếp comment Facebook sang "All Comments" hoặc "Newest"
- Hỗ trợ cấu hình trong code: chọn sort preference, bật/tắt debug logs
- Tùy chọn tự động mở/expand replies (mặc định: tắt)
- Hỗ trợ đa ngôn ngữ: tiếng Anh, tiếng Việt, và các ngôn ngữ khác
- Script hoạt động khi mở post qua link timestamp (ngày tháng)

### Lưu ý
- Hiện tại script **chỉ hoạt động** khi bấm vào link ngày tháng của post
- Không hoạt động khi bấm nút "Comment" hoặc link số lượng comments

### Cấu hình
```javascript
const CONFIG = {
    sortPreference: "all",      // "newest" hoặc "all"
    debug: false,               // true = bật logs, false = tắt
    expandReplies: false        // true = tự động mở replies
};
```
