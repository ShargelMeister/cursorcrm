"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import raw from "./data/normalized.json";

type Role = "admin" | "manager";
type Tab = "workspace" | "leads" | "payments" | "dashboard" | "employees";
type Lead = {
  id: number; manager: string; createdAt?: string; phone?: string; telegram?: string;
  name: string; income?: string; request?: string; sourceStatus?: string; status: string;
  product?: string; amount?: number; net?: number; paymentType?: string; nextAction?: string;
};
type Payment = { id: number; client: string; product: string; amount: number; net: number; paymentType: string; date: string; manager: string; comment?: string };

const money = (value = 0) => new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(value) + " ₽";
const shortMoney = (value = 0) => value >= 1_000_000 ? `${(value / 1_000_000).toFixed(1).replace(".0", "")} млн ₽` : `${Math.round(value / 1000)} тыс ₽`;
const months = ["Январь 2026", "Февраль 2026", "Март 2026"];
const statuses = ["Новая заявка", "В работе", "КП отправлено", "Ждём решения", "Оплата", "Закрыта"];
const statusMeta: Record<string, { dot: string; hint: string }> = {
  "Новая заявка": { dot: "#8b5cf6", hint: "Не обработана" },
  "В работе": { dot: "#3b82f6", hint: "Идут переговоры" },
  "КП отправлено": { dot: "#f59e0b", hint: "Предложение у клиента" },
  "Ждём решения": { dot: "#f97316", hint: "Ожидаем ответ" },
  "Оплата": { dot: "#10b981", hint: "Успешная сделка" },
  "Закрыта": { dot: "#94a3b8", hint: "Отказ / завершена" },
};

const leadsSeed: Lead[] = (raw.leads as Omit<Lead, "id">[]).map((lead, index) => ({
  ...lead, id: index + 1, name: lead.name || "Без имени", amount: Number(lead.amount || 0), net: Number(lead.net || 0),
  product: lead.product || "Не указан", manager: lead.manager || "Не назначен",
}));
const paymentsSeed: Payment[] = (raw.payments as Omit<Payment, "id">[]).map((payment, index) => ({
  ...payment, id: Number(payment.id || index + 1), client: payment.client || "Без имени", product: payment.product || "Не указан",
  amount: Number(payment.amount || 0), net: Number(payment.net || payment.amount || 0), paymentType: payment.paymentType || "Не указан",
  date: payment.date || "2026-02-01", manager: payment.manager || "ОП",
}));

const monthlyPlans: Record<string, { minimum: number; target: number; maximum: number }> = {
  "Январь 2026": { minimum: 1_000_000, target: 1_500_000, maximum: 2_000_000 },
  "Февраль 2026": { minimum: 1_100_000, target: 1_600_000, maximum: 2_100_000 },
  "Март 2026": { minimum: 1_200_000, target: 1_700_000, maximum: 2_200_000 },
};

const employeeSeed = [
  { name: "Алина", initials: "АБ", role: "Менеджер", color: "violet", active: true },
  { name: "Паша", initials: "ПМ", role: "Менеджер", color: "blue", active: true },
  { name: "Вася", initials: "ВК", role: "Руководитель", color: "green", active: true },
];

const compensation: Record<string, Record<string, { salary: number; rate: number; minCoef: number; targetCoef: number; maxCoef: number }>> = {
  "Январь 2026": {
    "Алина": { salary: 60_000, rate: 3, minCoef: 1.2, targetCoef: 1.5, maxCoef: 1.8 },
    "Паша": { salary: 60_000, rate: 3, minCoef: 1.2, targetCoef: 1.5, maxCoef: 1.8 },
    "Вася": { salary: 90_000, rate: 2, minCoef: 1.1, targetCoef: 1.3, maxCoef: 1.5 },
  },
  "Февраль 2026": {
    "Алина": { salary: 65_000, rate: 3.2, minCoef: 1.2, targetCoef: 1.5, maxCoef: 1.8 },
    "Паша": { salary: 65_000, rate: 3.2, minCoef: 1.2, targetCoef: 1.5, maxCoef: 1.8 },
    "Вася": { salary: 95_000, rate: 2, minCoef: 1.1, targetCoef: 1.3, maxCoef: 1.5 },
  },
  "Март 2026": {
    "Алина": { salary: 70_000, rate: 3.5, minCoef: 1.25, targetCoef: 1.55, maxCoef: 1.9 },
    "Паша": { salary: 70_000, rate: 3.5, minCoef: 1.25, targetCoef: 1.55, maxCoef: 1.9 },
    "Вася": { salary: 100_000, rate: 2.2, minCoef: 1.1, targetCoef: 1.3, maxCoef: 1.5 },
  },
};

const Icon = ({ children }: { children: React.ReactNode }) => <span className="nav-icon" aria-hidden>{children}</span>;

