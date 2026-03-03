import { useState, useEffect, useCallback, useRef } from "react";

// ─── Constants ────────────────────────────────────────────────────────────────
const LOCATIONS = ["DUB-20", "CO1-14", "SN1-08", "BL3-22", "YQ1-01", "HK2-07", "SG1-11", "AMS-04"];
const CATEGORIES = ["Server Down", "Fan Failure", "Network Latency", "Disk Failure", "Power Anomaly", "Memory Error", "NIC Failure", "RAID Degraded", "Temperature Alert", "PDU Fault", "Switch Loop", "BGP Flap"];
const ASSIGNEES = ["Maria Chen", "Jake Torres", "Priya Nair", "Sam Okafor", "Lee Park", "Dana Reeves", "Alex Voss", "Yuki Tanaka"];
const STATUSES = ["Open", "In Progress", "Resolved"];

const PRIORITY_META = {
  P0: { label: "P0 · SEV0", color: "#ff2d55", bg: "rgba(255,45,85,0.12)", pulse: true },
  P1: { label: "P1 · SEV1", color: "#ff6b35", bg: "rgba(255,107,53,0.12)", pulse: false },
  P2: { label: "P2 · SEV2", color: "#ffd60a", bg: "rgba(255,214,10,0.10)", pulse: false },
  P3: { label: "P3 · SEV3", color: "#30d158", bg: "rgba(48,209,88,0.10)", pulse: false },
  P4: { label: "P4 · SEV4", color: "#636366", bg: "rgba(99,99,102,0.15)", pulse: false },
};

const STATUS_META = {
  "Open":        { color: "#ff6b35", icon: "⬤" },
  "In Progress": { color: "#0a84ff", icon: "⬤" },
  "Resolved":    { color: "#30d158", icon: "⬤" },
};

let _id = 1000;
const genId = () => `TKT-${++_id}`;

function randomItem(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function randomPriority() {
  const r = Math.random();
  if (r < 0.05) return "P0";
  if (r < 0.18) return "P1";
  if (r < 0.45) return "P2";
  if (r < 0.75) return "P3";
  return "P4";
}

function makeTicket(overrides = {}) {
  return {
    id: genId(),
    title: randomItem(CATEGORIES),
    priority: randomPriority(),
    location: randomItem(LOCATIONS),
    status: "Open",
    assignee: null,
    createdAt: Date.now(),
    age: 0,
    ...overrides,
  };
}

const SEED_TICKETS = [
  makeTicket({ priority: "P0", title: "Server Down",       location: "CO1-14", createdAt: Date.now() - 180000 }),
  makeTicket({ priority: "P1", title: "Fan Failure",        location: "DUB-20", createdAt: Date.now() - 90000  }),
  makeTicket({ priority: "P1", title: "BGP Flap",           location: "AMS-04", createdAt: Date.now() - 42000  }),
  makeTicket({ priority: "P2", title: "Network Latency",    location: "SN1-08", createdAt: Date.now() - 320000 }),
  makeTicket({ priority: "P2", title: "RAID Degraded",      location: "YQ1-01", createdAt: Date.now() - 75000  }),
  makeTicket({ priority: "P3", title: "Temperature Alert",  location: "HK2-07", createdAt: Date.now() - 600000 }),
  makeTicket({ priority: "P3", title: "Memory Error",       location: "BL3-22", createdAt: Date.now() - 15000  }),
  makeTicket({ priority: "P4", title: "PDU Fault",          location: "SG1-11", createdAt: Date.now() - 900000 }),
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtAge(ms) {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

function fmtTs(ts) {
  return new Date(ts).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

// ─── Subcomponents ────────────────────────────────────────────────────────────
function PriorityBadge({ p }) {
  const m = PRIORITY_META[p];
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      background: m.bg, color: m.color,
      border: `1px solid ${m.color}33`,
      borderRadius: 4, padding: "2px 8px",
      fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, fontWeight: 600,
      letterSpacing: "0.04em",
      position: "relative",
    }}>
      {m.pulse && (
        <span style={{
          width: 6, height: 6, borderRadius: "50%",
          background: m.color,
          display: "inline-block",
          animation: "pulse 1.1s ease-in-out infinite",
        }} />
      )}
      {m.label}
    </span>
  );
}

function StatusDot({ status }) {
  const m = STATUS_META[status];
  return (
    <span style={{ color: m.color, display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12 }}>
      <span style={{ fontSize: 8 }}>{m.icon}</span>
      {status}
    </span>
  );
}

function AgeBar({ age, priority }) {
  // TTL thresholds (ms) per priority
  const thresholds = { P0: 300000, P1: 900000, P2: 3600000, P3: 14400000, P4: 86400000 };
  const ttl = thresholds[priority] || 3600000;
  const pct = Math.min((age / ttl) * 100, 100);
  const color = pct > 80 ? "#ff2d55" : pct > 50 ? "#ffd60a" : "#30d158";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 110 }}>
      <div style={{ flex: 1, height: 4, background: "#2c2c2e", borderRadius: 2, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 2, transition: "width 1s linear" }} />
      </div>
      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: "#8e8e93", minWidth: 42, textAlign: "right" }}>
        {fmtAge(age)}
      </span>
    </div>
  );
}

