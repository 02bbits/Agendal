# Note engine — câu dài và phần bổ nghĩa

Kiểm tra lại ngày **02/11/2026**: **70/70 lượt HTTP khớp kỳ vọng đã ghi dưới đây**, cùng 67 ca cơ bản trong [note-cases.md](note-cases.md). Một ca đạt có thể là đọc được lịch, hoặc giữ nguyên để fallback khi ràng buộc chưa thể biểu diễn chính xác; hai trường hợp được ghi riêng.

## Cách thử lại

Chạy `php -S localhost:8091 tests/Manual/try.php` từ `backend/`, mở <http://localhost:8091/>. Dùng **Asia/Ho_Chi_Minh**, tuần bắt đầu thứ Hai; đặt Written at theo từng nhóm bên dưới. Trang chỉ chạy rules và không ghi DB.

```text
task: Gọi mẹ
task: Báo cáo | 2026-11-05 | 09:00
task: Danh sách cũ
task: Call mum
task: Report | 2026-11-05 | 09:00
done: Pay rent
```

## Các hành vi cần giữ

- “nửa tiếng”, “half an hour”, “thirty minutes” và chữ số dùng chung vocabulary số/đơn vị. Giờ tương đối dựa trên Written at, gồm việc qua ngày/tháng/năm.
- Phần chỉ chứa ngày/giờ/số lần lặp có thể đứng trước hoặc sau tên việc, cách nhau bằng dấu phẩy. Không tạo việc riêng từ metadata; `;`, xuống dòng và từ nối phân việc vẫn giữ ranh giới.
- Một ngày/giờ đứng đầu không làm danh sách `buy milk, eggs and bread` bị tách mất các món phía sau.
- **3 lần mỗi thứ Ba** là ba chuỗi riêng. **Kết thúc sau 3 lần** là COUNT=3 của một chuỗi.
- Các ngoại lệ chưa hỗ trợ (`trừ`, `except`, `not on`…), lượng thời gian chưa biểu diễn được và giờ/ngày mâu thuẫn giữ nguyên ràng buộc để fallback; không áp lịch một phần.
- Với `nửa tiếng sau, plank, lặp lại 3 lần, thứ 3 mỗi tuần`, kết quả bảo thủ là **một mục giữ nguyên và low confidence**: không tạo task “Nửa tiếng sau”, không bỏ phần lặp, không tự đặt cùng một giờ cho ba lần. Bỏ phần giờ thì `plank, lặp lại 3 lần, thứ 3 mỗi tuần` tạo đủ ba chuỗi thứ Ba chưa có giờ.
- Riêng `plank` là tên một từ chưa được vocabulary coi là task rõ nghĩa; có thể có low confidence về tiêu đề dù các trường lịch được đọc đúng. `tập plank` có động từ rõ ràng.
- `hoàn thành gọi mẹ` là việc cần làm theo vocabulary hiện tại; `đã hoàn thành gọi mẹ` là lệnh đánh dấu xong.
- Mô tả hiển thị của thư viện có thể khác cách viết ngày; đối chiếu ngày/giờ/thứ/tần suất/số lần thực tế.

## Written at: 2026-11-02 12:51

