/**
 * OpenRouter Language-Model Fallback for Low-Confidence Items (IM-38, ADR-008, SC-12, SC-13, SC-20, SC-21)
 *
 * Requirements:
 * - Only low-confidence items are sent (§2.5, ADR-008)
 * - Minimum context: low-confidence items, now, timezone, project names, and <= 20 candidate task titles with opaque IDs
 * - Never send email, user display name, other notes, or task notes (SC-20, SEC-43)
 * - Provider routing: `data_collection: "deny"` and `require_parameters: true`
 * - Structured Outputs with strict JSON Schema and candidate IDs as enum (SC-13, SEC-40)
 * - 1.5s timeout per request (NF-5, ADR-008)
 * - Fall back to rules on error, timeout, kill switch, or budget limit with engine = 'rules_fallback'
 * - Cost controls: <= 20 calls/day per user, global token budget, kill switch NOTE_LLM_ENABLED (SC-12, SEC-42)
 * - Metadata-only logging: counts, duration, tokens, NEVER note text (SC-21, SEC-44)
 * - Recorded stub / mock client for deterministic CI testing
 */

export const DEFAULT_TIMEOUT_MS = 1500;
export const MAX_USER_DAILY_CALLS = 20;
export const MAX_CANDIDATE_TASKS = 20;

/**
 * Detect if an item has low confidence under rules
 *
 * @param {string} item
 * @param {object} [options]
 * @returns {boolean}
 */
export function isLowConfidenceItem(item, options = {}) {
  const text = item.trim();
  if (!text) return false;

  // 1. Invalid date/time tokens (e.g. 31/2, 3pmish, 25:00)
  if (/\b(?:3[2-9]\/\d+|\d+\/1[3-9]|31\/0?2|\d+pmish|\d+amish|2[4-9]:\d{2})\b/i.test(text)) {
    return true;
  }

  // 2. Unaccented Vietnamese: words matching common VI vocabulary without diacritics (NU-E40)
  const unaccentedViWords = /\b(mua|ban|lam|bai|tap|hoc|nop|di|gap|nhac|hen|sang|trua|chieu|toi|ngay|mai|tuan|sau)\b/i;
  // If it contains multiple unaccented VI keywords and no diacritics
  const hasDiacritics = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i.test(text);
  if (!hasDiacritics && unaccentedViWords.test(text)) {
    const matches = text.match(new RegExp(unaccentedViWords.source, 'gi'));
    if (matches && matches.length >= 2) {
      return true;
    }
  }

  // 3. Command-like with no open match or ambiguous instruction
  if (/^(?:done|finish|did|delete|remove|reschedule|move|dời|xóa|hủy)\b/i.test(text)) {
    if (options.hasCommandMatch === false) {
      return true;
    }
  }

  // 4. Missing verb or object (e.g. text that has only random words without clear verb/task)
  if (options.missingVerbOrObject) {
    return true;
  }

  // 5. Foreign language not English or Vietnamese (NU-E28)
  if (options.isForeignLanguage) {
    return true;
  }

  return false;
}

/**
 * Build OpenRouter Structured Outputs JSON Schema
 * Candidate task IDs are strictly constrained as an enum to prevent hallucinated IDs (SC-13, SEC-40)
 */
export function buildPlanJsonSchema(candidateTaskIds = [], userProjects = []) {
  const candidateEnum = candidateTaskIds.length > 0 ? candidateTaskIds : ['NONE'];
  const projectEnum = [...userProjects, null];

  return {
    type: 'object',
    required: ['create', 'update', 'delete'],
    additionalProperties: false,
    properties: {
      create: {
        type: 'array',
        items: {
          type: 'object',
          required: ['title', 'due_date', 'start_time', 'end_time', 'priority', 'project_name', 'repeat', 'reminder'],
          additionalProperties: false,
          properties: {
            title: { type: 'string', minLength: 1, maxLength: 200 },
            due_date: { type: ['string', 'null'] },
            start_time: { type: ['string', 'null'] },
            end_time: { type: ['string', 'null'] },
            priority: { type: 'string', enum: ['low', 'medium', 'high'] },
            project_name: { type: ['string', 'null'] },
            repeat: { type: 'string', enum: ['never', 'daily', 'weekly', 'monthly', 'yearly'] },
            reminder: { type: 'string', enum: ['none', '5m', '15m', '30m', '1h', '1d'] },
          },
        },
      },
      update: {
        type: 'array',
        items: {
          type: 'object',
          required: ['task_id', 'done', 'due_date', 'start_time', 'label'],
          additionalProperties: false,
          properties: {
            task_id: { type: 'string', enum: candidateEnum },
            done: { type: ['boolean', 'null'] },
            due_date: { type: ['string', 'null'] },
            start_time: { type: ['string', 'null'] },
            label: { type: 'string' },
          },
        },
      },
      delete: {
        type: 'array',
        items: {
          type: 'object',
          required: ['task_id', 'label'],
          additionalProperties: false,
          properties: {
            task_id: { type: 'string', enum: candidateEnum },
            label: { type: 'string' },
          },
        },
      },
    },
  };
}