export default function CRMApp() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [role, setRole] = useState<Role>("admin");
  const [userName, setUserName] = useState("Вася");
  const [email, setEmail] = useState("admin@finflow.ru");
  const [password, setPassword] = useState("Admin2026!");
  const [tab, setTab] = useState<Tab>("leads");
  const [leads, setLeads] = useState(leadsSeed);
  const [payments, setPayments] = useState(paymentsSeed);
  const [employees, setEmployees] = useState(employeeSeed);
  const [plans, setPlans] = useState(monthlyPlans);
  const [terms, setTerms] = useState(compensation);
  const stateReady = useRef(false);
  const [month, setMonth] = useState("Февраль 2026");
  const [leadManager, setLeadManager] = useState("Все менеджеры");
  const [leadProduct, setLeadProduct] = useState("Все тарифы");
  const [payManager, setPayManager] = useState("Все менеджеры");
  const [payProduct, setPayProduct] = useState("Все тарифы");
  const [payMethod, setPayMethod] = useState("Все способы");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<{ key: keyof Payment; dir: "asc" | "desc" }>({ key: "date", dir: "desc" });
  const [modal, setModal] = useState<null | "lead" | "payment" | "employee" | "leadDetails">(null);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [employeeSection, setEmployeeSection] = useState<"plans" | "team">("plans");
  const [dashboardManager, setDashboardManager] = useState("Все менеджеры");
  const [dashboardProduct, setDashboardProduct] = useState("Все тарифы");
  const [toast, setToast] = useState("");

  const managerName = role === "manager" ? userName : "Вася";
  const managerFilter = role === "manager" ? managerName : leadManager;
  const productOptions = useMemo(() => [...new Set([...leads.map(l => l.product), ...payments.map(p => p.product)].filter(Boolean))].sort(), [leads, payments]);
  const managerOptions = ["Алина", "Паша", "Вася"];
  const paymentMethods = [...new Set(payments.map(p => p.paymentType).filter(Boolean))].sort();

  useEffect(() => {
    fetch("/api/crm-state").then(response => response.ok ? response.json() : null).then(saved => {
      if (saved?.state) {
        if (saved.state.leads) setLeads(saved.state.leads);
        if (saved.state.payments) setPayments(saved.state.payments);
        if (saved.state.employees) setEmployees(saved.state.employees);
        if (saved.state.plans) setPlans(saved.state.plans);
        if (saved.state.terms) setTerms(saved.state.terms);
      }
    }).catch(() => null).finally(() => { stateReady.current = true; });
  }, []);

  useEffect(() => {
    if (!stateReady.current) return;
    const timer = window.setTimeout(() => {
      fetch("/api/crm-state", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ leads, payments, employees, plans, terms }) }).catch(() => null);
    }, 700);
    return () => window.clearTimeout(timer);
  }, [leads, payments, employees, plans, terms]);

  const filteredLeads = leads.filter(lead =>
    (managerFilter === "Все менеджеры" || lead.manager === managerFilter) &&
    (leadProduct === "Все тарифы" || lead.product === leadProduct) &&
    (!query || `${lead.name} ${lead.phone || ""} ${lead.telegram || ""}`.toLowerCase().includes(query.toLowerCase()))
  );
  const filteredPayments = useMemo(() => payments.filter(payment =>
    (role === "manager" ? payment.manager === managerName : payManager === "Все менеджеры" || payment.manager === payManager) &&
    (payProduct === "Все тарифы" || payment.product === payProduct) &&
    (payMethod === "Все способы" || payment.paymentType === payMethod) &&
    (!query || `${payment.client} ${payment.product}`.toLowerCase().includes(query.toLowerCase()))
  ).sort((a, b) => {
    const av = a[sort.key] ?? ""; const bv = b[sort.key] ?? "";
    return (typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv), "ru")) * (sort.dir === "asc" ? 1 : -1);
  }), [payments, role, managerName, payManager, payProduct, payMethod, query, sort]);

  function showToast(message: string) { setToast(message); window.setTimeout(() => setToast(""), 2400); }
  function login(event: FormEvent) {
    event.preventDefault();
    const isManager = email.toLowerCase().includes("manager") || email.toLowerCase().includes("alina");
    const isPasha = email.toLowerCase().includes("pasha");
    setRole(isManager || isPasha ? "manager" : "admin");
    setUserName(isPasha ? "Паша" : isManager ? "Алина" : "Вася");
    setTab(isManager || isPasha ? "workspace" : "leads");
    setLoggedIn(true);
  }
  function quickAccount(nextRole: Role, name = nextRole === "admin" ? "Вася" : "Алина") {
    setRole(nextRole);
    setUserName(name);
    setEmail(nextRole === "admin" ? "admin@finflow.ru" : name === "Паша" ? "pasha@finflow.ru" : "manager@finflow.ru");
    setPassword(nextRole === "admin" ? "Admin2026!" : name === "Паша" ? "Pasha2026!" : "Manager2026!");
  }
  function openLead(lead: Lead) { setSelectedLead(lead); setModal("leadDetails"); }
  function goToLead(lead: Lead) {
    setTab("leads"); setLeadManager(role === "admin" ? lead.manager : "Все менеджеры"); setQuery(lead.name); setSelectedLead(lead);
  }
  function moveLead(id: number, status: string) {
    const lead = leads.find(item => item.id === id);
    setLeads(current => current.map(item => item.id === id ? { ...item, status } : item));
    if (status === "Оплата" && lead && !payments.some(payment => payment.client === lead.name)) {
      setPayments(current => [{ id: Math.max(...current.map(p => p.id), 0) + 1, client: lead.name, product: lead.product || "Не указан", amount: lead.amount || 0, net: lead.net || lead.amount || 0, paymentType: lead.paymentType || "Ожидает уточнения", date: "2026-02-13", manager: lead.manager, comment: "Создано автоматически из Kanban" }, ...current]);
      showToast("Сделка добавлена в оплаты");
    }
  }
  function toggleSort(key: keyof Payment) { setSort(current => ({ key, dir: current.key === key && current.dir === "desc" ? "asc" : "desc" })); }

  if (!loggedIn) return <Login email={email} password={password} role={role} userName={userName} setEmail={setEmail} setPassword={setPassword} quickAccount={quickAccount} onSubmit={login} />;

  const nav: { id: Tab; label: string; icon: string }[] = role === "admin" ? [
    { id: "leads", label: "Заявки", icon: "▦" }, { id: "payments", label: "Оплаты", icon: "₽" },
    { id: "dashboard", label: "Дашборд", icon: "◫" }, { id: "employees", label: "Сотрудники", icon: "♙" },
  ] : [{ id: "workspace", label: "Рабочий стол", icon: "◫" }, { id: "leads", label: "Мои заявки", icon: "▦" }];

  return (
    <main className="app-shell">
      <header className="topbar">
        <button className="brand" onClick={() => setTab(role === "admin" ? "leads" : "workspace")}><span className="brand-mark">F</span><span>FinFlow <b>CRM</b></span></button>
        <nav className="main-nav">{nav.map(item => <button key={item.id} className={tab === item.id ? "active" : ""} onClick={() => { setTab(item.id); setQuery(""); }}><Icon>{item.icon}</Icon>{item.label}</button>)}</nav>
        <div className="user-area">
          <div className="user-copy"><strong>{managerName} {role === "admin" ? "Ковалёв" : managerName === "Алина" ? "Белова" : "Миронов"}</strong><span>{role === "admin" ? "Руководитель" : "Менеджер по продажам"}</span></div>
          <span className={`avatar ${role === "admin" ? "green" : managerName === "Алина" ? "violet" : "blue"}`}>{role === "admin" ? "ВК" : managerName === "Алина" ? "АБ" : "ПМ"}</span>
          <button className="logout" title="Выйти" onClick={() => setLoggedIn(false)}>↗</button>
        </div>
      </header>

      <section className="page-frame">
        {tab === "leads" && <LeadsView leads={filteredLeads} role={role} manager={leadManager} product={leadProduct} managers={managerOptions} products={productOptions} query={query} setManager={setLeadManager} setProduct={setLeadProduct} setQuery={setQuery} onNew={() => setModal("lead")} onOpen={openLead} onMove={moveLead} />}
        {tab === "payments" && <PaymentsView payments={filteredPayments} manager={payManager} product={payProduct} method={payMethod} managers={managerOptions} products={productOptions} methods={paymentMethods} query={query} role={role} sort={sort} setManager={setPayManager} setProduct={setPayProduct} setMethod={setPayMethod} setQuery={setQuery} toggleSort={toggleSort} onNew={() => setModal("payment")} />}
        {tab === "dashboard" && <Dashboard payments={payments} month={month} setMonth={setMonth} manager={dashboardManager} product={dashboardProduct} setManager={setDashboardManager} setProduct={setDashboardProduct} managers={managerOptions} products={productOptions} />}
        {tab === "employees" && <EmployeesView section={employeeSection} setSection={setEmployeeSection} month={month} setMonth={setMonth} employees={employees} payments={payments} plans={plans} setPlans={setPlans} terms={terms} setTerms={setTerms} onNew={() => setModal("employee")} />}
        {tab === "workspace" && <ManagerWorkspace managerName={managerName} leads={filteredLeads} payments={payments.filter(p => p.manager === managerName)} month={month} onGoLead={goToLead} />}
      </section>

      {modal === "lead" && <LeadModal managers={managerOptions} products={productOptions} defaultManager={managerName} close={() => setModal(null)} save={lead => { setLeads(current => [{ ...lead, id: Math.max(...current.map(l => l.id)) + 1 }, ...current]); setModal(null); showToast("Заявка создана"); }} />}
      {modal === "payment" && <PaymentModal managers={managerOptions} products={productOptions} close={() => setModal(null)} save={payment => { setPayments(current => [{ ...payment, id: Math.max(...current.map(p => p.id)) + 1 }, ...current]); setModal(null); showToast("Оплата добавлена"); }} />}
      {modal === "employee" && <EmployeeModal close={() => setModal(null)} save={name => { setEmployees(current => [...current, { name, initials: name.slice(0, 2).toUpperCase(), role: "Менеджер", color: "blue", active: true }]); setModal(null); showToast("Сотрудник добавлен"); }} />}
      {modal === "leadDetails" && selectedLead && <LeadDetails lead={selectedLead} close={() => setModal(null)} move={status => { moveLead(selectedLead.id, status); setSelectedLead({ ...selectedLead, status }); }} />}
      {toast && <div className="toast"><span>✓</span>{toast}</div>}
    </main>
  );
}