| ID | Câu nhập | Kỳ vọng | Thực tế |
|---|---|---|---|
| L-01 | `nửa tiếng sau plank` | Một việc lúc 02/11/2026 13:21; bỏ cụm thời gian khỏi tên. | create: "Plank" 2026-11-02 13:21 · reminder 15m · medium<br>**low confidence** |
| L-02 | `sau nửa tiếng plank` | Một việc lúc 02/11/2026 13:21; bỏ cụm thời gian khỏi tên. | create: "Plank" 2026-11-02 13:21 · reminder 15m · medium<br>**low confidence** |
| L-03 | `plank nửa tiếng nữa` | Một việc lúc 02/11/2026 13:21; bỏ cụm thời gian khỏi tên. | create: "Plank" 2026-11-02 13:21 · reminder 15m · medium<br>**low confidence** |
| L-04 | `in half an hour plank` | Một việc lúc 02/11/2026 13:21; bỏ cụm thời gian khỏi tên. | create: "Plank" 2026-11-02 13:21 · reminder 15m · medium<br>**low confidence** |
| L-05 | `plank in thirty minutes` | Một việc lúc 02/11/2026 13:21; bỏ cụm thời gian khỏi tên. | create: "Plank" 2026-11-02 13:21 · reminder 15m · medium<br>**low confidence** |
| L-06 | `nhớ gọi mẹ sau nửa tiếng để hỏi thăm sức khỏe` | Một việc lúc 02/11/2026 13:21; bỏ cụm thời gian khỏi tên. | create: "Gọi mẹ để hỏi thăm sức khỏe" 2026-11-02 13:21 · reminder 15m · medium |
| L-07 | `nhớ gọi mẹ sau 30 phút để hỏi thăm sức khỏe` | Một việc lúc 02/11/2026 13:21; bỏ cụm thời gian khỏi tên. | create: "Gọi mẹ để hỏi thăm sức khỏe" 2026-11-02 13:21 · reminder 15m · medium |
| L-08 | `nhớ gọi mẹ 30 phút nữa để hỏi thăm sức khỏe` | Một việc lúc 02/11/2026 13:21; bỏ cụm thời gian khỏi tên. | create: "Gọi mẹ để hỏi thăm sức khỏe" 2026-11-02 13:21 · reminder 15m · medium |
| L-09 | `plank 3 lần mỗi thứ 3 hàng tuần` | 3 chuỗi riêng vào thứ Ba hằng tuần, không tự đặt giờ. | create: "Plank (1/3)" 2026-11-03  · weekly on Tuesday, forever<br>create: "Plank (2/3)" 2026-11-03  · weekly on Tuesday, forever<br>create: "Plank (3/3)" 2026-11-03  · weekly on Tuesday, forever<br>**low confidence** |
| L-10 | `plank, lặp lại 3 lần, thứ 3 mỗi tuần` | 3 chuỗi riêng vào thứ Ba hằng tuần, không tự đặt giờ. | create: "Plank (1/3)" 2026-11-03  · weekly on Tuesday, forever<br>create: "Plank (2/3)" 2026-11-03  · weekly on Tuesday, forever<br>create: "Plank (3/3)" 2026-11-03  · weekly on Tuesday, forever<br>**low confidence** |
| L-11 | `tập plank, lặp lại 3 lần vào mỗi thứ 3 hàng tuần` | 3 chuỗi riêng vào thứ Ba hằng tuần, không tự đặt giờ. | create: "Tập plank (1/3)" 2026-11-03  · weekly on Tuesday, forever<br>create: "Tập plank (2/3)" 2026-11-03  · weekly on Tuesday, forever<br>create: "Tập plank (3/3)" 2026-11-03  · weekly on Tuesday, forever |
| L-12 | `plank three times every Tuesday` | 3 chuỗi riêng vào thứ Ba hằng tuần, không tự đặt giờ. | create: "Plank (1/3)" 2026-11-03  · weekly on Tuesday, forever<br>create: "Plank (2/3)" 2026-11-03  · weekly on Tuesday, forever<br>create: "Plank (3/3)" 2026-11-03  · weekly on Tuesday, forever<br>**low confidence** |
| L-13 | `nửa tiếng sau, plank, lặp lại 3 lần, thứ 3 mỗi tuần` | Một mục giữ nguyên các ràng buộc, low confidence, chưa gán ngày/giờ vì không đủ thông tin hoặc mâu thuẫn. | create: "Nửa tiếng sau, plank, lặp lại 3 lần, thứ 3 mỗi tuần" no date<br>**low confidence** |
| L-14 | `nhớ tập plank sau nửa tiếng, lặp lại 3 lần vào mỗi thứ 3 hàng tuần` | Một mục giữ nguyên các ràng buộc, low confidence, chưa gán ngày/giờ vì không đủ thông tin hoặc mâu thuẫn. | create: "Tập plank sau nửa tiếng, lặp lại 3 lần vào mỗi thứ 3 hàng tuần" no date<br>**low confidence** |
| L-15 | `plank in 30 minutes, three times every Tuesday` | Một mục giữ nguyên các ràng buộc, low confidence, chưa gán ngày/giờ vì không đủ thông tin hoặc mâu thuẫn. | create: "Plank in 30 minutes, three times every Tuesday" no date<br>**low confidence** |
| L-16 | `plank in half an hour, three times every Tuesday` | Một mục giữ nguyên các ràng buộc, low confidence, chưa gán ngày/giờ vì không đủ thông tin hoặc mâu thuẫn. | create: "Plank in half an hour, three times every Tuesday" no date<br>**low confidence** |
| L-17 | `nhớ tập plank vào mỗi thứ 3 hàng tuần, kết thúc sau 3 lần` | Một chuỗi thứ Ba, kết thúc sau 3 ngày hẹn; 07:00 nếu câu có ghi giờ. | create: "Tập plank" 2026-11-03  · weekly on Tuesday, 3 times |
| L-18 | `plank every Tuesday for 3 occurrences` | Một chuỗi thứ Ba, kết thúc sau 3 ngày hẹn; 07:00 nếu câu có ghi giờ. | create: "Plank" 2026-11-03  · weekly on Tuesday, 3 times<br>**low confidence** |
| L-19 | `nhớ tập plank vào thứ 3 hàng tuần lúc 7h sáng, kết thúc sau 3 lần` | Một chuỗi thứ Ba, kết thúc sau 3 ngày hẹn; 07:00 nếu câu có ghi giờ. | create: "Tập plank" 2026-11-03 07:00 · weekly on Tuesday, 3 times · reminder 15m |
| L-20 | `nhớ mua sữa ngày mai lúc 9h sáng; sau đó gọi mẹ vào thứ sáu lúc 8h tối; nộp báo cáo trước ngày 15/11/2026` | 3 việc riêng: mua sữa 03/11 09:00; gọi mẹ 06/11 20:00; báo cáo 15/11. | create: "Mua sữa" 2026-11-03 09:00 · reminder 15m<br>create: "Gọi mẹ" 2026-11-06 20:00 · reminder 15m<br>create: "Nộp báo cáo" 2026-11-15  · high |
| L-21 | `nhớ mua sữa ngày mai lúc 9h sáng, gọi mẹ vào thứ sáu lúc 8h tối, nộp báo cáo trước ngày 15/11/2026` | 3 việc riêng: mua sữa 03/11 09:00; gọi mẹ 06/11 20:00; báo cáo 15/11. | create: "Mua sữa" 2026-11-03 09:00 · reminder 15m<br>create: "Gọi mẹ" 2026-11-06 20:00 · reminder 15m<br>create: "Nộp báo cáo" 2026-11-15  · high |
| L-22 | `tomorrow at 9am buy milk, then call mum on Friday at 8pm, then submit the report by November 15` | 3 việc riêng: mua sữa 03/11 09:00; gọi mẹ 06/11 20:00; báo cáo 15/11. | create: "Buy milk" 2026-11-03 09:00 · reminder 15m<br>create: "Call mum" 2026-11-06 20:00 · reminder 15m<br>create: "Submit the report" 2026-11-15  · high |
| L-23 | `mua sữa, trứng và bánh mì sáng mai, rồi gọi mẹ vào thứ sáu lúc 8h tối` | 2 việc; giữ nguyên danh sách mua sắm ngày mai 09:00 và gọi mẹ thứ Sáu 20:00. | create: "Mua sữa, trứng và bánh mì" 2026-11-03 09:00 · reminder 15m<br>create: "Gọi mẹ" 2026-11-06 20:00 · reminder 15m |
| L-24 | `gym every Monday, Wednesday and Friday at 7am, buy milk tomorrow and eggs` | 2 việc; Gym giữ đủ thứ Hai/Tư/Sáu 07:00; mua sữa và trứng ngày mai. | create: "Gym" 2026-11-04 07:00 · weekly on Monday, Wednesday and Friday, forever · reminder 15m<br>create: "Buy milk and eggs" 2026-11-03 |
| L-25 | `họp nhóm dự án vào thứ hai đầu tiên và thứ sáu cuối cùng hàng tháng lúc 9h sáng, sau đó gửi báo cáo vào ngày mai` | 2 việc; họp thứ Hai thứ nhất và thứ Sáu cuối tháng 09:00; gửi báo cáo ngày mai. | create: "Họp nhóm dự án" 2026-11-27 09:00 · monthly on the first Monday and the last Friday of the month, forever · reminder 15m<br>create: "Gửi báo cáo" 2026-11-03 |
| L-26 | `ngày mai nhớ đọc tài liệu today.md rồi gửi báo cáo vào thứ sáu lúc 9h sáng` | 2 việc; bỏ ngày được chọn khỏi tên, giữ nguyên URL/tên file. | create: "Đọc tài liệu today.md" 2026-11-03<br>create: "Gửi báo cáo" 2026-11-06 09:00 · reminder 15m |
| L-27 | `tomorrow read https://example.com/today, then send the report before Friday at 9am` | 2 việc; bỏ ngày được chọn khỏi tên, giữ nguyên URL/tên file. | create: "Read https://example.com/today" 2026-11-03<br>create: "Send the report" 2026-11-06 09:00 · reminder 15m |
| L-28 | `hoàn thành gọi mẹ rồi dời báo cáo sang thứ sáu lúc 10h sáng, sau đó xóa danh sách cũ` | Theo vocabulary hiện tại: “hoàn thành” là việc cần làm; dời báo cáo là update, xóa là delete; cần confirm. | create: "Hoàn thành gọi mẹ" no date<br>update: "Báo cáo" → {"due_date":"2026-11-06","start_time":"10:00"} · label "Due Fri 6 Nov 10:00"<br>delete: "Danh sách cũ" |
| L-29 | `tập plank vào mỗi thứ 3 hàng tuần lúc 7h sáng và 7h tối, kết thúc sau 3 lần` | Giữ nguyên nội dung để fallback; low confidence; không áp một phần giờ/lịch/ngoại lệ. | create: "Tập plank vào mỗi thứ 3 hàng tuần lúc 7h sáng và 7h tối, kết thúc sau 3 lần" no date<br>**low confidence** |
| L-30 | `tập plank mỗi thứ 3 hàng tuần trừ ngày 10/11/2026 và 24/11/2026` | Giữ nguyên nội dung để fallback; low confidence; không áp một phần giờ/lịch/ngoại lệ. | create: "Tập plank mỗi thứ 3 hàng tuần trừ ngày 10/11/2026 và 24/11/2026" no date<br>**low confidence** |

