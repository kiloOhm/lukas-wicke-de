ALTER TABLE `images` ADD `file_name` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `images` DROP COLUMN `position`;