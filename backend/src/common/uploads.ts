import { resolve } from 'node:path';

export const UPLOAD_ROOT = resolve(process.env.UPLOAD_DIR ?? 'uploads');
export const UPLOADS_URL_PREFIX = '/uploads';

export function uploadPath(...segments: string[]): string {
  return resolve(UPLOAD_ROOT, ...segments);
}
