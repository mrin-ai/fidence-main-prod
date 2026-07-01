const paymentDateFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
});

export function formatPaymentDateTime(value: string | Date) {
  const date = typeof value === "string" ? new Date(value) : value;
  return paymentDateFormatter.format(date);
}

const activityTimeFormatter = new Intl.DateTimeFormat("en-US", {
  timeStyle: "short",
});

const activityDateFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
});

export function formatActivityMeta(value: string | Date) {
  const date = typeof value === "string" ? new Date(value) : value;
  const time = activityTimeFormatter.format(date);
  const dateLabel = activityDateFormatter.format(date);
  return `at ${time} · ${dateLabel}`;
}