function StatCard({ label, value, accent, sub }) {
  return (
    <div style={{
      background: "#1c1c1e", border: "1px solid #2c2c2e", borderRadius: 10,
      padding: "16px 20px", minWidth: 130,
    }}>
      <div style={{ fontSize: 11, color: "#636366", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 700, color: accent || "#f5f5f7", fontFamily: "'IBM Plex Mono', monospace", lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "#636366", marginTop: 6 }}>{sub}</div>}
    </div>
  );
}

function TicketRow({ ticket, onClaim, onResolve, onSelect, isSelected }) {
  const pm = PRIORITY_META[ticket.priority];
  return (
    <tr
      onClick={() => onSelect(ticket.id)}
      style={{
        cursor: "pointer",
        background: isSelected ? "rgba(10,132,255,0.08)" : "transparent",
        borderLeft: isSelected ? "2px solid #0a84ff" : "2px solid transparent",
        transition: "background 0.15s",
      }}
    >
      <td style={td}><span style={{ fontFamily: "monospace", fontSize: 12, color: "#636366" }}>{ticket.id}</span></td>
      <td style={td}>
        <span style={{ color: "#f5f5f7", fontSize: 13, fontWeight: 500 }}>{ticket.title}</span>
      </td>
      <td style={td}><PriorityBadge p={ticket.priority} /></td>
      <td style={td}><span style={{ fontFamily: "monospace", fontSize: 12, color: "#aeaeb2" }}>{ticket.location}</span></td>
      <td style={td}><StatusDot status={ticket.status} /></td>
      <td style={td}><AgeBar age={ticket.age} priority={ticket.priority} /></td>
      <td style={td}>
        <span style={{ fontSize: 12, color: ticket.assignee ? "#aeaeb2" : "#3a3a3c" }}>
          {ticket.assignee || "—"}
        </span>
      </td>
      <td style={{ ...td, textAlign: "right" }}>
        <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }} onClick={e => e.stopPropagation()}>
          {ticket.status === "Open" && (
            <button onClick={() => onClaim(ticket.id)} style={btnSecondary}>Claim</button>
          )}
          {ticket.status === "In Progress" && (
            <button onClick={() => onResolve(ticket.id)} style={btnPrimary}>Resolve</button>
          )}
          {ticket.status === "Resolved" && (
            <span style={{ fontSize: 11, color: "#30d158", fontFamily: "monospace" }}>✓ Done</span>
          )}
        </div>
      </td>
    </tr>
  );
}