function Login({ email, password, role, userName, setEmail, setPassword, quickAccount, onSubmit }: { email: string; password: string; role: Role; userName: string; setEmail: (v: string) => void; setPassword: (v: string) => void; quickAccount: (r: Role, name?: string) => void; onSubmit: (e: FormEvent) => void }) {
  return <main className="login-page"><section className="login-card">
    <div className="login-brand"><span className="brand-mark large">F</span><div><strong>FinFlow</strong><span>Sales workspace</span></div></div>
    <div className="login-heading"><p>ДОБРО ПОЖАЛОВАТЬ</p><h1>Войдите в CRM</h1><span>Все заявки, оплаты и планы — в одном окне.</span></div>
    <div className="account-switch three"><button onClick={() => quickAccount("admin", "Вася")} className={role === "admin" ? "active" : ""}><span className="mini-avatar green">ВК</span><span><b>Вася</b><small>Руководитель</small></span><i>✓</i></button><button onClick={() => quickAccount("manager", "Алина")} className={role === "manager" && userName === "Алина" ? "active" : ""}><span className="mini-avatar violet">АБ</span><span><b>Алина</b><small>Менеджер</small></span><i>✓</i></button><button onClick={() => quickAccount("manager", "Паша")} className={role === "manager" && userName === "Паша" ? "active" : ""}><span className="mini-avatar blue">ПМ</span><span><b>Паша</b><small>Менеджер</small></span><i>✓</i></button></div>
    <form onSubmit={onSubmit} className="login-form"><label>Электронная почта<input value={email} onChange={e => setEmail(e.target.value)} /></label><label>Пароль<div className="password-field"><input type="text" value={password} onChange={e => setPassword(e.target.value)} /><span>◉</span></div></label><div className="remember"><label><input type="checkbox" defaultChecked /> Запомнить меня</label><button type="button">Забыли пароль?</button></div><button className="primary wide" type="submit">Войти в систему <span>→</span></button></form>
    <p className="demo-note"><span>i</span> Данные для входа уже подставлены. Выберите роль и нажмите «Войти».</p>
  </section><aside className="login-aside"><div className="aside-grid"/><div className="aside-content"><div className="quote-mark">“</div><blockquote>Теперь я вижу весь отдел продаж<br/>как на ладони — без десятка таблиц.</blockquote><p>Заявки, выручка и мотивация команды<br/>обновляются в одном рабочем пространстве.</p><div className="quote-author"><span className="mini-avatar green">ВК</span><span><strong>Василий Ковалёв</strong><small>Руководитель отдела продаж</small></span></div></div><div className="floating-stat"><span>Выполнение плана</span><strong>98%</strong><div><i style={{ width: "98%" }}/></div><small>↑ 12% к прошлому месяцу</small></div></aside></main>;
}

