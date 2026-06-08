import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 20 },
    { duration: '1m', target: 100 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.01'],
  },
};

const BASE = 'http://localhost/api/v1';

export function setup() {
  const res = http.post(
    `${BASE}/auth/register`,
    JSON.stringify({ email: `k6_${Date.now()}@test.com`, name: 'K6 User', password: 'password123' }),
    { headers: { 'Content-Type': 'application/json' } },
  );
  return { token: res.json('accessToken') };
}

export default function (data) {
  const headers = {
    Authorization: `Bearer ${data.token}`,
    'Content-Type': 'application/json',
  };

  const health = http.get(`${BASE}/health`);
  check(health, { 'health 200': (r) => r.status === 200 });

  const matches = http.get(`${BASE}/matches`);
  check(matches, { 'matches 200': (r) => r.status === 200 });

  const rooms = http.get(`${BASE}/rooms`, { headers });
  check(rooms, { 'rooms 200': (r) => r.status === 200 });

  sleep(1);
}