// ─── Detail Panel ─────────────────────────────────────────────────────────────
function DetailPanel({ ticket, onClose, onClaim, onResolve }) {
  if (!ticket) return null;
  const pm = PRIORITY_META[ticket.priority];
  return (
    <div style={{
      position: "fixed", top: 0, right: 0, height: "100vh", width: 360,
      background: "#1c1c1e", borderLeft: "1px solid #2c2c2e",
      zIndex: 100, overflowY: "auto", display: "flex", flexDirection: "column",
      animation: "slideIn 0.2s ease",
    }}>
      {/* Header */}
      <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid #2c2c2e", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontFamily: "monospace", fontSize: 11, color: "#636366", marginBottom: 4 }}>{ticket.id}</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: "#f5f5f7" }}>{ticket.title}</div>
        </div>
        <button onClick={onClose} style={{ background: "none", border: "none", color: "#636366", cursor: "pointer", fontSize: 20, padding: 0, lineHeight: 1 }}>×</button>
      </div>

      {/* Body */}
      <div style={{ padding: "20px 24px", flex: 1 }}>
        <Row label="Priority"><PriorityBadge p={ticket.priority} /></Row>
        <Row label="Status"><StatusDot status={ticket.status} /></Row>
        <Row label="Location"><span style={{ fontFamily: "monospace", fontSize: 13, color: "#aeaeb2" }}>{ticket.location}</span></Row>
        <Row label="Opened"><span style={{ fontFamily: "monospace", fontSize: 12, color: "#aeaeb2" }}>{fmtTs(ticket.createdAt)}</span></Row>
        <Row label="Age"><span style={{ fontFamily: "monospace", fontSize: 12, color: "#aeaeb2" }}>{fmtAge(ticket.age)}</span></Row>
        <Row label="Assignee">
          <span style={{ fontSize: 13, color: ticket.assignee ? "#f5f5f7" : "#3a3a3c" }}>
            {ticket.assignee || "Unassigned"}
          </span>
        </Row>

        {/* TTL gauge */}
        <div style={{ marginTop: 24 }}>
          <div style={{ fontSize: 11, color: "#636366", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 8 }}>TTL Gauge</div>
          <AgeBar age={ticket.age} priority={ticket.priority} />
        </div>

        {/* Fake timeline */}
        <div style={{ marginTop: 28 }}>
          <div style={{ fontSize: 11, color: "#636366", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 12 }}>Event Log</div>
          <TimelineEvent time={fmtTs(ticket.createdAt)} label="Ticket opened" color="#ff6b35" />
          {ticket.assignee && <TimelineEvent time={fmtTs(ticket.createdAt + 30000)} label={`Claimed by ${ticket.assignee}`} color="#0a84ff" />}
          {ticket.status === "Resolved" && <TimelineEvent time={fmtTs(Date.now())} label="Resolved" color="#30d158" />}
        </div>
      </div>

      {/* Actions */}
      <div style={{ padding: "16px 24px", borderTop: "1px solid #2c2c2e", display: "flex", gap: 10 }}>
        {ticket.status === "Open" && (
          <button onClick={() => onClaim(ticket.id)} style={{ ...btnSecondary, flex: 1, padding: "10px 0", fontSize: 13 }}>Claim Ticket</button>
        )}
        {ticket.status === "In Progress" && (
          <button onClick={() => onResolve(ticket.id)} style={{ ...btnPrimary, flex: 1, padding: "10px 0", fontSize: 13 }}>Mark Resolved</button>
        )}
      </div>
    </div>
  );
}

function Row({ label, children }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid #2c2c2e" }}>
      <span style={{ fontSize: 12, color: "#636366" }}>{label}</span>
      {children}
    </div>
  );
}

function TimelineEvent({ time, label, color }) {
  return (
    <div style={{ display: "flex", gap: 10, marginBottom: 12, alignItems: "flex-start" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 4 }}>
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: color }} />
        <div style={{ width: 1, flex: 1, background: "#2c2c2e", minHeight: 16, marginTop: 3 }} />
      </div>
      <div>
        <div style={{ fontSize: 12, color: "#f5f5f7" }}>{label}</div>
        <div style={{ fontSize: 10, color: "#636366", fontFamily: "monospace", marginTop: 2 }}>{time}</div>
      </div>
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const td = {
  padding: "12px 14px",
  fontSize: 13,
  borderBottom: "1px solid #1c1c1e",
  verticalAlign: "middle",
  whiteSpace: "nowrap",
};

const btnPrimary = {
  background: "#0a84ff", color: "#fff", border: "none",
  borderRadius: 6, padding: "5px 14px", fontSize: 12, fontWeight: 600,
  cursor: "pointer", letterSpacing: "0.02em",
};

