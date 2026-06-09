CREATE TABLE `sys_dept` (
	`id` int AUTO_INCREMENT NOT NULL,
	`parent_id` int NOT NULL DEFAULT 0,
	`name` varchar(64) NOT NULL,
	`sort_order` int NOT NULL DEFAULT 0,
	`status` tinyint NOT NULL DEFAULT 1,
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `sys_dept_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sys_post` (
	`id` int AUTO_INCREMENT NOT NULL,
	`code` varchar(32) NOT NULL,
	`name` varchar(64) NOT NULL,
	`sort_order` int NOT NULL DEFAULT 0,
	`status` tinyint NOT NULL DEFAULT 1,
	`remark` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `sys_post_id` PRIMARY KEY(`id`),
	CONSTRAINT `sys_post_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `sys_dict_type` (
	`id` int AUTO_INCREMENT NOT NULL,
	`dict_type` varchar(64) NOT NULL,
	`dict_name` varchar(64) NOT NULL,
	`status` tinyint NOT NULL DEFAULT 1,
	`remark` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `sys_dict_type_id` PRIMARY KEY(`id`),
	CONSTRAINT `sys_dict_type_dict_type_unique` UNIQUE(`dict_type`)
);
--> statement-breakpoint
CREATE TABLE `sys_dict_data` (
	`id` int AUTO_INCREMENT NOT NULL,
	`dict_type` varchar(64) NOT NULL,
	`dict_label` varchar(64) NOT NULL,
	`dict_value` varchar(64) NOT NULL,
	`sort_order` int NOT NULL DEFAULT 0,
	`status` tinyint NOT NULL DEFAULT 1,
	`remark` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `sys_dict_data_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sys_notice` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(128) NOT NULL,
	`notice_type` tinyint NOT NULL DEFAULT 1,
	`status` tinyint NOT NULL DEFAULT 1,
	`content` text NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `sys_notice_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sys_oper_log` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(64) NOT NULL,
	`oper_name` varchar(64) NOT NULL,
	`oper_url` varchar(255) NOT NULL,
	`method` varchar(16) NOT NULL,
	`oper_ip` varchar(64),
	`status` tinyint NOT NULL DEFAULT 1,
	`error_msg` varchar(512),
	`oper_time` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `sys_oper_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sys_login_log` (
	`id` int AUTO_INCREMENT NOT NULL,
	`username` varchar(64) NOT NULL,
	`ip` varchar(64),
	`browser` varchar(64),
	`os` varchar(64),
	`status` tinyint NOT NULL DEFAULT 1,
	`msg` varchar(255),
	`login_time` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `sys_login_log_id` PRIMARY KEY(`id`)
);
