# Business Rules

The single source for how a note becomes tasks (NU), plus rules that cut across modules. The prototype does this with rules. v1 can use a language model with structured output, but it must produce the same plan shape and follow the same rules ([ADR-001](../07-architecture/decisions/ADR-001-note-plan-contract.md)).

## Splitting (NU-1)

Items split on new lines, commas, semicolons, full stops and "then" (Vietnamese: "rồi", "sau đó"). Bullets are stripped. One task per actionable item. A comma list after a task verb stays one task ("buy milk, eggs and bread", [NU-E33](../03-modules/NU-note-understanding.md#nu-e33)).

## What is extracted from each item (NU-2)

| Field | Understood phrases (examples) | Result | When nothing is found |
|---|---|---|---|
| Due date | today, tonight, this evening, tomorrow / tmr, day after tomorrow, Monday … Sunday ("next", "this", "by", "on"), next week, in 3 days, in a week, end of the week, end of the month, 26 Oct | A date. Weekdays mean the next one ahead | No date (or today if a repeat or time is given) |
| Time | 9am, 6:30pm, at 14, 14:00, morning (09:00), noon (12:00), evening (19:00), tonight (20:00) | Start time | No time |
| Priority | urgent, asap, important, high priority, deadline, exam, quiz, submit → High. low priority, whenever, someday, maybe → Low | Priority | Medium if due today, otherwise Low |
| Project | The project's name anywhere in the item, or course keywords (e.g. sql / database / ER diagram → SQL Course; gym, mum, groceries → Personal) | Project | No project |
| Repeat | every day / daily, every week / weekly / every Monday, every month / monthly | Repeat | Never |
| Reminder | Exams and quizzes → 1 day before. Any task with a time → 15 minutes before | Reminder | None |
| Title | What is left after removing the date, time, priority and repeat words and lead-ins ("remember to", "I need to", "please") | Sentence-case title. Acronyms (SQL, HCI, CV, UI, API, PDF) kept upper case | — |

## Commands for existing tasks (NU-3)

| Command | Phrases | Effect |
|---|---|---|
| Complete | done X, finished X, did X, X is done | Marks the task done |
| Reschedule | move / push / reschedule / postpone X to \<when> | Sets the new due date (and time). The result shows "was …" |
| Delete | delete / cancel / remove / drop X | Deletes the task, always after confirmation |

A command matches the **open** task whose title contains at least **60%** of the command's meaningful words, compared without case. With no match, a reschedule becomes a new task, and a complete or delete is skipped with "Couldn't find…" ([NU-E29](../03-modules/NU-note-understanding.md#nu-e29)).

## Skipped text (NU-4)

Items that start with *idea, note, thought, remember that* or *fyi*, and filler such as "hmm", "ok", "test" or "thanks". They stay in the note but make no task.

## Vietnamese (Q3)

Notes can be written in English, Vietnamese or a mix. Both phrase sets are always active, so no language detection is needed. Titles keep the user's diacritics. Generated note names and all UI text stay in English.

| Field | Vietnamese phrases | Same as |
|---|---|---|
| Splitting | *rồi*, *sau đó* (whole words, with words after them). *và* never splits | *then* |
| Due date | hôm nay, tối nay, mai / ngày mai, mốt / ngày mốt, thứ 2 … thứ 7 / thứ hai … thứ bảy / T2 … T7, chủ nhật / CN, tuần sau / tuần tới, 3 ngày nữa, cuối tuần, cuối tháng, ngày 26/10, 26 tháng 10 | today, tonight, tomorrow, day after tomorrow, Monday … Sunday, next week, in 3 days, end of the week, end of the month, 26 Oct |
| Time | 9h, 9h30, 9 giờ, 9 giờ 30, lúc 14h. sáng (09:00), trưa (12:00), chiều (15:00), tối (19:00), tối nay (20:00). *sáng / chiều / tối* after an hour sets am or pm: 2 giờ chiều → 14:00 | 9am, 9:30, at 14, morning, noon, evening, tonight |
| Priority | gấp, khẩn, quan trọng, ưu tiên, hạn chót, thi, kiểm tra, nộp → High. không gấp, khi nào rảnh → Low | urgent, important, deadline, exam, quiz, submit → High. whenever, someday → Low |
| Repeat | mỗi ngày / hằng ngày / hàng ngày, mỗi tuần / hằng tuần, mỗi thứ 2, mỗi tháng / hằng tháng | every day, every week, every Monday, every month |
| Reminder | thi, kiểm tra → 1 day before | exam, quiz |
| Lead-ins (removed from the title) | nhớ, phải, cần, cần phải | remember to, I need to |
| Complete | xong X, đã xong X, X xong rồi | done X, X is done |
| Reschedule | dời / chuyển / hoãn X sang / qua / đến \<when> | move / postpone X to \<when> |
| Delete | xóa / xoá / hủy / huỷ / bỏ X | delete / cancel / remove X |
| Skipped text | Items that start with *ý tưởng, ghi chú, lưu ý*. Filler: ừ, ừm, cảm ơn, thử | idea, note, fyi; thanks, test |

**Vietnamese is typed with diacritics.** Phrases match only as written with their accents. Without them, many words become ambiguous (*toi* could be *tối* "evening" or *tôi* "I"), so unaccented Vietnamese is treated like any other language ([NU-E40](../03-modules/NU-note-understanding.md#nu-e40)).

## Safety rules

| ID | Rule | Ref |
|---|---|---|
| <a id="br-01"></a>BR-01 | Any delete, or more than 5 changes from one note, needs Apply changes before anything happens | [NU-5](../03-modules/NU-note-understanding.md#nu-5) |
| <a id="br-02"></a>BR-02 | A note with no actionable item gets one question: Keep as note, or Make it a task | [RV-3](../03-modules/RV-review-control.md#rv-3) |
| <a id="br-03"></a>BR-03 | Every applied note can be undone as a whole from its result screen | [RV-2](../03-modules/RV-review-control.md#rv-2), [NF-11](../05-quality/nfr.md#nf-11) |
| <a id="br-04"></a>BR-04 | Offline notes wait. They are processed on reconnect, in order, under the same rules | [NC-6](../03-modules/NC-note-capture.md#nc-6) |

## Naming a note (NU-6)

| Plan | Name | Example |
|---|---|---|
| One task | The task's title | Call mum |
| One change | "Update:" + title | Update: Renew gym membership |
| Only changes | "Updates to N tasks" | Updates to 3 tasks |
| All tasks in one project | Project + "to-dos" | SQL Course to-dos |
| All tasks due the same day | Today's plan / Tomorrow's plan / weekday + plan | Monday plan |
| All due within 7 days | This week | This week |
| Anything else | First title + "+ N more" | Call mum + 1 more |
| Nothing actionable | The note's first words (up to 6) | Ideas for the portfolio site |

The first row that matches wins. Names longer than 34 characters are cut at a word boundary with an ellipsis.

## Other rules

| ID | Rule | Ref |
|---|---|---|
| <a id="br-10"></a>BR-10 | Only a title is needed to create a task by hand | [NC-7](../03-modules/NC-note-capture.md#nc-7) |
| <a id="br-11"></a>BR-11 | A schedule's end must be later than its start: "End time must be later than the start time." | [TK-3](../03-modules/TK-tasks.md#tk-3) |
| <a id="br-12"></a>BR-12 | A reminder fires at its offset from the start time, or from 09:00 on the due date when there is no time | [TK-6](../03-modules/TK-tasks.md#tk-6) |
| <a id="br-13"></a>BR-13 | Completing a repeating task creates the next one. Deleting one asks "This task only" or "This and all future" | [TK-4](../03-modules/TK-tasks.md#tk-4) |
| <a id="br-14"></a>BR-14 | Deleting a task asks for confirmation, and the toast offers Undo | [TK-5](../03-modules/TK-tasks.md#tk-5) |
| <a id="br-15"></a>BR-15 | Deleting a project asks whether to move its tasks to No project or delete them too. The toast offers Undo | [PJ-4](../03-modules/PJ-projects.md#pj-4) |
| <a id="br-16"></a>BR-16 | A project has a name and one of 8 colours | [PJ-1](../03-modules/PJ-projects.md#pj-1) |
| <a id="br-17"></a>BR-17 | A password is at least 8 characters and differs from the email | [AA-1](../03-modules/AA-account-access.md#aa-1) |
| <a id="br-18"></a>BR-18 | After 3 failed sign-ins, Sign in is disabled for 60 s with a countdown | [AA-3](../03-modules/AA-account-access.md#aa-3) |
| <a id="br-19"></a>BR-19 | Password reset shows the same confirmation whether or not the account exists. The link is single-use and expires in 60 minutes. Resend unlocks after 45 s | [AA-4](../03-modules/AA-account-access.md#aa-4), [NF-10](../05-quality/nfr.md#nf-10) |
| <a id="br-20"></a>BR-20 | Inbox shows Overdue before Today | [LV-1](../03-modules/LV-lists-search.md#lv-1) |
| <a id="br-21"></a>BR-21 | Offline conflicts resolve last-write-wins **per field** | [NF-6](../05-quality/nfr.md#nf-6) |
| <a id="br-22"></a>BR-22 | Files up to 5 MB: text, Markdown, CSV, PDF, Word, photos. The file is discarded after text extraction | [NC-4](../03-modules/NC-note-capture.md#nc-4), [NF-9](../05-quality/nfr.md#nf-9) |
