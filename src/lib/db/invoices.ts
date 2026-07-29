import { ObjectId } from "mongodb";

import {
  logInvoiceCreatedActivity,
  logInvoiceDeletedActivity,
  logInvoicePaidActivity,
  logInvoiceSentActivity,
  logInvoiceUpdatedActivity,
} from "@/lib/db/activity";
import { getDb } from "@/lib/db/client";
import { COLLECTIONS } from "@/lib/db/collections";
import {
  getInvoicePaymentLinkById,
  upsertInvoicePaymentLink,
} from "@/lib/db/payment-links";
import type {
  InvoiceDoc,
  InvoiceFieldsDoc,
  InvoiceStatus,
  UserDoc,
} from "@/lib/db/types";
import {
  sendInvoicePaidEmail,
  sendInvoiceShareEmail,
} from "@/lib/email/invoice-emails";
import type { InvoiceFormData } from "@/lib/invoice/schema";
import { invoiceReference } from "@/lib/invoice/schema";
import { calculateInvoiceTotal } from "@/lib/invoice/calculate-totals";
import { getTokenById } from "@/lib/create-payment-link-data";
import { resolveInvoicePaymentExpiry } from "@/lib/invoice/invoice-payment-link";
import {
  MANAGE_INVOICES_PAGE_SIZE,
  type ManageInvoiceFilterStatus,
  type ManageInvoiceSort,
  type ManageInvoiceSortField,
} from "@/lib/invoice/manage-invoices";

function toFieldsDoc(data: InvoiceFormData): InvoiceFieldsDoc {
  return {
    companyDetails: data.companyDetails,
    clientDetails: data.clientDetails,
    invoiceDetails: {
      ...data.invoiceDetails,
      dueDate: data.invoiceDetails.dueDate ?? null,
    },
    items: data.items,
    metadata: data.metadata,
    paymentLink: data.paymentLink,
  };
}

function fromFieldsDoc(doc: InvoiceFieldsDoc): InvoiceFormData {
  return {
    companyDetails: doc.companyDetails,
    clientDetails: doc.clientDetails,
    invoiceDetails: {
      ...doc.invoiceDetails,
      theme: {
        ...doc.invoiceDetails.theme,
        template: doc.invoiceDetails.theme.template ?? "default",
      },
      dueDate: doc.invoiceDetails.dueDate ?? null,
    },
    items: doc.items,
    metadata: doc.metadata,
    paymentLink: doc.paymentLink ?? {
      tokenId: "usdc",
      networkId: "",
    },
  };
}

export async function getNextInvoiceSerial(workspaceId: ObjectId) {
  const db = await getDb();
  const count = await db
    .collection(COLLECTIONS.invoices)
    .countDocuments({ workspaceId });

  return String(count + 1).padStart(4, "0");
}

export async function listInvoices(workspaceId: ObjectId) {
  const db = await getDb();
  const invoices = await db
    .collection<InvoiceDoc>(COLLECTIONS.invoices)
    .find({ workspaceId })
    .sort({ updatedAt: -1 })
    .toArray();

  return invoices.map((invoice) => ({
    id: invoice._id.toString(),
    reference: invoice.reference,
    clientName: invoice.fields.clientDetails.name,
    status: invoice.status,
    currency: invoice.fields.invoiceDetails.currency,
    total: calculateInvoiceTotal(fromFieldsDoc(invoice.fields)),
    date: invoice.fields.invoiceDetails.date,
    updatedAt: invoice.updatedAt,
  }));
}

export type ManageInvoiceListItem = {
  id: string;
  shortId: string;
  serialNumber: string;
  reference: string;
  clientName: string;
  storage: string;
  total: number;
  currency: string;
  itemCount: number;
  status: InvoiceStatus;
  invoiceDate: string;
  createdAt: string;
  paidAt?: string;
};

export async function listManageInvoices(
  workspaceId: ObjectId,
): Promise<ManageInvoiceListItem[]> {
  const result = await listManageInvoicesPaginated(workspaceId, {
    page: 1,
    limit: 10_000,
  });
  return result.items;
}

