# Changelog

## Google SSO Popup Blocker

## [2.0] - 2026-10-11

### Những điểm đã sửa


| Vấn đề ở bản 1.1                           | Cách xử lý ở bản 2.0                                       |
| ------------------------------------------ | ---------------------------------------------------------- |
| Dừng sau lần chặn đầu tiên                 | Observer duy trì suốt phiên trang                          |
| Observer bị ngắt sau 60 giây               | Không đặt timeout cho observer                             |
| Popup xuất hiện muộn                       | Theo dõi DOM và quét dự phòng định kỳ                      |
| Chỉ tìm phần tử theo ID                    | Kết hợp selector ID và URL iframe Google Identity Services |
| Ghi đè `window.google`                     | Bỏ cách ghi đè API dễ xung đột với website                 |
| Có thể xóa nhầm nút đăng nhập thông thường | Mặc định không chặn `.g_id_signin`                         |
| Không xử lý iframe đổi `src` sau khi tạo   | Theo dõi thay đổi thuộc tính `src`                         |

## Cách kiểm tra

1. Lưu script và tải lại trang có popup.
2. Đặt `debug: true` nếu muốn xem log.
3. Kiểm tra Console để xem phần tử nào bị xóa.
4. Nếu popup vẫn xuất hiện, kiểm tra xem nó có thực sự là Google One Tap hay là một hộp thoại do website tự tạo.

Giới hạn cần lưu ý: CSS và observer có thể chặn những phần tử Google SSO nằm trong DOM của trang. Tuy nhiên, chúng không bảo đảm chặn được mọi cơ chế đăng nhập của Google, chẳng hạn giao diện do trình duyệt quản lý, FedCM hoặc popup nằm ngoài DOM của trang. Bản này cũng chưa được kiểm thử trực tiếp trên mọi website. Nếu bạn cung cấp URL của một website cụ thể nơi popup vẫn xuất hiện (không cần cung cấp tài khoản hay thông tin đăng nhập), có thể xác định selector và cơ chế chặn phù hợp hơn.

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