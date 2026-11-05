import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeCustomerCode } from '../../src/customer-code.mjs';
import { createClaimsClient, getCustomerStatus } from '../../src/claims-client.mjs';

test('getCustomerStatus returns the normalized reference and uses the cache', async () => {
  let calls = 0;
  let time = 0;
  const client = createClaimsClient(async code => ({ code, n: ++calls }), { now: () => time });
  assert.deepEqual(await getCustomerStatus(client, ' cus-000123 '),
    { customerCode: 'CUS-000123', status: { code: 'CUS-000123', n: 1 } });
  time = 29999;
  assert.deepEqual((await getCustomerStatus(client, 'CUS-000123')).status.n, 1);
  time = 30000;
  assert.deepEqual((await getCustomerStatus(client, 'CUS-000123')).status.n, 2);
  assert.equal(calls, 2);
});

test('getCustomerStatus rejects old and malformed codes without calling claims-core', async () => {
  let calls = 0;
  const client = createClaimsClient(async () => ++calls);
  for (const bad of ['CUST-1234', 'CUS-123', undefined]) {
    await assert.rejects(getCustomerStatus(client, bad), TypeError);
  }
  assert.equal(calls, 0);
});

test('current CUS-000123 format is accepted and normalized', () => {
  assert.equal(normalizeCustomerCode('CUS-000123'), 'CUS-000123');
  assert.equal(normalizeCustomerCode('  cus-000123\n'), 'CUS-000123');
  assert.equal(normalizeCustomerCode('CUS-000001'), 'CUS-000001');
});

test('old CUST-1234 format and malformed codes are rejected', () => {
  for (const bad of ['CUST-1234', 'cust-1234', 'CUST-123456', 'CUS-123', 'CUS-1234567', 'CUS-00012A', '', 'CUS 000123']) {
    assert.throws(() => normalizeCustomerCode(bad), TypeError, bad);
  }
  for (const bad of [undefined, null, 123456, {}]) {
    assert.throws(() => normalizeCustomerCode(bad), TypeError);
  }
});

test('repeated reads within 30 seconds make one upstream request', async () => {
  let calls = 0;
  let time = 1000;
  const client = createClaimsClient(async code => ({ code, n: ++calls }), { now: () => time });
  for (let i = 0; i < 20; i++) {
    const value = await client.get('CUS-000123');
    assert.deepEqual(value, { code: 'CUS-000123', n: 1 });
    time += 1000; // stays below 30000 ms of age for 20 reads
  }
  assert.equal(calls, 1);
});

test('default ttl is 30000 ms and refreshes at the boundary', async () => {
  let calls = 0;
  let time = 0;
  const client = createClaimsClient(async () => ++calls, { now: () => time });
  assert.equal(await client.get('CUS-000123'), 1);
  time = 29999;
  assert.equal(await client.get('CUS-000123'), 1);
  time = 30000;
  assert.equal(await client.get('CUS-000123'), 2);
  assert.equal(calls, 2);
});

test('fetchClaim receives the normalized code and spellings share one entry', async () => {
  const seen = [];
  const client = createClaimsClient(async code => { seen.push(code); return code; }, { now: () => 0 });
  await client.get(' cus-000123 ');
  await client.get('CUS-000123');
  assert.deepEqual(seen, ['CUS-000123']);
});

test('independent customers have independent cache entries', async () => {
  const seen = [];
  const client = createClaimsClient(async code => { seen.push(code); return code; }, { now: () => 0 });
  await client.get('CUS-000123');
  await client.get('CUS-000456');
  await client.get('CUS-000123');
  await client.get('CUS-000456');
  assert.deepEqual(seen, ['CUS-000123', 'CUS-000456']);
});

test('failures are not cached', async () => {
  let calls = 0;
  const client = createClaimsClient(async () => {
    calls++;
    if (calls === 1) throw new Error('upstream down');
    return 'ok';
  }, { now: () => 0 });
  await assert.rejects(client.get('CUS-000123'), /upstream down/);
  assert.equal(await client.get('CUS-000123'), 'ok');
  assert.equal(calls, 2);
});

test('invalid codes never reach claims-core', async () => {
  let calls = 0;
  const client = createClaimsClient(async () => ++calls);
  await assert.rejects(client.get('CUST-1234'), TypeError);
  await assert.rejects(client.get(undefined), TypeError);
  assert.equal(calls, 0);
});