function PageTitle({ eyebrow, title, copy, actions }: { eyebrow?: string; title: string; copy: string; actions?: React.ReactNode }) {
  return <div className="page-title"><div>{eyebrow && <p>{eyebrow}</p>}<h1>{title}</h1><span>{copy}</span></div>{actions && <div className="title-actions">{actions}</div>}</div>;
}

function Select({ value, onChange, children, label }: { value: string; onChange: (v: string) => void; children: React.ReactNode; label?: string }) { return <label className="select-wrap">{label && <span>{label}</span>}<select value={value} onChange={e => onChange(e.target.value)}>{children}</select></label>; }
function Search({ value, onChange, placeholder = "Поиск..." }: { value: string; onChange: (v: string) => void; placeholder?: string }) { return <label className="search"><span>⌕</span><input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} /></label>; }

function LeadsView({ leads, role, manager, product, managers, products, query, setManager, setProduct, setQuery, onNew, onOpen, onMove }: any) {
  return <div className="screen leads-screen"><PageTitle eyebrow="ПРОДАЖИ" title="Заявки" copy={`${leads.length} заявок в выбранном представлении`} actions={<><Search value={query} onChange={setQuery} placeholder="Клиент, телефон..."/><button className="primary" onClick={onNew}>＋ Новая заявка</button></>} />
    <div className="filterbar"><div className="filter-label">Фильтры</div>{role === "admin" && <Select value={manager} onChange={setManager}>{["Все менеджеры", ...managers].map((v: string) => <option key={v}>{v}</option>)}</Select>}<Select value={product} onChange={setProduct}>{["Все тарифы", ...products].map((v: string) => <option key={v}>{v}</option>)}</Select>{(manager !== "Все менеджеры" || product !== "Все тарифы" || query) && <button className="clear-filter" onClick={() => { setManager("Все менеджеры"); setProduct("Все тарифы"); setQuery(""); }}>Сбросить ×</button>}<span className="filter-spacer"/><span className="view-hint">Перетащите карточку для смены статуса</span></div>
    <div className="kanban" onDragOver={e => e.preventDefault()}>{statuses.map(status => { const items = leads.filter((lead: Lead) => lead.status === status); return <section className="kanban-column" key={status} onDrop={e => onMove(Number(e.dataTransfer.getData("leadId")), status)}><header><div><i style={{ background: statusMeta[status].dot }}/><strong>{status}</strong><span>{items.length}</span></div><small>{statusMeta[status].hint}</small></header><div className="card-scroll">{items.map((lead: Lead) => <LeadCard key={lead.id} lead={lead} open={() => onOpen(lead)} />)}{!items.length && <div className="empty-column">Перетащите заявку сюда</div>}</div></section>; })}</div>
  </div>;
}

function LeadCard({ lead, open }: { lead: Lead; open: () => void }) {
  return <article className="lead-card" draggable onDragStart={e => e.dataTransfer.setData("leadId", String(lead.id))} onClick={open}><div className="lead-card-top"><span className={`tiny-avatar ${lead.manager === "Алина" ? "violet" : lead.manager === "Паша" ? "blue" : "green"}`}>{lead.manager.slice(0, 1)}</span><span className="lead-date">{lead.createdAt ? new Date(lead.createdAt).toLocaleDateString("ru-RU", { day: "2-digit", month: "short" }) : "Без даты"}</span><button>•••</button></div><h3>{lead.name}</h3><p>{lead.request || lead.sourceStatus || "Запрос клиента не указан"}</p><div className="tags"><span>{lead.product}</span>{lead.income && <span className="muted-tag">{lead.income}</span>}</div><footer><strong>{lead.amount ? money(lead.amount) : "Сумма не указана"}</strong><span>{lead.manager}</span></footer>{lead.nextAction && <div className="next-action"><b>↗</b><span>{lead.nextAction}</span></div>}</article>;
}

