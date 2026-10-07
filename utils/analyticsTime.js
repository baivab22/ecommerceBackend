/**
 * Pure analytics helpers: timezone maths, range resolution, bucketing and
 * traffic-source classification.
 *
 * Kept free of Mongoose/express imports so the logic can be unit tested
 * without a database connection.
 */

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const BUSINESS_TZ = process.env.ANALYTICS_TIMEZONE || "Asia/Kathmandu";

/**
 * Range windows. `calendarDay: true` means "since midnight in the business
 * timezone" rather than a rolling N-hour window.
 *
 * `day` is the key the dashboard actually sends; `today` is the older name kept
 * as an alias so bookmarks and cached URLs keep working. Both resolve to the
 * same window — without the alias an unknown key silently fell back to the
 * default and the server echoed back a range the caller never asked for.
 */
const DAY_WINDOW = {ms: DAY, alignToDay: true, bucket: "hour", calendarDay: true};

const RANGES = {
  hour: {ms: HOUR, alignToDay: true, bucket: "minute"},
  day: DAY_WINDOW,
  today: DAY_WINDOW,
  week: {ms: 7 * DAY, alignToDay: true, bucket: "day"},
  month: {ms: 30 * DAY, alignToDay: true, bucket: "day"},
  year: {ms: 365 * DAY, alignToDay: true, bucket: "day"}
};

const BUCKET_FORMAT = {
  minute: "%Y-%m-%dT%H:%M",
  hour: "%Y-%m-%dT%H:00",
  day: "%Y-%m-%d"
};

/** Offset of `tz` from UTC in ms at the given instant (DST aware). */
const getTimezoneOffsetMs = (date, tz) => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  })
    .formatToParts(date)
    .reduce((acc, part) => {
      if (part.type !== "literal") acc[part.type] = part.value;
      return acc;
    }, {});

  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour) % 24,
    Number(parts.minute),
    Number(parts.second)
  );

  return asUtc - date.getTime();
};

/** Midnight of the day containing `date`, in `tz`, as a real UTC instant. */
const startOfDayInTz = (date, tz) => {
  const offsetMs = getTimezoneOffsetMs(date, tz);
  const shifted = new Date(date.getTime() + offsetMs);
  const midnightUtc = Date.UTC(
    shifted.getUTCFullYear(),
    shifted.getUTCMonth(),
    shifted.getUTCDate()
  );
  return new Date(midnightUtc - offsetMs);
};

/** Resolve a range key into an absolute [start, end] window. */
const resolveWindow = (rangeKey, now = new Date()) => {
  const config = RANGES[rangeKey];
  const end = now;

  if (config.calendarDay) {
    return {config, start: startOfDayInTz(now, BUSINESS_TZ), end};
  }

  const start = new Date(now.getTime() - config.ms);
  return {
    config,
    start: config.alignToDay ? startOfDayInTz(start, BUSINESS_TZ) : start,
    end
  };
};

/** Human label for a bucket key, formatted in the business timezone. */
const formatLabel = (bucket, granularity) => {
  const [datePart, timePart] = bucket.split("T");
  const [y, m, d] = datePart.split("-").map(Number);

  if (granularity === "day") {
    return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      timeZone: "UTC"
    });
  }

  const [hh, mm] = (timePart || "00:00").split(":").map(Number);
  const hour12 = hh % 12 === 0 ? 12 : hh % 12;
  const suffix = hh < 12 ? "AM" : "PM";

  return granularity === "hour"
    ? `${hour12} ${suffix}`
    : `${hour12}:${String(mm).padStart(2, "0")} ${suffix}`;
};

/** Advance a bucket key by one step in wall-clock terms. */
const nextBucketKey = (key, granularity) => {
  const [datePart, timePart = "00:00"] = key.split("T");
  const [y, m, d] = datePart.split("-").map(Number);
  const dayKey = (date) =>
    `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(
      date.getUTCDate()
    ).padStart(2, "0")}`;

  if (granularity === "day") return dayKey(new Date(Date.UTC(y, m - 1, d) + DAY));

  const [hh, mm] = timePart.split(":").map(Number);
  const step = granularity === "hour" ? 60 : 5;
  const total = hh * 60 + mm + step;

  if (total >= 24 * 60) {
    return `${dayKey(new Date(Date.UTC(y, m - 1, d) + DAY))}T00:00`;
  }

  return `${datePart}T${String(Math.floor(total / 60)).padStart(2, "0")}:${String(
    total % 60
  ).padStart(2, "0")}`;
};