## Written at: 2026-11-03 12:51

| ID | Câu nhập | Kỳ vọng | Thực tế |
|---|---|---|---|
| L-31 | `nửa tiếng sau plank` | Một việc lúc 03/11/2026 13:21; bỏ cụm thời gian khỏi tên. | create: "Plank" 2026-11-03 13:21 · reminder 15m · medium<br>**low confidence** |
| L-32 | `sau nửa tiếng plank` | Một việc lúc 03/11/2026 13:21; bỏ cụm thời gian khỏi tên. | create: "Plank" 2026-11-03 13:21 · reminder 15m · medium<br>**low confidence** |
| L-33 | `plank nửa tiếng nữa` | Một việc lúc 03/11/2026 13:21; bỏ cụm thời gian khỏi tên. | create: "Plank" 2026-11-03 13:21 · reminder 15m · medium<br>**low confidence** |
| L-34 | `in half an hour plank` | Một việc lúc 03/11/2026 13:21; bỏ cụm thời gian khỏi tên. | create: "Plank" 2026-11-03 13:21 · reminder 15m · medium<br>**low confidence** |
| L-35 | `plank in thirty minutes` | Một việc lúc 03/11/2026 13:21; bỏ cụm thời gian khỏi tên. | create: "Plank" 2026-11-03 13:21 · reminder 15m · medium<br>**low confidence** |
| L-36 | `nhớ gọi mẹ sau nửa tiếng để hỏi thăm sức khỏe` | Một việc lúc 03/11/2026 13:21; bỏ cụm thời gian khỏi tên. | create: "Gọi mẹ để hỏi thăm sức khỏe" 2026-11-03 13:21 · reminder 15m · medium |
| L-37 | `nhớ gọi mẹ sau 30 phút để hỏi thăm sức khỏe` | Một việc lúc 03/11/2026 13:21; bỏ cụm thời gian khỏi tên. | create: "Gọi mẹ để hỏi thăm sức khỏe" 2026-11-03 13:21 · reminder 15m · medium |
| L-38 | `nhớ gọi mẹ 30 phút nữa để hỏi thăm sức khỏe` | Một việc lúc 03/11/2026 13:21; bỏ cụm thời gian khỏi tên. | create: "Gọi mẹ để hỏi thăm sức khỏe" 2026-11-03 13:21 · reminder 15m · medium |
| L-39 | `plank 3 lần mỗi thứ 3 hàng tuần` | 3 chuỗi riêng vào thứ Ba hằng tuần, không tự đặt giờ. | create: "Plank (1/3)" 2026-11-03  · weekly on Tuesday, forever · medium<br>create: "Plank (2/3)" 2026-11-03  · weekly on Tuesday, forever · medium<br>create: "Plank (3/3)" 2026-11-03  · weekly on Tuesday, forever · medium<br>**low confidence** |
| L-40 | `plank, lặp lại 3 lần, thứ 3 mỗi tuần` | 3 chuỗi riêng vào thứ Ba hằng tuần, không tự đặt giờ. | create: "Plank (1/3)" 2026-11-03  · weekly on Tuesday, forever · medium<br>create: "Plank (2/3)" 2026-11-03  · weekly on Tuesday, forever · medium<br>create: "Plank (3/3)" 2026-11-03  · weekly on Tuesday, forever · medium<br>**low confidence** |
| L-41 | `tập plank, lặp lại 3 lần vào mỗi thứ 3 hàng tuần` | 3 chuỗi riêng vào thứ Ba hằng tuần, không tự đặt giờ. | create: "Tập plank (1/3)" 2026-11-03  · weekly on Tuesday, forever · medium<br>create: "Tập plank (2/3)" 2026-11-03  · weekly on Tuesday, forever · medium<br>create: "Tập plank (3/3)" 2026-11-03  · weekly on Tuesday, forever · medium |
| L-42 | `plank three times every Tuesday` | 3 chuỗi riêng vào thứ Ba hằng tuần, không tự đặt giờ. | create: "Plank (1/3)" 2026-11-03  · weekly on Tuesday, forever · medium<br>create: "Plank (2/3)" 2026-11-03  · weekly on Tuesday, forever · medium<br>create: "Plank (3/3)" 2026-11-03  · weekly on Tuesday, forever · medium<br>**low confidence** |
| L-43 | `nửa tiếng sau, plank, lặp lại 3 lần, thứ 3 mỗi tuần` | Một mục giữ nguyên các ràng buộc, low confidence, chưa gán ngày/giờ vì không đủ thông tin hoặc mâu thuẫn. | create: "Nửa tiếng sau, plank, lặp lại 3 lần, thứ 3 mỗi tuần" no date<br>**low confidence** |
| L-44 | `nhớ tập plank sau nửa tiếng, lặp lại 3 lần vào mỗi thứ 3 hàng tuần` | Một mục giữ nguyên các ràng buộc, low confidence, chưa gán ngày/giờ vì không đủ thông tin hoặc mâu thuẫn. | create: "Tập plank sau nửa tiếng, lặp lại 3 lần vào mỗi thứ 3 hàng tuần" no date<br>**low confidence** |
| L-45 | `plank in 30 minutes, three times every Tuesday` | Một mục giữ nguyên các ràng buộc, low confidence, chưa gán ngày/giờ vì không đủ thông tin hoặc mâu thuẫn. | create: "Plank in 30 minutes, three times every Tuesday" no date<br>**low confidence** |
| L-46 | `plank in half an hour, three times every Tuesday` | Một mục giữ nguyên các ràng buộc, low confidence, chưa gán ngày/giờ vì không đủ thông tin hoặc mâu thuẫn. | create: "Plank in half an hour, three times every Tuesday" no date<br>**low confidence** |

