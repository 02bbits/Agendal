# Note engine — danh sách test tay

Lần kiểm tra: **02/11/2026**. **67/67 ca khớp kỳ vọng**, gửi qua HTTP của Try notes sau khi sửa lỗi danh sách ngày/thứ tự trong tháng và nhận biết `biweekly` chưa rõ nghĩa.

## Cách chạy lại

Từ `backend/`, chạy `php -S localhost:8091 tests/Manual/try.php`, rồi mở <http://localhost:8091/>.

- Written at: **2026-11-02T12:51** (thứ Hai).
- Time zone: **Asia/Ho_Chi_Minh**; Week starts: **Monday**.
- Mỗi hàng là một lần gửi riêng. Trang này chạy rules và không ghi cơ sở dữ liệu.
- Giữ danh sách Existing tasks dưới đây cho các ca lệnh. Các ca tạo việc mới có thể hiện gợi ý trùng với việc đang mở; việc vẫn được tạo theo NU-E13.

```text
task: Call mum
task: Old list
task: Report | 2026-11-05 | 09:00
task: Gym | 2026-11-05 | 17:00
done: Pay rent
```

## Quy tắc đọc kết quả

- Một ngày được chọn sẽ được bỏ khỏi tiêu đề. Theo [NU-E6](../../../docs/03-modules/NU-note-understanding.md#nu-e6), nếu một việc có nhiều ngày, ngày không được chọn vẫn nằm trong tiêu đề. Không xóa hàng loạt từ `today`, `tomorrow` hoặc tên thứ khỏi mọi nội dung.
- Tên dự án, URL và tên file là nội dung được giữ nguyên. `tomorrow.md` khác với từ `tomorrow` dùng làm ngày.
- Với đồng hồ trên, `Monday` không kèm `this` là **09/11**; `this Monday` là **02/11**. Khi có nhiều ngày, ngày sau `by/due/on/before` ưu tiên; nếu không thì chọn ngày xa hơn.
- `3 times every day` tạo 3 chuỗi riêng; `every day for 3 occurrences` tạo 1 chuỗi có 3 lần. Từ 5 thay đổi trở lên cần `confirm`.
- `low confidence` có nghĩa rules chưa xác nhận được lịch; trang thử này không gọi LLM. Câu đó phải giữ nguyên thay vì tự áp dụng một phần lịch.
- Chuỗi mô tả lịch/ngày có thể khác theo định dạng hiển thị; đối chiếu ngày, thứ, số lần và tần suất, không chỉ cách viết ngày.

## Ngày và tiêu đề

| ID | Câu nhập | Kết quả mong đợi | HTTP |
|---|---|---|---|
| M-01 | `call mum today` | `Call mum` — 2026-11-02 | PASS |
| M-02 | `today call mum` | `Call mum` — 2026-11-02 | PASS |
| M-03 | `call mum tomorrow` | `Call mum` — 2026-11-03 | PASS |
| M-04 | `tomorrow call mum` | `Call mum` — 2026-11-03 | PASS |
| M-05 | `CALL MUM TOMORROW` | `CALL MUM` — 2026-11-03 | PASS |
| M-06 | `call mum on Friday` | `Call mum` — 2026-11-06 | PASS |
| M-07 | `Friday call mum` | `Call mum` — 2026-11-06 | PASS |
| M-08 | `call mum Monday` | `Call mum` — 2026-11-09 | PASS |
| M-09 | `call mum this Monday` | `Call mum` — 2026-11-02 | PASS |
| M-10 | `call mum next Monday` | `Call mum` — 2026-11-09 | PASS |
| M-11 | `gọi mẹ hôm nay` | `Gọi mẹ` — 2026-11-02 | PASS |
| M-12 | `ngày mai gọi mẹ` | `Gọi mẹ` — 2026-11-03 | PASS |
| M-13 | `đi ăn gia đình ngày thứ 7 8h sáng` | `Đi ăn gia đình` — 2026-11-07 | PASS |
| M-14 | `call mum on 15/11/2026` | `Call mum` — 2026-11-15 | PASS |
| M-15 | `call mum November 15` | `Call mum` — 2026-11-15 | PASS |
| M-16 | `read report tomorrow.md today` | `Read report tomorrow.md` — 2026-11-02 | PASS |
| M-17 | `read Tomorrowland today` | `Read Tomorrowland` — 2026-11-02 | PASS |
| M-57 | `call mum tomorrow morning` | `Call mum` — 2026-11-03 09:00 | PASS |
| M-58 | `read https://example.com/tomorrow today` | `Read https://example.com/tomorrow` — 2026-11-02 | PASS |

## Hai ngày trong cùng một việc — NU-E6

| ID | Câu nhập | Kết quả mong đợi | HTTP |
|---|---|---|---|
| M-18 | `call mum today tomorrow` | `Call mum today` — 2026-11-03 | PASS |
| M-19 | `study Monday for quiz Friday` | `Study for quiz Friday` — 2026-11-09 | PASS |
| M-20 | `call mum Tuesday by Friday` | `Call mum Tuesday` — 2026-11-06 | PASS |
| M-21 | `gọi mẹ hôm nay ngày mai` | `Gọi mẹ hôm nay` — 2026-11-03 | PASS |

## Giờ và chuyển ngày

| ID | Câu nhập | Kết quả mong đợi | HTTP |
|---|---|---|---|
| M-22 | `call mum today at 9am` | `Call mum` — 2026-11-02 09:00 | PASS |
| M-23 | `call mum tomorrow at 9am` | `Call mum` — 2026-11-03 09:00 | PASS |
| M-24 | `call mum at 9am` | `Call mum` — 2026-11-03 09:00 | PASS |
| M-25 | `call mum at 2` | `Call mum` — 2026-11-02 14:00 | PASS |
| M-26 | `call mum in 2 hours` | `Call mum` — 2026-11-02 14:51 | PASS |
| M-27 | `gọi mẹ lúc 8 giờ tối mai` | `Gọi mẹ` — 2026-11-03 20:00 | PASS |
| M-28 | `call mum Friday 9am-10am` | `Call mum` — 2026-11-06 09:00–10:00 | PASS |

## Lịch lặp

| ID | Câu nhập | Kết quả mong đợi | HTTP |
|---|---|---|---|
| M-29 | `gym every Monday, Wednesday and Friday` | `Gym` — 2026-11-02<br>weekly on Monday, Wednesday and Friday | PASS |
| M-30 | `gym 2, 4, 6 hàng tuần` | `Gym` — 2026-11-02<br>weekly on Monday, Wednesday and Friday | PASS |
| M-31 | `gym mỗi tuần 2, 3, 5` | `Gym` — 2026-11-02<br>weekly on Monday, Tuesday and Thursday | PASS |
| M-32 | `gym every other Monday, Wednesday` | `Gym` — 2026-11-02<br>every other week | PASS |
| M-33 | `gym every Monday, Wednesday until Friday` | `Gym` — 2026-11-02<br>until 11/6/26 | PASS |
| M-34 | `gym every month on day 1, 15, 25` | `Gym` — 2026-11-15<br>monthly on the 1st, the 15th and the 25th | PASS |
| M-35 | `gym every first Monday, last Friday of month` | `Gym` — 2026-11-02<br>monthly on the first Monday and the last Friday | PASS |
| M-36 | `gym mỗi ngày` | `Gym` — 2026-11-02<br>daily | PASS |
| M-37 | `gym every 3 days` | `Gym` — 2026-11-02<br>every 3 days | PASS |
| M-38 | `gym every year on February 29` | `Gym` — 2028-02-29<br>yearly | PASS |
| M-60 | `gym every month on 1st, 15th and 25th` | `Gym` — 2026-11-15<br>monthly on the 1st, the 15th and the 25th | PASS |
| M-61 | `gym monthly on 31st` | `Gym` — 2026-12-31<br>monthly | PASS |
| M-66 | `gym every month on first and third Monday` | `Gym` — 2026-11-02<br>monthly on the first Monday and the third Monday | PASS |
| M-67 | `gym every month on first, third and last Monday` | `Gym` — 2026-11-02<br>monthly on the first Monday, the third Monday and the last Monday | PASS |

## Số việc và số lần lặp

| ID | Câu nhập | Kết quả mong đợi | HTTP |
|---|---|---|---|
| M-39 | `visit house 3 times every day` | `Visit house (1/3)` — 2026-11-02<br>`Visit house (2/3)` — 2026-11-02<br>`Visit house (3/3)` — 2026-11-02 | PASS |
| M-40 | `visit house twice per day` | `Visit house (1/2)` — 2026-11-02<br>`Visit house (2/2)` — 2026-11-02 | PASS |
| M-41 | `gym every day for 3 occurrences` | `Gym` — 2026-11-02<br>3 times | PASS |
| M-42 | `gym 3 times every day for 2 occurrences` | `Gym (1/3)` — 2026-11-02<br>`Gym (2/3)` — 2026-11-02<br>`Gym (3/3)` — 2026-11-02<br>2 times | PASS |
| M-62 | `gym 6 times every day` | `Gym (1/6)` — 2026-11-02<br>`Gym (2/6)` — 2026-11-02<br>`Gym (3/6)` — 2026-11-02<br>`Gym (4/6)` — 2026-11-02<br>`Gym (5/6)` — 2026-11-02<br>`Gym (6/6)` — 2026-11-02<br>status: confirm | PASS |

## Câu chưa đủ rõ hoặc lịch không hợp lệ

| ID | Câu nhập | Kết quả mong đợi | HTTP |
|---|---|---|---|
| M-43 | `gym every day at 8am, 5pm` | Giữ nguyên nội dung; không gán ngày/lịch; low confidence | PASS |
| M-44 | `gym every Monday, Wednesday except the first Monday` | Giữ nguyên nội dung; không gán ngày/lịch; low confidence | PASS |
| M-45 | `gym every month on day 0, 15, 32` | Giữ nguyên nội dung; không gán ngày/lịch; low confidence | PASS |
| M-46 | `gym -3 times every day` | Giữ nguyên nội dung; không gán ngày/lịch; low confidence | PASS |
| M-47 | `gym every year on February 30` | Giữ nguyên nội dung; không gán ngày/lịch; low confidence | PASS |
| M-63 | `gym biweekly` | Giữ nguyên nội dung; không gán ngày/lịch; low confidence | PASS |
| M-64 | `gym every day for 0 occurrences` | Giữ nguyên nội dung; không gán ngày/lịch; low confidence | PASS |
| M-65 | `gym every day for 3 occurrences until Friday` | Giữ nguyên nội dung; không gán ngày/lịch; low confidence | PASS |

## Tách và gộp việc

| ID | Câu nhập | Kết quả mong đợi | HTTP |
|---|---|---|---|
| M-48 | `buy milk tomorrow; call mum Friday` | `Buy milk` — 2026-11-03<br>`Call mum` — 2026-11-06 | PASS |
| M-49 | `mua sữa, trứng sáng mai` | `Mua sữa, trứng` — 2026-11-03 09:00 | PASS |
| M-50 | `gym 2, 4, 6 hàng tuần, buy milk` | `Gym` — 2026-11-02<br>`Buy milk` — không ngày | PASS |
| M-51 | `buy milk, buy milk` | `Buy milk` — không ngày | PASS |
| M-59 | `gym every Monday, Wednesday at 8am, buy milk` | `Gym` — 2026-11-04 08:00<br>`Buy milk` — không ngày | PASS |

## Lệnh và trạng thái

| ID | Câu nhập | Kết quả mong đợi | HTTP |
|---|---|---|---|
| M-52 | `done call mum` | update<br>Completed | PASS |
| M-53 | `delete old list` | delete<br>Old list<br>status: confirm | PASS |
| M-54 | `move report and gym to Friday` | update, update<br>2026-11-06 | PASS |
| M-55 | `ok thanks` | skipped<br>skip<br>status: followup | PASS |
| M-56 | `done pay rent` | skipped<br>already_done | PASS |

## Các lỗi đã phát hiện và sửa trong lần kiểm tra này

- `gym every month on 1st, 15th and 25th`: trước đây chỉ lấy ngày 1 và để lại `15th and 25th` trong tiêu đề. Nay tạo một lịch có cả ba ngày.
- `gym every month on first and third Monday`: trước đây chỉ lấy lần thứ ba. Nay giữ cả thứ Hai thứ nhất và thứ ba; danh sách dùng dấu phẩy cũng được đọc chung.
- `gym biweekly`: trước đây được coi là việc thường đã hiểu rõ. Nay giữ nguyên và đánh dấu low confidence vì từ này có thể mang hai nghĩa.

## Câu dài và phức tạp

Xem [70 lượt thử mở rộng](complex-note-cases.md): khoảng thời gian bằng chữ, hoán đổi vị trí metadata, danh sách có ngày đứng đầu, câu có ngoại lệ và các đoạn trộn nhiều task/lệnh.
