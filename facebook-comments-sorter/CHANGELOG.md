# Changelog

### [1.0] - 2024-12-24

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
