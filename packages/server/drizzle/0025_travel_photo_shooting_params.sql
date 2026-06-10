-- J5+：旅行照片 EXIF 拍摄参数 JSON
ALTER TABLE `travel_photos`
  ADD COLUMN `shooting_params` json NULL AFTER `source`;
