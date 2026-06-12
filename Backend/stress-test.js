import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';
import exec from 'k6/execution';

const errorRate = new Rate('errors');
const matchesDuration = new Trend('matches_duration');

const NUM_USERS = 25;

export const options = {
  stages: [
    { duration: '30s', target: 10 },
    { duration: '1m',  target: 50 },
    { duration: '30s', target: 100 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],
    errors: ['rate<0.01'],
  },
};

const BASE = 'http://localhost:80/api/v1';
const JSON_HEADERS = { 'Content-Type': 'application/json' };

export function setup() {
  // Login as admin to create the shared room
  const adminLogin = http.post(
    `${BASE}/auth/login`,
    JSON.stringify({ email: 'admin@sureshot.com', password: 'Admin1234!' }),
    { headers: JSON_HEADERS },
  );
  const adminToken = adminLogin.json('accessToken');
  if (!adminToken) {
    console.error('Admin login failed:', adminLogin.status, adminLogin.body);
    return { users: [], roomId: null };
  }

  const adminHeaders = { ...JSON_HEADERS, Authorization: `Bearer ${adminToken}` };

  const roomRes = http.post(
    `${BASE}/rooms`,
    JSON.stringify({ name: 'k6-stress-test' }),
    { headers: adminHeaders },
  );
  const roomId = roomRes.json('id');
  const inviteCode = roomRes.json('inviteCode');
  if (!roomId || !inviteCode) {
    console.error('Room creation failed:', roomRes.status, roomRes.body);
    return { users: [], roomId: null };
  }

  // Register NUM_USERS test users and join them to the room
  const users = [];
  for (let i = 0; i < NUM_USERS; i++) {
    const email = `k6-user-${i}@stress.test`;
    const password = 'K6Test1234!';

    // Register (ignore conflict — user may exist from prior run)
    http.post(
      `${BASE}/auth/register`,
      JSON.stringify({ name: `k6-user-${i}`, email, password }),
      { headers: JSON_HEADERS },
    );

    const loginRes = http.post(
      `${BASE}/auth/login`,
      JSON.stringify({ email, password }),
      { headers: JSON_HEADERS },
    );
    const token = loginRes.json('accessToken');
    if (!token) {
      console.error(`Login failed for user ${i}:`, loginRes.status, loginRes.body);
      continue;
    }

    // Join the room via invite code
    http.post(
      `${BASE}/rooms/join`,
      JSON.stringify({ inviteCode }),
      { headers: { ...JSON_HEADERS, Authorization: `Bearer ${token}` } },
    );

    users.push({ token });
  }

  return { users, roomId };
}

export default function (data) {
  const { users, roomId } = data;
  if (!users.length || !roomId) return;

  const { token } = users[(exec.vu.idInTest - 1) % users.length];
  const authHeaders = { Authorization: `Bearer ${token}` };

  // Health check
  const health = http.get(`${BASE}/health`);
  check(health, { 'health 200': (r) => r.status === 200 });
  errorRate.add(health.status !== 200);

  // Matches (public)
  const matches = http.get(`${BASE}/matches`);
  matchesDuration.add(matches.timings.duration);
  check(matches, { 'matches 200': (r) => r.status === 200 });

  // Leaderboard
  const lb = http.get(`${BASE}/rooms/${roomId}/leaderboard`, { headers: authHeaders });
  check(lb, { 'leaderboard ok': (r) => r.status === 200 });

  sleep(1);
}