const btnSecondary = {
  background: "transparent", color: "#aeaeb2",
  border: "1px solid #3a3a3c",
  borderRadius: 6, padding: "5px 14px", fontSize: 12,
  cursor: "pointer", letterSpacing: "0.02em",
};

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [tickets, setTickets] = useState(SEED_TICKETS);
  const [selectedId, setSelectedId] = useState(null);
  const [filterStatus, setFilterStatus] = useState("All");
  const [filterPriority, setFilterPriority] = useState("All");
  const [sortBy, setSortBy] = useState("priority");
  const [spawnLog, setSpawnLog] = useState([]);
  const logRef = useRef(null);

  const currentUser = "You (Student)";

  // ── Age ticker
  useEffect(() => {
    const t = setInterval(() => {
      setTickets(ts => ts.map(tk => ({ ...tk, age: Date.now() - tk.createdAt })));
    }, 1000);
    return () => clearInterval(t);
  }, []);

  // ── Spawn new tickets
  useEffect(() => {
    const t = setInterval(() => {
      const nt = makeTicket();
      setTickets(ts => [nt, ...ts]);
      setSpawnLog(l => [`${fmtTs(Date.now())}  NEW ${nt.id}  ${nt.title}  ${nt.priority}  ${nt.location}`, ...l.slice(0, 49)]);
    }, 12000);
    return () => clearInterval(t);
  }, []);

  const claimTicket = useCallback((id) => {
    setTickets(ts => ts.map(tk =>
      tk.id === id ? { ...tk, status: "In Progress", assignee: currentUser } : tk
    ));
  }, []);

  const resolveTicket = useCallback((id) => {
    setTickets(ts => ts.map(tk =>
      tk.id === id ? { ...tk, status: "Resolved" } : tk
    ));
  }, []);

  // ── Derived data
  const filtered = tickets
    .filter(tk => filterStatus === "All" || tk.status === filterStatus)
    .filter(tk => filterPriority === "All" || tk.priority === filterPriority)
    .sort((a, b) => {
      if (sortBy === "priority") return a.priority.localeCompare(b.priority);
      if (sortBy === "age") return b.age - a.age;
      if (sortBy === "status") return a.status.localeCompare(b.status);
      return 0;
    });

  const selectedTicket = tickets.find(t => t.id === selectedId) || null;

  const counts = {
    open: tickets.filter(t => t.status === "Open").length,
    inProgress: tickets.filter(t => t.status === "In Progress").length,
    resolved: tickets.filter(t => t.status === "Resolved").length,
    p0: tickets.filter(t => t.priority === "P0" && t.status !== "Resolved").length,
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #0a0a0b; color: #f5f5f7; font-family: 'IBM Plex Sans', sans-serif; }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: #1c1c1e; }
        ::-webkit-scrollbar-thumb { background: #3a3a3c; border-radius: 3px; }
        tr:hover td { background: rgba(255,255,255,0.03); }
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.7); }
        }
        @keyframes slideIn {
          from { transform: translateX(40px); opacity: 0; }
          to   { transform: translateX(0);   opacity: 1; }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .ticket-new { animation: fadeIn 0.4s ease; }
        button:hover { filter: brightness(1.15); }
      `}</style>

      <div style={{ minHeight: "100vh", background: "#0a0a0b" }}>

        {/* ── Top Nav */}
        <nav style={{
          height: 52, background: "#141414", borderBottom: "1px solid #1c1c1e",
          display: "flex", alignItems: "center", padding: "0 24px",
          justifyContent: "space-between", position: "sticky", top: 0, zIndex: 50,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{
              width: 28, height: 28, background: "#0a84ff", borderRadius: 6,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 15, fontWeight: 700, fontFamily: "monospace", color: "#fff",
            }}>Ω</div>
            <span style={{ fontSize: 14, fontWeight: 600, letterSpacing: "0.01em" }}>DataCenter NOC</span>
            <span style={{ fontSize: 11, color: "#636366", fontFamily: "monospace", marginLeft: 8 }}>STUDENT LAB PORTAL</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            {counts.p0 > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(255,45,85,0.12)", border: "1px solid rgba(255,45,85,0.3)", borderRadius: 6, padding: "4px 10px" }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#ff2d55", display: "block", animation: "pulse 1s infinite" }} />
                <span style={{ fontSize: 12, color: "#ff2d55", fontWeight: 600 }}>{counts.p0} P0 ACTIVE</span>
              </div>
            )}
            <span style={{ fontSize: 12, color: "#636366", fontFamily: "monospace" }}>{currentUser}</span>
          </div>
        </nav>

        <div style={{ display: "flex", marginRight: selectedTicket ? 360 : 0, transition: "margin-right 0.2s ease" }}>
          <div style={{ flex: 1, padding: "24px", minWidth: 0 }}>

            {/* ── Stats Row */}
            <div style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
              <StatCard label="Open"       value={counts.open}       accent="#ff6b35"  sub="needs attention" />
              <StatCard label="In Progress" value={counts.inProgress} accent="#0a84ff"  sub="being handled" />
              <StatCard label="Resolved"   value={counts.resolved}   accent="#30d158"  sub="this session" />
              <StatCard label="Total"      value={tickets.length}    sub="all tickets" />
              <div style={{ flex: 1, minWidth: 200, background: "#1c1c1e", border: "1px solid #2c2c2e", borderRadius: 10, padding: "16px 20px" }}>
                <div style={{ fontSize: 11, color: "#636366", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>Spawn Log</div>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: "#636366", lineHeight: 1.8, maxHeight: 60, overflowY: "hidden" }}>
                  {spawnLog.length === 0
                    ? <span style={{ color: "#3a3a3c" }}>waiting for new tickets…</span>
                    : spawnLog.slice(0, 3).map((l, i) => <div key={i} style={{ color: i === 0 ? "#0a84ff" : "#3a3a3c" }}>{l}</div>)
                  }
                </div>
              </div>
            </div>

            {/* ── Filter/Sort Bar */}
            <div style={{ display: "flex", gap: 10, marginBottom: 16, alignItems: "center", flexWrap: "wrap" }}>
              <span style={{ fontSize: 11, color: "#636366", letterSpacing: "0.06em", textTransform: "uppercase" }}>Filter</span>
              {["All", "Open", "In Progress", "Resolved"].map(s => (
                <button key={s} onClick={() => setFilterStatus(s)} style={{
                  background: filterStatus === s ? "rgba(10,132,255,0.15)" : "transparent",
                  color: filterStatus === s ? "#0a84ff" : "#636366",
                  border: `1px solid ${filterStatus === s ? "#0a84ff55" : "#2c2c2e"}`,
                  borderRadius: 6, padding: "4px 12px", fontSize: 12, cursor: "pointer",
                }}>{s}</button>
              ))}
              <div style={{ width: 1, height: 20, background: "#2c2c2e", margin: "0 4px" }} />
              {["All", "P0", "P1", "P2", "P3", "P4"].map(p => (
                <button key={p} onClick={() => setFilterPriority(p)} style={{
                  background: filterPriority === p ? (p === "All" ? "rgba(255,255,255,0.08)" : PRIORITY_META[p]?.bg || "rgba(255,255,255,0.08)") : "transparent",
                  color: filterPriority === p ? (p === "All" ? "#f5f5f7" : PRIORITY_META[p]?.color || "#f5f5f7") : "#636366",
                  border: `1px solid ${filterPriority === p ? (p === "All" ? "#3a3a3c" : (PRIORITY_META[p]?.color + "55") || "#3a3a3c") : "#2c2c2e"}`,
                  borderRadius: 6, padding: "4px 10px", fontSize: 12, cursor: "pointer",
                  fontFamily: p !== "All" ? "monospace" : "inherit",
                }}>{p}</button>
              ))}
              <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
                <span style={{ fontSize: 11, color: "#636366" }}>Sort</span>
                {[["priority", "Priority"], ["age", "Age"], ["status", "Status"]].map(([v, l]) => (
                  <button key={v} onClick={() => setSortBy(v)} style={{
                    background: sortBy === v ? "#1c1c1e" : "transparent",
                    color: sortBy === v ? "#f5f5f7" : "#636366",
                    border: `1px solid ${sortBy === v ? "#3a3a3c" : "transparent"}`,
                    borderRadius: 6, padding: "4px 10px", fontSize: 12, cursor: "pointer",
                  }}>{l}</button>
                ))}
              </div>
            </div>

            {/* ── Table */}
            <div style={{ background: "#141414", border: "1px solid #1c1c1e", borderRadius: 12, overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#1c1c1e" }}>
                    {["Ticket ID", "Title", "Priority", "Location", "Status", "Age / TTL", "Assignee", "Actions"].map(h => (
                      <th key={h} style={{
                        padding: "10px 14px", textAlign: "left",
                        fontSize: 10, color: "#636366", letterSpacing: "0.08em",
                        textTransform: "uppercase", fontWeight: 600, borderBottom: "1px solid #2c2c2e",
                        whiteSpace: "nowrap",
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ padding: "48px", textAlign: "center", color: "#3a3a3c", fontSize: 13 }}>
                        No tickets match the current filters
                      </td>
                    </tr>
                  ) : filtered.map(tk => (
                    <TicketRow
                      key={tk.id}
                      ticket={tk}
                      onClaim={claimTicket}
                      onResolve={resolveTicket}
                      onSelect={(id) => setSelectedId(id === selectedId ? null : id)}
                      isSelected={tk.id === selectedId}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ marginTop: 12, fontSize: 11, color: "#3a3a3c", fontFamily: "monospace" }}>
              Showing {filtered.length} of {tickets.length} tickets · Auto-spawning every 12s · Click row to inspect
            </div>

          </div>
        </div>

        {/* ── Detail Panel */}
        {selectedTicket && (
          <DetailPanel
            ticket={selectedTicket}
            onClose={() => setSelectedId(null)}
            onClaim={claimTicket}
            onResolve={resolveTicket}
          />
        )}

      </div>
    </>
  );
}