function mapManageInvoice(invoice: InvoiceDoc): ManageInvoiceListItem {
  const fields = fromFieldsDoc(invoice.fields);
  const template = invoice.fields.invoiceDetails.theme.template ?? "default";

  return {
    id: invoice._id.toString(),
    shortId: invoice._id.toString().slice(-8),
    serialNumber: invoice.fields.invoiceDetails.serialNumber,
    reference: invoice.reference || invoiceReference(fields),
    clientName: fields.clientDetails.name,
    storage: template === "vercel" ? "Minimal" : "Default",
    total: calculateInvoiceTotal(fields),
    currency: invoice.fields.invoiceDetails.currency,
    itemCount: invoice.fields.items.length,
    status: invoice.status,
    invoiceDate: invoice.fields.invoiceDetails.date.toISOString(),
    createdAt: invoice.createdAt.toISOString(),
    paidAt: invoice.paidAt?.toISOString(),
  };
}

export async function listManageInvoicesPaginated(
  workspaceId: ObjectId,
  options: {
    page?: number;
    limit?: number;
    status?: ManageInvoiceFilterStatus;
    sortField?: ManageInvoiceSortField;
    sort?: ManageInvoiceSort;
  } = {},
) {
  const db = await getDb();
  const page = Math.max(1, options.page ?? 1);
  const limit = Math.min(50, Math.max(1, options.limit ?? MANAGE_INVOICES_PAGE_SIZE));
  const skip = (page - 1) * limit;

  const filter: Record<string, unknown> = { workspaceId };
  if (options.status && options.status !== "all") {
    filter.status = options.status;
  }

  const sortDirection = options.sort === "asc" ? 1 : -1;
  const sortField = options.sortField ?? "createdAt";

  let sort: Record<string, 1 | -1> = { createdAt: -1 };
  if (sortField === "createdAt") {
    sort = { createdAt: sortDirection };
  } else if (sortField === "paidAt") {
    sort = { paidAt: sortDirection, createdAt: -1 };
  } else if (sortField === "invoiceDate") {
    sort = { "fields.invoiceDetails.date": sortDirection };
  }

  const [invoices, total] = await Promise.all([
    db
      .collection<InvoiceDoc>(COLLECTIONS.invoices)
      .find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .toArray(),
    db.collection(COLLECTIONS.invoices).countDocuments(filter),
  ]);

  let items = invoices.map(mapManageInvoice);

  if (sortField === "total" || sortField === "items") {
    const direction = options.sort === "asc" ? 1 : -1;
    items = [...items].sort((left, right) => {
      if (sortField === "total") {
        return (left.total - right.total) * direction;
      }
      return (left.itemCount - right.itemCount) * direction;
    });
  }

  return {
    items,
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}

export async function getInvoiceById(workspaceId: ObjectId, invoiceId: string) {
  const db = await getDb();
  const invoice = await db.collection<InvoiceDoc>(COLLECTIONS.invoices).findOne({
    _id: new ObjectId(invoiceId),
    workspaceId,
  });

  if (!invoice) return null;

  const paymentLink = invoice.paymentLinkId
    ? await getInvoicePaymentLinkById(workspaceId, invoice.paymentLinkId)
    : null;

  return {
    id: invoice._id.toString(),
    status: invoice.status,
    reference: invoice.reference,
    fields: fromFieldsDoc(invoice.fields),
    paymentLink,
    createdAt: invoice.createdAt,
    updatedAt: invoice.updatedAt,
  };
}

export async function createInvoice(input: {
  workspaceId: ObjectId;
  userId: ObjectId;
  data: InvoiceFormData;
  status?: InvoiceStatus;
}) {
  const db = await getDb();
  const now = new Date();
  const reference = invoiceReference(input.data);

  const doc: Omit<InvoiceDoc, "_id"> = {
    workspaceId: input.workspaceId,
    createdBy: input.userId,
    status: input.status ?? "draft",
    reference,
    fields: toFieldsDoc(input.data),
    createdAt: now,
    updatedAt: now,
  };

  const result = await db.collection(COLLECTIONS.invoices).insertOne(doc);

  await logInvoiceCreatedActivity({
    workspaceId: input.workspaceId,
    reference,
  });

  return {
    id: result.insertedId.toString(),
    reference,
  };
}

export async function updateInvoice(input: {
  workspaceId: ObjectId;
  invoiceId: string;
  data: InvoiceFormData;
  status?: InvoiceStatus;
}) {
  const db = await getDb();
  const now = new Date();
  const reference = invoiceReference(input.data);

  const result = await db.collection<InvoiceDoc>(COLLECTIONS.invoices).updateOne(
    { _id: new ObjectId(input.invoiceId), workspaceId: input.workspaceId },
    {
      $set: {
        reference,
        fields: toFieldsDoc(input.data),
        updatedAt: now,
        ...(input.status ? { status: input.status } : {}),
        ...(input.status === "paid" ? { paidAt: now } : {}),
      },
    },
  );

  return { updated: result.matchedCount > 0, reference };
}

export async function saveInvoiceWithPaymentLink(input: {
  workspaceId: ObjectId;
  userId: ObjectId;
  username: string;
  recipientAddress: string;
  data: InvoiceFormData;
  invoiceId?: string;
}) {
  const amount = calculateInvoiceTotal(input.data);
  if (amount <= 0) {
    throw new Error("Invoice total must be greater than zero");
  }

  const expiresAt = resolveInvoicePaymentExpiry(input.data);
  const { tokenId, networkId } = input.data.paymentLink;
  const db = await getDb();

  if (input.invoiceId) {
    const existing = await db.collection<InvoiceDoc>(COLLECTIONS.invoices).findOne({
      _id: new ObjectId(input.invoiceId),
      workspaceId: input.workspaceId,
    });

    if (!existing) {
      throw new Error("Invoice not found");
    }

    const nextStatus: InvoiceStatus =
      existing.status === "paid" || existing.status === "cancelled"
        ? existing.status
        : "sent";

    const updateResult = await updateInvoice({
      workspaceId: input.workspaceId,
      invoiceId: input.invoiceId,
      data: input.data,
      status: nextStatus,
    });

    if (!updateResult.updated) {
      throw new Error("Invoice not found");
    }

    if (nextStatus === "sent" && existing.status !== "sent") {
      await logInvoiceSentActivity({
        workspaceId: input.workspaceId,
        reference: updateResult.reference,
      });
    } else {
      await logInvoiceUpdatedActivity({
        workspaceId: input.workspaceId,
        reference: updateResult.reference,
      });
    }

    const paymentLink = await upsertInvoicePaymentLink({
      workspaceId: input.workspaceId,
      userId: input.userId,
      username: input.username,
      recipientAddress: input.recipientAddress,
      invoiceId: existing._id,
      paymentLinkId: existing.paymentLinkId,
      amount,
      tokenId,
      networkId,
      expiresAt,
    });

    if (!existing.paymentLinkId) {
      await db.collection<InvoiceDoc>(COLLECTIONS.invoices).updateOne(
        { _id: existing._id },
        { $set: { paymentLinkId: new ObjectId(paymentLink.id) } },
      );
    }

    return {
      id: input.invoiceId,
      reference: updateResult.reference,
      status: nextStatus,
      paymentLink,
    };
  }

  const created = await createInvoice({
    workspaceId: input.workspaceId,
    userId: input.userId,
    data: input.data,
    status: "sent",
  });

  const invoiceObjectId = new ObjectId(created.id);

  const paymentLink = await upsertInvoicePaymentLink({
    workspaceId: input.workspaceId,
    userId: input.userId,
    username: input.username,
    recipientAddress: input.recipientAddress,
    invoiceId: invoiceObjectId,
    amount,
    tokenId,
    networkId,
    expiresAt,
  });

  await db.collection<InvoiceDoc>(COLLECTIONS.invoices).updateOne(
    { _id: invoiceObjectId },
    { $set: { paymentLinkId: new ObjectId(paymentLink.id) } },
  );

  await logInvoiceSentActivity({
    workspaceId: input.workspaceId,
    reference: created.reference,
  });

  return {
    id: created.id,
    reference: created.reference,
    status: "sent" as const,
    paymentLink,
  };
}

export async function deleteInvoice(workspaceId: ObjectId, invoiceId: string) {
  const db = await getDb();
  const invoice = await db.collection<InvoiceDoc>(COLLECTIONS.invoices).findOne({
    _id: new ObjectId(invoiceId),
    workspaceId,
  });

  await db.collection(COLLECTIONS.invoices).deleteOne({
    _id: new ObjectId(invoiceId),
    workspaceId,
  });

  if (invoice) {
    await logInvoiceDeletedActivity({
      workspaceId,
      reference: invoice.reference,
    });
  }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function shareInvoiceByEmail(input: {
  workspaceId: ObjectId;
  userId: ObjectId;
  invoiceId: string;
  to: string;
  message?: string;
  replyTo?: string;
}) {
  const to = input.to.trim().toLowerCase();
  if (!EMAIL_RE.test(to)) {
    throw new Error("Enter a valid email address");
  }

  const db = await getDb();
  const invoice = await db.collection<InvoiceDoc>(COLLECTIONS.invoices).findOne({
    _id: new ObjectId(input.invoiceId),
    workspaceId: input.workspaceId,
  });

  if (!invoice) {
    throw new Error("Invoice not found");
  }

  if (invoice.status === "cancelled") {
    throw new Error("Cancelled invoices cannot be shared");
  }

  if (invoice.status === "paid") {
    throw new Error("This invoice is already paid");
  }

  if (!invoice.paymentLinkId) {
    throw new Error("Save the invoice first to create a payment link");
  }

  const paymentLink = await getInvoicePaymentLinkById(
    input.workspaceId,
    invoice.paymentLinkId,
  );

  if (!paymentLink) {
    throw new Error("Payment link not found. Save the invoice and try again.");
  }

  if (paymentLink.status !== "pending") {
    throw new Error("This invoice payment link is no longer active");
  }

  const fields = fromFieldsDoc(invoice.fields);
  const token = getTokenById(paymentLink.tokenId);
  const amountLabel = `${paymentLink.amount.toLocaleString("en-US", {
    maximumFractionDigits: 2,
  })} ${token?.symbol ?? paymentLink.tokenId.toUpperCase()}`;

  await sendInvoiceShareEmail({
    to,
    replyTo: input.replyTo,
    companyName: fields.companyDetails.name,
    clientName: fields.clientDetails.name,
    reference: invoice.reference,
    amountLabel,
    paymentUrl: paymentLink.url,
    message: input.message,
  });

  const now = new Date();
  const nextStatus: InvoiceStatus =
    invoice.status === "draft" ? "sent" : invoice.status;

  await db.collection<InvoiceDoc>(COLLECTIONS.invoices).updateOne(
    { _id: invoice._id },
    {
      $set: {
        status: nextStatus,
        lastSharedAt: now,
        updatedAt: now,
      },
      $push: {
        sharedRecipients: {
          email: to,
          sharedAt: now,
          ...(input.message?.trim()
            ? { message: input.message.trim().slice(0, 1000) }
            : {}),
        },
      },
    },
  );

  if (invoice.status === "draft") {
    await logInvoiceSentActivity({
      workspaceId: input.workspaceId,
      reference: invoice.reference,
    });
  }

  return {
    ok: true as const,
    to,
    reference: invoice.reference,
    paymentUrl: paymentLink.url,
    status: nextStatus,
  };
}

export async function notifyInvoiceCreatorOfPayment(input: {
  invoiceId: ObjectId;
  amount: number;
  tokenSymbol: string;
  paymentUrl?: string;
}) {
  const db = await getDb();
  const invoice = await db.collection<InvoiceDoc>(COLLECTIONS.invoices).findOne({
    _id: input.invoiceId,
  });

  if (!invoice || invoice.paidNotificationSentAt) {
    return { sent: false as const };
  }

  const creator = await db.collection<UserDoc>(COLLECTIONS.users).findOne({
    _id: invoice.createdBy,
  });

  const to = creator?.email?.trim().toLowerCase();
  if (!to) {
    return { sent: false as const, reason: "missing_creator_email" as const };
  }

  const amountLabel = `${input.amount.toLocaleString("en-US", {
    maximumFractionDigits: 2,
  })} ${input.tokenSymbol}`;

  await sendInvoicePaidEmail({
    to,
    reference: invoice.reference,
    clientName: invoice.fields.clientDetails.name,
    amountLabel,
    paymentUrl: input.paymentUrl,
  });

  await db.collection<InvoiceDoc>(COLLECTIONS.invoices).updateOne(
    { _id: invoice._id, paidNotificationSentAt: { $exists: false } },
    { $set: { paidNotificationSentAt: new Date() } },
  );

  return { sent: true as const, to };
}
