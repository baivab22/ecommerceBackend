/* eslint-disable no-console */
/**
 * Verify single + multi confirm endpoint behavior.
 *
 * Usage:
 *   npm run verify:confirm-bulk -- <orderIdentifier1> [orderIdentifier2] [orderIdentifier3]
 *
 * Notes:
 * - Identifier can be Mongo _id or productOrderId.
 * - This performs real confirmations on provided orders.
 */

const DEFAULT_API_BASE = 'http://localhost:8000/api';

const parseIdentifiers = () => {
  const fromArgs = process.argv.slice(2).map((v) => String(v || '').trim()).filter(Boolean);
  if (fromArgs.length > 0) return fromArgs;

  const fromEnv = String(process.env.ORDER_IDS || '')
    .split(',')
    .map((v) => String(v || '').trim())
    .filter(Boolean);
  return fromEnv;
};

const postJson = async (url, body) => {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const json = await response.json().catch(() => ({}));
  return { status: response.status, ok: response.ok, json };
};

const printResult = (label, result) => {
  console.log(`\n=== ${label} ===`);
  console.log(`HTTP ${result.status} (${result.ok ? 'ok' : 'not ok'})`);
  console.log(JSON.stringify(result.json, null, 2));
};

const run = async () => {
  const apiBase = String(process.env.API_BASE_URL || DEFAULT_API_BASE).replace(/\/$/, '');
  const endpoint = `${apiBase}/order/confirm-bulk`;
  const identifiers = parseIdentifiers();

  if (identifiers.length === 0) {
    console.error('No order identifiers provided.');
    console.error('Provide identifiers via args or ORDER_IDS env.');
    console.error('Example: npm run verify:confirm-bulk -- 680d... 12345');
    process.exit(1);
  }

  const singlePayload = { orderIds: [identifiers[0]] };
  const multiPayload = { orderIds: [...new Set(identifiers.slice(0, 3))] };
  const mixedPayload = {
    orderIds: [...new Set([...multiPayload.orderIds, `INVALID_${Date.now()}`])],
  };

  console.log(`Using endpoint: ${endpoint}`);
  console.log(`Input identifiers: ${identifiers.join(', ')}`);

  const single = await postJson(endpoint, singlePayload);
  printResult('Single Confirm Check', single);

  const multi = await postJson(endpoint, multiPayload);
  printResult('Multi Confirm Check', multi);

  const mixed = await postJson(endpoint, mixedPayload);
  printResult('Mixed Success + Failure Check', mixed);

  console.log('\nVerification script completed.');
};

run().catch((error) => {
  console.error('Verification script failed:', error?.message || error);
  process.exit(1);
});
