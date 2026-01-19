CREATE TABLE `extra_files` (
	`collection` text NOT NULL,
	`name` text NOT NULL,
	`path` text NOT NULL,
	PRIMARY KEY(`collection`, `path`),
	FOREIGN KEY (`collection`) REFERENCES `collections`(`name`) ON UPDATE no action ON DELETE no action
);
