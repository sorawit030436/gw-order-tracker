import { useState, useEffect } from "react";
import { db, auth } from "./firebase";
import {
  collection, addDoc, getDocs, updateDoc, doc, getDoc, setDoc,
  orderBy, query, serverTimestamp
} from "firebase/firestore";
import {
  signInWithEmailAndPassword, createUserWithEmailAndPassword,
  signOut, onAuthStateChanged
} from "firebase/auth";

const STATUS_CONFIG = {
  "Pending":   { color: "#f59e0b", bg: "#fef3c7", label: "Pending" },
  "Ordered":   { color: "#3b82f6", bg: "#dbeafe", label: "Ordered" },
  "Received":  { color: "#10b981", bg: "#d1fae5", label: "Received" },
  "Cancelled": { color: "#ef4444", bg: "#fee2e2", label: "Cancelled" },
};
const CATEGORIES = ["อุปกรณ์สำนักงาน","อะไหล่เครื่องจักร","เครื่องมือ","อุปกรณ์ความปลอดภัย","อื่นๆ"];
const STATUSES   = ["ทุกสถานะ","Pending","Ordered","Received","Cancelled"];
const DEPARTMENTS = ["Press","Weld","Paint","Assembly","QA","Engineering","Maintenance","อื่นๆ"];

