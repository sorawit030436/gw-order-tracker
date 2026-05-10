import { useState, useEffect } from "react";
import { db } from "./firebase";
import {
  collection, addDoc, getDocs, updateDoc, doc, orderBy, query, serverTimestamp
} from "firebase/firestore";

const STATUS_CONFIG = {
  "Pending":   { color: "#f59e0b", bg: "#fef3c7", label: "Pending" },
  "Ordered":   { color: "#3b82f6", bg: "#dbeafe", label: "Ordered" },
  "Received":  { color: "#10b981", bg: "#d1fae5", label: "Received" },
  "Cancelled": { color: "#ef4444", bg: "#fee2e2", label: "Cancelled" },
};

const CATEGORIES = ["อุปกรณ์สำนักงาน", "อะไหล่เครื่องจักร", "เครื่องมือ", "อุปกรณ์ความปลอดภัย", "อื่นๆ"];
const STATUSES   = ["ทุกสถานะ", "Pending", "Ordered", "Received", "Cancelled"];

const USER = { name: "Sorawit Gudta", role: "QA Engineer", dept: "Press", avatar: "SG" };

export default function App() {
  const [page, setPage]             = useState("list");
  const [items, setItems]           = useState([]);
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);
  const [selected, setSelected]     = useState(null);
  const [filterStatus, setFilter]   = useState("ทุกสถานะ");
  const [filterCat, setFilterCat]   = useState("ทุกประเภท");
  const [search, setSearch]         = useState("");
  const [menuOpen, setMenuOpen]     = useState(false);
  const [form, setForm]             = useState({
    category: "อุปกรณ์สำนักงาน", description: "", qty: 1, unit: "อัน", note: ""
  });

  // Load from Firestore
  useEffect(() => {
    loadItems();
  }, []);

  const loadItems = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, "orders"), orderBy("createdAt", "desc"));
      const snap = await getDocs(q);
      setItems(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const handleAdd = async () => {
    if (!form.description.trim()) return;
    setSaving(true);
    try {
      await addDoc(collection(db, "orders"), {
        ...form,
        qty: Number(form.qty),
        status: "Pending",
        requestedBy: USER.name,
        requestDate: new Date().toISOString().slice(0, 10),
        receivedDate: null,
        createdAt: serverTimestamp(),
      });
      setForm({ category: "อุปกรณ์สำนักงาน", description: "", qty: 1, unit: "อัน", note: "" });
      await loadItems();
      setPage("list");
    } catch (e) { console.error(e); }
    setSaving(false);
  };

  const handleStatusChange = async (item, newStatus) => {
    try {
      const ref = doc(db, "orders", item.id);
      const updates = {
        status: newStatus,
        receivedDate: newStatus === "Received" ? new Date().toISOString().slice(0, 10) : item.receivedDate
      };
      await updateDoc(ref, updates);
      const updated = { ...item, ...updates };
      setItems(prev => prev.map(i => i.id === item.id ? updated : i));
      setSelected(updated);
    } catch (e) { console.error(e); }
  };

  const filtered = items.filter(it => {
    const matchStatus = filterStatus === "ทุกสถานะ" || it.status === filterStatus;
    const matchCat    = filterCat === "ทุกประเภท" || it.category === filterCat;
    const matchSearch = it.description?.toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchCat && matchSearch;
  });

  const counts = Object.fromEntries(
    Object.keys(STATUS_CONFIG).map(s => [s, items.filter(i => i.status === s).length])
  );

  // ─── STYLES ───────────────────────────────────────────────────────────────
  const S = {
    root:      { fontFamily:"'Sarabun',sans-serif", background:"#f8fafc", minHeight:"100vh", maxWidth:430, margin:"0 auto", display:"flex", flexDirection:"column", position:"relative" },
    header:    { background:"#fff", padding:"12px 16px", display:"flex", alignItems:"center", gap:12, borderBottom:"1px solid #e5e7eb", position:"sticky", top:0, zIndex:100, boxShadow:"0 1px 4px rgba(0,0,0,0.06)" },
    menuBtn:   { background:"none", border:"none", cursor:"pointer", fontSize:20, color:"#374151", padding:4 },
    hTitle:    { flex:1 },
    hMain:     { fontWeight:700, fontSize:15, color:"#111827", lineHeight:1.2, display:"block" },
    hSub:      { fontSize:11, color:"#9ca3af" },
    avatar:    { width:34, height:34, borderRadius:"50%", background:"#2563eb", color:"#fff", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:700, fontSize:13, cursor:"pointer" },
    overlay:   { position:"fixed", inset:0, background:"rgba(0,0,0,0.3)", zIndex:200 },
    panel:     { width:260, background:"#fff", height:"100%", padding:20, display:"flex", flexDirection:"column", gap:4 },
    panelHead: { display:"flex", alignItems:"center", gap:12, padding:"12px 0 20px", borderBottom:"1px solid #f3f4f6", marginBottom:8 },
    panelAv:   { width:44, height:44, borderRadius:"50%", background:"#2563eb", color:"#fff", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:700, fontSize:16 },
    panelName: { fontWeight:700, fontSize:14, color:"#111827" },
    panelRole: { fontSize:12, color:"#6b7280", marginTop:2 },
    menuItem:  { padding:"11px 14px", borderRadius:10, border:"none", background:"none", textAlign:"left", fontSize:14, cursor:"pointer", color:"#374151", fontFamily:"inherit" },
    menuActive:{ background:"#eff6ff", color:"#2563eb", fontWeight:600 },
    main:      { flex:1, overflowY:"auto", paddingBottom:80 },
    wrap:      { padding:"16px 16px 0" },
    pageTitle: { fontSize:20, fontWeight:700, color:"#111827", marginBottom:16 },
    backBtn:   { background:"none", border:"none", color:"#2563eb", fontSize:14, cursor:"pointer", padding:"0 0 12px", fontFamily:"inherit" },
    sumRow:    { display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr", gap:8, marginBottom:14 },
    sumCard:   { background:"#fff", borderRadius:10, padding:"10px 6px", textAlign:"center", cursor:"pointer", boxShadow:"0 1px 3px rgba(0,0,0,0.06)" },
    sumNum:    { fontSize:22, fontWeight:800, lineHeight:1 },
    sumLabel:  { fontSize:10, color:"#6b7280", marginTop:2 },
    filterRow: { display:"flex", gap:8, marginBottom:8 },
    select:    { flex:1, padding:"8px 10px", borderRadius:8, border:"1.5px solid #e5e7eb", fontSize:13, background:"#fff", color:"#374151", fontFamily:"inherit" },
    searchRow: { position:"relative", marginBottom:14 },
    searchIn:  { width:"100%", padding:"9px 36px 9px 12px", borderRadius:8, border:"1.5px solid #e5e7eb", fontSize:13, background:"#fff", boxSizing:"border-box", fontFamily:"inherit" },
    clearBtn:  { position:"absolute", right:10, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", color:"#9ca3af", cursor:"pointer", fontSize:14 },
    listWrap:  { display:"flex", flexDirection:"column", gap:10 },
    empty:     { textAlign:"center", color:"#9ca3af", padding:40, fontSize:14 },
    card:      { background:"#fff", borderRadius:12, padding:14, boxShadow:"0 1px 4px rgba(0,0,0,0.07)" },
    cardTop:   { display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:8 },
    cardId:    { fontSize:11, color:"#9ca3af", marginBottom:2 },
    cardDesc:  { fontSize:14, fontWeight:600, color:"#111827", lineHeight:1.3 },
    cardMeta:  { fontSize:12, color:"#6b7280", marginTop:3 },
    cardRight: { display:"flex", flexDirection:"column", alignItems:"flex-end", gap:6 },
    badge:     { fontSize:11, fontWeight:700, padding:"3px 9px", borderRadius:20, whiteSpace:"nowrap" },
    detailBtn: { background:"#eff6ff", color:"#2563eb", border:"none", borderRadius:8, padding:"6px 10px", fontSize:12, cursor:"pointer", whiteSpace:"nowrap", fontFamily:"inherit" },
    dateRow:   { display:"flex", gap:14, marginTop:8, paddingTop:8, borderTop:"1px solid #f9fafb" },
    dateText:  { fontSize:11, color:"#9ca3af" },
    fab:       { position:"fixed", bottom:90, right:"calc(50% - 215px + 20px)", width:52, height:52, borderRadius:"50%", background:"#2563eb", color:"#fff", border:"none", fontSize:26, cursor:"pointer", boxShadow:"0 4px 14px rgba(37,99,235,0.4)", zIndex:50 },
    detCard:   { background:"#fff", borderRadius:16, padding:20, boxShadow:"0 1px 6px rgba(0,0,0,0.08)" },
    detHead:   { display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8 },
    detId:     { fontSize:13, color:"#9ca3af" },
    detDesc:   { fontSize:18, fontWeight:700, color:"#111827", marginBottom:18, lineHeight:1.4 },
    detRow:    { display:"flex", justifyContent:"space-between", padding:"9px 0", borderBottom:"1px solid #f3f4f6" },
    detKey:    { fontSize:13, color:"#6b7280" },
    detVal:    { fontSize:13, color:"#111827", fontWeight:500, maxWidth:"55%", textAlign:"right" },
    statActs:  { marginTop:20 },
    statLabel: { fontSize:12, color:"#6b7280", marginBottom:10 },
    statBtns:  { display:"flex", flexWrap:"wrap", gap:8 },
    statBtn:   { padding:"7px 14px", borderRadius:20, fontSize:12, cursor:"pointer", fontFamily:"inherit", fontWeight:600 },
    formCard:  { background:"#fff", borderRadius:16, padding:20, boxShadow:"0 1px 6px rgba(0,0,0,0.08)", display:"flex", flexDirection:"column", gap:14 },
    formGrp:   { display:"flex", flexDirection:"column", gap:5 },
    formLbl:   { fontSize:13, color:"#374151", fontWeight:600 },
    formIn:    { padding:"10px 12px", borderRadius:8, border:"1.5px solid #e5e7eb", fontSize:13, fontFamily:"inherit", color:"#111827" },
    submitBtn: { background:"#2563eb", color:"#fff", border:"none", borderRadius:10, padding:13, fontSize:15, fontWeight:700, cursor:"pointer", fontFamily:"inherit", marginTop:4 },
    profCard:  { background:"#fff", borderRadius:16, padding:24, boxShadow:"0 1px 6px rgba(0,0,0,0.08)", display:"flex", flexDirection:"column", alignItems:"center", marginBottom:16 },
    profAv:    { width:72, height:72, borderRadius:"50%", background:"#2563eb", color:"#fff", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:700, fontSize:26, marginBottom:12 },
    profName:  { fontSize:18, fontWeight:800, color:"#111827", marginBottom:16 },
    profRow:   { display:"flex", justifyContent:"space-between", width:"100%", padding:"9px 0", borderBottom:"1px solid #f3f4f6" },
    profKey:   { fontSize:13, color:"#6b7280" },
    profVal:   { fontSize:13, color:"#111827", fontWeight:600 },
    profStats: { display:"flex", gap:24, marginTop:20 },
    profStat:  { textAlign:"center" },
    profStatN: { fontSize:26, fontWeight:800 },
    profStatL: { fontSize:11, color:"#6b7280", marginTop:2 },
    profBtns:  { display:"flex", gap:10 },
    profNavB:  { flex:1, padding:12, border:"none", borderRadius:12, color:"#fff", fontWeight:700, fontSize:13, cursor:"pointer", fontFamily:"inherit" },
    bottomNav: { position:"fixed", bottom:0, left:"50%", transform:"translateX(-50%)", width:"100%", maxWidth:430, background:"#fff", borderTop:"1px solid #e5e7eb", display:"flex", zIndex:100 },
    navItem:   { flex:1, padding:"10px 0", display:"flex", flexDirection:"column", alignItems:"center", gap:2, background:"none", border:"none", cursor:"pointer" },
    navActive: { background:"#eff6ff" },
    navIcon:   { fontSize:18 },
    navLabel:  { fontSize:10, color:"#9ca3af", fontFamily:"'Sarabun',sans-serif" },
    loading:   { display:"flex", alignItems:"center", justifyContent:"center", height:200, color:"#9ca3af", fontSize:14 },
  };

  const NavBtn = ({ icon, label, view }) => (
    <button style={{ ...S.navItem, ...(page === view || (page === "detail" && view === "list") ? S.navActive : {}) }}
      onClick={() => setPage(view)}>
      <span style={S.navIcon}>{icon}</span>
      <span style={S.navLabel}>{label}</span>
    </button>
  );

  return (
    <div style={S.root}>
      {/* Header */}
      <header style={S.header}>
        <button style={S.menuBtn} onClick={() => setMenuOpen(!menuOpen)}>☰</button>
        <div style={S.hTitle}>
          <span style={S.hMain}>GW One Stop</span>
          <span style={S.hSub}>Order Tracking</span>
        </div>
        <div style={S.avatar} onClick={() => { setPage("profile"); setMenuOpen(false); }}>
          {USER.avatar}
        </div>
      </header>

      {/* Slide Menu */}
      {menuOpen && (
        <div style={S.overlay} onClick={() => setMenuOpen(false)}>
          <div style={S.panel} onClick={e => e.stopPropagation()}>
            <div style={S.panelHead}>
              <div style={S.panelAv}>{USER.avatar}</div>
              <div>
                <div style={S.panelName}>{USER.name}</div>
                <div style={S.panelRole}>{USER.role} · {USER.dept}</div>
              </div>
            </div>
            {[
              { label: "📋 รายการสั่งซื้อ", view: "list" },
              { label: "➕ แจ้งสั่งของใหม่", view: "add" },
              { label: "👤 โปรไฟล์", view: "profile" },
            ].map(m => (
              <button key={m.view}
                style={{ ...S.menuItem, ...(page === m.view ? S.menuActive : {}) }}
                onClick={() => { setPage(m.view); setMenuOpen(false); }}>
                {m.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <main style={S.main}>

        {/* LIST PAGE */}
        {page === "list" && (
          <div style={S.wrap}>
            <div style={S.pageTitle}>รายการสั่งซื้อ</div>

            {/* Summary */}
            <div style={S.sumRow}>
              {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                <div key={k} style={{ ...S.sumCard, borderTop: `3px solid ${v.color}` }}
                  onClick={() => setFilter(k === filterStatus ? "ทุกสถานะ" : k)}>
                  <div style={{ ...S.sumNum, color: v.color }}>{counts[k] || 0}</div>
                  <div style={S.sumLabel}>{v.label}</div>
                </div>
              ))}
            </div>

            {/* Filters */}
            <div style={S.filterRow}>
              <select style={S.select} value={filterStatus} onChange={e => setFilter(e.target.value)}>
                {STATUSES.map(s => <option key={s}>{s}</option>)}
              </select>
              <select style={S.select} value={filterCat} onChange={e => setFilterCat(e.target.value)}>
                {["ทุกประเภท", ...CATEGORIES].map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div style={S.searchRow}>
              <input style={S.searchIn} placeholder="ค้นหารายการ..." value={search}
                onChange={e => setSearch(e.target.value)} />
              {search && <button style={S.clearBtn} onClick={() => setSearch("")}>✕</button>}
            </div>

            {/* Items */}
            {loading ? (
              <div style={S.loading}>⏳ กำลังโหลด...</div>
            ) : (
              <div style={S.listWrap}>
                {filtered.length === 0 && <div style={S.empty}>ไม่พบรายการ</div>}
                {filtered.map(item => {
                  const sc = STATUS_CONFIG[item.status] || STATUS_CONFIG["Pending"];
                  return (
                    <div key={item.id} style={S.card}>
                      <div style={S.cardTop}>
                        <div style={{ flex: 1 }}>
                          <div style={S.cardId}>#{item.id?.slice(-6).toUpperCase()}</div>
                          <div style={S.cardDesc}>{item.description}</div>
                          <div style={S.cardMeta}>{item.category} · {item.qty} {item.unit}</div>
                        </div>
                        <div style={S.cardRight}>
                          <span style={{ ...S.badge, color: sc.color, background: sc.bg }}>{sc.label}</span>
                          <button style={S.detailBtn}
                            onClick={() => { setSelected(item); setPage("detail"); }}>
                            ดูรายละเอียด
                          </button>
                        </div>
                      </div>
                      <div style={S.dateRow}>
                        <span style={S.dateText}>📅 สั่ง: {item.requestDate}</span>
                        {item.receivedDate && <span style={S.dateText}>✅ รับ: {item.receivedDate}</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <button style={S.fab} onClick={() => setPage("add")}>+</button>
          </div>
        )}

        {/* DETAIL PAGE */}
        {page === "detail" && selected && (() => {
          const sc = STATUS_CONFIG[selected.status] || STATUS_CONFIG["Pending"];
          return (
            <div style={S.wrap}>
              <button style={S.backBtn} onClick={() => setPage("list")}>← กลับ</button>
              <div style={S.pageTitle}>รายละเอียดรายการ</div>
              <div style={S.detCard}>
                <div style={S.detHead}>
                  <span style={S.detId}>#{selected.id?.slice(-6).toUpperCase()}</span>
                  <span style={{ ...S.badge, color: sc.color, background: sc.bg, fontSize: 13 }}>{sc.label}</span>
                </div>
                <div style={S.detDesc}>{selected.description}</div>
                {[
                  ["ประเภท", selected.category],
                  ["จำนวน", `${selected.qty} ${selected.unit}`],
                  ["ผู้สั่ง", selected.requestedBy],
                  ["วันที่สั่ง", selected.requestDate],
                  ["วันที่รับ", selected.receivedDate || "-"],
                  ["หมายเหตุ", selected.note || "-"],
                ].map(([k, v]) => (
                  <div key={k} style={S.detRow}>
                    <span style={S.detKey}>{k}</span>
                    <span style={S.detVal}>{v}</span>
                  </div>
                ))}
                <div style={S.statActs}>
                  <div style={S.statLabel}>อัปเดตสถานะ</div>
                  <div style={S.statBtns}>
                    {Object.entries(STATUS_CONFIG).map(([s, cfg]) => (
                      <button key={s}
                        style={{
                          ...S.statBtn,
                          background: selected.status === s ? cfg.color : "#f3f4f6",
                          color: selected.status === s ? "#fff" : "#6b7280",
                          border: `1.5px solid ${cfg.color}`
                        }}
                        onClick={() => handleStatusChange(selected, s)}>
                        {cfg.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        {/* ADD PAGE */}
        {page === "add" && (
          <div style={S.wrap}>
            <button style={S.backBtn} onClick={() => setPage("list")}>← กลับ</button>
            <div style={S.pageTitle}>แจ้งสั่งของใหม่</div>
            <div style={S.formCard}>
              {[
                { label: "ประเภทสินค้า", key: "category", type: "select", opts: CATEGORIES },
                { label: "รายละเอียดสินค้า", key: "description", type: "text", placeholder: "เช่น กระดาษ A4, สายพาน..." },
                { label: "จำนวน", key: "qty", type: "number", placeholder: "1" },
                { label: "หน่วย", key: "unit", type: "text", placeholder: "อัน / ชิ้น / รีม..." },
                { label: "หมายเหตุ", key: "note", type: "text", placeholder: "ข้อมูลเพิ่มเติม (ถ้ามี)" },
              ].map(f => (
                <div key={f.key} style={S.formGrp}>
                  <label style={S.formLbl}>{f.label}</label>
                  {f.type === "select"
                    ? <select style={S.formIn} value={form[f.key]} onChange={e => setForm({ ...form, [f.key]: e.target.value })}>
                      {f.opts.map(o => <option key={o}>{o}</option>)}
                    </select>
                    : <input style={S.formIn} type={f.type} placeholder={f.placeholder}
                      value={form[f.key]} onChange={e => setForm({ ...form, [f.key]: e.target.value })} />
                  }
                </div>
              ))}
              <button style={{ ...S.submitBtn, opacity: saving ? 0.6 : 1 }}
                onClick={handleAdd} disabled={saving}>
                {saving ? "⏳ กำลังบันทึก..." : "✓ บันทึกรายการ"}
              </button>
            </div>
          </div>
        )}

        {/* PROFILE PAGE */}
        {page === "profile" && (
          <div style={S.wrap}>
            <div style={S.pageTitle}>โปรไฟล์</div>
            <div style={S.profCard}>
              <div style={S.profAv}>{USER.avatar}</div>
              <div style={S.profName}>{USER.name}</div>
              {[
                ["ตำแหน่ง", USER.role],
                ["แผนก", USER.dept],
                ["ระบบสิทธิ์", "Employee"],
              ].map(([k, v]) => (
                <div key={k} style={S.profRow}>
                  <span style={S.profKey}>{k}</span>
                  <span style={S.profVal}>{v}</span>
                </div>
              ))}
              <div style={S.profStats}>
                <div style={S.profStat}>
                  <div style={{ ...S.profStatN, color: "#3b82f6" }}>{items.length}</div>
                  <div style={S.profStatL}>ทั้งหมด</div>
                </div>
                <div style={S.profStat}>
                  <div style={{ ...S.profStatN, color: "#10b981" }}>{counts.Received || 0}</div>
                  <div style={S.profStatL}>รับแล้ว</div>
                </div>
                <div style={S.profStat}>
                  <div style={{ ...S.profStatN, color: "#f59e0b" }}>{(counts.Pending || 0) + (counts.Ordered || 0)}</div>
                  <div style={S.profStatL}>รอดำเนินการ</div>
                </div>
              </div>
            </div>
            <div style={S.profBtns}>
              <button style={{ ...S.profNavB, background: "#2563eb" }} onClick={() => setPage("add")}>➕ แจ้งสั่งของใหม่</button>
              <button style={{ ...S.profNavB, background: "#10b981" }} onClick={() => setPage("list")}>📋 ดูรายการทั้งหมด</button>
            </div>
          </div>
        )}
      </main>

      {/* Bottom Nav */}
      <nav style={S.bottomNav}>
        <NavBtn icon="📋" label="รายการ" view="list" />
        <NavBtn icon="➕" label="สั่งใหม่" view="add" />
        <NavBtn icon="👤" label="โปรไฟล์" view="profile" />
      </nav>
    </div>
  );
}