function PaymentsView({ payments, manager, product, method, managers, products, methods, query, role, sort, setManager, setProduct, setMethod, setQuery, toggleSort, onNew }: any) {
  const revenue = payments.reduce((s: number, p: Payment) => s + p.amount, 0); const net = payments.reduce((s: number, p: Payment) => s + p.net, 0); const installments = payments.filter((p: Payment) => p.paymentType.toLowerCase().includes("расср")).reduce((s: number, p: Payment) => s + p.amount, 0);
  return <div className="screen payments-screen"><PageTitle eyebrow="ФИНАНСЫ" title="Оплаты" copy="Поступления, прибыль и графики платежей" actions={<><Search value={query} onChange={setQuery} placeholder="Найти клиента..."/><button className="primary" onClick={onNew}>＋ Внести оплату</button></>} />
    <div className="metric-row compact"><Metric label="Выручка" value={money(revenue)} note={`${payments.length} платежей`} tone="blue"/><Metric label="Чистая прибыль" value={money(net)} note={`${revenue ? Math.round(net / revenue * 100) : 0}% от выручки`} tone="green"/><Metric label="В рассрочку" value={money(installments)} note="По выбранным фильтрам" tone="orange"/><Metric label="Средний чек" value={money(payments.length ? revenue / payments.length : 0)} note="За период" tone="violet"/></div>
    <div className="table-card"><div className="table-tools"><div>{role === "admin" && <Select value={manager} onChange={setManager}>{["Все менеджеры", ...managers].map((v: string) => <option key={v}>{v}</option>)}</Select>}<Select value={product} onChange={setProduct}>{["Все тарифы", ...products].map((v: string) => <option key={v}>{v}</option>)}</Select><Select value={method} onChange={setMethod}>{["Все способы", ...methods].map((v: string) => <option key={v}>{v}</option>)}</Select></div><span>Показано: <b>{payments.length}</b></span></div><div className="table-scroll"><table><thead><tr><SortHead label="Клиент" field="client" {...{ sort, toggleSort }}/><SortHead label="Тариф" field="product" {...{ sort, toggleSort }}/><SortHead label="Выручка" field="amount" {...{ sort, toggleSort }}/><SortHead label="Чистыми" field="net" {...{ sort, toggleSort }}/><SortHead label="Оплата" field="paymentType" {...{ sort, toggleSort }}/><SortHead label="Дата" field="date" {...{ sort, toggleSort }}/><SortHead label="Менеджер" field="manager" {...{ sort, toggleSort }}/><th>Комментарий</th></tr></thead><tbody>{payments.map((p: Payment) => <tr key={`${p.id}-${p.client}`}><td><div className="client-cell"><span className="tiny-avatar soft">{p.client.slice(0, 1)}</span><strong>{p.client}</strong></div></td><td><span className="product-pill">{p.product}</span></td><td><strong>{money(p.amount)}</strong></td><td className="net">{money(p.net)}</td><td><span className={`payment-pill ${p.paymentType.toLowerCase().includes("расср") ? "installment" : "full"}`}>{p.paymentType}</span></td><td>{new Date(p.date).toLocaleDateString("ru-RU")}</td><td>{p.manager}</td><td className="comment-cell">{p.comment || "—"}</td></tr>)}</tbody></table></div></div>
  </div>;
}

function SortHead({ label, field, sort, toggleSort }: { label: string; field: keyof Payment; sort: any; toggleSort: any }) { return <th><button onClick={() => toggleSort(field)}>{label}<span className={sort.key === field ? "sorted" : ""}>{sort.key === field ? sort.dir === "asc" ? "↑" : "↓" : "↕"}</span></button></th>; }
function Metric({ label, value, note, tone }: { label: string; value: string; note: string; tone: string }) { return <article className={`metric ${tone}`}><div className="metric-label"><span>{label}</span><i/></div><strong>{value}</strong><small>{note}</small></article>; }

function Dashboard({ payments, month, setMonth, manager, product, setManager, setProduct, managers, products }: { payments: Payment[]; month: string; setMonth: (v: string) => void; manager: string; product: string; setManager: (v: string) => void; setProduct: (v: string) => void; managers: string[]; products: string[] }) {
  const baseData = [
    { name: "Алина", net: 1_319_086, plan: 1_500_000, color: "#7c3aed" },
    { name: "Паша", net: 1_451_142, plan: 1_500_000, color: "#2563eb" },
    { name: "Вася", net: 167_039, plan: 300_000, color: "#059669" },
  ];
  const productFactor = product === "Все тарифы" ? 1 : product.toLowerCase().includes("куратор") ? .48 : product.toLowerCase().includes("вип") ? .18 : .34;
  const managerData = baseData.filter(item => manager === "Все менеджеры" || item.name === manager).map(item => ({ ...item, net: Math.round(item.net * productFactor), plan: Math.round(item.plan * productFactor) }));
  const total = managerData.reduce((s, m) => s + m.net, 0); const totalPlan = managerData.reduce((s, m) => s + m.plan, 0);
  const chartFactor = total / 2_937_267;
  const dynamics = [220, 345, 278, 510, 392, 618, 574, 705, 630, 780, 860, 935].map(v => Math.max(Math.round(v * chartFactor), 6)); const max = Math.max(...dynamics);
  return <div className="screen dashboard-screen"><PageTitle eyebrow="АНАЛИТИКА" title="Дашборд продаж" copy="План-факт, прибыль и динамика поступлений" actions={<><Select label="Период" value={month} onChange={setMonth}>{months.map(v => <option key={v}>{v}</option>)}</Select><Select label="Менеджер" value={manager} onChange={setManager}>{["Все менеджеры", ...managers].map(v => <option key={v}>{v}</option>)}</Select><Select label="Тариф" value={product} onChange={setProduct}>{["Все тарифы", ...products].map(v => <option key={v}>{v}</option>)}</Select></>} />
    <div className="metric-row"><Metric label="Чистая прибыль" value={money(total)} note="↑ 14% к прошлому месяцу" tone="green"/><Metric label="План отдела" value={money(totalPlan)} note={`${Math.round(total / totalPlan * 100)}% выполнено`} tone="blue"/><Metric label="До целевого плана" value={money(Math.max(totalPlan - total, 0))} note="Осталось заработать" tone="orange"/><Metric label="Прогноз месяца" value={money(total * 1.08)} note="При текущем темпе" tone="violet"/></div>
    <div className="dashboard-grid"><section className="panel plan-fact"><header><div><h2>План-факт по менеджерам</h2><p>Чистая прибыль и выполнение цели</p></div><span className="legend"><i/> Факт <i/> План</span></header><div className="manager-bars">{managerData.map(m => <div className="manager-bar" key={m.name}><div className="manager-row"><div><span className={`tiny-avatar ${m.name === "Алина" ? "violet" : m.name === "Паша" ? "blue" : "green"}`}>{m.name.slice(0, 1)}</span><strong>{m.name}</strong></div><span><b>{money(m.net)}</b> из {money(m.plan)}</span></div><div className="bar-track"><i style={{ width: `${Math.min(m.net / m.plan * 100, 100)}%`, background: m.color }}/><em style={{ left: "100%" }}/></div><small className={m.net / m.plan >= .9 ? "good" : ""}>{Math.round(m.net / m.plan * 100)}% плана</small></div>)}</div></section>
      <section className="panel dynamic"><header><div><h2>Динамика поступлений</h2><p>Чистая прибыль по неделям, тыс. ₽</p></div><span className="trend">↑ 18,4%</span></header><div className="chart"><div className="y-labels"><span>1 000</span><span>750</span><span>500</span><span>250</span><span>0</span></div><div className="bars">{dynamics.map((v, i) => <div className="chart-bar" key={i}><i style={{ height: `${v / max * 92}%` }}><b>{v}</b></i><span>{i + 1}</span></div>)}</div></div><div className="chart-caption"><span>Недели запуска</span><b>Итого: {shortMoney(total)}</b></div></section>
    </div>
    <section className="panel targets"><header><div><h2>Уровни плана отдела</h2><p>Пороговые значения и повышающие коэффициенты</p></div></header><div className="target-grid"><Target label="Минимум" value={2_000_000} current={total} coef="× 1,2" color="orange"/><Target label="Целевой" value={3_000_000} current={total} coef="× 1,5" color="blue"/><Target label="Максимум" value={4_000_000} current={total} coef="× 1,8" color="violet"/></div></section>
  </div>;
}

