const axios = require('axios');

const NCM_BASE_URL = (process.env.NCM_BASE_URL || 'https://demo.nepalcanmove.com').replace(/\/$/, '');
const NCM_ORDER_CREATE_PATH = process.env.NCM_ORDER_CREATE_PATH || '/api/v1/order/create';
const ALLOWED_DELIVERY_TYPES = new Set(['Door2Door', 'Branch2Door', 'Branch2Branch', 'Door2Branch']);

const getNcmToken = () => {
  const token = String(process.env.NCM_API_TOKEN || '').trim();
  if (!token) {
    throw new Error('NCM_API_TOKEN is missing in environment variables.');
  }
  return token;
};

const buildNcmUrl = (path) => `${NCM_BASE_URL}${path}`;

const getNcmHeaders = (token) => ({
  Authorization: `Token ${token}`,
  'Content-Type': 'application/json',
});

const ncmGet = async (path, params = {}) => {
  const token = getNcmToken();
  try {
    const response = await axios.get(buildNcmUrl(path), {
      headers: getNcmHeaders(token),
      params,
      timeout: 15000,
    });
    return response?.data;
  } catch (error) {
    throw new Error(parseNcmError(error));
  }
};

const ncmPost = async (path, body = {}) => {
  const token = getNcmToken();
  try {
    const response = await axios.post(buildNcmUrl(path), body, {
      headers: getNcmHeaders(token),
      timeout: 15000,
    });
    return response?.data;
  } catch (error) {
    throw new Error(parseNcmError(error));
  }
};

const sanitizePhone = (value) => {
  if (!value) return '';
  return String(value).replace(/[^0-9+]/g, '').trim();
};

const normalizePhoneCandidate = (value) => {
  const cleaned = sanitizePhone(value).replace(/\+/g, '');
  if (!cleaned) return '';

  const digits = cleaned.replace(/\D/g, '');
  if (!digits) return '';

  // Normalize Nepal numbers: convert 977XXXXXXXXXX to local 10-digit mobile where possible.
  if (digits.startsWith('977') && digits.length >= 13) {
    return digits.slice(-10);
  }

  if (digits.length > 10) {
    return digits.slice(-10);
  }

  return digits;
};

const isLikelyValidPhone = (phone) => {
  const value = String(phone || '').trim();
  if (!value) return false;
  // NCM demo accepts standard Nepal-style mobile length and most local 7-10 digit contacts.
  return /^\d{7,10}$/.test(value);
};

const resolvePhoneNumbers = (order) => {
  const fallbackPhone = process.env.NCM_FALLBACK_PHONE || process.env.NCM_VENDOR_PHONE || '';
  const candidates = [
    order?.phoneNumber,
    order?.userId?.phone,
    fallbackPhone,
  ]
    .map(normalizePhoneCandidate)
    .filter(Boolean);

  const primary = candidates.find(isLikelyValidPhone) || '';
  const secondary = candidates.find((item) => item !== primary && isLikelyValidPhone(item)) || '';

  return {
    phone: primary,
    phone2: secondary,
  };
};

const stringifyAmount = (value) => {
  const amount = Number(value || 0);
  if (Number.isNaN(amount) || amount <= 0) return '';
  return amount.toFixed(2);
};

const buildVendorRefId = (order) => {
  const preferred = String(order?.ncmVendorRefId || order?.productOrderId || '').trim();
  const fallback = String(order?._id || '').trim();
  const raw = preferred || fallback;

  if (!raw) return '';

  // Keep reference stable across systems. Preserve readable format and just normalize whitespace/casing.
  return raw.replace(/\s+/g, '').toUpperCase().slice(0, 32);
};

const getDeliveryType = () => {
  const requested = String(process.env.NCM_DELIVERY_TYPE || 'Door2Door').trim();
  if (ALLOWED_DELIVERY_TYPES.has(requested)) return requested;
  return 'Door2Door';
};

const buildPackageName = (order) => {
  const names = (order?.products || [])
    .map((item) => item?.productId?.name)
    .filter(Boolean)
    .slice(0, 3);

  if (!names.length) return 'General Package';
  return names.join(', ');
};

const resolveDestinationBranch = (order) => {
  if (order?.ncmDestinationBranch) {
    return String(order.ncmDestinationBranch).trim().toUpperCase();
  }
  return String(process.env.NCM_DEFAULT_BRANCH || '').trim().toUpperCase();
};

