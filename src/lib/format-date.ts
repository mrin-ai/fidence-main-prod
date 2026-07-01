const paymentDateFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
});

export function formatPaymentDateTime(value: string | Date) {
  const date = typeof value === "string" ? new Date(value) : value;
  return paymentDateFormatter.format(date);
}
