/** PC 旅程相册允许的图片 MIME（与后端 multer 白名单对齐） */
const ALLOWED_IMAGE_MIME = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/bmp',
  'image/heic',
  'image/heif',
  'image/x-ms-bmp',
  'image/pjpeg',
]);

const ALLOWED_IMAGE_EXT = /\.(jpe?g|png|webp|gif|bmp|heic|heif)$/i;

/** 文件选择器 accept 属性 */
export const TRAVEL_PHOTO_ACCEPT =
  'image/jpeg,image/png,image/webp,image/gif,image/bmp,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.gif,.bmp,.heic,.heif';

export function isAllowedTravelPhotoFile(file: File): boolean {
  const mime = file.type?.trim().toLowerCase();
  if (mime) {
    if (mime.startsWith('image/')) return true;
    if (ALLOWED_IMAGE_MIME.has(mime)) return true;
  }
  return ALLOWED_IMAGE_EXT.test(file.name);
}

export function partitionTravelPhotoFiles(files: FileList | File[]): {
  accepted: File[];
  rejectedCount: number;
} {
  const list = Array.from(files);
  const accepted: File[] = [];
  let rejectedCount = 0;
  for (const file of list) {
    if (isAllowedTravelPhotoFile(file)) {
      accepted.push(file);
    } else {
      rejectedCount += 1;
    }
  }
  return { accepted, rejectedCount };
}