const buildNcmOrderPayload = (order) => {
  const fromBranch = String(process.env.NCM_FBRANCH || '').trim().toUpperCase();
  const branch = resolveDestinationBranch(order);
  const token = getNcmToken();

  const name = String(order?.userId?.name || order?.customerName || 'Customer').trim();
  const { phone, phone2 } = resolvePhoneNumbers(order);
  const codCharge = stringifyAmount(order?.totalAmount);
  const address = String(order?.locationAddress || order?.shippingLocation || '').trim();
  const vrefId = buildVendorRefId(order);

  const deliveryType = getDeliveryType();
  const weight = String(process.env.NCM_DEFAULT_WEIGHT || '1').trim();

  if (!fromBranch) {
    throw new Error('NCM_FBRANCH is missing in environment variables.');
  }

  if (!branch) {
    throw new Error('NCM_DEFAULT_BRANCH is missing in environment variables.');
  }

  if (!name || !phone || !codCharge || !address) {
    throw new Error('Order is missing required values for NCM create order API (name, phone, cod_charge, address).');
  }

  return {
    token,
    payload: {
      name,
      phone,
      phone2,
      cod_charge: codCharge,
      address,
      fbranch: fromBranch,
      branch,
      package: buildPackageName(order),
      ...(vrefId ? { vref_id: vrefId } : {}),
      instruction: String(order?.orderNote || '').trim(),
      delivery_type: deliveryType,
      weight,
    },
  };
};

const parseNcmError = (error) => {
  const responseData = error?.response?.data;
  if (typeof responseData === 'string' && responseData.trim()) {
    return responseData;
  }
  if (responseData && typeof responseData === 'object') {
    return JSON.stringify(responseData);
  }
  if (error?.message) {
    return error.message;
  }
  return 'Unknown NCM error';
};

const createNcmOrder = async (order) => {
  const { token, payload } = buildNcmOrderPayload(order);
  const url = buildNcmUrl(NCM_ORDER_CREATE_PATH);

  try {
    const assignedBranches = await fetchNcmBranches();
    if (Array.isArray(assignedBranches) && assignedBranches.length > 0) {
      const normalizedAssigned = assignedBranches
        .map((name) => String(name || '').trim().toUpperCase())
        .filter(Boolean);
      const currentBranch = String(payload.branch || '').trim().toUpperCase();
      if (!normalizedAssigned.includes(currentBranch)) {
        payload.branch = normalizedAssigned[0];
      }
    }
  } catch (_error) {
    // If branch verification fails, continue with existing payload branch.
  }

  let response;
  try {
    response = await axios.post(url, payload, {
      headers: getNcmHeaders(token),
      timeout: 15000,
    });



  } catch (error) {
    throw new Error(parseNcmError(error));
  }
console.log("responsesss",response);
  const ncmOrderId = response?.data?.orderid;
  if (!ncmOrderId) {
    throw new Error(`NCM order creation did not return orderid. Response: ${JSON.stringify(response?.data || {})}`);
  }

  console.log("ncm orders",response?.data)

  return {
    ncmOrderId: String(ncmOrderId),
    rawResponse: response?.data,
  };
};

const validateOrderIdParam = (orderId) => {
  const id = String(orderId || '').trim();
  if (!id) {
    throw new Error('Order id is required.');
  }
  return id;
};

const fetchNcmOrderDetails = async (orderId) => {
  const id = validateOrderIdParam(orderId);
  return ncmGet('/api/v1/order', { id });
};

const fetchNcmOrderComments = async (orderId) => {
  const id = validateOrderIdParam(orderId);
  return ncmGet('/api/v1/order/comment', { id });
};

const fetchNcmLastBulkComments = async () => {
  return ncmGet('/api/v1/order/getbulkcomments');
};

const fetchNcmOrderStatus = async (orderId) => {

  
  const id = validateOrderIdParam(orderId);
  return ncmGet('/api/v1/order/status', { id });
};

const createNcmOrderComment = async ({ orderid, comments }) => {
  const safeOrderId = validateOrderIdParam(orderid);
  const safeComments = String(comments || '').trim();

  if (!safeComments) {
    throw new Error('comments is required.');
  }

  return ncmPost('/api/v1/comment', {
    orderid: safeOrderId,
    comments: safeComments,
  });
};

const fetchNcmShippingRate = async ({ creation, destination, type }) => {
  const safeCreation = String(creation || '').trim().toUpperCase();
  const safeDestination = String(destination || '').trim().toUpperCase();
  const safeType = String(type || '').trim();
  if (!safeCreation || !safeDestination || !safeType) {
    throw new Error('creation, destination and type are required.');
  }
  return ncmGet('/api/v1/shipping-rate', {
    creation: safeCreation,
    destination: safeDestination,
    type: safeType,
  });
};

const fetchBulkNcmOrderStatuses = async ({ orders }) => {
  const orderIds = Array.isArray(orders) ? orders : [];
  if (!orderIds.length) {
    throw new Error('orders array is required.');
  }
  return ncmPost('/api/v1/orders/statuses', { orders: orderIds });
};

const createVendorTicket = async ({ ticket_type, message }) => {
  const safeType = String(ticket_type || '').trim();
  const safeMessage = String(message || '').trim();
  if (!safeType || !safeMessage) {
    throw new Error('ticket_type and message are required.');
  }
  return ncmPost('/api/v2/vendor/ticket/create', {
    ticket_type: safeType,
    message: safeMessage,
  });
};

