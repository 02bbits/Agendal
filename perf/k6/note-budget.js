import http from "k6/http";
import { check, sleep } from "k6";
import { Trend } from "k6/metrics";
import { apiHeaders, signIn, uuidv4 } from "./lib/auth.js";

/**
 * IM-63 / NF-5 / PERF-02:
 * Note processing budget: a note of up to 10 items is processed and its result
 * shown in <= 2 s (p90) when online (rules-only path <= 300 ms p90).
 */
const BASE_URL = __ENV.BASE_URL || "http://127.0.0.1:8000";
const USER_EMAIL = __ENV.PERF_EMAIL || "example@gmail.com";
const USER_PASSWORD = __ENV.PERF_PASSWORD || "password";
const RULES_ONLY = __ENV.RULES_ONLY === "true";

const noteProcessingDuration = new Trend("note_processing_duration", true);

const TEN_ITEM_NOTE = [
  "Buy groceries tomorrow at 09:00",
  "Email the group about the ER diagram today p1",
  "Review HCI wireframe notes on Friday #HCI",
  "Pay electricity bill by 2026-11-28 18:00 #Personal",
  "Finish SQL Lab 4 queries tomorrow 14:00 #SQL Course",
  "Team sync for Adv Web project next Monday at 10:00 #Adv Web",
  "Prepare portfolio case study slides on Wednesday #Portfolio",
  "Renew gym membership every month starting 2026-12-01 #Personal",
  "Call dentist to reschedule appointment tomorrow morning",
  "Submit weekly progress report on Friday at 17:00 p2",
].join("\n");

export const options = {
  scenarios: {
    note_budget: {
      executor: "constant-arrival-rate",
      rate: Number(__ENV.NOTE_RATE || 2), // PERF-02: 2 notes/s burst
      timeUnit: "1s",
      duration: __ENV.NOTE_DURATION || "30s",
      preAllocatedVUs: Number(__ENV.PRE_ALLOCATED_VUS || 5),
      maxVUs: Number(__ENV.MAX_VUS || 20),
    },
  },
  thresholds: {
    note_processing_duration: [
      RULES_ONLY ? "p(90)<300" : "p(90)<2000",
    ],
    http_req_failed: ["rate<0.001"],
    checks: ["rate>0.99"],
  },
};

export function setup() {
  // Verify health before load starts
  const res = http.get(`${BASE_URL}/api/v1/health`);
  check(res, { "health 200": (r) => r.status === 200 });
}

let loggedIn = false;

export default function () {
  if (!loggedIn) {
    // Support multi-user pools (perf1..perfN) when PERF_USER_COUNT > 1 to respect per-user rate limits
    const poolSize = Number(__ENV.PERF_USER_COUNT || 1);
    const email =
      poolSize > 1
        ? `perf${((__VU - 1) % poolSize) + 1}@agendal.test`
        : USER_EMAIL;
    loggedIn = signIn(BASE_URL, email, USER_PASSWORD);
  }

  const payload = JSON.stringify({
    client_id: uuidv4(),
    text: TEN_ITEM_NOTE,
    written_at: new Date().toISOString(),
    timezone: "Asia/Ho_Chi_Minh",
  });

  const res = http.post(`${BASE_URL}/api/v1/notes`, payload, {
    headers: apiHeaders(BASE_URL),
    tags: { name: "post_notes_10_items" },
  });

  noteProcessingDuration.add(res.timings.duration);

  check(res, {
    "note processed (201)": (r) => r.status === 201,
    "note has id and status": (r) => {
      try {
        const body = r.json();
        return Boolean(body?.data?.id || body?.id);
      } catch {
        return false;
      }
    },
  });

  sleep(0.1);
}
