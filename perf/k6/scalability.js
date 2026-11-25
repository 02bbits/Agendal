import http from "k6/http";
import { check, sleep } from "k6";
import { Trend } from "k6/metrics";
import { apiHeaders, signIn, uuidv4 } from "./lib/auth.js";

/**
 * IM-63 / Scalability SLOs (PERF-01, PERF-04, PERF-05):
 * - Read endpoints latency: p95 <= 300 ms
 * - Write endpoints latency: p95 <= 500 ms
 * - Reconnect sync (100 edits + pull): <= 10 s
 * - PERF-05 (5,000 tasks user): search, counts, lists, sync <= 300 ms p95
 * - Error rate < 0.1%
 */
const BASE_URL = __ENV.BASE_URL || "http://127.0.0.1:8000";
const USER_EMAIL = __ENV.PERF_EMAIL || "example@gmail.com";
const USER_PASSWORD = __ENV.PERF_PASSWORD || "password";
const HEAVY_EMAIL = __ENV.HEAVY_EMAIL || "perf-heavy@agendal.test";

const readLatency = new Trend("read_latency", true);
const writeLatency = new Trend("write_latency", true);
const reconnectSyncDuration = new Trend("reconnect_sync_duration", true);
const heavyReadLatency = new Trend("heavy_read_latency", true);
const heavyCommandNoteDuration = new Trend("heavy_command_note_duration", true);

export const options = {
  scenarios: {
    mixed_traffic: {
      executor: "constant-arrival-rate",
      rate: Number(__ENV.MIXED_RATE || 10),
      timeUnit: "1s",
      duration: __ENV.MIXED_DURATION || "30s",
      preAllocatedVUs: Number(__ENV.PRE_ALLOCATED_VUS || 10),
      maxVUs: Number(__ENV.MAX_VUS || 30),
      exec: "mixedTraffic",
    },
    reconnect_burst: {
      executor: "per-vu-iterations",
      vus: 1,
      iterations: Number(__ENV.RECONNECT_ITERATIONS || 2),
      startTime: "5s",
      exec: "reconnectBurst",
    },
    heavy_5k_user: {
      executor: "per-vu-iterations",
      vus: 1,
      iterations: Number(__ENV.HEAVY_ITERATIONS || 10),
      startTime: "2s",
      exec: "heavy5kUser",
    },
  },
  thresholds: {
    read_latency: ["p(95)<300"],
    write_latency: ["p(95)<500"],
    reconnect_sync_duration: ["p(95)<10000"],
    heavy_read_latency: ["p(95)<300"],
    heavy_command_note_duration: ["p(90)<2000"],
    http_req_failed: ["rate<0.001"],
    checks: ["rate>0.99"],
  },
};

const sessionState = { loggedIn: false, taskId: null };
let heavyLoggedIn = false;

function ensureSession() {
  if (sessionState.loggedIn) return;
  const poolSize = Number(__ENV.PERF_USER_COUNT || 1);
  const email =
    poolSize > 1
      ? `perf${((__VU - 1) % poolSize) + 1}@agendal.test`
      : USER_EMAIL;
  sessionState.loggedIn = signIn(BASE_URL, email, USER_PASSWORD);

  const createRes = http.post(
    `${BASE_URL}/api/v1/tasks`,
    JSON.stringify({
      id: uuidv4(),
      title: `Perf baseline task VU ${__VU}`,
      due_date: "2026-12-01",
    }),
    { headers: apiHeaders(BASE_URL), tags: { name: "setup_task" } },
  );
  if (createRes.status === 201) {
    try {
      const body = createRes.json();
      sessionState.taskId = body?.data?.id || body?.id || null;
    } catch {
      sessionState.taskId = null;
    }
  }
}

