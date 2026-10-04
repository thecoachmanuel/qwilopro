const path = require('path');
const fs = require('fs');

const fullstackDir = 'c:\\Users\\TAWAAB\\Downloads\\restropro-210\\codecanyon-52806377-restropro-saas-pos-software-for-restaurant-cafe-hotel-food-truck\\code\\New folder\\restropro-saas-fullstack';

const envPath = path.join(fullstackDir, '.env');
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8');
  content.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const idx = trimmed.indexOf('=');
      if (idx !== -1) {
        const k = trimmed.substring(0, idx).trim();
        const v = trimmed.substring(idx + 1).trim().replace(/^["']|["']$/g, '');
        if (!process.env[k]) process.env[k] = v;
      }
    }
  });
}

const { connectDB } = require(path.join(fullstackDir, 'src/backend/db/connect'));
const app = require(path.join(fullstackDir, 'src/backend/app'));
const { generateAccessToken } = require(path.join(fullstackDir, 'src/backend/utils/jwt'));
const { User, Tenant } = require(path.join(fullstackDir, 'src/backend/models'));
const http = require('http');

async function testAllRoutes() {
  await connectDB();
  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, resolve));
  const port = server.address().port;

  const users = await User.find({ role: 'admin' }).lean();

  const routes = [
    ["GET", "/api/v1/dashboard"],
    ["GET", "/api/v1/pos/init"],
    ["GET", "/api/v1/orders/init"],
    ["GET", "/api/v1/orders?page=1&perPage=10"],
    ["GET", "/api/v1/kitchen"],
    ["GET", "/api/v1/reservations"],
    ["GET", "/api/v1/customers?page=1&perPage=10"],
    ["GET", "/api/v1/invoices?page=1&perPage=10"],
    ["GET", "/api/v1/inventory/items"],
    ["GET", "/api/v1/feedback"],
    ["GET", "/api/v1/settings"],
    ["GET", "/api/v1/reports/sales?type=today"],
  ];

  for (const user of users) {
    console.log(`\n======================================================`);
    console.log(`Testing Tenant ${user.tenant_id} (${user.username})`);
    const tenant = await Tenant.findOne({ id: user.tenant_id }).lean();
    console.log(`Tenant active: ${tenant?.is_active}, plan_id: ${tenant?.plan_id}, product_id: ${tenant?.payment_gateway_product_id}`);

    const payload = {
      username: user.username,
      role: user.role,
      tenant_id: user.tenant_id,
      name: user.name,
      tokenVersion: 1,
    };
    const token = generateAccessToken(payload);

    for (const [method, route] of routes) {
      const res = await fetch(`http://localhost:${port}${route}`, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      const status = res.status;
      let data = {};
      try {
        data = await res.json();
      } catch {}

      if (status === 200 || status === 201) {
        console.log(`  ✓ ${route} -> 200 OK`);
      } else {
        console.log(`  ✗ ${route} -> ${status} ${data.message || ''}`);
      }
    }
  }

  server.close();
  process.exit(0);
}

testAllRoutes().catch(err => {
  console.error(err);
  process.exit(1);
});
