const Orders = require('../modals/orderModal');
const { sendOrderDeliveryStatusChangedNotification } = require('../services/orderNotificationService');
const {
  createNcmOrder,
  parseNcmError,
  fetchNcmOrderStatus,
  fetchNcmOrderComments,
} = require('../services/ncmService');

const RETRY_BASE_MS = Number(process.env.NCM_RETRY_BASE_MS || 60 * 1000);
const RETRY_MAX_MS = Number(process.env.NCM_RETRY_MAX_MS || 60 * 60 * 1000);
const TRACKING_REFRESH_WINDOW_MS = Number(process.env.NCM_TRACKING_REFRESH_WINDOW_MS || 15 * 60 * 1000);
const AUTO_SYNC_INTERVAL_MS = Number(process.env.NCM_AUTOSYNC_INTERVAL_MS || 3 * 60 * 1000);
const MAX_RETRY_BATCH = Number(process.env.NCM_RETRY_BATCH_SIZE || 20);
const MAX_TRACKING_BATCH = Number(process.env.NCM_TRACKING_BATCH_SIZE || 30);
const normalizeStatusForCompare = (value) => String(value || '').trim().toLowerCase();

const toArray = (value) => {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== 'object') return [];
  if (Array.isArray(value.data)) return value.data;
  if (Array.isArray(value.results)) return value.results;
  if (Array.isArray(value.statuses)) return value.statuses;
  return [value];
};

const normalizeNcmStatuses = (rawStatuses) => {
  const statuses = toArray(rawStatuses)
    .map((item, idx) => {
      const statusText = String(item?.status || item?.current_status || item?.order_status || item?.state || '').trim();
      const rawTime = item?.added_time || item?.timestamp || item?.created_at || item?.updated_at || null;
      const parsed = rawTime ? new Date(rawTime) : null;
      const statusAt = parsed && !Number.isNaN(parsed.getTime()) ? parsed : null;
      return {
        index: idx,
        status: statusText,
        statusAt,
      };
    })
    .filter((item) => item.status);

  statuses.sort((a, b) => {
    const aTime = a.statusAt ? a.statusAt.getTime() : Number.MAX_SAFE_INTEGER;
    const bTime = b.statusAt ? b.statusAt.getTime() : Number.MAX_SAFE_INTEGER;
    if (aTime !== bTime) return aTime - bTime;
    return a.index - b.index;
  });

  return statuses;
};

const computeNextRetryAt = (retryCount) => {
  const power = Math.max(0, Number(retryCount || 0));
  const delay = Math.min(RETRY_BASE_MS * (2 ** power), RETRY_MAX_MS);
  return new Date(Date.now() + delay);
};

const refreshOrderTracking = async (order) => {
  const previousStatus = String(order?.ncmLastStatus || '').trim();
  const [statuses, comments] = await Promise.allSettled([
    fetchNcmOrderStatus(order.ncmOrderId),
    fetchNcmOrderComments(order.ncmOrderId),
  ]);

  const update = {
    ncmLastSyncAt: new Date(),
  };

  let latestStatusText = '';
  let latestStatusAt = null;
  const previousNotifiedStatus = String(order?.ncmLastNotifiedStatus || '').trim();

  if (statuses.status === 'fulfilled') {
    const normalizedStatuses = normalizeNcmStatuses(statuses.value);

    if (normalizedStatuses.length) {
      const latestStatus = normalizedStatuses[normalizedStatuses.length - 1];
      latestStatusText = latestStatus.status;
      latestStatusAt = latestStatus.statusAt || new Date();
      update.ncmLastStatus = latestStatusText;
      update.ncmLastStatusAt = latestStatusAt;

      const hasStatusChanged =
        normalizeStatusForCompare(latestStatusText) !== normalizeStatusForCompare(previousStatus);
      const alreadyNotifiedForCurrentStatus =
        normalizeStatusForCompare(latestStatusText) === normalizeStatusForCompare(previousNotifiedStatus);

      if (latestStatusText && hasStatusChanged && !alreadyNotifiedForCurrentStatus) {
        try {
          const orderForNotification = await Orders.findById(order._id)
            .populate('userId')
            .populate({
              path: 'products.productId',
              model: 'Product',
              populate: {
                path: 'images',
                model: 'ProductImage',
              },
            });

          if (orderForNotification) {
            await sendOrderDeliveryStatusChangedNotification(orderForNotification, {
              previousStatus,
              newStatus: latestStatusText,
              statusTime: latestStatusAt || new Date(),
            });

            update.ncmLastNotifiedStatus = latestStatusText;
            update.ncmLastStatusNotifiedAt = latestStatusAt || new Date();
          }
        } catch (notifyError) {
          console.error(`[NCM Scheduler] Failed to send status notification for order ${order._id}:`, notifyError?.message || notifyError);
        }
      }
    }
  }

  if (comments.status === 'fulfilled' && Array.isArray(comments.value) && comments.value.length) {
    const latestComment = comments.value[0];
    update.ncmLastComment = String(latestComment?.comments || '');
    update.ncmLastCommentAt = latestComment?.added_time ? new Date(latestComment.added_time) : new Date();
  }

  await Orders.findByIdAndUpdate(order._id, update, { new: true });
};