export function mixedTraffic() {
  ensureSession();
  const headers = apiHeaders(BASE_URL);
  const roll = Math.random();

  if (roll < 0.6) {
    // 60% Lists / Reads (PERF-01)
    const endpoints = [
      "/api/v1/tasks",
      "/api/v1/counts",
      "/api/v1/projects",
      "/api/v1/tasks/search?q=perf",
    ];
    const path = endpoints[Math.floor(Math.random() * endpoints.length)];
    const res = http.get(`${BASE_URL}${path}`, {
      headers,
      tags: { name: `read_${path}` },
    });
    readLatency.add(res.timings.duration);
    check(res, { "read 200": (r) => r.status === 200 });
  } else if (roll < 0.85) {
    // 25% Sync pull
    const res = http.get(`${BASE_URL}/api/v1/sync?cursor=0&limit=100`, {
      headers,
      tags: { name: "sync_pull" },
    });
    readLatency.add(res.timings.duration);
    check(res, { "sync pull 200": (r) => r.status === 200 });
  } else {
    // 15% Task edit / write
    if (sessionState.taskId) {
      const res = http.patch(
        `${BASE_URL}/api/v1/tasks/${sessionState.taskId}`,
        JSON.stringify({
          title: `Perf task updated ${Date.now()}`,
        }),
        { headers, tags: { name: "task_patch" } },
      );
      writeLatency.add(res.timings.duration);
      check(res, { "write 200": (r) => r.status === 200 });
    }
  }

  sleep(0.05);
}

export function reconnectBurst() {
  ensureSession();
  if (!sessionState.taskId) return;

  const headers = apiHeaders(BASE_URL);
  const started = Date.now();
  const nowIso = new Date().toISOString();

  // PERF-04: 100 queued field patches + sync pull within 10 s
  const patches = [];
  for (let i = 0; i < 100; i += 1) {
    patches.push({
      entity: "task",
      id: sessionState.taskId,
      field: "notes",
      value: `Reconnect batch patch #${i}`,
      at: nowIso,
    });
  }

  const patchRes = http.post(
    `${BASE_URL}/api/v1/sync/patches`,
    JSON.stringify(patches),
    { headers, tags: { name: "reconnect_patches_100" } },
  );
  check(patchRes, { "reconnect patches 200": (r) => r.status === 200 });

  const pullRes = http.get(`${BASE_URL}/api/v1/sync?cursor=0&limit=500`, {
    headers,
    tags: { name: "reconnect_pull" },
  });
  check(pullRes, { "reconnect pull 200": (r) => r.status === 200 });

  reconnectSyncDuration.add(Date.now() - started);
}

export function heavy5kUser() {
  if (!heavyLoggedIn) {
    heavyLoggedIn = signIn(BASE_URL, HEAVY_EMAIL, USER_PASSWORD);
  }
  const headers = apiHeaders(BASE_URL);

  // PERF-05: User with 5,000 tasks — tasks list, counts, task search, note search, sync page
  const heavyReadEndpoints = [
    "/api/v1/tasks",
    "/api/v1/counts",
    "/api/v1/tasks/search?q=report",
    "/api/v1/tasks/search?q=bao%20cao&filter=overdue",
    "/api/v1/notes/search?q=meeting",
    "/api/v1/sync?full=1&limit=500",
  ];

  for (const path of heavyReadEndpoints) {
    const res = http.get(`${BASE_URL}${path}`, {
      headers,
      tags: { name: `heavy5k_${path.split("?")[0]}` },
    });
    heavyReadLatency.add(res.timings.duration);
    check(res, { "heavy 5k read 200": (r) => r.status === 200 });
  }

  // Command matching (TaskCandidates pg_trgm) across 5,000 tasks
  const cmdRes = http.post(
    `${BASE_URL}/api/v1/notes`,
    JSON.stringify({
      client_id: uuidv4(),
      text: "Move quarterly report to next Friday and complete groceries task",
      written_at: new Date().toISOString(),
      timezone: "Asia/Ho_Chi_Minh",
    }),
    { headers, tags: { name: "heavy5k_note_command" } },
  );
  heavyCommandNoteDuration.add(cmdRes.timings.duration);
  check(cmdRes, { "heavy 5k note command (201)": (r) => r.status === 201 });

  sleep(0.1);
}
