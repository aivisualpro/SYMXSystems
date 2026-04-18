const fs = require('fs');
const path = require('path');

function getFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      if (!['node_modules', '.git', '.next'].includes(file)) {
        getFiles(filePath, fileList);
      }
    } else {
      fileList.push(filePath);
    }
  }
  return fileList;
}

const allFiles = getFiles(__dirname);
const res = {
  routes: [],
  apis: [],
  models: []
};

allFiles.forEach(f => {
  const code = fs.readFileSync(f, 'utf8');
  if (f.includes('/app/') && f.endsWith('page.tsx')) {
    const route = f.split('/app/')[1];
    res.routes.push({
      path: route,
      query: (code.match(/searchParams|useSearchParams/g) || []).length > 0,
    });
  }
  if (f.includes('/app/api/') && f.endsWith('route.ts')) {
    const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'].filter(m => code.includes(`export async function ${m}`));
    const route = f.split('/app/api/')[1];
    const collections = [...new Set(Array.from(code.matchAll(/([A-Z][a-zA-Z0-9_]+)\.findOne|\.find|\.aggregate|\.create|\.updateOne/g)).map(m => m[1]))];
    res.apis.push({ path: route, methods, collections });
  }
  if (f.includes('/lib/models/') && f.endsWith('.ts')) {
    const modelMatch = code.match(/mongoose\.model\(["']([^"']+)["']/);
    const modelName = modelMatch ? modelMatch[1] : path.basename(f, '.ts');
    const indexes = Array.from(code.matchAll(/\.index\(\{([^}]+)\}/g)).map(m => m[1]);
    res.models.push({ name: modelName, indexes });
  }
});

fs.writeFileSync('audit_temp.json', JSON.stringify(res, null, 2));
