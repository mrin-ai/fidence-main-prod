import { z } from "zod";

export const savedAddressInputSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  email: z.string().trim().email("Valid email required").max(254).optional().or(z.literal("")),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  line1: z.string().trim().min(1, "Address line 1 is required").max(200),
  line2: z.string().trim().max(200).optional().or(z.literal("")),
  city: z.string().trim().min(1, "City is required").max(100),
  state: z.string().trim().max(100).optional().or(z.literal("")),
  postalCode: z.string().trim().max(20).optional().or(z.literal("")),
  country: z.string().trim().min(2, "Country is required").max(2),
});

export type SavedAddressInput = z.infer<typeof savedAddressInputSchema>;
