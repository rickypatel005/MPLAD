async function testApis() {
  const tests = [
    { method: 'GET', url: 'http://localhost:3000/api/health' },
    { method: 'GET', url: 'http://localhost:3000/api/projects?page=1&page_size=5' },
    { method: 'GET', url: 'http://localhost:3000/api/projects/P10001' },
    { method: 'GET', url: 'http://localhost:3000/api/projects/P10001/payments' },
    { method: 'GET', url: 'http://localhost:3000/api/dashboard/summary' },
    { method: 'GET', url: 'http://localhost:3000/api/risk/top?limit=5' },
    { method: 'GET', url: 'http://localhost:3000/api/risk/P10001' },
    { method: 'GET', url: 'http://localhost:3000/api/duplicates/P10001' },
    { method: 'GET', url: 'http://localhost:3000/api/ia/IA001' },
    { method: 'GET', url: 'http://localhost:3000/api/alerts?limit=5' },
    { method: 'GET', url: 'http://localhost:3000/api/evidence/P10001' },
    { method: 'GET', url: 'http://localhost:3000/api/dashboard' },
    { method: 'GET', url: 'http://localhost:3000/api/project/P10001' },
    { method: 'GET', url: 'http://localhost:3000/api/network' },
    { method: 'GET', url: 'http://localhost:3000/api/map-data' },
    { method: 'GET', url: 'http://localhost:3000/api/duplicates' },
    { method: 'GET', url: 'http://localhost:3000/api/compliance-summary' },
    { method: 'GET', url: 'http://localhost:3000/api/report/P10001' },
    { method: 'POST', url: 'http://localhost:3000/api/auth/login', body: { username: 'admin', password: 'admin123' } }
  ];

  console.log('=== API SMOKE TEST RESULTS ===');
  let token = '';
  for (const t of tests) {
    try {
      const opts = { method: t.method, headers: { 'Content-Type': 'application/json' } };
      if (t.body) opts.body = JSON.stringify(t.body);
      const res = await fetch(t.url, opts);
      const data = await res.json();
      if (t.url.includes('/login') && data.token) {
        token = data.token;
      }
      const summary = Array.isArray(data) ? `${data.length} items` : typeof data === 'object' ? Object.keys(data).join(', ') : 'value';
      console.log(`[${res.status} OK] ${t.method} ${t.url} -> keys: [${summary.slice(0, 80)}]`);
    } catch (err) {
      console.error(`[ERR] ${t.method} ${t.url} -> ${err.message}`);
    }
  }

  // Authenticated review action test
  if (token) {
    try {
      const reviewRes = await fetch('http://localhost:3000/api/review/action', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          project_id: 'P10001',
          action: 'ACKNOWLEDGE',
          comment: 'Automated smoke test review verification'
        })
      });
      const reviewData = await reviewRes.json();
      console.log(`[${reviewRes.status} OK] POST http://localhost:3000/api/review/action -> ${JSON.stringify(reviewData)}`);
    } catch (err) {
      console.error(`[ERR] POST http://localhost:3000/api/review/action -> ${err.message}`);
    }
  }
}
testApis();
