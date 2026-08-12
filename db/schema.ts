import { sql } from "drizzle-orm";
import { check, index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const employees = sqliteTable("employees", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  role: text("role", { enum: ["manager", "leader"] }).notNull(),
  passwordHash: text("password_hash"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("uq_employees_email").on(table.email),
  index("idx_employees_role_active").on(table.role, table.isActive),
]);

export const products = sqliteTable("products", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [uniqueIndex("uq_products_name").on(table.name)]);

export const leads = sqliteTable("leads", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  managerId: text("manager_id").notNull().references(() => employees.id, { onDelete: "restrict", onUpdate: "cascade" }),
  productId: text("product_id").references(() => products.id, { onDelete: "set null", onUpdate: "cascade" }),
  clientName: text("client_name").notNull(),
  phone: text("phone"),
  telegram: text("telegram"),
  income: text("income"),
  request: text("request"),
  sourceStatus: text("source_status"),
  status: text("status", { enum: ["Новая заявка", "В работе", "КП отправлено", "Ждём решения", "Оплата", "Закрыта"] }).notNull().default("Новая заявка"),
  amount: integer("amount").notNull().default(0),
  netAmount: integer("net_amount").notNull().default(0),
  paymentType: text("payment_type"),
  nextAction: text("next_action"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("idx_leads_manager_status").on(table.managerId, table.status),
  index("idx_leads_product_status").on(table.productId, table.status),
  index("idx_leads_created_at").on(table.createdAt),
  check("chk_leads_amount_nonnegative", sql`${table.amount} >= 0`),
  check("chk_leads_net_amount_nonnegative", sql`${table.netAmount} >= 0`),
]);

export const leadStatusHistory = sqliteTable("lead_status_history", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  leadId: integer("lead_id").notNull().references(() => leads.id, { onDelete: "cascade" }),
  fromStatus: text("from_status"),
  toStatus: text("to_status").notNull(),
  changedBy: text("changed_by").references(() => employees.id, { onDelete: "set null" }),
  changedAt: text("changed_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("idx_lead_history_lead_date").on(table.leadId, table.changedAt)]);

export const payments = sqliteTable("payments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  leadId: integer("lead_id").references(() => leads.id, { onDelete: "set null" }),
  managerId: text("manager_id").notNull().references(() => employees.id, { onDelete: "restrict", onUpdate: "cascade" }),
  productId: text("product_id").references(() => products.id, { onDelete: "set null", onUpdate: "cascade" }),
  clientName: text("client_name").notNull(),
  revenue: integer("revenue").notNull().default(0),
  netProfit: integer("net_profit").notNull().default(0),
  paymentMethod: text("payment_method").notNull(),
  paymentDate: text("payment_date").notNull(),
  comment: text("comment"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("idx_payments_manager_date").on(table.managerId, table.paymentDate),
  index("idx_payments_product_date").on(table.productId, table.paymentDate),
  index("idx_payments_method_date").on(table.paymentMethod, table.paymentDate),
  check("chk_payments_revenue_nonnegative", sql`${table.revenue} >= 0`),
  check("chk_payments_net_profit_nonnegative", sql`${table.netProfit} >= 0`),
]);

export const monthlyPlans = sqliteTable("monthly_plans", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  month: text("month").notNull(),
  scopeKey: text("scope_key").notNull().default("department"),
  employeeId: text("employee_id").references(() => employees.id, { onDelete: "cascade" }),
  productId: text("product_id").references(() => products.id, { onDelete: "cascade" }),
  minimum: integer("minimum").notNull(),
  target: integer("target").notNull(),
  maximum: integer("maximum").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("uq_monthly_plans_month_scope").on(table.month, table.scopeKey),
  index("idx_monthly_plans_employee_month").on(table.employeeId, table.month),
  index("idx_monthly_plans_product_month").on(table.productId, table.month),
  check("chk_monthly_plans_order", sql`${table.minimum} <= ${table.target} AND ${table.target} <= ${table.maximum}`),
]);

export const employeeCompensation = sqliteTable("employee_compensation", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  employeeId: text("employee_id").notNull().references(() => employees.id, { onDelete: "cascade", onUpdate: "cascade" }),
  month: text("month").notNull(),
  salary: integer("salary").notNull(),
  baseRate: real("base_rate").notNull(),
  minimumCoefficient: real("minimum_coefficient").notNull().default(1),
  targetCoefficient: real("target_coefficient").notNull().default(1),
  maximumCoefficient: real("maximum_coefficient").notNull().default(1),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("uq_employee_compensation_employee_month").on(table.employeeId, table.month),
  index("idx_employee_compensation_month").on(table.month),
  check("chk_employee_compensation_salary", sql`${table.salary} >= 0`),
  check("chk_employee_compensation_coefficients", sql`${table.minimumCoefficient} > 0 AND ${table.targetCoefficient} > 0 AND ${table.maximumCoefficient} > 0`),
]);

export const auditLog = sqliteTable("audit_log", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  actorId: text("actor_id").references(() => employees.id, { onDelete: "set null" }),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  action: text("action").notNull(),
  changes: text("changes"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("idx_audit_entity_date").on(table.entityType, table.entityId, table.createdAt)]);

// Временная таблица прошлой версии. Новая логика её не использует, но она
// сохраняется в схеме, чтобы миграция не удаляла ранее сохранённое состояние.
export const legacyCrmState = sqliteTable("crm_state", {
  id: integer("id").primaryKey(),
  payload: text("payload").notNull(),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});
