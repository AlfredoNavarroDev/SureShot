import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  setupTimeout: '120s',
  stages: [
    { duration: '30s', target: 20 },
    { duration: '1m', target: 100 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.05'],
  },
};

const BASE = 'http://localhost/api/v1';
const VU_COUNT = 100;

export function setup() {
  const tokens = [];
  for (let i = 0; i < VU_COUNT; i++) {
    const res = http.post(
      `${BASE}/auth/register`,
      JSON.stringify({
        email: `k6_vu${i}_${Date.now()}@test.com`,
        name: `K6 VU ${i}`,
        password: 'password123',
      }),
      { headers: { 'Content-Type': 'application/json' } },
    );
    const token = res.json('accessToken');
    if (token) tokens.push(token);
  }
  return { tokens };
}

export default function (data) {
  const token = data.tokens[(__VU - 1) % data.tokens.length];
  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  const health = http.get(`${BASE}/health`);
  check(health, { 'health 200': (r) => r.status === 200 });

  const matches = http.get(`${BASE}/matches`, { headers });
  check(matches, { 'matches 200': (r) => r.status === 200 });

  const rooms = http.get(`${BASE}/rooms`, { headers });
  check(rooms, { 'rooms 200': (r) => r.status === 200 });

  sleep(1);
}
