# Changelog

## Google SSO Popup Blocker

## [1.1] - 2024-12-24

#### Tối ưu hóa
- **FIX Memory Leak**: Thêm auto-cleanup cho MutationObserver và setInterval
- **FIX Performance**: WeakSet tracking để tránh xử lý element 2 lần
- **Giảm scope**: Exclude localhost, private IPs, github.com, gitlab.com
- **Auto-stop**: Tự động dừng sau khi block thành công hoặc timeout 60s
- **Code cleanup**: Loại bỏ createElement override không cần thiết
- Tăng observerTimeout: 30s → 60s
- Tăng maxChecks: 10 → 20 checks

#### Cấu hình
```javascript
const CONFIG = {
    debug: false,              // Bật/tắt debug logs
    autoStop: true,            // Tự động dừng
    observerTimeout: 60000,    // 60s
    checkInterval: 3000,       // 3s
    maxChecks: 20              // 20 lần
};
```

---