/**
 * Task Verbs and Signal Words used for Comma-List Merging (NU-1, NU-E33)
 *
 * Rules:
 * A fragment after a comma merges with the item before it when:
 * 1. The item before it starts with a task verb (common actions).
 * 2. The fragment has NO signal of its own (no verb, date, time, priority, project keyword, or skip prefix).
 */

export const TASK_VERBS_EN = new Set([
  'buy', 'call', 'email', 'finish', 'read', 'submit', 'write', 'book', 'clean', 'cook',
  'pay', 'order', 'send', 'ask', 'meet', 'check', 'review', 'update', 'fix', 'print',
  'schedule', 'prepare', 'organize', 'organise', 'study', 'revise', 'practice', 'practise',
  'draft', 'complete', 'create', 'do', 'make', 'pick', 'collect', 'get', 'wash', 'tidy',
  'take', 'bring', 'return', 'cancel', 'reschedule', 'postpone', 'remind', 'tell', 'contact',
  'message', 'text', 'research', 'inspect', 'test', 'sign', 'renew', 'apply', 'register',
  'exercise', 'workout', 'work', 'attend', 'join', 'listen', 'watch', 'find', 'choose',
  'arrange', 'discuss', 'plan', 'set', 'upload', 'download', 'backup', 'deploy', 'learn',
  'pack', 'unpack', 'feed', 'water', 'deliver', 'ship', 'invite', 'hire', 'fill', 'sort',
  'search', 'start', 'begin', 'continue', 'reopen', 'change', 'replace', 'share', 'push',
  'pull', 'cut', 'repair', 'setup', 'set up', 'look', 'charge', 'clear', 'iron', 'mend'
]);

export const TASK_VERBS_VI = new Set([
  'mua', 'gọi', 'gởi', 'gửi', 'làm', 'học', 'nộp', 'đọc', 'viết', 'đặt', 'dọn', 'nấu',
  'trả', 'hỏi', 'gặp', 'xem', 'kiểm tra', 'sửa', 'in', 'chuẩn bị', 'ôn', 'luyện',
  'tập', 'soạn', 'hoàn thành', 'tạo', 'lấy', 'đón', 'giặt', 'mang', 'đem', 'trả lại',
  'hủy', 'huỷ', 'dời', 'chuyển', 'hoãn', 'nhắc', 'bảo', 'liên hệ', 'nhắn', 'nghiên cứu',
  'ký', 'gia hạn', 'đăng ký', 'tham gia', 'nghe', 'tìm', 'chọn', 'sắp xếp', 'thảo luận',
  'lên lịch', 'tải', 'sao lưu', 'gói', 'mở', 'tưới', 'giao', 'mời', 'thuê', 'điền',
  'bắt đầu', 'tiếp tục', 'thay', 'chia sẻ', 'cắt', 'cài đặt', 'sạc', 'quét', 'rửa', 'chạy bộ', 'đi chợ'
]);

export const COMMAND_VERBS = new Set([
  'done', 'finished', 'did', 'move', 'push', 'reschedule', 'postpone', 'delete', 'cancel', 'remove', 'drop',
  'xong', 'đã xong', 'dời', 'chuyển', 'hoãn', 'xóa', 'xoá', 'hủy', 'huỷ', 'bỏ'
]);

export const SKIP_PREFIXES = [
  'idea:', 'idea', 'note:', 'note', 'thought:', 'thought', 'remember that:', 'remember that', 'fyi:', 'fyi',
  'ý tưởng:', 'ý tưởng', 'ghi chú:', 'ghi chú', 'lưu ý:', 'lưu ý'
];

export const FILLER_WORDS = new Set([
  'hmm', 'ok', 'okay', 'test', 'thanks', 'thank you', 'cool', 'lol',
  'ừ', 'ừm', 'cảm ơn', 'thử'
]);

export const DATE_TIME_SIGNALS = [
  // English
  'today', 'tonight', 'tomorrow', 'tmr', 'yesterday',
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
  'mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun',
  'morning', 'noon', 'afternoon', 'evening', 'night',
  'am', 'pm', 'weekly', 'daily', 'monthly',
  // Vietnamese
  'hôm nay', 'tối nay', 'mai', 'ngày mai', 'mốt', 'ngày mốt',
  'thứ 2', 'thứ 3', 'thứ 4', 'thứ 5', 'thứ 6', 'thứ 7', 'chủ nhật',
  'thứ hai', 'thứ ba', 'thứ tư', 'thứ năm', 'thứ sáu', 'thứ bảy',
  't2', 't3', 't4', 't5', 't6', 't7', 'cn',
  'sáng', 'trưa', 'chiều', 'tối', 'mỗi ngày', 'hằng ngày', 'mỗi tuần'
];

export const KNOWN_ABBREVIATIONS = new Set([
  'dr', 'prof', 'mr', 'mrs', 'ms', 'st', 'no', 'vs', 'etc', 'e.g', 'i.e'
]);
