ALTER TABLE `users` ADD `gender` varchar(16);
ALTER TABLE `users` ADD `age_range` varchar(16);
ALTER TABLE `users` ADD `travel_radius` varchar(16);
ALTER TABLE `users` ADD `companion_structure` json;
ALTER TABLE `users` ADD `budget_tier` varchar(32);
ALTER TABLE `users` ADD `onboarded_at` timestamp NULL;
