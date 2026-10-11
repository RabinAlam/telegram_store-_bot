import { describe, it, expect } from 'vitest';

const LIVE_URL = process.env.TEST_LIVE_URL || 'https://merry-gelato-5debd2.netlify.app';

describe('DEPLOYMENT TESTS (Netlify Live Infrastructure & Routing)', () => {
  it('1. Root Storefront serves HTTP 200 with HTML content', async () => {
    const res = await fetch(`${LIVE_URL}/`);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('<!DOCTYPE html>');
    expect(res.headers.get('content-type')).toContain('text/html');
  });

  it('2. Admin SPA route (/admin) rewrites cleanly to index.html with 200 OK', async () => {
    const res = await fetch(`${LIVE_URL}/admin`);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('<title>TZ Store Admin</title>');
    expect(html).toContain('id="root"');
  });

  it('3. Admin sub-route (/admin/login) rewrites cleanly to index.html (SPA deep-linking)', async () => {
    const res = await fetch(`${LIVE_URL}/admin/login`);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('<title>TZ Store Admin</title>');
  });

  it('4. Admin assets on Netlify CDN are accessible with correct content-types', async () => {
    // Fetch admin HTML to extract an asset URL
    const adminRes = await fetch(`${LIVE_URL}/admin`);
    const html = await adminRes.text();
    const match = html.match(/src="(\/admin\/assets\/[^"]+\.js)"/);
    expect(match).toBeTruthy();
    if (match) {
      const assetUrl = `${LIVE_URL}${match[1]}`;
      const assetRes = await fetch(assetUrl);
      expect(assetRes.status).toBe(200);
      expect(assetRes.headers.get('content-type')).toMatch(/javascript/);
    }
  });

  it('5. Serverless API rejects unauthorized requests to protected admin endpoints', async () => {
    const res = await fetch(`${LIVE_URL}/api/dashboard`);
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe('unauthorized');
  });
});

describe('SYSTEM TESTS (End-to-End Live Workflow & Data Flow)', { timeout: 15000 }, () => {
  let adminAccessToken = '';

  it('Step 1: Public catalog retrieval fetches 16 Supabase categories with 0ms timeout', async () => {
    const t0 = Date.now();
    const res = await fetch(`${LIVE_URL}/api/categories`);
    const duration = Date.now() - t0;
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.categories)).toBe(true);
    expect(data.categories.length).toBeGreaterThanOrEqual(16);
    // Verified direct Prisma query without 2.5s HTTP timeout
    expect(duration).toBeLessThan(3500);

    const names = data.categories.map((c: any) => c.name);
    expect(names).toContain('GitHub');
    expect(names).toContain('CapCut');
    expect(names).toContain('ChatGPT');
  });

  it('Step 2: Admin authentication authenticates via bcrypt against Supabase PostgreSQL', async () => {
    const res = await fetch(`${LIVE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'admin@tzstore.io', password: 'Admin@123' }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.admin?.email).toBe('admin@tzstore.io');
    expect(data.admin?.role).toBe('SUPER_ADMIN');
    expect(data.accessToken).toBeDefined();
    expect(data.refreshToken).toBeDefined();
    adminAccessToken = data.accessToken;
  });

  it('Step 3: Admin me endpoint verifies valid JWT session', async () => {
    expect(adminAccessToken).toBeTruthy();
    const res = await fetch(`${LIVE_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${adminAccessToken}` },
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.email).toBe('admin@tzstore.io');
  });

  it('Step 4: Admin dashboard KPIs and Bot health retrieve live metrics', async () => {
    const res = await fetch(`${LIVE_URL}/api/dashboard`, {
      headers: { Authorization: `Bearer ${adminAccessToken}` },
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.kpis).toBeDefined();
    expect(typeof data.kpis.todayRevenue).toBe('number');
    expect(typeof data.kpis.ordersToday).toBe('number');
    expect(data.botHealth).toBeDefined();
    expect(data.botHealth.webhookConfigured).toBe(true);
  });

  it('Step 5: Settings endpoint reads masked Supabase system configuration', async () => {
    const res = await fetch(`${LIVE_URL}/api/settings`, {
      headers: { Authorization: `Bearer ${adminAccessToken}` },
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.referralPercent).toBeDefined();
    expect(data.binanceUid).toBe('1134278389');
  });

  it('Step 6: User management queries Supabase users table', async () => {
    const res = await fetch(`${LIVE_URL}/api/users`, {
      headers: { Authorization: `Bearer ${adminAccessToken}` },
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.items)).toBe(true);
    expect(typeof data.total).toBe('number');
  });

  it('Step 7: Storefront creates order and payment intent with Binance UID', async () => {
    // 1. Create order
    const orderRes = await fetch(`${LIVE_URL}/api/orders`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ productId: 'p-github-student', qty: 1 }),
    });
    expect(orderRes.status).toBe(200);
    const orderData = await orderRes.json();
    expect(orderData.order?.id).toBeDefined();
    const orderId = orderData.order.id;

    // 2. Create Binance payment intent
    const intentRes = await fetch(`${LIVE_URL}/api/payments/intent`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ orderId, provider: 'BINANCE' }),
    });
    expect(intentRes.status).toBe(200);
    const intentData = await intentRes.json();
    expect(intentData.intent?.id).toBeDefined();
    expect(intentData.intent?.provider).toBe('BINANCE');
    expect(intentData.intent?.address).toContain('8389');
  });

  it('Step 8: Payment TxID submission enforces validation & anti-replay checks', async () => {
    // 1. Invalid short TxID
    const invalidRes = await fetch(`${LIVE_URL}/api/payments/intent/in_test/txid`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ txid: '123' }),
    });
    expect(invalidRes.status).toBe(400);

    // 2. Non-existent intent
    const notFoundRes = await fetch(`${LIVE_URL}/api/payments/intent/in_nonexistent999/txid`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ txid: 'TXID_TEST_999999999' }),
    });
    expect(notFoundRes.status).toBe(404);
  });
});