## Written at: 2026-11-03 23:45

| ID | Câu nhập | Kỳ vọng | Thực tế |
|---|---|---|---|
| L-47 | `nửa tiếng sau plank` | Một việc lúc 04/11/2026 00:15; bỏ cụm thời gian khỏi tên. | create: "Plank" 2026-11-04 00:15 · reminder 15m<br>**low confidence** |
| L-48 | `sau nửa tiếng plank` | Một việc lúc 04/11/2026 00:15; bỏ cụm thời gian khỏi tên. | create: "Plank" 2026-11-04 00:15 · reminder 15m<br>**low confidence** |
| L-49 | `plank nửa tiếng nữa` | Một việc lúc 04/11/2026 00:15; bỏ cụm thời gian khỏi tên. | create: "Plank" 2026-11-04 00:15 · reminder 15m<br>**low confidence** |
| L-50 | `in half an hour plank` | Một việc lúc 04/11/2026 00:15; bỏ cụm thời gian khỏi tên. | create: "Plank" 2026-11-04 00:15 · reminder 15m<br>**low confidence** |
| L-51 | `plank in thirty minutes` | Một việc lúc 04/11/2026 00:15; bỏ cụm thời gian khỏi tên. | create: "Plank" 2026-11-04 00:15 · reminder 15m<br>**low confidence** |
| L-52 | `nhớ gọi mẹ sau nửa tiếng để hỏi thăm sức khỏe` | Một việc lúc 04/11/2026 00:15; bỏ cụm thời gian khỏi tên. | create: "Gọi mẹ để hỏi thăm sức khỏe" 2026-11-04 00:15 · reminder 15m |
| L-53 | `nhớ gọi mẹ sau 30 phút để hỏi thăm sức khỏe` | Một việc lúc 04/11/2026 00:15; bỏ cụm thời gian khỏi tên. | create: "Gọi mẹ để hỏi thăm sức khỏe" 2026-11-04 00:15 · reminder 15m |
| L-54 | `nhớ gọi mẹ 30 phút nữa để hỏi thăm sức khỏe` | Một việc lúc 04/11/2026 00:15; bỏ cụm thời gian khỏi tên. | create: "Gọi mẹ để hỏi thăm sức khỏe" 2026-11-04 00:15 · reminder 15m |
| L-55 | `plank 3 lần mỗi thứ 3 hàng tuần` | 3 chuỗi riêng vào thứ Ba hằng tuần, không tự đặt giờ. | create: "Plank (1/3)" 2026-11-03  · weekly on Tuesday, forever · medium<br>create: "Plank (2/3)" 2026-11-03  · weekly on Tuesday, forever · medium<br>create: "Plank (3/3)" 2026-11-03  · weekly on Tuesday, forever · medium<br>**low confidence** |
| L-56 | `plank, lặp lại 3 lần, thứ 3 mỗi tuần` | 3 chuỗi riêng vào thứ Ba hằng tuần, không tự đặt giờ. | create: "Plank (1/3)" 2026-11-03  · weekly on Tuesday, forever · medium<br>create: "Plank (2/3)" 2026-11-03  · weekly on Tuesday, forever · medium<br>create: "Plank (3/3)" 2026-11-03  · weekly on Tuesday, forever · medium<br>**low confidence** |
| L-57 | `tập plank, lặp lại 3 lần vào mỗi thứ 3 hàng tuần` | 3 chuỗi riêng vào thứ Ba hằng tuần, không tự đặt giờ. | create: "Tập plank (1/3)" 2026-11-03  · weekly on Tuesday, forever · medium<br>create: "Tập plank (2/3)" 2026-11-03  · weekly on Tuesday, forever · medium<br>create: "Tập plank (3/3)" 2026-11-03  · weekly on Tuesday, forever · medium |
| L-58 | `plank three times every Tuesday` | 3 chuỗi riêng vào thứ Ba hằng tuần, không tự đặt giờ. | create: "Plank (1/3)" 2026-11-03  · weekly on Tuesday, forever · medium<br>create: "Plank (2/3)" 2026-11-03  · weekly on Tuesday, forever · medium<br>create: "Plank (3/3)" 2026-11-03  · weekly on Tuesday, forever · medium<br>**low confidence** |
| L-59 | `nửa tiếng sau, plank, lặp lại 3 lần, thứ 3 mỗi tuần` | Một mục giữ nguyên các ràng buộc, low confidence, chưa gán ngày/giờ vì không đủ thông tin hoặc mâu thuẫn. | create: "Nửa tiếng sau, plank, lặp lại 3 lần, thứ 3 mỗi tuần" no date<br>**low confidence** |
| L-60 | `nhớ tập plank sau nửa tiếng, lặp lại 3 lần vào mỗi thứ 3 hàng tuần` | Một mục giữ nguyên các ràng buộc, low confidence, chưa gán ngày/giờ vì không đủ thông tin hoặc mâu thuẫn. | create: "Tập plank sau nửa tiếng, lặp lại 3 lần vào mỗi thứ 3 hàng tuần" no date<br>**low confidence** |
| L-61 | `plank in 30 minutes, three times every Tuesday` | Một mục giữ nguyên các ràng buộc, low confidence, chưa gán ngày/giờ vì không đủ thông tin hoặc mâu thuẫn. | create: "Plank in 30 minutes, three times every Tuesday" no date<br>**low confidence** |
| L-62 | `plank in half an hour, three times every Tuesday` | Một mục giữ nguyên các ràng buộc, low confidence, chưa gán ngày/giờ vì không đủ thông tin hoặc mâu thuẫn. | create: "Plank in half an hour, three times every Tuesday" no date<br>**low confidence** |

