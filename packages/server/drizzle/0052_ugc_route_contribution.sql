ALTER TABLE `travel_routes` ADD `source_kind` varchar(32) NOT NULL DEFAULT 'ugc_original';--> statement-breakpoint
ALTER TABLE `travel_routes` ADD `content_tier` varchar(32) NOT NULL DEFAULT 'inspiration';--> statement-breakpoint
ALTER TABLE `travel_routes` ADD `verification_status` varchar(32) NOT NULL DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE `travel_routes` ADD `moderation_status` varchar(32) NOT NULL DEFAULT 'approved';--> statement-breakpoint
ALTER TABLE `travel_routes` ADD `parent_route_id` int;--> statement-breakpoint
UPDATE `travel_routes`
SET `source_kind` = 'ai_draft'
WHERE JSON_EXTRACT(`route_detail`, '$.isAiGenerated') = true
  AND (`source_kind` = 'ugc_original' OR `source_kind` IS NULL);--> statement-breakpoint
UPDATE `travel_routes`
SET `content_tier` = 'inspiration'
WHERE `is_public` = 1;
