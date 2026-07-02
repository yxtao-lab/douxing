-- H10-a：路线评论支持按天/POI 筛选
ALTER TABLE `route_comments`
  ADD COLUMN `day_index` INT NULL COMMENT '关联行程天（0-based）' AFTER `content`,
  ADD COLUMN `attraction_id` INT NULL COMMENT '关联景点库 ID' AFTER `day_index`,
  ADD COLUMN `poi_name` VARCHAR(128) NULL COMMENT '关联 POI 名称（无 attractionId 时兜底）' AFTER `attraction_id`;
--> statement-breakpoint
CREATE INDEX `idx_route_comments_poi` ON `route_comments` (`route_id`, `attraction_id`, `day_index`);