## Đoạn dài trộn nhiều việc và lệnh

Các ca sau dùng Written at **2026-11-02T12:51**.

### P-01

```text
nhớ soạn bản tổng hợp các góp ý của khách hàng và kiểm tra lại số liệu trong báo cáo hôm nay lúc 15h; gọi mẹ để xác nhận địa chỉ giao quà và hỏi thăm sức khỏe ngày mai lúc 9h sáng; họp nhóm để thống nhất phần trình bày cho buổi bảo vệ vào thứ tư lúc 14h; gửi báo cáo đã sửa cho giảng viên trước ngày 15/11/2026; mua sữa, trứng và bánh mì cho cả nhà vào thứ bảy lúc 8h sáng
```

**Kỳ vọng:** 5 việc riêng, ngày/giờ tương ứng 02/11 15:00, 03/11 09:00, 04/11 14:00, 15/11, 07/11 08:00; confirm.

**Kết quả:** PASS; status `confirm`; low confidence `false`.

- create: "Soạn bản tổng hợp các góp ý của khách hàng và kiểm tra lại số liệu trong báo cáo" 2026-11-02 15:00 · high
- create: "Gọi mẹ để xác nhận địa chỉ giao quà và hỏi thăm sức khỏe" 2026-11-03 09:00 · reminder 15m
- create: "Họp nhóm để thống nhất phần trình bày cho buổi bảo vệ" 2026-11-04 14:00 · reminder 15m
- create: "Gửi báo cáo đã sửa cho giảng viên" 2026-11-15
- create: "Mua sữa, trứng và bánh mì cho cả nhà" 2026-11-07 08:00 · reminder 15m

