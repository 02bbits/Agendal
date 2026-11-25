import http from "k6/http";
import { check, sleep } from "k6";
import { Trend } from "k6/metrics";
import { apiHeaders, signIn, uuidv4 } from "./lib/auth.js";

/**
 * IM-63 / NF-5 / PERF-02:
 * - Note of up to 10 items: processed and shown in <= 2 s p90 (rules-only <= 300 ms p90)
 * - Max-limit note (30 items, NF-14): processed within <= 2 s p90
 * - Apply / Undo roundtrip: write endpoints <= 500 ms p95
 */
const BASE_URL = __ENV.BASE_URL || "http://127.0.0.1:8000";
const USER_EMAIL = __ENV.PERF_EMAIL || "example@gmail.com";
const USER_PASSWORD = __ENV.PERF_PASSWORD || "password";
const RULES_ONLY = __ENV.RULES_ONLY === "true";

const noteProcessingDuration = new Trend("note_processing_duration", true);
const noteMaxItemsDuration = new Trend("note_max_items_duration", true);
const noteUndoLatency = new Trend("note_undo_latency", true);

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

const THIRTY_ITEM_NOTE = Array.from({ length: 30 }, (_, i) =>
  `Task item #${i + 1} prepare checklist tomorrow at ${String(8 + (i % 10)).padStart(2, "0")}:00`,
).join("\n");

export const options = {
  noCookiesReset: true,
  scenarios: {
    note_budget: {
      executor: "constant-arrival-rate",
      rate: Number(__ENV.NOTE_RATE || 2), // PERF-02: 2 notes/s burst
      timeUnit: "1s",
      duration: __ENV.NOTE_DURATION || "30s",
      preAllocatedVUs: Number(__ENV.PRE_ALLOCATED_VUS || 5),
      maxVUs: Number(__ENV.MAX_VUS || 20),
      exec: "note10Items",
    },
    note_max_items: {
      executor: "per-vu-iterations",
      vus: 1,
      iterations: Number(__ENV.MAX_NOTE_ITERATIONS || 5),
      startTime: "5s",
      exec: "note30ItemsAndUndo",
    },
  },
  thresholds: {
    note_processing_duration: [
      RULES_ONLY ? "p(90)<300" : "p(90)<2000",
    ],
    note_max_items_duration: ["p(90)<2000"],
    note_undo_latency: ["p(95)<500"],
    http_req_failed: ["rate<0.001"],
    checks: ["rate>0.99"],
  },
};

export function setup() {
  const res = http.get(`${BASE_URL}/api/v1/health`);
  check(res, { "health 200": (r) => r.status === 200 });
}

let loggedIn = false;

function ensureLogin() {
  if (loggedIn) return;
  const poolSize = Number(__ENV.PERF_USER_COUNT || 1);
  const email =
    poolSize > 1
      ? `perf${((__VU - 1) % poolSize) + 1}@agendal.test`
      : USER_EMAIL;
  loggedIn = signIn(BASE_URL, email, USER_PASSWORD);
}

export function note10Items() {
  ensureLogin();

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

  const ok = check(res, {
    "note 10 items processed (201)": (r) => r.status === 201,
    "note has id": (r) => {
      try {
        const body = r.json();
        return Boolean(body?.note?.id || body?.data?.id || body?.id);
      } catch {
        return false;
      }
    },
  });

  if (!ok && res.status !== 201) {
    console.error(`note10Items failed: status=${res.status} body=${res.body}`);
  }

  sleep(0.1);
}

export function note30ItemsAndUndo() {
  ensureLogin();

  const payload = JSON.stringify({
    client_id: uuidv4(),
    text: THIRTY_ITEM_NOTE,
    written_at: new Date().toISOString(),
    timezone: "Asia/Ho_Chi_Minh",
  });

  const res = http.post(`${BASE_URL}/api/v1/notes`, payload, {
    headers: apiHeaders(BASE_URL),
    tags: { name: "post_notes_30_items" },
  });

  noteMaxItemsDuration.add(res.timings.duration);

  let noteId = null;
  let noteStatus = null;
  try {
    const body = res.json();
    noteId = body?.note?.id || body?.data?.id || body?.id || null;
    noteStatus = body?.note?.status || body?.data?.status || body?.status || null;
  } catch {
    // handled by check
  }

  const ok = check(res, {
    "note 30 items processed (201)": (r) => r.status === 201,
    "30-item note has id": () => Boolean(noteId),
  });

  if (!ok && res.status !== 201) {
    console.error(`note30Items failed: status=${res.status} body=${res.body}`);
  }

  // Exercise undo if note auto-applied tasks (status === "done")
  if (noteId && noteStatus === "done") {
    const undoRes = http.post(
      `${BASE_URL}/api/v1/notes/${noteId}/undo`,
      JSON.stringify({ confirm_conflicts: true }),
      { headers: apiHeaders(BASE_URL), tags: { name: "note_undo" } },
    );
    noteUndoLatency.add(undoRes.timings.duration);
    check(undoRes, { "note undo (200)": (r) => r.status === 200 });
  }

  sleep(0.2);
}
