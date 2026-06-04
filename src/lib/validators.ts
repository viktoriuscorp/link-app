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

export const createLinkSchema = z.object({
  title: z.string().trim().max(90).optional().default(""),
  slug: z.union([slugSchema, z.literal("")]).optional().default(""),
  targetUrl: urlSchema,
  domainId: z.union([z.string().min(1), z.literal("base")]).optional().default("base")
});

export const updateLinkSchema = z.object({
  title: z.string().trim().max(90).optional(),
  targetUrl: urlSchema.optional()
});

export const createDomainSchema = z.object({
  hostname: hostnameSchema
});
