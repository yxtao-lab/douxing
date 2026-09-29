ALTER TABLE `travel_routes` ADD `trust_score` int NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE `travel_routes` ADD `trust_breakdown` json;--> statement-breakpoint
ALTER TABLE `travel_routes` ADD `trust_crowned` tinyint NOT NULL DEFAULT 0;
