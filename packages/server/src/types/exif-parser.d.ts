declare module 'exif-parser' {
  interface ExifTags {
    DateTimeOriginal?: number;
    CreateDate?: number;
    GPSLatitude?: number;
    GPSLongitude?: number;
    Make?: string;
    Model?: string;
    LensModel?: string;
    LensInfo?: string;
    ISO?: number;
    ISOSpeedRatings?: number;
    PhotographicSensitivity?: number;
    FNumber?: number;
    ApertureValue?: number;
    ExposureTime?: number;
    ShutterSpeedValue?: number;
    FocalLength?: number;
    FocalLengthIn35mmFilm?: number;
    FocalLengthIn35mmFormat?: number;
    Flash?: number;
    WhiteBalance?: string;
  }

  interface ExifResult {
    tags: ExifTags;
  }

  interface ExifParser {
    parse(): ExifResult;
  }

  export function create(buffer: Buffer): ExifParser;
}
