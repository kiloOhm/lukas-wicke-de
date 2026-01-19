PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_extra_files` (
	`id` text PRIMARY KEY NOT NULL,
	`collection` text NOT NULL,
	`name` text NOT NULL,
	FOREIGN KEY (`collection`) REFERENCES `collections`(`name`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_extra_files`("id", "collection", "name") SELECT "id", "collection", "name" FROM `extra_files`;--> statement-breakpoint
DROP TABLE `extra_files`;--> statement-breakpoint
ALTER TABLE `__new_extra_files` RENAME TO `extra_files`;--> statement-breakpoint
PRAGMA foreign_keys=ON;