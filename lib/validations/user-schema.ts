import { z } from "zod";

export const userSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().optional(),
  phone: z.string().optional(),
  AppRole: z.string().optional(),
  designation: z.string().optional(),
  isActive: z.boolean().optional(),
  serialNo: z.string().optional(),
  profilePicture: z.string().optional(),
  location: z.string().optional(),
  siteIds: z.array(z.string()).optional(),
  primarySiteId: z.string().optional(),
}).passthrough();