/**
 * Build OpenRouter Request Body conforming to ADR-008, SC-13, SC-20, SEC-43
 */
export function buildOpenRouterRequestBody({
  lowConfidenceItems,
  clockContext,
  userProjects = [],
  candidateTasks = [],
  model = 'openai/gpt-4o-mini',
}) {
  // Candidate tasks restricted to max 20, containing only opaque ID and title
  const safeCandidates = candidateTasks.slice(0, MAX_CANDIDATE_TASKS).map(t => ({
    id: String(t.id),
    title: String(t.title),
  }));

  const candidateIds = safeCandidates.map(c => c.id);
  const schema = buildPlanJsonSchema(candidateIds, userProjects);

  const systemPrompt = [
    'You are the Agendal Note Understanding fallback engine.',
    'Extract actionable tasks or task changes from the provided low-confidence items.',
    'Strictly follow the JSON schema.',
    'Never invent task IDs not listed in candidate_tasks.',
    'If an item cannot be understood or is purely non-actionable, return empty arrays.',
  ].join(' ');

  const userContext = {
    now: clockContext.now instanceof Date ? clockContext.now.toISOString() : String(clockContext.now),
    timezone: clockContext.timezone || 'Asia/Ho_Chi_Minh',
    user_projects: userProjects,
    candidate_tasks: safeCandidates,
    items: lowConfidenceItems,
  };

  return {
    model,
    temperature: 0,
    provider: {
      require_parameters: true,
      data_collection: 'deny',
    },
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: JSON.stringify(userContext) },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'plan',
        strict: true,
        schema,
      },
    },
  };
}

/**
 * Budget and Rate Limiting Tracker (SC-12, SEC-42)
 */
export class FallbackBudgetTracker {
  constructor({ maxUserDailyCalls = MAX_USER_DAILY_CALLS, maxGlobalDailyTokens = 500000 } = {}) {
    this.maxUserDailyCalls = maxUserDailyCalls;
    this.maxGlobalDailyTokens = maxGlobalDailyTokens;
    this.userDailyCounts = new Map();
    this.globalDailyTokens = 0;
    this.lastResetDate = new Date().toDateString();
  }

  _checkDateReset() {
    const today = new Date().toDateString();
    if (today !== this.lastResetDate) {
      this.userDailyCounts.clear();
      this.globalDailyTokens = 0;
      this.lastResetDate = today;
    }
  }

  canMakeCall(userId) {
    this._checkDateReset();
    if (this.globalDailyTokens >= this.maxGlobalDailyTokens) {
      return { allowed: false, reason: 'global_budget_exceeded' };
    }
    const userCount = this.userDailyCounts.get(userId) || 0;
    if (userCount >= this.maxUserDailyCalls) {
      return { allowed: false, reason: 'user_daily_limit_exceeded' };
    }
    return { allowed: true };
  }

  recordUsage(userId, tokensUsed = 0) {
    this._checkDateReset();
    const count = this.userDailyCounts.get(userId) || 0;
    this.userDailyCounts.set(userId, count + 1);
    this.globalDailyTokens += tokensUsed;
  }
}

/**
 * OpenRouter Fallback Service Client
 */
