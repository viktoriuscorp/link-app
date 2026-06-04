import { z } from "zod";

export const slugSchema = z
  .string()
  .trim()
  .min(3, "El slug debe tener al menos 3 caracteres.")
  .max(48, "El slug no puede superar 48 caracteres.")
  .regex(/^[a-zA-Z0-9_-]+$/, "Usa solo letras, numeros, guiones y guiones bajos.");

export const urlSchema = z
  .string()
  .trim()
  .url("Introduce una URL valida, incluyendo https://")
  .refine((value) => /^https?:\/\//i.test(value), "La URL debe empezar por http:// o https://");

export const hostnameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(4, "Introduce un dominio valido.")
  .max(253, "El dominio es demasiado largo.")
  .regex(
    /^(?!-)([a-z0-9-]{1,63}\.)+[a-z]{2,63}$/,
    "Usa un dominio o subdominio valido, por ejemplo go.tumarca.com."
  );

const optionalUrlSchema = z.union([urlSchema, z.literal("")]).optional().default("");
const tagsSchema = z
  .string()
  .trim()
  .max(160, "Los tags no pueden superar 160 caracteres.")
  .optional()
  .default("");
const optionalTagsSchema = z.string().trim().max(160, "Los tags no pueden superar 160 caracteres.").optional();

export const createLinkSchema = z.object({
  title: z.string().trim().max(90).optional().default(""),
  slug: z.union([slugSchema, z.literal("")]).optional().default(""),
  targetUrl: urlSchema,
  domainId: z.union([z.string().min(1), z.literal("base")]).optional().default("base"),
  tags: tagsSchema,
  campaign: z.string().trim().max(80).optional().default(""),
  expiresAt: z.string().trim().optional().default(""),
  clickLimit: z.coerce.number().int().positive().max(1000000).optional().nullable(),
  fallbackUrl: optionalUrlSchema
});

export const updateLinkSchema = z.object({
  title: z.string().trim().max(90).optional(),
  targetUrl: urlSchema.optional(),
  isActive: z.boolean().optional(),
  tags: optionalTagsSchema,
  campaign: z.string().trim().max(80).optional(),
  expiresAt: z.string().trim().nullable().optional(),
  clickLimit: z.coerce.number().int().positive().max(1000000).nullable().optional(),
  fallbackUrl: z.union([urlSchema, z.literal("")]).optional()
});

export const createDomainSchema = z.object({
  hostname: hostnameSchema
});
