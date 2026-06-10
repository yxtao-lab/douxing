-- J5：旅程相册公开分享 token
ALTER TABLE `journey_albums`
  ADD COLUMN `share_enabled` tinyint NOT NULL DEFAULT 0 AFTER `status`,
  ADD COLUMN `share_token` varchar(32) NULL AFTER `share_enabled`,
  ADD UNIQUE INDEX `uk_journey_albums_share_token` (`share_token`);