export class OpenRouterFallbackService {
  /**
   * @param {object} options
   * @param {string} [options.apiKey]
   * @param {string} [options.model]
   * @param {string} [options.baseUrl]
   * @param {FallbackBudgetTracker} [options.budgetTracker]
   * @param {Function} [options.fetchFn] Custom fetch or mock stub
   * @param {number} [options.timeoutMs] Default 1500ms
   * @param {boolean} [options.enabled] Kill switch flag (default from NOTE_LLM_ENABLED)
   * @param {Function} [options.logger] Metadata-only logger function
   */
  constructor(options = {}) {
    this.apiKey = options.apiKey || process.env.NOTE_LLM_API_KEY || '';
    this.model = options.model || process.env.NOTE_LLM_MODEL || 'openai/gpt-4o-mini';
    this.baseUrl = options.baseUrl || 'https://openrouter.ai/api/v1/chat/completions';
    this.budgetTracker = options.budgetTracker || new FallbackBudgetTracker();
    this.fetchFn = options.fetchFn || globalThis.fetch;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.enabled = options.enabled ?? (process.env.NOTE_LLM_ENABLED === 'true');
    this.logger = options.logger || this._defaultLogger.bind(this);
  }

  _defaultLogger(meta) {
    // SC-21: Log only metadata: durations, counts, status. NEVER free note text!
    if (process.env.NODE_ENV !== 'test') {
      console.log(`[LLM_FALLBACK_META] status=${meta.status} durationMs=${meta.durationMs} tokens=${meta.tokensUsed ?? 0} items=${meta.itemCount}`);
    }
  }

  /**
   * Request fallback plan for low-confidence items
   *
   * @param {object} params
   * @param {string[]} params.lowConfidenceItems
   * @param {object} params.clockContext
   * @param {string[]} [params.userProjects]
   * @param {Array} [params.candidateTasks]
   * @param {string} [params.userId]
   * @returns {Promise<{ success: boolean, plan?: object, error?: string, durationMs: number }>}
   */
  async requestFallback({
    lowConfidenceItems,
    clockContext,
    userProjects = [],
    candidateTasks = [],
    userId = 'anonymous',
  }) {
    const startTime = Date.now();

    // 1. Kill-switch check (SC-12)
    if (!this.enabled) {
      this.logger({ status: 'kill_switch_disabled', durationMs: 0, itemCount: lowConfidenceItems.length });
      return { success: false, error: 'kill_switch_disabled', durationMs: 0 };
    }

    // 2. Budget & rate limit check (SC-12, SEC-42)
    const budgetCheck = this.budgetTracker.canMakeCall(userId);
    if (!budgetCheck.allowed) {
      this.logger({ status: budgetCheck.reason, durationMs: 0, itemCount: lowConfidenceItems.length });
      return { success: false, error: budgetCheck.reason, durationMs: 0 };
    }

    // 3. Build payload with security and privacy restrictions (SC-13, SC-20, SEC-43)
    const requestBody = buildOpenRouterRequestBody({
      lowConfidenceItems,
      clockContext,
      userProjects,
      candidateTasks,
      model: this.model,
    });

    // 4. Request with timeout (NF-5: 1.5s timeout)
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await this.fetchFn(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      clearTimeout(timer);
      const durationMs = Date.now() - startTime;

      if (!response.ok) {
        this.logger({ status: `http_${response.status}`, durationMs, itemCount: lowConfidenceItems.length });
        return { success: false, error: `http_error_${response.status}`, durationMs };
      }

      const data = await response.json();
      const content = data?.choices?.[0]?.message?.content;
      const tokensUsed = data?.usage?.total_tokens || 0;

      this.budgetTracker.recordUsage(userId, tokensUsed);
      this.logger({ status: 'success', durationMs, tokensUsed, itemCount: lowConfidenceItems.length });

      if (!content) {
        return { success: false, error: 'empty_response', durationMs };
      }

      const parsedPlan = JSON.parse(content);
      return { success: true, plan: parsedPlan, durationMs, tokensUsed };
    } catch (err) {
      clearTimeout(timer);
      const durationMs = Date.now() - startTime;
      const isAbort = err.name === 'AbortError';
      const status = isAbort ? 'timeout' : 'request_error';

      this.logger({ status, durationMs, itemCount: lowConfidenceItems.length });
      return { success: false, error: status, durationMs };
    }
  }
}