const retryPendingNcmOrders = async () => {
  const now = new Date();
  const pendingOrders = await Orders.find({
    isConfirmed: true,
    ncmOrderId: { $exists: false },
    $and: [
      {
        $or: [
          { ncmSyncStatus: 'failed' },
          { ncmSyncStatus: 'pending' },
          { ncmSyncStatus: { $exists: false } },
        ],
      },
      {
        $or: [
          { ncmNextRetryAt: { $exists: false } },
          { ncmNextRetryAt: null },
          { ncmNextRetryAt: { $lte: now } },
        ],
      },
    ],
  })
    .limit(MAX_RETRY_BATCH)
    .populate('userId')
    .populate({
      path: 'products.productId',
      model: 'Product',
      populate: {
        path: 'images',
        model: 'ProductImage',
      },
    });

  if (!pendingOrders.length) return;

  for (const order of pendingOrders) {
    try {
      const result = await createNcmOrder(order);
      await Orders.findByIdAndUpdate(order._id, {
        ncmOrderId: result.ncmOrderId,
        ncmVendorRefId: order.productOrderId || order.ncmVendorRefId,
        ncmPickupCreatedAt: new Date(),
        ncmSyncStatus: 'success',
        ncmSyncError: null,
        ncmRetryCount: 0,
        ncmNextRetryAt: null,
        ncmLastSyncAt: new Date(),
      });
      console.log(`[NCM Scheduler] Synced order ${order._id} -> NCM ${result.ncmOrderId}`);
    } catch (error) {
      const parsedError = parseNcmError(error);
      const nextRetryCount = Number(order.ncmRetryCount || 0) + 1;
      await Orders.findByIdAndUpdate(order._id, {
        ncmSyncStatus: 'failed',
        ncmSyncError: parsedError,
        ncmRetryCount: nextRetryCount,
        ncmNextRetryAt: computeNextRetryAt(nextRetryCount),
        ncmLastSyncAt: new Date(),
      });
      console.error(`[NCM Scheduler] Failed to sync order ${order._id}:`, parsedError);
    }
  }
};

const refreshSyncedOrderTracking = async () => {
  const cutoff = new Date(Date.now() - TRACKING_REFRESH_WINDOW_MS);
  const syncedOrders = await Orders.find({
    ncmOrderId: { $exists: true, $ne: null },
    ncmSyncStatus: { $in: ['success', 'skipped'] },
    $or: [
      { ncmLastSyncAt: { $exists: false } },
      { ncmLastSyncAt: null },
      { ncmLastSyncAt: { $lte: cutoff } },
    ],
  })
    .limit(MAX_TRACKING_BATCH)
    .select('_id ncmOrderId ncmSyncStatus ncmLastSyncAt ncmLastStatus ncmLastNotifiedStatus');

  if (!syncedOrders.length) return;

  for (const order of syncedOrders) {
    try {
      await refreshOrderTracking(order);
    } catch (error) {
      const parsedError = parseNcmError(error);
      await Orders.findByIdAndUpdate(order._id, {
        ncmSyncError: parsedError,
        ncmLastSyncAt: new Date(),
      });
      console.error(`[NCM Scheduler] Tracking refresh failed for order ${order._id}:`, parsedError);
    }
  }
};

let running = false;
const runNcmAutoSyncCycle = async () => {
  if (running) return;
  running = true;
  try {
    await retryPendingNcmOrders();
    await refreshSyncedOrderTracking();
  } catch (error) {
    console.error('[NCM Scheduler] Unexpected cycle error:', error);
  } finally {
    running = false;
  }
};

function startNcmOrderSchedulers() {
  console.log(`[NCM Scheduler] Started (every ${Math.round(AUTO_SYNC_INTERVAL_MS / 1000)}s)`);
  runNcmAutoSyncCycle();
  setInterval(runNcmAutoSyncCycle, AUTO_SYNC_INTERVAL_MS);
}

module.exports = {
  startNcmOrderSchedulers,
  runNcmAutoSyncCycle,
};
