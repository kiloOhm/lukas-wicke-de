CREATE TABLE `comments` (
	`id` text PRIMARY KEY NOT NULL,
	`collection` text NOT NULL,
	`image_id` text NOT NULL,
	`text` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`name` text
);
--> statement-breakpoint
CREATE TABLE `image_comment_stats` (
	`collection` text NOT NULL,
	`image_id` text NOT NULL,
	`comment_count` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`collection`, `image_id`)
);
