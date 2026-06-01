ALTER TABLE `attractions` ADD `cover_image_url` varchar(512);--> statement-breakpoint
ALTER TABLE `attractions` ADD `image_source` varchar(32);--> statement-breakpoint
ALTER TABLE `attractions` ADD `image_license` varchar(128);--> statement-breakpoint
ALTER TABLE `attractions` ADD `image_attribution` varchar(256);--> statement-breakpoint
ALTER TABLE `attractions` ADD `image_fetched_at` timestamp;
