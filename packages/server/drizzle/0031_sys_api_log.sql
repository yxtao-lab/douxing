CREATE TABLE `sys_api_log` (
	`id` int AUTO_INCREMENT NOT NULL,
	`trace_id` varchar(64),
	`oper_name` varchar(64) NOT NULL DEFAULT 'anonymous',
	`request_url` varchar(512) NOT NULL,
	`method` varchar(16) NOT NULL,
	`request_params` text,
	`response_body` text,
	`status_code` int NOT NULL DEFAULT 200,
	`oper_ip` varchar(64),
	`cost_time` int NOT NULL DEFAULT 0,
	`status` tinyint NOT NULL DEFAULT 1,
	`error_msg` varchar(512),
	`request_time` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `sys_api_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `idx_sys_api_log_request_time` ON `sys_api_log` (`request_time`);
