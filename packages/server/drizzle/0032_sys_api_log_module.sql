ALTER TABLE `sys_api_log` ADD `api_module` varchar(32);--> statement-breakpoint
CREATE INDEX `idx_sys_api_log_api_module` ON `sys_api_log` (`api_module`);
