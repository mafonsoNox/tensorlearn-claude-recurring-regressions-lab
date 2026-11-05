import { normalizeCustomerCode } from './customer-code.mjs';
export function createClaimsClient(fetchClaim, {now=Date.now, ttlMs=30000} = {}) {
  const cache=new Map();
  return {async get(customerCode) {
    const code=normalizeCustomerCode(customerCode);
    const prior=cache.get(code);
    if (prior && now()-prior.at < ttlMs) return prior.value;
    const value=await fetchClaim(code);
    cache.set(code,{at:now(),value});
    return value;
  }};
}

// Returns {customerCode, status} using the client's per-customer cache.
// Caller must enforce owner authorization before calling. Do not log the result.
export async function getCustomerStatus(client, customerCode) {
  const code=normalizeCustomerCode(customerCode);
  const status=await client.get(code);
  return {customerCode: code, status};
}
