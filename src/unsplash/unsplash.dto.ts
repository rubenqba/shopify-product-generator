import { z } from 'zod';

/**
 * Unsplash -> Solo lo relevante para:
 * - construir una URL con lado largo ≤ 2048
 * - alt/atribución
 * - tracking (download_location) para cumplir con la API
 * - placeholders (blur_hash) opcional
 */
export const UnsplashImageMinimalSchema = z.object({
  id: z.string(),
  slug: z.string().optional(),
  alt_description: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  color: z
    .string()
    .regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/)
    .optional(),
  blur_hash: z.string().optional(),
  urls: z.object({
    raw: z.string().url(),
    full: z.string().url(),
    regular: z.string().url(),
    small: z.string().url(),
    thumb: z.string().url(),
    small_s3: z.string().url().optional(),
  }),
  links: z.object({
    html: z.string().url(), // página pública (atribución)
    download: z.string().url(), // opcional
    download_location: z.string().url(), // para registrar descarga vía API
  }),
  user: z.object({
    username: z.string(),
    name: z.string().optional(),
  }),
});

export const UnsplashSearchResponseSchema = z.object({
  results: z.array(UnsplashImageMinimalSchema),
});

export type UnsplashImageMinimal = z.infer<typeof UnsplashImageMinimalSchema>;

export const DownloadUrlSchema = z.object({
  url: z.string().url(),
});
