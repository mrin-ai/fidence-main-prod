export const MANAGE_INVOICES_PAGE_SIZE = 10;

export type ManageInvoiceFilterStatus = "all" | "draft" | "sent" | "paid" | "cancelled";

export type ManageInvoiceSortField =
  | "total"
  | "items"
  | "invoiceDate"
  | "createdAt"
  | "paidAt";

export type ManageInvoiceSort = "asc" | "desc";