const createVendorCodTransferTicket = async ({ bankName, bankAccountName, bankAccountNumber }) => {
  if (!String(bankName || '').trim() || !String(bankAccountName || '').trim() || !String(bankAccountNumber || '').trim()) {
    throw new Error('bankName, bankAccountName and bankAccountNumber are required.');
  }
  return ncmPost('/api/v2/vendor/ticket/cod/create', {
    bankName: String(bankName).trim(),
    bankAccountName: String(bankAccountName).trim(),
    bankAccountNumber: String(bankAccountNumber).trim(),
  });
};

const closeVendorTicket = async (ticketId) => {
  const safeTicketId = String(ticketId || '').trim();
  if (!safeTicketId) {
    throw new Error('ticketId is required.');
  }
  return ncmPost(`/api/v2/vendor/ticket/close/${safeTicketId}`, {});
};

const fetchVendorStaffs = async ({ q, page, page_size, limit }) => {
  const params = {};
  if (q) params.q = String(q).trim();
  if (page) params.page = String(page);
  if (page_size) params.page_size = String(page_size);
  if (limit) params.limit = String(limit);
  return ncmGet('/api/v2/vendor/staffs', params);
};

const markOrderReturn = async ({ pk, comment }) => {
  const safePk = Number(pk);
  if (!safePk) {
    throw new Error('pk is required.');
  }
  return ncmPost('/api/v2/vendor/order/return', {
    pk: safePk,
    ...(comment ? { comment: String(comment).trim() } : {}),
  });
};

const createExchangeOrder = async ({ pk }) => {
  const safePk = Number(pk);
  if (!safePk) {
    throw new Error('pk is required.');
  }
  return ncmPost('/api/v2/vendor/order/exchange-create', { pk: safePk });
};

const redirectOrder = async (payload) => {
  const safePk = Number(payload?.pk);
  if (!safePk) {
    throw new Error('pk is required.');
  }
  return ncmPost('/api/v2/vendor/order/redirect', {
    ...payload,
    pk: safePk,
  });
};

const upsertWebhookUrl = async ({ webhook_url }) => {
  if (typeof webhook_url !== 'string') {
    throw new Error('webhook_url is required.');
  }
  return ncmPost('/api/v2/vendor/webhook', { webhook_url });
};

const testWebhookUrl = async ({ webhook_url }) => {
  const safeUrl = String(webhook_url || '').trim();
  if (!safeUrl) {
    throw new Error('webhook_url is required.');
  }
  return ncmPost('/api/v2/vendor/webhook/test', { webhook_url: safeUrl });
};

const normalizeBranchList = (payload) => {
  if (!payload) return [];

  if (Array.isArray(payload)) {
    return payload
      .map((item) => {
        if (typeof item === 'string') return item;
        if (item && typeof item === 'object') {
          return item.branch || item.name || item.title || null;
        }
        return null;
      })
      .filter(Boolean)
      .map((name) => String(name).trim().toUpperCase());
  }

  if (Array.isArray(payload.results)) {
    return normalizeBranchList(payload.results);
  }

  return [];
};

const fetchNcmBranches = async () => {
  const token = getNcmToken();

  const headers = { Authorization: `Token ${token}` };

  try {
    const assignedUrl = `${NCM_BASE_URL}/api/v2/vendor/assigned-branches`;
    const assignedResponse = await axios.get(assignedUrl, { headers, timeout: 15000 });
    const assigned = normalizeBranchList(assignedResponse?.data);
    if (assigned.length) {
      return assigned;
    }
  } catch (error) {
    // Fall back to global branch list if assigned branch fetch fails.
  }

  const branchUrl = `${NCM_BASE_URL}/api/v2/branches`;
  const branchResponse = await axios.get(branchUrl, { headers, timeout: 15000 });
  const branches = normalizeBranchList(branchResponse?.data);

  if (!branches.length) {
    throw new Error('Unable to fetch NCM branches.');
  }

  return branches;
};

const fetchNcmBranchDetails = async () => {
  return ncmGet('/api/v2/branches');
};

module.exports = {
  createNcmOrder,
  parseNcmError,
  fetchNcmBranches,
  fetchNcmBranchDetails,
  fetchNcmShippingRate,
  fetchNcmOrderDetails,
  fetchNcmOrderComments,
  fetchNcmLastBulkComments,
  fetchNcmOrderStatus,
  fetchBulkNcmOrderStatuses,
  createNcmOrderComment,
  createVendorTicket,
  createVendorCodTransferTicket,
  closeVendorTicket,
  fetchVendorStaffs,
  markOrderReturn,
  createExchangeOrder,
  redirectOrder,
  upsertWebhookUrl,
  testWebhookUrl,
};