### P-02

```text
please review the customer feedback and double check the numbers in the quarterly report today at 3pm; call mum to confirm the delivery address for the birthday present tomorrow at 9am; meet the project team to agree the final presentation outline on Wednesday at 2pm; send the revised report to the supervisor by November 15; buy milk, eggs and bread for the family on Saturday at 8am
```

**Kỳ vọng:** 5 việc riêng, ngày/giờ tương ứng 02/11 15:00, 03/11 09:00, 04/11 14:00, 15/11, 07/11 08:00; confirm.

**Kết quả:** PASS; status `confirm`; low confidence `false`.

- create: "Review the customer feedback and double check the numbers in the quarterly report" 2026-11-02 15:00 · reminder 15m · medium
- create: "Call mum to confirm the delivery address for the birthday present" 2026-11-03 09:00 · reminder 15m
- create: "Meet the project team to agree the final presentation outline" 2026-11-04 14:00 · reminder 15m
- create: "Send the revised report to the supervisor" 2026-11-15
- create: "Buy milk, eggs and bread for the family" 2026-11-07 08:00 · reminder 15m

### P-03

```text
nhớ tập plank để cải thiện sức bền và giữ đúng tư thế, lặp lại 3 lần vào mỗi thứ 3 hàng tuần; mua sữa và bánh mì cho cả nhà vào ngày mai lúc 9h sáng; đã hoàn thành gọi mẹ rồi dời báo cáo sang thứ sáu lúc 10h sáng, sau đó xóa danh sách cũ
```

