import { ObjectId } from "mongodb";

import { logInvoiceCreatedActivity } from "@/lib/db/activity";
import { getDb } from "@/lib/db/client";
import { COLLECTIONS } from "@/lib/db/collections";
import type { InvoiceDoc, InvoiceFieldsDoc, InvoiceStatus } from "@/lib/db/types";
import type { InvoiceFormData } from "@/lib/invoice/schema";
import { invoiceReference } from "@/lib/invoice/schema";

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
    total: invoice.fields.items.reduce(
      (sum, item) => sum + item.quantity * item.unitPrice,
      0,
    ),
    date: invoice.fields.invoiceDetails.date,
    updatedAt: invoice.updatedAt,
  }));
}

export async function getInvoiceById(workspaceId: ObjectId, invoiceId: string) {
  const db = await getDb();
  const invoice = await db.collection<InvoiceDoc>(COLLECTIONS.invoices).findOne({
    _id: new ObjectId(invoiceId),
    workspaceId,
  });

  if (!invoice) return null;

  return {
    id: invoice._id.toString(),
    status: invoice.status,
    reference: invoice.reference,
    fields: fromFieldsDoc(invoice.fields),
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
      },
    },
  );

  return { updated: result.matchedCount > 0, reference };
}

export async function deleteInvoice(workspaceId: ObjectId, invoiceId: string) {
  const db = await getDb();
  await db.collection(COLLECTIONS.invoices).deleteOne({
    _id: new ObjectId(invoiceId),
    workspaceId,
  });
}
