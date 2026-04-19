const http = require('http');

const endpoints = [
  '/api/admin/employees',
  '/api/fleet',
  '/api/dispatching/routes',
  '/api/scorecard/employee-performance'
];

async function testAuth() {
  let passed = true;
  console.log("TESTING 401 ON PROTECTED APIS:");
  
  for (const ep of endpoints) {
    const res = await fetch(`http://localhost:3000${ep}`);
    if (res.status === 401 || res.status === 403) {
      console.log(`✅ PASS: ${ep} returned ${res.status}`);
    } else {
      console.log(`❌ FAIL: ${ep} returned ${res.status} without auth`);
      passed = false;
    }
  }

  const publicRes = await fetch('http://localhost:3000/api/public/interview', { method: 'POST' });
  if (publicRes.status !== 401 && publicRes.status !== 403) {
    console.log(`✅ PASS: /api/public/interview allowed through (returned ${publicRes.status})`);
  } else {
    console.log(`❌ FAIL: Public route returned ${publicRes.status}`);
    passed = false;
  }

  console.log("\nTESTING PAGE REDIRECTS:");
  const pageRes = await fetch('http://localhost:3000/fleet/repairs', { redirect: 'manual' });
  if (pageRes.status >= 300 && pageRes.status < 400 && pageRes.headers.get('location')?.includes('/login?from=')) {
    console.log(`✅ PASS: /fleet/repairs redirected to ${pageRes.headers.get('location')}`);
  } else {
    console.log(`❌ FAIL: redirect didn't land on login correctly. Landed on ${pageRes.url} with status ${pageRes.status}`);
    passed = false;
  }

  if (!passed) process.exit(1);
}

testAuth().catch(e => {
  console.error(e);
  process.exit(1);
});
