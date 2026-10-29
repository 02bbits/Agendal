<?php

declare(strict_types=1);

namespace App\Services\Notes;

final class NoteVocabulary
{
    public const VERBS = 'buy|call|email|finish|read|submit|write|book|clean|cook|pay|order|send|ask|meet|check|review|update|fix|print|schedule|prepare|organize|organise|study|revise|practice|practise|draft|complete|create|do|make|pick|collect|get|wash|tidy|take|bring|return|cancel|reschedule|postpone|remind|tell|contact|message|text|research|inspect|test|sign|renew|apply|register|exercise|workout|work|attend|join|listen|watch|find|choose|arrange|discuss|plan|set|upload|download|backup|deploy|learn|pack|unpack|feed|water|deliver|ship|invite|hire|fill|sort|search|start|begin|continue|reopen|change|replace|share|push|pull|cut|repair|setup|look|charge|clear|iron|mend|mua|gọi|gởi|gửi|làm|học|nộp|đọc|viết|đặt|dọn|nấu|trả|hỏi|gặp|xem|kiểm tra|sửa|in|chuẩn bị|ôn|luyện|tập|soạn|hoàn thành|tạo|lấy|đón|giặt|mang|đem|hủy|huỷ|dời|chuyển|hoãn|nhắc|bảo|liên hệ|nhắn|nghiên cứu|ký|gia hạn|đăng ký|tham gia|nghe|tìm|chọn|sắp xếp|thảo luận|lên lịch|tải|sao lưu|gói|mở|tưới|giao|mời|thuê|điền|bắt đầu|tiếp tục|thay|chia sẻ|cắt|cài đặt|sạc|quét|rửa|chạy|đi';

    public const SKIP_PREFIXES = 'idea|note|thought|remember that|fyi|ý tưởng|ghi chú|lưu ý';

    public const COMPLETE = 'done|finished|did|đã xong|xong';

    public const MOVE = 'move|push|reschedule|postpone|dời|chuyển|hoãn';

    public const DELETE = 'delete|cancel|remove|drop|xóa|xoá|hủy|huỷ|bỏ';

    /** Unicode word boundaries also work on Vietnamese words ending in an accented letter. */
    public static function pattern(string $phrases): string
    {
        return '~(?<![\p{L}\p{N}_])(?:'.$phrases.')(?![\p{L}\p{N}_])~iu';
    }

    public static function startsWithVerb(string $text): bool
    {
        return preg_match('~^(?:'.self::VERBS.')(?![\p{L}\p{N}_])~iu', $text) === 1;
    }
}