function Target({ label, value, current, coef, color }: { label: string; value: number; current: number; coef: string; color: string }) { const pct = Math.min(current / value * 100, 100); return <article className={`target ${color}`}><div><span>{label}</span><b>{coef}</b></div><strong>{money(value)}</strong><div className="target-track"><i style={{ width: `${pct}%` }}/></div><small>{Math.round(pct)}% выполнено · {current >= value ? "Достигнут" : `осталось ${shortMoney(value - current)}`}</small></article>; }

function EmployeesView({ section, setSection, month, setMonth, employees, payments, plans, setPlans, terms, setTerms, onNew }: any) {
  const currentPlan = plans[month];
  function updatePlan(field: "minimum" | "target" | "maximum", value: number) { setPlans((p: any) => ({ ...p, [month]: { ...p[month], [field]: value } })); }
  function updateTerm(name: string, field: string, value: number) { setTerms((t: any) => ({ ...t, [month]: { ...t[month], [name]: { ...t[month][name], [field]: value } } })); }
  return <div className="screen employees-screen"><PageTitle eyebrow="УПРАВЛЕНИЕ" title="Планы и сотрудники" copy="Условия, мотивация и история изменений по месяцам" actions={<button className="primary" onClick={onNew}>＋ Добавить сотрудника</button>} />
    <div className="subnav"><button className={section === "plans" ? "active" : ""} onClick={() => setSection("plans")}>Планы отдела</button><button className={section === "team" ? "active" : ""} onClick={() => setSection("team")}>Условия сотрудников</button><div/><Select label="Расчётный месяц" value={month} onChange={setMonth}>{months.map(v => <option key={v}>{v}</option>)}</Select></div>
    {section === "plans" ? <div className="employees-content"><section className="panel edit-plan"><header><div><h2>План на {month.toLowerCase()}</h2><p>Изменения применяются только к выбранному месяцу</p></div><span className="saved">● Автосохранение</span></header><div className="plan-inputs"><NumberField label="План-минимум" value={currentPlan.minimum} onChange={v => updatePlan("minimum", v)} tone="orange"/><NumberField label="План целевой" value={currentPlan.target} onChange={v => updatePlan("target", v)} tone="blue"/><NumberField label="План максимум" value={currentPlan.maximum} onChange={v => updatePlan("maximum", v)} tone="violet"/></div><div className="plan-scale"><i style={{ left: `${currentPlan.minimum / currentPlan.maximum * 100}%` }}/><i style={{ left: `${currentPlan.target / currentPlan.maximum * 100}%` }}/><b style={{ width: "74%" }}/></div><div className="scale-labels"><span>0 ₽</span><span>Текущий факт: 1 451 142 ₽</span><span>{money(currentPlan.maximum)}</span></div></section>
      <section className="panel history"><header><div><h2>История планов</h2><p>Зафиксированные значения по месяцам</p></div></header><table><thead><tr><th>Период</th><th>Минимум</th><th>Целевой</th><th>Максимум</th><th>Статус</th></tr></thead><tbody>{months.map(m => <tr key={m}><td><strong>{m}</strong></td><td>{money(plans[m].minimum)}</td><td>{money(plans[m].target)}</td><td>{money(plans[m].maximum)}</td><td><span className={`history-status ${m === month ? "current" : m === "Март 2026" ? "future" : "closed"}`}>{m === month ? "Выбран" : m === "Март 2026" ? "Запланирован" : "Закрыт"}</span></td></tr>)}</tbody></table></section></div> :
      <div className="employees-content"><section className="team-grid">{employees.map((employee: any) => { const t = terms[month]?.[employee.name] || { salary: 60_000, rate: 3, minCoef: 1.2, targetCoef: 1.5, maxCoef: 1.8 }; const actual = employee.name === "Алина" ? 1_319_086 : employee.name === "Паша" ? 1_451_142 : 167_039; const coef = actual >= currentPlan.target ? t.targetCoef : actual >= currentPlan.minimum ? t.minCoef : 1; const bonus = actual * (t.rate / 100) * coef; return <article className="employee-card" key={employee.name}><header><span className={`avatar ${employee.color}`}>{employee.initials}</span><div><h3>{employee.name}</h3><p>{employee.role}</p></div><span className="active-dot">● Работает</span></header><div className="term-fields"><NumberField label="Оклад" value={t.salary} onChange={v => updateTerm(employee.name, "salary", v)} small/><NumberField label="Ставка, %" value={t.rate} onChange={v => updateTerm(employee.name, "rate", v)} small/><NumberField label="Коэф. минимум" value={t.minCoef} onChange={v => updateTerm(employee.name, "minCoef", v)} small/><NumberField label="Коэф. целевой" value={t.targetCoef} onChange={v => updateTerm(employee.name, "targetCoef", v)} small/></div><footer><div><span>Факт / коэффициент</span><strong>{shortMoney(actual)} · × {coef}</strong></div><div><span>Премия</span><strong>{money(bonus)}</strong></div><div className="payout"><span>К выплате</span><strong>{money(t.salary + bonus)}</strong></div></footer></article>; })}</section><section className="panel history compact-history"><header><div><h2>История условий</h2><p>Ставки и оклады не перезаписывают прошлые периоды</p></div></header><table><thead><tr><th>Сотрудник</th><th>Январь</th><th>Февраль</th><th>Март</th></tr></thead><tbody>{employees.map((e: any) => <tr key={e.name}><td><strong>{e.name}</strong></td>{months.map(m => { const t = terms[m]?.[e.name]; return <td key={m}>{t ? <><b>{money(t.salary)}</b><small>{t.rate}% · ×{t.minCoef} / ×{t.targetCoef}</small></> : "—"}</td>; })}</tr>)}</tbody></table></section></div>}
  </div>;
}