export default function App() {
  // Auth
  const [user, setUser]           = useState(null);
  const [profile, setProfile]     = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Auth form mode: "login" | "register" | "setup"
  const [authMode, setAuthMode]   = useState("login");
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPass, setLoginPass]   = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  // Register form
  const [regEmail, setRegEmail]   = useState("");
  const [regPass, setRegPass]     = useState("");
  const [regPass2, setRegPass2]   = useState("");
  const [regError, setRegError]   = useState("");
  const [regLoading, setRegLoading] = useState(false);

  // Profile setup form
  const [setupName, setSetupName] = useState("");
  const [setupDept, setSetupDept] = useState("Press");
  const [setupRole, setSetupRole] = useState("");
  const [setupLoading, setSetupLoading] = useState(false);

  // App state
  const [page, setPage]           = useState("list");
  const [items, setItems]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [selected, setSelected]   = useState(null);
  const [filterStatus, setFilter] = useState("ทุกสถานะ");
  const [filterCat, setFilterCat] = useState("ทุกประเภท");
  const [search, setSearch]       = useState("");
  const [menuOpen, setMenuOpen]   = useState(false);
  const [form, setForm]           = useState({ category:"อุปกรณ์สำนักงาน", description:"", qty:1, unit:"อัน", note:"" });

  // Profile edit
  const [editMode, setEditMode]   = useState(false);
  const [editName, setEditName]   = useState("");
  const [editDept, setEditDept]   = useState("");
  const [editRole, setEditRole]   = useState("");
  const [editSaving, setEditSaving] = useState(false);

  // ── Auth listener ──────────────────────────────────────────────
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        await loadProfile(u.uid);
        await loadItems();
      }
      setAuthLoading(false);
    });
    return unsub;
  }, []);

  const loadProfile = async (uid) => {
    try {
      const snap = await getDoc(doc(db, "users", uid));
      if (snap.exists()) {
        setProfile(snap.data());
      } else {
        setProfile(null); // trigger setup page
      }
    } catch (e) { console.error(e); }
  };

  // ── Login ──────────────────────────────────────────────────────
  const handleLogin = async () => {
    setLoginError("");
    setLoginLoading(true);
    try {
      await signInWithEmailAndPassword(auth, loginEmail, loginPass);
    } catch (e) {
      setLoginError("Email หรือรหัสผ่านไม่ถูกต้องครับ");
    }
    setLoginLoading(false);
  };

  // ── Register ───────────────────────────────────────────────────
  const handleRegister = async () => {
    setRegError("");
    if (!regEmail || !regPass || !regPass2) { setRegError("กรุณากรอกข้อมูลให้ครบ"); return; }
    if (regPass !== regPass2) { setRegError("รหัสผ่านไม่ตรงกัน"); return; }
    if (regPass.length < 6) { setRegError("รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร"); return; }
    setRegLoading(true);
    try {
      await createUserWithEmailAndPassword(auth, regEmail, regPass);
      // profile will be set in setup step
    } catch (e) {
      if (e.code === "auth/email-already-in-use") setRegError("Email นี้มีผู้ใช้งานแล้ว");
      else setRegError("เกิดข้อผิดพลาด ลองใหม่อีกครั้ง");
    }
    setRegLoading(false);
  };

  // ── Profile Setup (first time) ────────────────────────────────
  const handleSetup = async () => {
    if (!setupName.trim() || !setupRole.trim()) return;
    setSetupLoading(true);
    try {
      const profileData = {
        name: setupName.trim(),
        department: setupDept,
        role: setupRole.trim(),
        email: user.email,
        createdAt: serverTimestamp(),
      };
      await setDoc(doc(db, "users", user.uid), profileData);
      setProfile(profileData);
    } catch (e) { console.error(e); }
    setSetupLoading(false);
  };

  // ── Edit Profile ───────────────────────────────────────────────
  const handleEditSave = async () => {
    setEditSaving(true);
    try {
      const updated = { ...profile, name: editName, department: editDept, role: editRole };
      await updateDoc(doc(db, "users", user.uid), { name: editName, department: editDept, role: editRole });
      setProfile(updated);
      setEditMode(false);
    } catch (e) { console.error(e); }
    setEditSaving(false);
  };

  const handleLogout = async () => {
    await signOut(auth);
    setProfile(null);
    setItems([]);
    setPage("list");
    setMenuOpen(false);
    setAuthMode("login");
  };

  // ── Orders ─────────────────────────────────────────────────────
  const loadItems = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, "orders"), orderBy("createdAt", "desc"));
      const snap = await getDocs(q);
      setItems(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const handleAdd = async () => {
    if (!form.description.trim()) return;
    setSaving(true);
    try {
      await addDoc(collection(db, "orders"), {
        ...form, qty: Number(form.qty), status: "Pending",
        requestedBy: profile?.name || user.email,
        requestedByEmail: user.email,
        department: profile?.department || "-",
        requestDate: new Date().toISOString().slice(0, 10),
        receivedDate: null, createdAt: serverTimestamp(),
      });
      setForm({ category:"อุปกรณ์สำนักงาน", description:"", qty:1, unit:"อัน", note:"" });
      await loadItems();
      setPage("list");
    } catch (e) { console.error(e); }
    setSaving(false);
  };

  const handleStatusChange = async (item, newStatus) => {
    try {
      const updates = { status: newStatus, receivedDate: newStatus==="Received" ? new Date().toISOString().slice(0,10) : item.receivedDate };
      await updateDoc(doc(db, "orders", item.id), updates);
      const updated = { ...item, ...updates };
      setItems(prev => prev.map(i => i.id===item.id ? updated : i));
      setSelected(updated);
    } catch (e) { console.error(e); }
  };

  const handleDelete = async (item) => {
    if (!window.confirm(`ลบรายการ "${item.description}" ใช่ไหมครับ?`)) return;
    try {
      const { deleteDoc } = await import("firebase/firestore");
      await deleteDoc(doc(db, "orders", item.id));
      setItems(prev => prev.filter(i => i.id !== item.id));
      setPage("list");
    } catch (e) { console.error(e); }
  };

  const filtered = items.filter(it => {
    const matchStatus = filterStatus==="ทุกสถานะ" || it.status===filterStatus;
    const matchCat    = filterCat==="ทุกประเภท" || it.category===filterCat;
    const matchSearch = it.description?.toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchCat && matchSearch;
  });
  const counts = Object.fromEntries(Object.keys(STATUS_CONFIG).map(s=>[s,items.filter(i=>i.status===s).length]));
  const userInitial = (profile?.name || user?.email || "?").slice(0,2).toUpperCase();

  // ── Styles ─────────────────────────────────────────────────────
  const S = {
    root:{ fontFamily:"'Sarabun',sans-serif", background:"#f8fafc", minHeight:"100vh", maxWidth:430, margin:"0 auto", display:"flex", flexDirection:"column" },
    authWrap:{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:"linear-gradient(135deg,#1e40af,#3b82f6)", padding:20 },
    authCard:{ background:"#fff", borderRadius:20, padding:32, width:"100%", maxWidth:380, boxShadow:"0 20px 60px rgba(0,0,0,0.2)" },
    authLogo:{ textAlign:"center", fontSize:48, marginBottom:8 },
    authTitle:{ fontSize:22, fontWeight:800, color:"#111827", textAlign:"center", marginBottom:4 },
    authSub:{ fontSize:13, color:"#6b7280", textAlign:"center", marginBottom:24 },
    label:{ fontSize:13, color:"#374151", fontWeight:600, marginBottom:5, display:"block" },
    input:{ width:"100%", padding:"11px 14px", borderRadius:10, border:"1.5px solid #e5e7eb", fontSize:14, fontFamily:"inherit", marginBottom:12, boxSizing:"border-box" },
    selectInput:{ width:"100%", padding:"11px 14px", borderRadius:10, border:"1.5px solid #e5e7eb", fontSize:14, fontFamily:"inherit", marginBottom:12, boxSizing:"border-box", background:"#fff" },
    primaryBtn:{ width:"100%", padding:13, background:"#2563eb", color:"#fff", border:"none", borderRadius:10, fontSize:15, fontWeight:700, cursor:"pointer", fontFamily:"inherit" },
    secondaryBtn:{ width:"100%", padding:11, background:"#f3f4f6", color:"#374151", border:"none", borderRadius:10, fontSize:14, fontWeight:600, cursor:"pointer", fontFamily:"inherit", marginTop:10 },
    errorTxt:{ color:"#ef4444", fontSize:13, textAlign:"center", marginBottom:10 },
    switchTxt:{ textAlign:"center", fontSize:13, color:"#6b7280", marginTop:16 },
    switchLink:{ color:"#2563eb", fontWeight:700, cursor:"pointer", textDecoration:"underline" },
    header:{ background:"#fff", padding:"12px 16px", display:"flex", alignItems:"center", gap:12, borderBottom:"1px solid #e5e7eb", position:"sticky", top:0, zIndex:100, boxShadow:"0 1px 4px rgba(0,0,0,0.06)" },
    menuBtn:{ background:"none", border:"none", cursor:"pointer", fontSize:20, color:"#374151", padding:4 },
    hTitle:{ flex:1 },
    hMain:{ fontWeight:700, fontSize:15, color:"#111827", lineHeight:1.2, display:"block" },
    hSub:{ fontSize:11, color:"#9ca3af" },
    avatar:{ width:34, height:34, borderRadius:"50%", background:"#2563eb", color:"#fff", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:700, fontSize:12, cursor:"pointer" },
    overlay:{ position:"fixed", inset:0, background:"rgba(0,0,0,0.3)", zIndex:200 },
    panel:{ width:260, background:"#fff", height:"100%", padding:20, display:"flex", flexDirection:"column", gap:4 },
    panelHead:{ display:"flex", alignItems:"center", gap:12, padding:"12px 0 20px", borderBottom:"1px solid #f3f4f6", marginBottom:8 },
    panelAv:{ width:44, height:44, borderRadius:"50%", background:"#2563eb", color:"#fff", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:700, fontSize:14 },
    panelName:{ fontWeight:700, fontSize:13, color:"#111827" },
    panelRole:{ fontSize:11, color:"#6b7280", marginTop:2 },
    menuItem:{ padding:"11px 14px", borderRadius:10, border:"none", background:"none", textAlign:"left", fontSize:14, cursor:"pointer", color:"#374151", fontFamily:"inherit" },
    menuActive:{ background:"#eff6ff", color:"#2563eb", fontWeight:600 },
    menuLogout:{ padding:"11px 14px", borderRadius:10, border:"none", background:"none", textAlign:"left", fontSize:14, cursor:"pointer", color:"#ef4444", fontFamily:"inherit", marginTop:"auto" },
    main:{ flex:1, overflowY:"auto", paddingBottom:80 },
    wrap:{ padding:"16px 16px 0" },
    pageTitle:{ fontSize:20, fontWeight:700, color:"#111827", marginBottom:16 },
    backBtn:{ background:"none", border:"none", color:"#2563eb", fontSize:14, cursor:"pointer", padding:"0 0 12px", fontFamily:"inherit" },
    sumRow:{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr", gap:8, marginBottom:14 },
    sumCard:{ background:"#fff", borderRadius:10, padding:"10px 6px", textAlign:"center", cursor:"pointer", boxShadow:"0 1px 3px rgba(0,0,0,0.06)" },
    sumNum:{ fontSize:22, fontWeight:800, lineHeight:1 },
    sumLabel:{ fontSize:10, color:"#6b7280", marginTop:2 },
    filterRow:{ display:"flex", gap:8, marginBottom:8 },
    select:{ flex:1, padding:"8px 10px", borderRadius:8, border:"1.5px solid #e5e7eb", fontSize:13, background:"#fff", color:"#374151", fontFamily:"inherit" },
    searchRow:{ position:"relative", marginBottom:14 },
    searchIn:{ width:"100%", padding:"9px 36px 9px 12px", borderRadius:8, border:"1.5px solid #e5e7eb", fontSize:13, background:"#fff", boxSizing:"border-box", fontFamily:"inherit" },
    clearBtn:{ position:"absolute", right:10, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", color:"#9ca3af", cursor:"pointer", fontSize:14 },
    listWrap:{ display:"flex", flexDirection:"column", gap:10 },
    empty:{ textAlign:"center", color:"#9ca3af", padding:40, fontSize:14 },
    card:{ background:"#fff", borderRadius:12, padding:14, boxShadow:"0 1px 4px rgba(0,0,0,0.07)" },
    cardTop:{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:8 },
    cardId:{ fontSize:11, color:"#9ca3af", marginBottom:2 },
    cardDesc:{ fontSize:14, fontWeight:600, color:"#111827", lineHeight:1.3 },
    cardMeta:{ fontSize:12, color:"#6b7280", marginTop:3 },
    cardRight:{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:6 },
    badge:{ fontSize:11, fontWeight:700, padding:"3px 9px", borderRadius:20, whiteSpace:"nowrap" },
    detailBtn:{ background:"#eff6ff", color:"#2563eb", border:"none", borderRadius:8, padding:"6px 10px", fontSize:12, cursor:"pointer", whiteSpace:"nowrap", fontFamily:"inherit" },
    dateRow:{ display:"flex", gap:14, marginTop:8, paddingTop:8, borderTop:"1px solid #f9fafb" },
    dateText:{ fontSize:11, color:"#9ca3af" },
    fab:{ position:"fixed", bottom:90, right:"calc(50% - 215px + 20px)", width:52, height:52, borderRadius:"50%", background:"#2563eb", color:"#fff", border:"none", fontSize:26, cursor:"pointer", boxShadow:"0 4px 14px rgba(37,99,235,0.4)", zIndex:50 },
    detCard:{ background:"#fff", borderRadius:16, padding:20, boxShadow:"0 1px 6px rgba(0,0,0,0.08)" },
    detHead:{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8 },
    detId:{ fontSize:13, color:"#9ca3af" },
    detDesc:{ fontSize:18, fontWeight:700, color:"#111827", marginBottom:18, lineHeight:1.4 },
    detRow:{ display:"flex", justifyContent:"space-between", padding:"9px 0", borderBottom:"1px solid #f3f4f6" },
    detKey:{ fontSize:13, color:"#6b7280" },
    detVal:{ fontSize:13, color:"#111827", fontWeight:500, maxWidth:"55%", textAlign:"right" },
    statActs:{ marginTop:20 },
    statLabel:{ fontSize:12, color:"#6b7280", marginBottom:10 },
    statBtns:{ display:"flex", flexWrap:"wrap", gap:8 },
    statBtn:{ padding:"7px 14px", borderRadius:20, fontSize:12, cursor:"pointer", fontFamily:"inherit", fontWeight:600 },
    formCard:{ background:"#fff", borderRadius:16, padding:20, boxShadow:"0 1px 6px rgba(0,0,0,0.08)", display:"flex", flexDirection:"column", gap:14 },
    formGrp:{ display:"flex", flexDirection:"column", gap:5 },
    formLbl:{ fontSize:13, color:"#374151", fontWeight:600 },
    formIn:{ padding:"10px 12px", borderRadius:8, border:"1.5px solid #e5e7eb", fontSize:13, fontFamily:"inherit", color:"#111827" },
    submitBtn:{ background:"#2563eb", color:"#fff", border:"none", borderRadius:10, padding:13, fontSize:15, fontWeight:700, cursor:"pointer", fontFamily:"inherit", marginTop:4 },
    profCard:{ background:"#fff", borderRadius:16, padding:24, boxShadow:"0 1px 6px rgba(0,0,0,0.08)", display:"flex", flexDirection:"column", alignItems:"center", marginBottom:16 },
    profAv:{ width:80, height:80, borderRadius:"50%", background:"#2563eb", color:"#fff", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:700, fontSize:26, marginBottom:12 },
    profName:{ fontSize:18, fontWeight:800, color:"#111827", marginBottom:4 },
    profSub:{ fontSize:13, color:"#6b7280", marginBottom:16 },
    profRow:{ display:"flex", justifyContent:"space-between", width:"100%", padding:"9px 0", borderBottom:"1px solid #f3f4f6" },
    profKey:{ fontSize:13, color:"#6b7280" },
    profVal:{ fontSize:13, color:"#111827", fontWeight:600 },
    profStats:{ display:"flex", gap:20, marginTop:20 },
    profStat:{ textAlign:"center" },
    profStatN:{ fontSize:24, fontWeight:800 },
    profStatL:{ fontSize:11, color:"#6b7280", marginTop:2 },
    editBtn:{ background:"#eff6ff", color:"#2563eb", border:"none", borderRadius:10, padding:"9px 20px", fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"inherit", marginTop:16 },
    logoutBtn:{ width:"100%", padding:13, background:"#fee2e2", color:"#ef4444", border:"none", borderRadius:12, fontWeight:700, fontSize:14, cursor:"pointer", fontFamily:"inherit", marginTop:10 },
    deleteBtn:{ width:"100%", padding:12, background:"#fee2e2", color:"#ef4444", border:"none", borderRadius:10, fontWeight:700, fontSize:14, cursor:"pointer", fontFamily:"inherit", marginTop:16 },
    bottomNav:{ position:"fixed", bottom:0, left:"50%", transform:"translateX(-50%)", width:"100%", maxWidth:430, background:"#fff", borderTop:"1px solid #e5e7eb", display:"flex", zIndex:100 },
    navItem:{ flex:1, padding:"10px 0", display:"flex", flexDirection:"column", alignItems:"center", gap:2, background:"none", border:"none", cursor:"pointer" },
    navActive:{ background:"#eff6ff" },
    navIcon:{ fontSize:18 },
    navLabel:{ fontSize:10, color:"#9ca3af", fontFamily:"'Sarabun',sans-serif" },
    loadingBox:{ display:"flex", alignItems:"center", justifyContent:"center", height:200, color:"#9ca3af", fontSize:14 },
  };

  // ── Loading ────────────────────────────────────────────────────
  if (authLoading) return (
    <div style={S.authWrap}><div style={{color:"#fff",fontSize:16}}>⏳ กำลังโหลด...</div></div>
  );

  // ── Login Page ─────────────────────────────────────────────────
  if (!user) return (
    <div style={S.authWrap}>
      <div style={S.authCard}>
        <div style={S.authLogo}>🏭</div>
        <div style={S.authTitle}>G/W Press Shop</div>
        <div style={S.authSub}>{authMode==="login" ? "เข้าสู่ระบบ" : "สมัครสมาชิก"}</div>

        {authMode==="login" ? (
          <>
            <label style={S.label}>Email</label>
            <input style={S.input} type="email" placeholder="email@example.com"
              value={loginEmail} onChange={e=>setLoginEmail(e.target.value)}
              onKeyDown={e=>e.key==="Enter"&&handleLogin()} />
            <label style={S.label}>รหัสผ่าน</label>
            <input style={S.input} type="password" placeholder="••••••••"
              value={loginPass} onChange={e=>setLoginPass(e.target.value)}
              onKeyDown={e=>e.key==="Enter"&&handleLogin()} />
            {loginError && <div style={S.errorTxt}>{loginError}</div>}
            <button style={{...S.primaryBtn,opacity:loginLoading?0.6:1}} onClick={handleLogin} disabled={loginLoading}>
              {loginLoading?"⏳ กำลังเข้าสู่ระบบ...":"เข้าสู่ระบบ"}
            </button>
            <div style={S.switchTxt}>ยังไม่มีบัญชี? <span style={S.switchLink} onClick={()=>{setAuthMode("register");setLoginError("");}}>สมัครสมาชิก</span></div>
          </>
        ) : (
          <>
            <label style={S.label}>Email</label>
            <input style={S.input} type="email" placeholder="email@example.com"
              value={regEmail} onChange={e=>setRegEmail(e.target.value)} />
            <label style={S.label}>รหัสผ่าน</label>
            <input style={S.input} type="password" placeholder="อย่างน้อย 6 ตัวอักษร"
              value={regPass} onChange={e=>setRegPass(e.target.value)} />
            <label style={S.label}>ยืนยันรหัสผ่าน</label>
            <input style={S.input} type="password" placeholder="••••••••"
              value={regPass2} onChange={e=>setRegPass2(e.target.value)} />
            {regError && <div style={S.errorTxt}>{regError}</div>}
            <button style={{...S.primaryBtn,opacity:regLoading?0.6:1}} onClick={handleRegister} disabled={regLoading}>
              {regLoading?"⏳ กำลังสมัคร...":"สมัครสมาชิก"}
            </button>
            <div style={S.switchTxt}>มีบัญชีแล้ว? <span style={S.switchLink} onClick={()=>{setAuthMode("login");setRegError("");}}>เข้าสู่ระบบ</span></div>
          </>
        )}
      </div>
    </div>
  );

  // ── Profile Setup (first time after register) ──────────────────
  if (user && !profile) return (
    <div style={S.authWrap}>
      <div style={S.authCard}>
        <div style={S.authLogo}>👤</div>
        <div style={S.authTitle}>ตั้งค่าโปรไฟล์</div>
        <div style={S.authSub}>กรอกข้อมูลของคุณเพื่อเริ่มใช้งาน</div>
        <label style={S.label}>ชื่อ - นามสกุล *</label>
        <input style={S.input} type="text" placeholder="เช่น สมชาย ใจดี"
          value={setupName} onChange={e=>setSetupName(e.target.value)} />
        <label style={S.label}>แผนก *</label>
        <select style={S.selectInput} value={setupDept} onChange={e=>setSetupDept(e.target.value)}>
          {DEPARTMENTS.map(d=><option key={d}>{d}</option>)}
        </select>
        <label style={S.label}>ตำแหน่ง *</label>
        <input style={S.input} type="text" placeholder="เช่น QA Engineer, Technician"
          value={setupRole} onChange={e=>setSetupRole(e.target.value)} />
        <button style={{...S.primaryBtn,opacity:(setupLoading||!setupName||!setupRole)?0.6:1}}
          onClick={handleSetup} disabled={setupLoading||!setupName||!setupRole}>
          {setupLoading?"⏳ กำลังบันทึก...":"✓ เริ่มใช้งาน"}
        </button>
        <button style={S.secondaryBtn} onClick={handleLogout}>ออกจากระบบ</button>
      </div>
    </div>
  );

  // ── Main App ───────────────────────────────────────────────────
  const NavBtn = ({icon,label,view}) => (
    <button style={{...S.navItem,...(page===view||(page==="detail"&&view==="list")?S.navActive:{})}} onClick={()=>setPage(view)}>
      <span style={S.navIcon}>{icon}</span>
      <span style={S.navLabel}>{label}</span>
    </button>
  );

  return (
    <div style={S.root}>
      <header style={S.header}>
        <button style={S.menuBtn} onClick={()=>setMenuOpen(!menuOpen)}>☰</button>
        <div style={S.hTitle}>
          <span style={S.hMain}>G/W Press Shop</span>
          <span style={S.hSub}>Order Tracking</span>
        </div>
        <div style={S.avatar} onClick={()=>{setPage("profile");setMenuOpen(false);}}>{userInitial}</div>
      </header>

      {menuOpen && (
        <div style={S.overlay} onClick={()=>setMenuOpen(false)}>
          <div style={S.panel} onClick={e=>e.stopPropagation()}>
            <div style={S.panelHead}>
              <div style={S.panelAv}>{userInitial}</div>
              <div>
                <div style={S.panelName}>{profile?.name}</div>
                <div style={S.panelRole}>{profile?.role} · {profile?.department}</div>
              </div>
            </div>
            {[{label:"📋 รายการสั่งซื้อ",view:"list"},{label:"➕ แจ้งสั่งของใหม่",view:"add"},{label:"👤 โปรไฟล์",view:"profile"}].map(m=>(
              <button key={m.view} style={{...S.menuItem,...(page===m.view?S.menuActive:{})}} onClick={()=>{setPage(m.view);setMenuOpen(false);}}>{m.label}</button>
            ))}
            <button style={S.menuLogout} onClick={handleLogout}>🚪 ออกจากระบบ</button>
          </div>
        </div>
      )}

      <main style={S.main}>

        {/* LIST */}
        {page==="list" && (
          <div style={S.wrap}>
            <div style={S.pageTitle}>รายการสั่งซื้อ</div>
            <div style={S.sumRow}>
              {Object.entries(STATUS_CONFIG).map(([k,v])=>(
                <div key={k} style={{...S.sumCard,borderTop:`3px solid ${v.color}`}} onClick={()=>setFilter(k===filterStatus?"ทุกสถานะ":k)}>
                  <div style={{...S.sumNum,color:v.color}}>{counts[k]||0}</div>
                  <div style={S.sumLabel}>{v.label}</div>
                </div>
              ))}
            </div>
            <div style={S.filterRow}>
              <select style={S.select} value={filterStatus} onChange={e=>setFilter(e.target.value)}>{STATUSES.map(s=><option key={s}>{s}</option>)}</select>
              <select style={S.select} value={filterCat} onChange={e=>setFilterCat(e.target.value)}>{["ทุกประเภท",...CATEGORIES].map(c=><option key={c}>{c}</option>)}</select>
            </div>
            <div style={S.searchRow}>
              <input style={S.searchIn} placeholder="ค้นหารายการ..." value={search} onChange={e=>setSearch(e.target.value)} />
              {search && <button style={S.clearBtn} onClick={()=>setSearch("")}>✕</button>}
            </div>
            {loading ? <div style={S.loadingBox}>⏳ กำลังโหลด...</div> : (
              <div style={S.listWrap}>
                {filtered.length===0 && <div style={S.empty}>ไม่พบรายการ</div>}
                {filtered.map(item=>{
                  const sc=STATUS_CONFIG[item.status]||STATUS_CONFIG["Pending"];
                  return (
                    <div key={item.id} style={S.card}>
                      <div style={S.cardTop}>
                        <div style={{flex:1}}>
                          <div style={S.cardId}>#{item.id?.slice(-6).toUpperCase()}</div>
                          <div style={S.cardDesc}>{item.description}</div>
                          <div style={S.cardMeta}>{item.category} · {item.qty} {item.unit}</div>
                        </div>
                        <div style={S.cardRight}>
                          <span style={{...S.badge,color:sc.color,background:sc.bg}}>{sc.label}</span>
                          <button style={S.detailBtn} onClick={()=>{setSelected(item);setPage("detail");}}>ดูรายละเอียด</button>
                        </div>
                      </div>
                      <div style={S.dateRow}>
                        <span style={S.dateText}>📅 {item.requestDate}</span>
                        {item.receivedDate && <span style={S.dateText}>✅ {item.receivedDate}</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <button style={S.fab} onClick={()=>setPage("add")}>+</button>
          </div>
        )}

        {/* DETAIL */}
        {page==="detail" && selected && (()=>{
          const sc=STATUS_CONFIG[selected.status]||STATUS_CONFIG["Pending"];
          return (
            <div style={S.wrap}>
              <button style={S.backBtn} onClick={()=>setPage("list")}>← กลับ</button>
              <div style={S.pageTitle}>รายละเอียดรายการ</div>
              <div style={S.detCard}>
                <div style={S.detHead}>
                  <span style={S.detId}>#{selected.id?.slice(-6).toUpperCase()}</span>
                  <span style={{...S.badge,color:sc.color,background:sc.bg,fontSize:13}}>{sc.label}</span>
                </div>
                <div style={S.detDesc}>{selected.description}</div>
                {[["ประเภท",selected.category],["จำนวน",`${selected.qty} ${selected.unit}`],["ผู้สั่ง",selected.requestedBy],["แผนก",selected.department||"-"],["วันที่สั่ง",selected.requestDate],["วันที่รับ",selected.receivedDate||"-"],["หมายเหตุ",selected.note||"-"]].map(([k,v])=>(
                  <div key={k} style={S.detRow}><span style={S.detKey}>{k}</span><span style={S.detVal}>{v}</span></div>
                ))}
                <div style={S.statActs}>
                  <div style={S.statLabel}>อัปเดตสถานะ</div>
                  <div style={S.statBtns}>
                    {Object.entries(STATUS_CONFIG).map(([s,cfg])=>(
                      <button key={s} style={{...S.statBtn,background:selected.status===s?cfg.color:"#f3f4f6",color:selected.status===s?"#fff":"#6b7280",border:`1.5px solid ${cfg.color}`}}
                        onClick={()=>handleStatusChange(selected,s)}>{cfg.label}</button>
                    ))}
                  </div>
                </div>
                <button style={S.deleteBtn} onClick={()=>handleDelete(selected)}>🗑️ ลบรายการนี้</button>
              </div>
            </div>
          );
        })()}

        {page==="add" && (
          <div style={S.wrap}>
            <button style={S.backBtn} onClick={()=>setPage("list")}>← กลับ</button>
            <div style={S.pageTitle}>แจ้งสั่งของใหม่</div>
            <div style={S.formCard}>
              {[{label:"ประเภทสินค้า",key:"category",type:"select",opts:CATEGORIES},{label:"รายละเอียดสินค้า",key:"description",type:"text",placeholder:"เช่น กระดาษ A4..."},{label:"จำนวน",key:"qty",type:"number",placeholder:"1"},{label:"หน่วย",key:"unit",type:"text",placeholder:"อัน / ชิ้น / รีม..."},{label:"หมายเหตุ",key:"note",type:"text",placeholder:"ข้อมูลเพิ่มเติม (ถ้ามี)"}].map(f=>(
                <div key={f.key} style={S.formGrp}>
                  <label style={S.formLbl}>{f.label}</label>
                  {f.type==="select"
                    ?<select style={S.formIn} value={form[f.key]} onChange={e=>setForm({...form,[f.key]:e.target.value})}>{f.opts.map(o=><option key={o}>{o}</option>)}</select>
                    :<input style={S.formIn} type={f.type} placeholder={f.placeholder} value={form[f.key]} onChange={e=>setForm({...form,[f.key]:e.target.value})} />
                  }
                </div>
              ))}
              <button style={{...S.submitBtn,opacity:saving?0.6:1}} onClick={handleAdd} disabled={saving}>
                {saving?"⏳ กำลังบันทึก...":"✓ บันทึกรายการ"}
              </button>
            </div>
          </div>
        )}

        {/* PROFILE */}
        {page==="profile" && (
          <div style={S.wrap}>
            <div style={S.pageTitle}>โปรไฟล์</div>
            <div style={S.profCard}>
              <div style={S.profAv}>{userInitial}</div>
              <div style={S.profName}>{profile?.name}</div>
              <div style={S.profSub}>{profile?.role} · {profile?.department}</div>

              {!editMode ? (
                <>
                  {[["Email",user.email],["ตำแหน่ง",profile?.role],["แผนก",profile?.department]].map(([k,v])=>(
                    <div key={k} style={S.profRow}><span style={S.profKey}>{k}</span><span style={S.profVal}>{v}</span></div>
                  ))}
                  <div style={S.profStats}>
                    <div style={S.profStat}><div style={{...S.profStatN,color:"#3b82f6"}}>{items.length}</div><div style={S.profStatL}>ทั้งหมด</div></div>
                    <div style={S.profStat}><div style={{...S.profStatN,color:"#10b981"}}>{counts.Received||0}</div><div style={S.profStatL}>รับแล้ว</div></div>
                    <div style={S.profStat}><div style={{...S.profStatN,color:"#f59e0b"}}>{(counts.Pending||0)+(counts.Ordered||0)}</div><div style={S.profStatL}>รอดำเนินการ</div></div>
                  </div>
                  <button style={S.editBtn} onClick={()=>{setEditName(profile?.name);setEditDept(profile?.department);setEditRole(profile?.role);setEditMode(true);}}>✏️ แก้ไขโปรไฟล์</button>
                </>
              ) : (
                <>
                  <div style={{width:"100%",marginTop:8}}>
                    <label style={{...S.label,marginBottom:6}}>ชื่อ - นามสกุล</label>
                    <input style={{...S.formIn,marginBottom:10,width:"100%",boxSizing:"border-box"}} value={editName} onChange={e=>setEditName(e.target.value)} />
                    <label style={{...S.label,marginBottom:6}}>แผนก</label>
                    <select style={{...S.formIn,marginBottom:10,width:"100%",boxSizing:"border-box"}} value={editDept} onChange={e=>setEditDept(e.target.value)}>
                      {DEPARTMENTS.map(d=><option key={d}>{d}</option>)}
                    </select>
                    <label style={{...S.label,marginBottom:6}}>ตำแหน่ง</label>
                    <input style={{...S.formIn,marginBottom:10,width:"100%",boxSizing:"border-box"}} value={editRole} onChange={e=>setEditRole(e.target.value)} />
                    <div style={{display:"flex",gap:8,marginTop:4}}>
                      <button style={{...S.submitBtn,flex:1,opacity:editSaving?0.6:1}} onClick={handleEditSave} disabled={editSaving}>{editSaving?"⏳ บันทึก...":"✓ บันทึก"}</button>
                      <button style={{flex:1,padding:13,background:"#f3f4f6",color:"#374151",border:"none",borderRadius:10,fontSize:14,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}} onClick={()=>setEditMode(false)}>ยกเลิก</button>
                    </div>
                  </div>
                </>
              )}
            </div>
            <button style={S.logoutBtn} onClick={handleLogout}>🚪 ออกจากระบบ</button>
          </div>
        )}
      </main>

      <nav style={S.bottomNav}>
        <NavBtn icon="📋" label="รายการ" view="list" />
        <NavBtn icon="➕" label="สั่งใหม่" view="add" />
        <NavBtn icon="👤" label="โปรไฟล์" view="profile" />
      </nav>
    </div>
  );
}
