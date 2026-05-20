ALTER TABLE `attractions` MODIFY `latitude` decimal(10,7);--> statement-breakpoint
ALTER TABLE `attractions` MODIFY `longitude` decimal(10,7);--> statement-breakpoint
ALTER TABLE `attractions` ADD `source` varchar(16) NOT NULL DEFAULT 'seed';--> statement-breakpoint
ALTER TABLE `attractions` ADD `price_source` varchar(32);--> statement-breakpoint
ALTER TABLE `attractions` ADD `match_confidence` decimal(4,3);--> statement-breakpoint
ALTER TABLE `attractions` ADD `price_updated_at` timestamp;--> statement-breakpoint
ALTER TABLE `attractions` ADD `verified_at` timestamp;--> statement-breakpoint
UPDATE `attractions` SET `price_source` = 'seed', `verified_at` = COALESCE(`verified_at`, NOW()) WHERE `price_source` IS NULL;--> statement-breakpoint
CREATE INDEX `idx_attractions_status` ON `attractions` (`status`);