function NumberField({ label, value, onChange, tone, small }: { label: string; value: number; onChange: (v: number) => void; tone?: string; small?: boolean }) { return <label className={`number-field ${tone || ""} ${small ? "small" : ""}`}><span>{label}</span><div><input type="number" step={value < 10 ? .1 : 1000} value={value} onChange={e => onChange(Number(e.target.value))}/>{!small && <b>₽</b>}</div></label>; }

function ManagerWorkspace({ managerName, leads, payments, month, onGoLead }: { managerName: string; leads: Lead[]; payments: Payment[]; month: string; onGoLead: (lead: Lead) => void }) {
  const actual = managerName === "Паша" ? 1_451_142 : 1_319_086; const plan = monthlyPlans[month].target; const min = monthlyPlans[month].minimum; const employeeTerms = compensation[month][managerName] || compensation[month]["Алина"]; const rate = employeeTerms.rate; const coef = actual >= plan ? employeeTerms.targetCoef : actual >= min ? employeeTerms.minCoef : 1; const bonus = actual * rate / 100 * coef; const active = leads.filter(l => ["Новая заявка", "В работе", "КП отправлено", "Ждём решения"].includes(l.status));
  return <div className="screen workspace-screen"><PageTitle eyebrow="МОЙ РАБОЧИЙ СТОЛ" title={`Добрый день, ${managerName}!`} copy="Главное по вашим продажам на сегодня" actions={<span className="today">13 февраля · пятница</span>} />
    <div className="workspace-grid"><section className="bonus-hero"><div className="bonus-top"><div><p>ПРЕМИЯ НА ТЕКУЩИЙ МОМЕНТ</p><strong>{money(bonus)}</strong><span>Ставка {rate}% × коэффициент {coef}</span></div><div className="bonus-total"><span>К выплате с окладом</span><b>{money(bonus + employeeTerms.salary)}</b></div></div><div className="progress-copy"><span>Выполнение целевого плана</span><b>{Math.round(actual / plan * 100)}%</b></div><div className="hero-track"><i style={{ width: `${Math.min(actual / plan * 100, 100)}%` }}/><em style={{ left: `${min / plan * 100}%` }}/></div><div className="progress-scale"><span>0 ₽</span><span>Минимум {shortMoney(min)}</span><span>Цель {shortMoney(plan)}</span></div><div className="next-level"><span>До целевого плана осталось</span><b>{money(Math.max(plan - actual, 0))}</b><small>После достижения коэффициент вырастет до × {employeeTerms.targetCoef}</small></div></section>
      <section className="workspace-side"><article><span>Чистая прибыль</span><strong>{money(actual)}</strong><small>↑ 9% к прошлой неделе</small></article><article><span>Сделок оплачено</span><strong>{payments.length}</strong><small>Средний чек {money(payments.reduce((s, p) => s + p.amount, 0) / Math.max(payments.length, 1))}</small></article><article><span>Активных заявок</span><strong>{active.length}</strong><small>{active.filter(l => l.status === "Новая заявка").length} ждут первого контакта</small></article></section></div>
    <section className="panel work-list"><header><div><h2>Сейчас в работе</h2><p>Нажмите на клиента, чтобы открыть его на Kanban-доске</p></div><button onClick={() => active[0] && onGoLead(active[0])}>Все заявки →</button></header><div className="work-cards">{active.slice(0, 5).map(lead => <button key={lead.id} onClick={() => onGoLead(lead)}><div className="work-name"><span className="tiny-avatar soft">{lead.name.slice(0, 1)}</span><span><strong>{lead.name}</strong><small>{lead.product}</small></span></div><span className="work-status"><i style={{ background: statusMeta[lead.status].dot }}/>{lead.status}</span><span className="work-amount">{lead.amount ? money(lead.amount) : "Сумма уточняется"}</span><span className="work-next">{lead.nextAction || "Открыть карточку"}</span><b>→</b></button>)}</div></section>
  </div>;
}

