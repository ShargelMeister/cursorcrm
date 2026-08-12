import { env } from "cloudflare:workers";
import seedData from "../../data/normalized.json";

type SqlValue = string | number | null;

const monthLabels: Record<string, string> = {
  "2026-01": "Январь 2026",
  "2026-02": "Февраль 2026",
  "2026-03": "Март 2026",
};
const monthKeys = Object.fromEntries(Object.entries(monthLabels).map(([key, label]) => [label, key]));

function stableId(prefix: string, value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `${prefix}-${(hash >>> 0).toString(36)}`;
}

function employeeId(name: string) {
  const known: Record<string, string> = { "Алина": "employee-alina", "Паша": "employee-pasha", "Вася": "employee-vasya", "ОП": "employee-op" };
  return known[name] ?? stableId("employee", name);
}

function productId(name: string) {
  return stableId("product", name || "Не указан");
}

function safeNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.round(number) : 0;
}

async function runBatch(statements: D1PreparedStatement[]) {
  for (let index = 0; index < statements.length; index += 80) {
    await env.DB.batch(statements.slice(index, index + 80));
  }
}

async function ensureSeeded() {
  const row = await env.DB.prepare("SELECT COUNT(*) AS count FROM audit_log WHERE entity_type = 'database' AND entity_id = 'initial-seed' AND action = 'seed'").first<{ count: number }>();
  if ((row?.count ?? 0) > 0) return;

  // Повторный запуск после оборванного первоначального импорта безопасно
  // очищает только незавершённый seed. После записи маркера данные не стираются.
  await env.DB.batch([
    env.DB.prepare("DELETE FROM lead_status_history"),
    env.DB.prepare("DELETE FROM payments"),
    env.DB.prepare("DELETE FROM leads"),
    env.DB.prepare("DELETE FROM employee_compensation"),
    env.DB.prepare("DELETE FROM monthly_plans"),
    env.DB.prepare("DELETE FROM products"),
    env.DB.prepare("DELETE FROM employees"),
  ]);

  const leads = seedData.leads as Array<Record<string, unknown>>;
  const payments = seedData.payments as Array<Record<string, unknown>>;
  const managerNames = new Set<string>(["Алина", "Паша", "Вася", "ОП"]);
  leads.forEach((lead) => managerNames.add(String(lead.manager || "ОП")));
  payments.forEach((payment) => managerNames.add(String(payment.manager || "ОП")));
  const productNames = new Set<string>();
  leads.forEach((lead) => lead.product && productNames.add(String(lead.product)));
  payments.forEach((payment) => payment.product && productNames.add(String(payment.product)));

  const statements: D1PreparedStatement[] = [];
  for (const name of managerNames) {
    const email = name === "Алина" ? "manager@cursorcrm.local" : name === "Паша" ? "pasha@cursorcrm.local" : name === "Вася" ? "admin@cursorcrm.local" : `${employeeId(name)}@cursorcrm.local`;
    statements.push(env.DB.prepare("INSERT INTO employees (id, name, email, role, is_active) VALUES (?, ?, ?, ?, ?)").bind(employeeId(name), name, email, name === "Вася" ? "leader" : "manager", ["Алина", "Паша", "Вася"].includes(name) ? 1 : 0));
  }
  for (const name of productNames) {
    statements.push(env.DB.prepare("INSERT INTO products (id, name) VALUES (?, ?)").bind(productId(name), name));
  }
  leads.forEach((lead, index) => {
    statements.push(env.DB.prepare(`INSERT INTO leads
      (id, manager_id, product_id, client_name, phone, telegram, income, request, source_status, status, amount, net_amount, payment_type, next_action, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(index + 1, employeeId(String(lead.manager || "ОП")), lead.product ? productId(String(lead.product)) : null, String(lead.name || "Без имени"), lead.phone ?? null, lead.telegram ?? null, lead.income ?? null, lead.request ?? null, lead.sourceStatus ?? null, String(lead.status || "Новая заявка"), safeNumber(lead.amount), safeNumber(lead.net), lead.paymentType ?? null, lead.nextAction ?? null, String(lead.createdAt || "2026-02-01")));
  });
  payments.forEach((payment, index) => {
    statements.push(env.DB.prepare(`INSERT INTO payments
      (id, manager_id, product_id, client_name, revenue, net_profit, payment_method, payment_date, comment)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(index + 1, employeeId(String(payment.manager || "ОП")), payment.product ? productId(String(payment.product)) : null, String(payment.client || "Без имени"), safeNumber(payment.amount), safeNumber(payment.net), String(payment.paymentType || "Не указан"), String(payment.date || "2026-02-01"), payment.comment ?? null));
  });

  const plans = {
    "2026-01": [1_000_000, 1_500_000, 2_000_000],
    "2026-02": [1_100_000, 1_600_000, 2_100_000],
    "2026-03": [1_200_000, 1_700_000, 2_200_000],
  };
  for (const [month, values] of Object.entries(plans)) {
    statements.push(env.DB.prepare("INSERT INTO monthly_plans (month, scope_key, minimum, target, maximum) VALUES (?, 'department', ?, ?, ?)").bind(month, ...values));
  }
  const compensation = {
    "2026-01": { "Алина": [60_000, 3, 1.2, 1.5, 1.8], "Паша": [60_000, 3, 1.2, 1.5, 1.8], "Вася": [90_000, 2, 1.1, 1.3, 1.5] },
    "2026-02": { "Алина": [65_000, 3.2, 1.2, 1.5, 1.8], "Паша": [65_000, 3.2, 1.2, 1.5, 1.8], "Вася": [95_000, 2, 1.1, 1.3, 1.5] },
    "2026-03": { "Алина": [70_000, 3.5, 1.25, 1.55, 1.9], "Паша": [70_000, 3.5, 1.25, 1.55, 1.9], "Вася": [100_000, 2.2, 1.1, 1.3, 1.5] },
  } as Record<string, Record<string, number[]>>;
  for (const [month, people] of Object.entries(compensation)) {
    for (const [name, values] of Object.entries(people)) {
      statements.push(env.DB.prepare(`INSERT INTO employee_compensation
        (employee_id, month, salary, base_rate, minimum_coefficient, target_coefficient, maximum_coefficient)
        VALUES (?, ?, ?, ?, ?, ?, ?)`)
        .bind(employeeId(name), month, ...values));
    }
  }
  statements.push(env.DB.prepare("INSERT INTO audit_log (entity_type, entity_id, action, changes) VALUES ('database', 'initial-seed', 'seed', ?)").bind(JSON.stringify({ leads: leads.length, payments: payments.length })));
  await runBatch(statements);
  await env.DB.prepare("PRAGMA optimize").run();
}

export async function GET() {
  try {
    await ensureSeeded();
    const [employeeRows, productRows, leadRows, paymentRows, planRows, compensationRows] = await Promise.all([
      env.DB.prepare("SELECT id, name, email, role, is_active FROM employees ORDER BY name").all<Record<string, SqlValue>>(),
      env.DB.prepare("SELECT id, name FROM products ORDER BY name").all<Record<string, SqlValue>>(),
      env.DB.prepare("SELECT * FROM leads ORDER BY id").all<Record<string, SqlValue>>(),
      env.DB.prepare("SELECT * FROM payments ORDER BY payment_date DESC, id DESC").all<Record<string, SqlValue>>(),
      env.DB.prepare("SELECT * FROM monthly_plans WHERE scope_key = 'department' ORDER BY month").all<Record<string, SqlValue>>(),
      env.DB.prepare("SELECT * FROM employee_compensation ORDER BY month, employee_id").all<Record<string, SqlValue>>(),
    ]);
    const employeeNames = new Map(employeeRows.results.map((row) => [String(row.id), String(row.name)]));
    const productNames = new Map(productRows.results.map((row) => [String(row.id), String(row.name)]));
    const employees = employeeRows.results.filter((row) => Number(row.is_active) === 1).map((row) => ({
      name: String(row.name), initials: String(row.name).slice(0, 2).toUpperCase(), role: row.role === "leader" ? "Руководитель" : "Менеджер", color: row.name === "Алина" ? "violet" : row.name === "Паша" ? "blue" : "green", active: true,
    }));
    const leads = leadRows.results.map((row) => ({
      id: Number(row.id), manager: employeeNames.get(String(row.manager_id)) || "ОП", createdAt: row.created_at, phone: row.phone, telegram: row.telegram, name: row.client_name, income: row.income, request: row.request, sourceStatus: row.source_status, status: row.status, product: productNames.get(String(row.product_id)) || "Не указан", amount: Number(row.amount || 0), net: Number(row.net_amount || 0), paymentType: row.payment_type, nextAction: row.next_action,
    }));
    const payments = paymentRows.results.map((row) => ({
      id: Number(row.id), client: row.client_name, product: productNames.get(String(row.product_id)) || "Не указан", amount: Number(row.revenue || 0), net: Number(row.net_profit || 0), paymentType: row.payment_method, date: row.payment_date, manager: employeeNames.get(String(row.manager_id)) || "ОП", comment: row.comment,
    }));
    const plans: Record<string, { minimum: number; target: number; maximum: number }> = {};
    planRows.results.forEach((row) => { plans[monthLabels[String(row.month)] || String(row.month)] = { minimum: Number(row.minimum), target: Number(row.target), maximum: Number(row.maximum) }; });
    const terms: Record<string, Record<string, { salary: number; rate: number; minCoef: number; targetCoef: number; maxCoef: number }>> = {};
    compensationRows.results.forEach((row) => {
      const label = monthLabels[String(row.month)] || String(row.month);
      terms[label] ||= {};
      terms[label][employeeNames.get(String(row.employee_id)) || String(row.employee_id)] = { salary: Number(row.salary), rate: Number(row.base_rate), minCoef: Number(row.minimum_coefficient), targetCoef: Number(row.target_coefficient), maxCoef: Number(row.maximum_coefficient) };
    });
    return Response.json({ state: { employees, leads, payments, plans, terms } });
  } catch (error) {
    return Response.json({ state: null, error: error instanceof Error ? error.message : "Database unavailable" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    await ensureSeeded();
    const state = await request.json() as Record<string, unknown>;
    const employeeList = (state.employees || []) as Array<Record<string, unknown>>;
    const leadList = (state.leads || []) as Array<Record<string, unknown>>;
    const paymentList = (state.payments || []) as Array<Record<string, unknown>>;
    const plans = (state.plans || {}) as Record<string, Record<string, number>>;
    const terms = (state.terms || {}) as Record<string, Record<string, Record<string, number>>>;
    const productNames = new Set<string>();
    leadList.forEach((lead) => lead.product && lead.product !== "Не указан" && productNames.add(String(lead.product)));
    paymentList.forEach((payment) => payment.product && payment.product !== "Не указан" && productNames.add(String(payment.product)));
    const oldStatuses = await env.DB.prepare("SELECT id, status FROM leads").all<{ id: number; status: string }>();
    const statusById = new Map(oldStatuses.results.map((row) => [row.id, row.status]));
    const statements: D1PreparedStatement[] = [];

    employeeList.forEach((employee) => {
      const name = String(employee.name);
      const id = employeeId(name);
      statements.push(env.DB.prepare(`INSERT INTO employees (id, name, email, role, is_active)
        VALUES (?, ?, ?, ?, 1) ON CONFLICT(id) DO UPDATE SET name=excluded.name, role=excluded.role, is_active=1, updated_at=CURRENT_TIMESTAMP`)
        .bind(id, name, `${id}@cursorcrm.local`, employee.role === "Руководитель" ? "leader" : "manager"));
    });
    productNames.forEach((name) => statements.push(env.DB.prepare("INSERT INTO products (id, name) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET name=excluded.name, is_active=1").bind(productId(name), name)));
    leadList.forEach((lead) => {
      const id = Number(lead.id);
      const status = String(lead.status || "Новая заявка");
      statements.push(env.DB.prepare(`INSERT INTO leads
        (id, manager_id, product_id, client_name, phone, telegram, income, request, source_status, status, amount, net_amount, payment_type, next_action, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET manager_id=excluded.manager_id, product_id=excluded.product_id, client_name=excluded.client_name, phone=excluded.phone, telegram=excluded.telegram, income=excluded.income, request=excluded.request, source_status=excluded.source_status, status=excluded.status, amount=excluded.amount, net_amount=excluded.net_amount, payment_type=excluded.payment_type, next_action=excluded.next_action, updated_at=CURRENT_TIMESTAMP`)
        .bind(id, employeeId(String(lead.manager || "ОП")), lead.product && lead.product !== "Не указан" ? productId(String(lead.product)) : null, String(lead.name || "Без имени"), lead.phone ?? null, lead.telegram ?? null, lead.income ?? null, lead.request ?? null, lead.sourceStatus ?? null, status, safeNumber(lead.amount), safeNumber(lead.net), lead.paymentType ?? null, lead.nextAction ?? null, String(lead.createdAt || "2026-02-01")));
      if (statusById.has(id) && statusById.get(id) !== status) {
        statements.push(env.DB.prepare("INSERT INTO lead_status_history (lead_id, from_status, to_status, changed_by) VALUES (?, ?, ?, ?)").bind(id, statusById.get(id) ?? null, status, employeeId(String(lead.manager || "ОП"))));
      }
    });
    paymentList.forEach((payment) => statements.push(env.DB.prepare(`INSERT INTO payments
      (id, manager_id, product_id, client_name, revenue, net_profit, payment_method, payment_date, comment)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET manager_id=excluded.manager_id, product_id=excluded.product_id, client_name=excluded.client_name, revenue=excluded.revenue, net_profit=excluded.net_profit, payment_method=excluded.payment_method, payment_date=excluded.payment_date, comment=excluded.comment, updated_at=CURRENT_TIMESTAMP`)
      .bind(Number(payment.id), employeeId(String(payment.manager || "ОП")), payment.product && payment.product !== "Не указан" ? productId(String(payment.product)) : null, String(payment.client || "Без имени"), safeNumber(payment.amount), safeNumber(payment.net), String(payment.paymentType || "Не указан"), String(payment.date || "2026-02-01"), payment.comment ?? null)));
    Object.entries(plans).forEach(([label, plan]) => statements.push(env.DB.prepare(`INSERT INTO monthly_plans (month, scope_key, minimum, target, maximum)
      VALUES (?, 'department', ?, ?, ?) ON CONFLICT(month, scope_key) DO UPDATE SET minimum=excluded.minimum, target=excluded.target, maximum=excluded.maximum, updated_at=CURRENT_TIMESTAMP`)
      .bind(monthKeys[label] || label, Number(plan.minimum), Number(plan.target), Number(plan.maximum))));
    Object.entries(terms).forEach(([label, people]) => Object.entries(people).forEach(([name, values]) => statements.push(env.DB.prepare(`INSERT INTO employee_compensation
      (employee_id, month, salary, base_rate, minimum_coefficient, target_coefficient, maximum_coefficient)
      VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(employee_id, month) DO UPDATE SET salary=excluded.salary, base_rate=excluded.base_rate, minimum_coefficient=excluded.minimum_coefficient, target_coefficient=excluded.target_coefficient, maximum_coefficient=excluded.maximum_coefficient, updated_at=CURRENT_TIMESTAMP`)
      .bind(employeeId(name), monthKeys[label] || label, Number(values.salary), Number(values.rate), Number(values.minCoef), Number(values.targetCoef), Number(values.maxCoef)))));
    statements.push(env.DB.prepare("INSERT INTO audit_log (entity_type, entity_id, action, changes) VALUES ('crm', 'state', 'synchronize', ?)").bind(JSON.stringify({ employees: employeeList.length, leads: leadList.length, payments: paymentList.length })));
    await runBatch(statements);
    return Response.json({ saved: true });
  } catch (error) {
    return Response.json({ saved: false, error: error instanceof Error ? error.message : "Database unavailable" }, { status: 500 });
  }
}
