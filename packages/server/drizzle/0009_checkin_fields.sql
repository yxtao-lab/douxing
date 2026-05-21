ALTER TABLE `check_ins` ADD `city_code` varchar(32);--> statement-breakpoint
ALTER TABLE `check_ins` ADD `photos` json;--> statement-breakpoint
ALTER TABLE `check_ins` ADD `points_earned` int NOT NULL DEFAULT 0;--> statement-breakpoint
UPDATE `check_ins` ci
INNER JOIN `attractions` a ON ci.`attraction_id` = a.`id`
SET ci.`city_code` = a.`city_code`
WHERE ci.`city_code` IS NULL;--> statement-breakpoint
UPDATE `check_ins` SET `city_code` = 'unknown' WHERE `city_code` IS NULL;--> statement-breakpoint
ALTER TABLE `check_ins` MODIFY `city_code` varchar(32) NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_check_ins_city` ON `check_ins` (`city_code`);