function ModalShell({ title, copy, close, children }: { title: string; copy: string; close: () => void; children: React.ReactNode }) { return <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && close()}><section className="modal"><header><div><h2>{title}</h2><p>{copy}</p></div><button onClick={close}>×</button></header>{children}</section></div>; }
const Field = ({ label, children }: { label: string; children: React.ReactNode }) => <label className="modal-field"><span>{label}</span>{children}</label>;

function LeadModal({ managers, products, defaultManager, close, save }: any) { const submit = (e: FormEvent<HTMLFormElement>) => { e.preventDefault(); const f = new FormData(e.currentTarget); save({ name: f.get("name"), manager: f.get("manager"), product: f.get("product"), amount: Number(f.get("amount")), status: "Новая заявка", createdAt: "2026-02-13", request: f.get("request") }); }; return <ModalShell title="Новая заявка" copy="Добавьте клиента в начало воронки" close={close}><form onSubmit={submit}><div className="modal-grid"><Field label="Имя клиента"><input name="name" required placeholder="Например, Мария"/></Field><Field label="Менеджер"><select name="manager" defaultValue={defaultManager}>{managers.map((v: string) => <option key={v}>{v}</option>)}</select></Field><Field label="Тариф"><select name="product">{products.map((v: string) => <option key={v}>{v}</option>)}</select></Field><Field label="Потенциальная сумма"><input name="amount" type="number" placeholder="54990"/></Field><Field label="Запрос клиента"><textarea name="request" placeholder="Что важно клиенту?"/></Field></div><ModalActions close={close} label="Создать заявку"/></form></ModalShell>; }
function PaymentModal({ managers, products, close, save }: any) { const submit = (e: FormEvent<HTMLFormElement>) => { e.preventDefault(); const f = new FormData(e.currentTarget); save({ client: f.get("client"), manager: f.get("manager"), product: f.get("product"), amount: Number(f.get("amount")), net: Number(f.get("net")), paymentType: f.get("method"), date: f.get("date") || "2026-02-13", comment: f.get("comment") }); }; return <ModalShell title="Внести оплату" copy="Новая запись появится в финансовой таблице" close={close}><form onSubmit={submit}><div className="modal-grid"><Field label="Клиент"><input name="client" required/></Field><Field label="Менеджер"><select name="manager">{managers.map((v: string) => <option key={v}>{v}</option>)}</select></Field><Field label="Тариф"><select name="product">{products.map((v: string) => <option key={v}>{v}</option>)}</select></Field><Field label="Способ оплаты"><select name="method"><option>сразу</option><option>рассрочка</option><option>по счёту</option></select></Field><Field label="Выручка"><input name="amount" type="number" required/></Field><Field label="Чистая прибыль"><input name="net" type="number" required/></Field><Field label="Дата оплаты"><input name="date" type="date" defaultValue="2026-02-13"/></Field><Field label="Комментарий"><input name="comment"/></Field></div><ModalActions close={close} label="Добавить оплату"/></form></ModalShell>; }
function EmployeeModal({ close, save }: any) { const submit = (e: FormEvent<HTMLFormElement>) => { e.preventDefault(); save(String(new FormData(e.currentTarget).get("name"))); }; return <ModalShell title="Новый сотрудник" copy="Создайте профиль и настройте мотивацию" close={close}><form onSubmit={submit}><div className="modal-grid"><Field label="Имя сотрудника"><input name="name" required placeholder="Имя и фамилия"/></Field><Field label="Роль"><select><option>Менеджер</option><option>Руководитель</option></select></Field><Field label="Оклад"><input type="number" defaultValue="60000"/></Field><Field label="Базовая ставка, %"><input type="number" defaultValue="3" step="0.1"/></Field></div><ModalActions close={close} label="Добавить сотрудника"/></form></ModalShell>; }
function ModalActions({ close, label }: { close: () => void; label: string }) { return <footer className="modal-actions"><button type="button" onClick={close}>Отмена</button><button className="primary" type="submit">{label}</button></footer>; }
function LeadDetails({ lead, close, move }: { lead: Lead; close: () => void; move: (s: string) => void }) { return <ModalShell title={lead.name} copy={`${lead.manager} · ${lead.product}`} close={close}><div className="lead-details"><div><span>Статус</span><select value={lead.status} onChange={e => move(e.target.value)}>{statuses.map(s => <option key={s}>{s}</option>)}</select></div><div><span>Сумма</span><strong>{lead.amount ? money(lead.amount) : "Не указана"}</strong></div><div><span>Дата заявки</span><strong>{lead.createdAt || "Не указана"}</strong></div><div><span>Контакт</span><strong>{lead.phone || lead.telegram || "Не указан"}</strong></div><article><span>Запрос клиента</span><p>{lead.request || "Нет описания"}</p></article><article><span>История / следующее действие</span><p>{lead.nextAction || lead.sourceStatus || "Нет записей"}</p></article></div><footer className="modal-actions"><button onClick={close}>Закрыть</button><button className="primary" onClick={() => move("Оплата")}>Перевести в оплату</button></footer></ModalShell>; }