**Kỳ vọng:** 3 chuỗi plank thứ Ba + mua sắm + complete + move + delete; confirm.

**Kết quả:** PASS; status `confirm`; low confidence `false`.

- create: "Tập plank để cải thiện sức bền và giữ đúng tư thế (1/3)" 2026-11-03  · weekly on Tuesday, forever
- create: "Tập plank để cải thiện sức bền và giữ đúng tư thế (2/3)" 2026-11-03  · weekly on Tuesday, forever
- create: "Tập plank để cải thiện sức bền và giữ đúng tư thế (3/3)" 2026-11-03  · weekly on Tuesday, forever
- create: "Mua sữa và bánh mì cho cả nhà" 2026-11-03 09:00 · reminder 15m
- update: "Gọi mẹ" → {"done":true} · label "Completed"
- update: "Báo cáo" → {"due_date":"2026-11-06","start_time":"10:00"} · label "Due Fri 6 Nov 10:00"
- delete: "Danh sách cũ"

### P-04

```text
nhớ gọi mẹ sau 30 phút để xác nhận thời gian giao quà trước khi mẹ rời nhà; sau đó gửi bản báo cáo đã kiểm tra số liệu cho cả nhóm vào thứ sáu lúc 10h sáng; cuối tuần mua sữa, trứng và bánh mì cho gia đình, rồi đọc lại tài liệu today.md vào ngày mai
```

**Kỳ vọng:** 4 việc; gọi mẹ 02/11 13:21; mua sắm giữ một danh sách; tên file today.md giữ nguyên.

**Kết quả:** PASS; status `done`; low confidence `false`.

- create: "Gọi mẹ để xác nhận thời gian giao quà trước khi mẹ rời nhà" 2026-11-02 13:21 · reminder 15m · medium
- create: "Gửi bản báo cáo đã kiểm tra số liệu cho cả nhóm" 2026-11-06 10:00 · reminder 1d · high
- create: "Mua sữa, trứng và bánh mì cho gia đình" 2026-11-08
- create: "Đọc lại tài liệu today.md" 2026-11-03

