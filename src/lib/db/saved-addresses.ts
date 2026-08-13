import type { ObjectId } from "mongodb";

import { getDb } from "@/lib/db/client";
import { COLLECTIONS } from "@/lib/db/collections";
import { logActivity } from "@/lib/db/activity";
import { MAX_SAVED_ADDRESSES_PER_WORKSPACE } from "@/lib/pay/config";
import type { SavedAddressInput } from "@/lib/pay/saved-address-schema";
import type { SavedAddressDoc, SavedAddressSummary } from "@/lib/pay/types";

function normalizeOptional(value?: string) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function toSummary(doc: SavedAddressDoc): SavedAddressSummary {
  return {
    id: doc._id.toString(),
    name: doc.name,
    email: doc.email,
    phone: doc.phone,
    line1: doc.line1,
    line2: doc.line2,
    city: doc.city,
    state: doc.state,
    postalCode: doc.postalCode,
    country: doc.country,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export async function listSavedAddresses(workspaceId: ObjectId) {
  const db = await getDb();
  const docs = await db
    .collection<SavedAddressDoc>(COLLECTIONS.savedAddresses)
    .find({ workspaceId, deletedAt: { $exists: false } })
    .sort({ createdAt: -1 })
    .toArray();

  return docs.map(toSummary);
}

export async function getSavedAddress(workspaceId: ObjectId, addressId: ObjectId) {
  const db = await getDb();
  const doc = await db.collection<SavedAddressDoc>(COLLECTIONS.savedAddresses).findOne({
    _id: addressId,
    workspaceId,
    deletedAt: { $exists: false },
  });
  return doc;
}

export async function createSavedAddress(input: {
  workspaceId: ObjectId;
  data: SavedAddressInput;
}) {
  const db = await getDb();
  const count = await db.collection(COLLECTIONS.savedAddresses).countDocuments({
    workspaceId: input.workspaceId,
    deletedAt: { $exists: false },
  });

  if (count >= MAX_SAVED_ADDRESSES_PER_WORKSPACE) {
    return {
      ok: false as const,
      error: `Maximum ${MAX_SAVED_ADDRESSES_PER_WORKSPACE} saved addresses allowed`,
    };
  }

  const now = new Date();
  const doc: Omit<SavedAddressDoc, "_id"> = {
    workspaceId: input.workspaceId,
    name: input.data.name.trim(),
    email: normalizeOptional(input.data.email),
    phone: normalizeOptional(input.data.phone),
    line1: input.data.line1.trim(),
    line2: normalizeOptional(input.data.line2),
    city: input.data.city.trim(),
    state: normalizeOptional(input.data.state),
    postalCode: normalizeOptional(input.data.postalCode),
    country: input.data.country.trim().toUpperCase(),
    createdAt: now,
    updatedAt: now,
  };

  const result = await db.collection(COLLECTIONS.savedAddresses).insertOne(doc as SavedAddressDoc);
  const saved = { ...doc, _id: result.insertedId };

  await logActivity({
    workspaceId: input.workspaceId,
    type: "saved_address_created",
    summary: `Saved address added · ${saved.name}`,
  });

  return { ok: true as const, address: toSummary(saved as SavedAddressDoc) };
}

export async function updateSavedAddress(input: {
  workspaceId: ObjectId;
  addressId: ObjectId;
  data: SavedAddressInput;
}) {
  const db = await getDb();
  const now = new Date();
  const result = await db.collection<SavedAddressDoc>(COLLECTIONS.savedAddresses).findOneAndUpdate(
    {
      _id: input.addressId,
      workspaceId: input.workspaceId,
      deletedAt: { $exists: false },
    },
    {
      $set: {
        name: input.data.name.trim(),
        email: normalizeOptional(input.data.email),
        phone: normalizeOptional(input.data.phone),
        line1: input.data.line1.trim(),
        line2: normalizeOptional(input.data.line2),
        city: input.data.city.trim(),
        state: normalizeOptional(input.data.state),
        postalCode: normalizeOptional(input.data.postalCode),
        country: input.data.country.trim().toUpperCase(),
        updatedAt: now,
      },
    },
    { returnDocument: "after" },
  );

  if (!result) {
    return { ok: false as const, error: "Saved address not found" };
  }

  await logActivity({
    workspaceId: input.workspaceId,
    type: "saved_address_updated",
    summary: `Saved address updated · ${result.name}`,
  });

  return { ok: true as const, address: toSummary(result) };
}

export async function deleteSavedAddress(input: {
  workspaceId: ObjectId;
  addressId: ObjectId;
}) {
  const db = await getDb();
  const now = new Date();
  const result = await db.collection<SavedAddressDoc>(COLLECTIONS.savedAddresses).findOneAndUpdate(
    {
      _id: input.addressId,
      workspaceId: input.workspaceId,
      deletedAt: { $exists: false },
    },
    { $set: { deletedAt: now, updatedAt: now } },
    { returnDocument: "before" },
  );

  if (!result) {
    return { ok: false as const, error: "Saved address not found" };
  }

  await logActivity({
    workspaceId: input.workspaceId,
    type: "saved_address_deleted",
    summary: `Saved address removed · ${result.name}`,
  });

  return { ok: true as const };
}
