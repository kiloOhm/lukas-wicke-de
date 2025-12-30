CREATE TABLE `collections` (
	`name` text PRIMARY KEY NOT NULL,
	`password` text,
	`thumb` text
);
--> statement-breakpoint
CREATE TABLE `images` (
	`id` text PRIMARY KEY NOT NULL,
	`alt` text NOT NULL,
	`width` integer,
	`height` integer,
	`collection` text NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`collection`) REFERENCES `collections`(`name`) ON UPDATE no action ON DELETE no action
);
