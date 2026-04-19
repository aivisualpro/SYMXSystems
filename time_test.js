const http = require('http');

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/user/permissions',
  method: 'GET'
};

async function timeReq(path) {
  const start = Date.now();
  return new Promise((resolve) => {
    http.get({ ...options, path }, (res) => {
      res.on('data', () => {});
      res.on('end', () => {
        resolve(Date.now() - start);
      });
    });
  });
}

(async () => {
  console.log("Permissions:", await timeReq('/api/user/permissions'));
  console.log("Schedules:", await timeReq('/api/schedules?yearWeek=2026-W16'));
  console.log("Dispatching:", await timeReq('/api/dispatching/routes?yearWeek=2026-W16'));
  console.log("HR Tickets:", await timeReq('/api/admin/hr-tickets'));
})();