### P-05

```text
nhớ gọi mẹ sau nửa tiếng để xác nhận thời gian giao quà trước khi mẹ rời nhà; sau đó gửi bản báo cáo đã kiểm tra số liệu cho cả nhóm vào thứ sáu lúc 10h sáng; cuối tuần mua sữa, trứng và bánh mì cho gia đình, rồi đọc lại tài liệu today.md vào ngày mai
```

**Kỳ vọng:** 4 việc; gọi mẹ 02/11 13:21; mua sắm giữ một danh sách; tên file today.md giữ nguyên.

**Kết quả:** PASS; status `done`; low confidence `false`.

- create: "Gọi mẹ để xác nhận thời gian giao quà trước khi mẹ rời nhà" 2026-11-02 13:21 · reminder 15m · medium
- create: "Gửi bản báo cáo đã kiểm tra số liệu cho cả nhóm" 2026-11-06 10:00 · reminder 1d · high
- create: "Mua sữa, trứng và bánh mì cho gia đình" 2026-11-08
- create: "Đọc lại tài liệu today.md" 2026-11-03

### P-06

```text
họp nhóm để rà soát tiến độ và thống nhất kế hoạch triển khai vào thứ hai đầu tiên và thứ sáu cuối cùng hàng tháng lúc 9h sáng, kết thúc sau 6 lần; sau đó gửi bản tóm tắt nội dung đã thống nhất cho cả nhóm vào ngày mai lúc 10h sáng; mua giấy, bút và sổ tay cho buổi họp vào thứ bảy
```

**Kỳ vọng:** 3 việc; lịch tháng thứ Hai thứ nhất/thứ Sáu cuối tháng 09:00 COUNT=6; hai việc sau giữ lịch riêng.

**Kết quả:** PASS; status `done`; low confidence `false`.

- create: "Họp nhóm để rà soát tiến độ và thống nhất kế hoạch triển khai" 2026-11-27 09:00 · monthly on the first Monday and the last Friday of the month, 6 times · reminder 15m
- create: "Gửi bản tóm tắt nội dung đã thống nhất cho cả nhóm" 2026-11-03 10:00 · reminder 15m
- create: "Mua giấy, bút và sổ tay cho buổi họp" 2026-11-07

### P-07

```text
nhớ tập plank để cải thiện sức bền vào mỗi thứ 3 hàng tuần lúc 7h sáng, trừ ngày 10/11/2026 và 24/11/2026 vì đi công tác; mua sữa, trứng và bánh mì cho cả nhà ngày mai lúc 9h sáng; sau đó gọi mẹ để hỏi thăm sức khỏe vào thứ sáu lúc 8h tối
```

**Kỳ vọng:** 3 việc; mục có ngoại lệ giữ nguyên và chưa gán lịch; hai mục còn lại vẫn có lịch đúng.

**Kết quả:** PASS; status `done`; low confidence `true`.

- create: "Tập plank để cải thiện sức bền vào mỗi thứ 3 hàng tuần lúc 7h sáng, trừ ngày 10/11/2026 và 24/11/2026 vì đi công tác" no date
- create: "Mua sữa, trứng và bánh mì cho cả nhà" 2026-11-03 09:00 · reminder 15m
- create: "Gọi mẹ để hỏi thăm sức khỏe" 2026-11-06 20:00 · reminder 15m

### P-08

```text
please read https://example.com/today and tomorrow.md to prepare the presentation tomorrow at 9am, then call mum to confirm the delivery address on Friday at 8pm, then move report to Friday at 10am, then buy milk, eggs and bread on Saturday at 8am
```

**Kỳ vọng:** 3 create + 1 update; URL và tomorrow.md giữ nguyên; ngày/giờ riêng cho từng việc.

**Kết quả:** PASS; status `done`; low confidence `false`.

- create: "Read https://example.com/today and tomorrow.md to prepare the presentation" 2026-11-03 09:00 · reminder 15m
- create: "Call mum to confirm the delivery address" 2026-11-06 20:00 · reminder 15m
- create: "Buy milk, eggs and bread" 2026-11-07 08:00 · reminder 15m
- update: "Report" → {"due_date":"2026-11-06","start_time":"10:00"} · label "Due Fri 6 Nov 10:00"