/**
 * Fill gaps so the chart reads as continuous time instead of skipping empty
 * slots. Runs from the first observed bucket to the last, so idle stretches
 * render as zeros rather than collapsing the x-axis.
 */
const zeroFill = (rows, granularity) => {
  if (rows.length === 0) return [];

  const byBucket = new Map(rows.map(row => [row.bucket, row]));
  const keys = Array.from(byBucket.keys()).sort();

  const empty = (bucket) => ({bucket, label: formatLabel(bucket, granularity), pageViews: 0, uniqueVisitors: 0});
  const filled = [];

  let cursor = keys[0];
  for (const key of keys) {
    // Walk forward from the last emitted bucket, zero-filling anything skipped.
    let guard = 0;
    while (cursor !== key && guard++ < 10_000) {
      filled.push(empty(cursor));
      cursor = nextBucketKey(cursor, granularity);
    }

    const row = byBucket.get(key);
    filled.push({
      bucket: key,
      label: formatLabel(key, granularity),
      pageViews: row.pageViews,
      uniqueVisitors: row.uniqueVisitors
    });
    cursor = nextBucketKey(key, granularity);
  }

  return filled;
};

/** Roll per-minute rows into 5-minute blocks for the "last hour" view. */
const rollUpToFiveMinutes = (rows) => {
  const buckets = new Map();

  for (const row of rows) {
    const [datePart, timePart = "00:00"] = row.bucket.split("T");
    const [hh, mm] = timePart.split(":").map(Number);
    const localMinutes = hh * 60 + mm;
    const floored = localMinutes - (localMinutes % 5);

    const key = `${datePart}T${String(Math.floor(floored / 60)).padStart(2, "0")}:${String(
      floored % 60
    ).padStart(2, "0")}`;

    const bucket = buckets.get(key) || {pageViews: 0, uniqueVisitors: 0};
    bucket.pageViews += row.pageViews;
    bucket.uniqueVisitors += row.uniqueVisitors;
    buckets.set(key, bucket);
  }

  return Array.from(buckets, ([bucket, value]) => ({
    bucket,
    label: formatLabel(bucket, "minute"),
    ...value
  }));
};

// MARK: traffic sources

const SOURCE_RULES = [
  {name: "Google", test: /(^|\.)google\./},
  {name: "Facebook", test: /(^|\.)facebook\.com$|(^|\.)fb\.com$/},
  {name: "Instagram", test: /(^|\.)instagram\.com$/},
  {name: "WhatsApp", test: /(^|\.)whatsapp\.com$|(^|\.)wa\.me$/},
  {name: "YouTube", test: /(^|\.)youtube\.com$|(^|\.)youtu\.be$/},
  {name: "X / Twitter", test: /(^|\.)twitter\.com$|(^|\.)x\.com$/},
  {name: "LinkedIn", test: /(^|\.)linkedin\.com$/},
  {name: "Bing", test: /(^|\.)bing\.com$/},
  {name: "TikTok", test: /(^|\.)tiktok\.com$/},
  {name: "Pinterest", test: /(^|\.)pinterest\./},
  {name: "Reddit", test: /(^|\.)reddit\.com$/},
  {name: "Amazon", test: /(^|\.)amazon\./},
  {name: "Flipkart", test: /(^|\.)flipkart\.com$/},
  {name: "Daraz", test: /(^|\.)daraz\./}
];

const OWN_HOSTS = /(^|\.)abhushangallery\.|localhost$|^127\.0\.0\.1$|^10\./;

/** Map a raw referrer to a readable traffic channel. */
const classifySource = (referrer) => {
  if (!referrer) return {source: "Direct", domain: ""};

  let host = "";
  try {
    host = new URL(referrer).hostname.toLowerCase();
  } catch {
    return {source: "Other", domain: String(referrer).slice(0, 60)};
  }

  if (!host) return {source: "Direct", domain: ""};

  // Same-site navigation is an internal move, not a real acquisition source.
  if (OWN_HOSTS.test(host)) return {source: "Internal", domain: host};

  const rule = SOURCE_RULES.find(item => item.test.test(host));
  return {source: rule ? rule.name : "Other", domain: host};
};

module.exports = {
  BUSINESS_TZ,
  RANGES,
  BUCKET_FORMAT,
  getTimezoneOffsetMs,
  startOfDayInTz,
  resolveWindow,
  formatLabel,
  nextBucketKey,
  zeroFill,
  rollUpToFiveMinutes,
  classifySource
};