CREATE TABLE `audit_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`actor_id` text,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`action` text NOT NULL,
	`changes` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`actor_id`) REFERENCES `employees`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_audit_entity_date` ON `audit_log` (`entity_type`,`entity_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `employee_compensation` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`employee_id` text NOT NULL,
	`month` text NOT NULL,
	`salary` integer NOT NULL,
	`base_rate` real NOT NULL,
	`minimum_coefficient` real DEFAULT 1 NOT NULL,
	`target_coefficient` real DEFAULT 1 NOT NULL,
	`maximum_coefficient` real DEFAULT 1 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON UPDATE cascade ON DELETE cascade,
	CONSTRAINT "chk_employee_compensation_salary" CHECK("employee_compensation"."salary" >= 0),
	CONSTRAINT "chk_employee_compensation_coefficients" CHECK("employee_compensation"."minimum_coefficient" > 0 AND "employee_compensation"."target_coefficient" > 0 AND "employee_compensation"."maximum_coefficient" > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_employee_compensation_employee_month` ON `employee_compensation` (`employee_id`,`month`);--> statement-breakpoint
CREATE INDEX `idx_employee_compensation_month` ON `employee_compensation` (`month`);--> statement-breakpoint
CREATE TABLE `employees` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`role` text NOT NULL,
	`password_hash` text,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_employees_email` ON `employees` (`email`);--> statement-breakpoint
CREATE INDEX `idx_employees_role_active` ON `employees` (`role`,`is_active`);--> statement-breakpoint
CREATE TABLE `lead_status_history` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`lead_id` integer NOT NULL,
	`from_status` text,
	`to_status` text NOT NULL,
	`changed_by` text,
	`changed_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`changed_by`) REFERENCES `employees`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_lead_history_lead_date` ON `lead_status_history` (`lead_id`,`changed_at`);--> statement-breakpoint
CREATE TABLE `leads` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`manager_id` text NOT NULL,
	`product_id` text,
	`client_name` text NOT NULL,
	`phone` text,
	`telegram` text,
	`income` text,
	`request` text,
	`source_status` text,
	`status` text DEFAULT 'Новая заявка' NOT NULL,
	`amount` integer DEFAULT 0 NOT NULL,
	`net_amount` integer DEFAULT 0 NOT NULL,
	`payment_type` text,
	`next_action` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`manager_id`) REFERENCES `employees`(`id`) ON UPDATE cascade ON DELETE restrict,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE cascade ON DELETE set null,
	CONSTRAINT "chk_leads_amount_nonnegative" CHECK("leads"."amount" >= 0),
	CONSTRAINT "chk_leads_net_amount_nonnegative" CHECK("leads"."net_amount" >= 0)
);
--> statement-breakpoint
CREATE INDEX `idx_leads_manager_status` ON `leads` (`manager_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_leads_product_status` ON `leads` (`product_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_leads_created_at` ON `leads` (`created_at`);--> statement-breakpoint
CREATE TABLE `monthly_plans` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`month` text NOT NULL,
	`scope_key` text DEFAULT 'department' NOT NULL,
	`employee_id` text,
	`product_id` text,
	`minimum` integer NOT NULL,
	`target` integer NOT NULL,
	`maximum` integer NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "chk_monthly_plans_order" CHECK("monthly_plans"."minimum" <= "monthly_plans"."target" AND "monthly_plans"."target" <= "monthly_plans"."maximum")
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_monthly_plans_month_scope` ON `monthly_plans` (`month`,`scope_key`);--> statement-breakpoint
CREATE INDEX `idx_monthly_plans_employee_month` ON `monthly_plans` (`employee_id`,`month`);--> statement-breakpoint
CREATE INDEX `idx_monthly_plans_product_month` ON `monthly_plans` (`product_id`,`month`);--> statement-breakpoint
CREATE TABLE `payments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`lead_id` integer,
	`manager_id` text NOT NULL,
	`product_id` text,
	`client_name` text NOT NULL,
	`revenue` integer DEFAULT 0 NOT NULL,
	`net_profit` integer DEFAULT 0 NOT NULL,
	`payment_method` text NOT NULL,
	`payment_date` text NOT NULL,
	`comment` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`manager_id`) REFERENCES `employees`(`id`) ON UPDATE cascade ON DELETE restrict,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE cascade ON DELETE set null,
	CONSTRAINT "chk_payments_revenue_nonnegative" CHECK("payments"."revenue" >= 0),
	CONSTRAINT "chk_payments_net_profit_nonnegative" CHECK("payments"."net_profit" >= 0)
);
--> statement-breakpoint
CREATE INDEX `idx_payments_manager_date` ON `payments` (`manager_id`,`payment_date`);--> statement-breakpoint
CREATE INDEX `idx_payments_product_date` ON `payments` (`product_id`,`payment_date`);--> statement-breakpoint
CREATE INDEX `idx_payments_method_date` ON `payments` (`payment_method`,`payment_date`);--> statement-breakpoint
CREATE TABLE `products` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_products_name` ON `products` (`name`);