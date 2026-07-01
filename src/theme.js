// ─────────────────────────────────────────────────────────────────────────────
//  Thème H€CTOR : couleurs, styles globaux (CSS) et catalogue de styles (S).
//  Extrait de App.jsx (refactorisation) : contenu identique, simplement déplacé
//  et rendu importable. Utilisé partout dans l'application.
// ─────────────────────────────────────────────────────────────────────────────

export const INK = "#0A2540";
export const ACCENT = "#378ADD";
export const PAPER = "#F0F4F8";

export const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap');
  @keyframes pulse { 0%,100% { box-shadow: 0 0 0 0 rgba(224,83,61,0.5); } 50% { box-shadow: 0 0 0 6px rgba(224,83,61,0); } }
  @keyframes fadeInDown { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes shrink { from { width: 100%; } to { width: 0%; } }
  /* ─── Vie d'Hector (cockpit intermittent) ─── */
  @keyframes hectorBreathe { 0%,100% { transform: scale(1) translateY(0); } 50% { transform: scale(1.012) translateY(-3px); } }
  @keyframes hectorHalo { 0%,100% { opacity: 0.4; transform: scale(1); } 50% { opacity: 0.7; transform: scale(1.06); } }
  @keyframes hectorPop { 0% { transform: scale(1); } 30% { transform: scale(1.06) rotate(-1deg); } 60% { transform: scale(0.98) rotate(1deg); } 100% { transform: scale(1); } }
  @keyframes celebrIn { from { opacity: 0; } to { opacity: 1; } }
  @keyframes celebrCard { 0% { opacity: 0; transform: scale(0.8) translateY(20px); } 60% { transform: scale(1.04) translateY(0); } 100% { opacity: 1; transform: scale(1) translateY(0); } }
  @keyframes confettiFall { 0% { opacity: 1; transform: translateY(-10vh) rotate(0deg); } 100% { opacity: 0; transform: translateY(85vh) rotate(540deg); } }
  @keyframes tailWag { 0%,100% { transform: rotate(0deg); } 25% { transform: rotate(8deg); } 75% { transform: rotate(-8deg); } }
  .hector-breathe { animation: hectorBreathe 5.5s ease-in-out infinite; }
  .hector-pop { animation: hectorPop 0.6s ease; }
  .analyse-step { opacity: 0; animation: analyseStepIn 0.3s ease forwards; }
  @keyframes analyseStepIn { from { opacity: 0; transform: translateX(-6px); } to { opacity: 1; transform: translateX(0); } }
  /* Pastille "En ligne" : ping GPU (scale+opacity) à la place d'un box-shadow animé (repaint permanent). */
  @keyframes hectorPing { 0%,100% { transform: scale(1); opacity: 0.5; } 50% { transform: scale(2.7); opacity: 0; } }
  .hector-ping { position: relative; display: inline-block; }
  .hector-ping::before { content: ""; position: absolute; inset: 0; border-radius: 50%; background: rgba(224,83,61,1); animation: hectorPing 2s ease-in-out infinite; pointer-events: none; }
  .hector-ping::after { content: ""; position: absolute; inset: 0; border-radius: 50%; background: #5DCAA5; }
  @media (prefers-reduced-motion: reduce) {
    .hector-breathe, .hector-pop, .hector-ping::before { animation: none !important; }
  }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: 'Inter', system-ui, sans-serif; background: ${PAPER}; }
  button { font-family: inherit; }
  input[type=number]::-webkit-inner-spin-button, input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
  input[type=number] { -moz-appearance: textfield; }
  input, select, textarea, button { transition: border-color 0.15s, background 0.15s, transform 0.1s; }
  input:focus, select:focus, textarea:focus { border-color: #378ADD !important; box-shadow: 0 0 0 3px rgba(55,138,221,0.12); }
  button:active { transform: scale(0.98); }
`;

export const S = {
  authPage: { display: "flex", flexDirection: "column", minHeight: "100vh", background: INK },
  authLeft: { padding: "48px 24px 32px", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", maxWidth: 640, margin: "0 auto", width: "100%" },
  authHero: { fontFamily: "Georgia, serif", fontSize: 32, fontWeight: 700, color: "white", margin: "24px 0 12px", lineHeight: 1.2 },
  authSub: { fontSize: 14, color: "#8BA5C0", lineHeight: 1.5, margin: "0 0 24px" },
  authFeatures: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 },
  authFeatureCard: { display: "flex", alignItems: "flex-start", gap: 10, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "12px 14px" },
  authFeatureTitle: { fontSize: 12, fontWeight: 600, color: "white", lineHeight: 1.3 },
  authFeatureDesc: { fontSize: 11, color: "#8BA5C0", lineHeight: 1.4, marginTop: 3 },
  simWidget: { marginTop: 36, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 14, padding: 18 },
  simInput: { flex: 1, fontFamily: "inherit", fontSize: 14, padding: "10px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.15)", outline: "none", background: "rgba(255,255,255,0.08)", color: "white" },
  simSelect: { flex: 1, fontFamily: "inherit", fontSize: 13, padding: "10px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.15)", outline: "none", background: "rgba(255,255,255,0.08)", color: "white" },
  authRight: { width: "100%", maxWidth: 460, margin: "0 auto", background: PAPER, display: "flex", alignItems: "center", justifyContent: "center", padding: "32px 20px 48px", borderRadius: "20px 20px 0 0" },
  authCard: { width: "100%", background: "white", borderRadius: 16, border: "0.5px solid #DDE5EE", padding: 32 },
  authTitle: { fontSize: 20, fontWeight: 600, color: INK, margin: "0 0 20px" },
  appWrap: { display: "flex", minHeight: "100vh", background: PAPER },
  mobileTopbar: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", background: INK, position: "fixed", top: 0, left: 0, right: 0, zIndex: 90, height: 56 },
  sidebarBackdrop: { position: "fixed", inset: 0, background: "rgba(10,37,64,0.5)", zIndex: 75 },
  sidebar: { width: 220, background: INK, display: "flex", flexDirection: "column", padding: "20px 0", flexShrink: 0, transition: "width 0.2s" },
  sidebarClosed: { width: 64 },
  sidebarTop: { padding: "0 16px 24px", display: "flex", justifyContent: "center" },
  sidebarBottom: { marginTop: "auto", borderTop: "1px solid rgba(255,255,255,0.08)", padding: "16px 0 0" },
  navItem: { display: "flex", alignItems: "center", gap: 10, padding: "10px 18px", fontSize: 13, color: "#8BA5C0", cursor: "pointer", background: "none", border: "none", width: "100%", textAlign: "left", borderLeft: "3px solid transparent" },
  navItemActive: { color: "white", background: "rgba(255,255,255,0.06)", borderLeft: `3px solid ${ACCENT}` },
  navLabel: { whiteSpace: "nowrap" },
  userRow: { display: "flex", alignItems: "center", gap: 10, padding: "10px 18px" },
  avatar: { width: 30, height: 30, borderRadius: "50%", background: ACCENT, display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: 11, fontWeight: 600, flexShrink: 0 },
  mainContent: { flex: 1, padding: "28px 32px", overflowY: "auto" },
  pageHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 },
  pageTitle: { fontSize: 22, fontWeight: 600, color: "white", margin: 0 },
  pageSub: { fontSize: 13, color: "#8BA5C0", margin: "4px 0 0" },
  kpiGrid: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 20 },
  kpiCard: { background: "#0d1f38", borderRadius: 12, border: "1px solid rgba(255,255,255,0.08)", padding: "16px 18px", display: "flex", flexDirection: "column", gap: 4 },
  kpiLabel: { fontSize: 11, color: "#8BA5C0", textTransform: "uppercase", letterSpacing: 0.5 },
  kpiValue: { fontSize: 24, fontWeight: 600, color: "white", fontVariantNumeric: "tabular-nums" },
  kpiSub: { fontSize: 11, color: "#8BA5C0" },
  row2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 },
  card: { background: "#0d1f38", borderRadius: 12, border: "1px solid rgba(255,255,255,0.08)", padding: "18px 20px", marginBottom: 0 },
  cardTitle: { fontSize: 14, fontWeight: 500, color: "white", marginBottom: 14, display: "flex", justifyContent: "space-between", alignItems: "center" },
  cardSub: { fontSize: 12, color: "#8BA5C0", fontWeight: 400 },
  monthRow: { display: "flex", alignItems: "center", gap: 8, padding: "5px 0", borderBottom: "0.5px solid #F0F4F8" },
  monthName: { fontSize: 11, color: "#6B7A8D", width: 28, flexShrink: 0 },
  barTrack: { flex: 1, height: 6, background: "#EEF2F7", borderRadius: 3, overflow: "hidden" },
  barFill: { height: "100%", borderRadius: 3, background: ACCENT },
  monthAmt: { fontSize: 12, color: INK, width: 72, textAlign: "right", fontVariantNumeric: "tabular-nums" },
  monthUrssaf: { fontSize: 11, color: "#854F0B", width: 68, textAlign: "right" },
  progressTrack: { height: 8, background: "#EEF2F7", borderRadius: 4, overflow: "hidden", margin: "8px 0 6px" },
  progressFill: { height: "100%", borderRadius: 4, background: ACCENT },
  newsItem: { padding: "8px 0", borderBottom: "0.5px solid #EEF2F7" },
  newsSource: { fontSize: 10, color: "#0F6E56", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, display: "block" },
  newsTitle: { fontSize: 12, color: INK, marginTop: 2, display: "block", textDecoration: "none", lineHeight: 1.4 },
  newsDate: { fontSize: 11, color: "#8BA5C0", display: "block", marginTop: 2 },
  urssafLink: { fontSize: 12, color: ACCENT, textDecoration: "none", display: "block", marginTop: 10 },
  alertChip: { background: "#FAEEDA", color: "#633806", fontSize: 11, fontWeight: 500, padding: "4px 10px", borderRadius: 20, display: "flex", alignItems: "center", gap: 5 },
  conseilItem: { display: "flex", gap: 12, padding: "10px 0", borderBottom: "0.5px solid #EEF2F7" },
  conseilIcon: { width: 30, height: 30, borderRadius: 8, background: "#E6F1FB", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: "#0C447C" },
  aiMsg: { maxWidth: "70%", padding: "10px 14px", borderRadius: 12, fontSize: 13, lineHeight: 1.5 },
  aiMsgBot: { background: "#F0F4F8", color: INK, borderRadius: "4px 12px 12px 12px" },
  aiMsgUser: { background: ACCENT, color: "white", borderRadius: "12px 4px 12px 12px" },
  incomeRow: { display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: "0.5px solid #EEF2F7" },
  incomeAmt: { display: "block", fontSize: 14, fontWeight: 500, color: INK, fontVariantNumeric: "tabular-nums" },
  incomeMeta: { display: "block", fontSize: 12, color: "#6B7A8D", marginTop: 2 },
  badge: { fontSize: 10, fontWeight: 600, padding: "3px 8px", borderRadius: 6, whiteSpace: "nowrap" },
  badgeGreen: { background: "#E1F5EE", color: "#0F6E56" },
  badgeGray: { background: "#F1F2EE", color: "#5B6573" },
  badgeBlue: { background: "#E6F1FB", color: "#0C447C" },
  badgeOrange: { background: "#FAEEDA", color: "#633806" },
  deleteBtn: { background: "none", border: "none", color: "#B0B6A8", cursor: "pointer", fontSize: 14, padding: 4 },
  netPreview: { background: "#F7F9F5", border: "1px solid #DDE5EE", borderRadius: 8, padding: "10px 14px", display: "flex", flexDirection: "column", gap: 6 },
  netRow: { display: "flex", justifyContent: "space-between", fontSize: 13, color: "#5B6573" },
  factureHeaderRow: { display: "flex", gap: 8, marginBottom: 6, paddingBottom: 6, borderBottom: "0.5px solid #DDE5EE" },
  factureRow: { display: "flex", gap: 8, marginBottom: 8, alignItems: "center" },
  dropZoneSmall: { display: "flex", alignItems: "center", justifyContent: "center", border: "1.5px dashed #DDE5EE", borderRadius: 8, padding: "14px 16px", cursor: "pointer", fontSize: 13, color: "#5B6573", background: "white", marginBottom: 12 },
  empty: { fontSize: 13, color: "#8BA5C0", textAlign: "center", padding: "24px 0" },
  bankCard: { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "16px 10px", border: "1px dashed #DDE5EE", borderRadius: 10, background: "#FAFBFC", cursor: "not-allowed" },
  bankHero: { background: "white", border: "0.5px solid #DDE5EE", borderRadius: 12, padding: "32px 24px", textAlign: "center", marginBottom: 16 },
  dispoHero: { background: INK, borderRadius: 14, padding: "22px 26px", marginBottom: 18, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 },
  dispoLabel: { fontSize: 12, color: "#8BA5C0", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 },
  dispoValue: { fontSize: 36, fontWeight: 700, marginTop: 4, fontVariantNumeric: "tabular-nums" },
  dispoSub: { fontSize: 11, color: "#8BA5C0", marginTop: 4 },
  dispoEmpty: { fontSize: 13, color: "#B5D4F4", marginTop: 6, maxWidth: 320 },
  dispoPlaisirLabel: { fontSize: 11, color: "#8BA5C0", fontWeight: 600 },
  dispoPlaisirValue: { fontSize: 22, fontWeight: 700, color: "#FAC775", marginTop: 2 },
  linkBtnLight: { background: "none", border: "none", color: "#5DCAA5", fontSize: 13, fontWeight: 600, cursor: "pointer", padding: 0, textDecoration: "underline" },
  objectifInput: { width: 110, fontFamily: "inherit", fontSize: 13, padding: "5px 8px", borderRadius: 6, border: "1px solid #DDE5EE", textAlign: "right" },
  objectifInputBig: { width: 90, fontFamily: "inherit", fontSize: 18, fontWeight: 600, color: ACCENT, padding: "4px 8px", borderRadius: 8, border: `1.5px solid ${ACCENT}`, background: "#F4F9FF" },
  achatResult: { display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderRadius: 10 },
  modelText: { fontSize: 12, color: "#3D4452", whiteSpace: "pre-wrap", fontFamily: "inherit", background: "#FAFBFC", border: "1px solid #EEF2F7", borderRadius: 8, padding: "12px 14px", margin: 0, lineHeight: 1.6 },
  inlineEditValue: { width: 90, fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, color: "#854F0B", padding: "4px 8px", borderRadius: 6, border: "1px solid #EEF2F7", textAlign: "right" },
  askHectorBtn: { width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, background: `linear-gradient(135deg, ${ACCENT}, #2563A8)`, color: "white", border: "none", borderRadius: 14, padding: "16px 20px", fontSize: 14, fontWeight: 600, cursor: "pointer", marginBottom: 18, boxShadow: "0 4px 14px rgba(55,138,221,0.3)" },
  quickAskChip: { background: "white", border: `1px solid ${ACCENT}`, color: ACCENT, borderRadius: 20, padding: "8px 14px", fontSize: 12, fontWeight: 500, cursor: "pointer" },
  salaireRow: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  recoRow: { display: "flex", alignItems: "flex-start", gap: 12, padding: "8px 0" },
  recoNum: { width: 22, height: 22, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, flexShrink: 0 },
  scoreDetailRow: { display: "flex", alignItems: "center", gap: 10, padding: "8px 0" },
  scoreBarTrack: { flex: 1, height: 6, background: "#EEF2F7", borderRadius: 3, overflow: "hidden" },
  scoreBarFill: { height: "100%", borderRadius: 3 },
  simBarTrack: { display: "flex", height: 36, borderRadius: 10, overflow: "hidden", background: "#EEF2F7" },
  simBarSeg: { height: "100%", transition: "width 0.2s ease" },
  legendDot: { display: "inline-block", width: 8, height: 8, borderRadius: "50%", marginRight: 5, verticalAlign: 1 },
  toggleBtn: { flex: 1, padding: "8px 12px", borderRadius: 8, border: "1px solid #DDE5EE", background: "#fff", fontSize: 12, fontWeight: 500, cursor: "pointer", color: "#5B6358" },
  toggleBtnActive: { border: `1.5px solid ${ACCENT}`, background: "#E6F1FB", color: "#0C447C" },
  paniqueLine: { display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13, color: "#5B6573", padding: "9px 0", borderBottom: "0.5px solid #EEF2F7" },
  paniqueLineLabel: { display: "flex", alignItems: "center" },
  paniqueResult: { display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", paddingTop: 20, marginTop: 8 },
  paniqueResultLabel: { fontSize: 12, color: "#6B7A8D", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 },
  paniqueResultValue: { fontSize: 40, fontWeight: 700, fontVariantNumeric: "tabular-nums" },
  checkRow: { display: "flex", alignItems: "center", gap: 10, padding: "6px 0" },
  diagGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, textAlign: "center" },
  compteursRow: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginTop: 14, marginBottom: 18 },
  compteurCard: { background: "white", border: "0.5px solid #DDE5EE", borderRadius: 12, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 2, textAlign: "center" },
  compteurLabel: { fontSize: 11, color: "#8BA5C0", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.3 },
  compteurValue: { fontSize: 20, fontWeight: 700, color: INK, fontVariantNumeric: "tabular-nums", marginTop: 2 },
  compteurSub: { fontSize: 11, color: "#8BA5C0" },
  heroDispo: { background: INK, borderRadius: 16, padding: "30px 28px", marginBottom: 16, textAlign: "center" },
  heroDispoLabel: { fontSize: 13, color: "#8BA5C0", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 },
  heroDispoValue: { fontSize: 52, fontWeight: 700, fontVariantNumeric: "tabular-nums", lineHeight: 1.1 },
  heroDispoSub: { fontSize: 14, color: "#B5D4F4", marginTop: 10 },
  soldeInputCard: { display: "flex", alignItems: "center", gap: 14, background: "white", border: "1px solid #DDE5EE", borderRadius: 12, padding: "12px 16px", marginBottom: 14 },
  onboardingNotice: { display: "flex", alignItems: "center", gap: 14, background: "#E6F1FB", border: "1px solid #B5D4F4", borderRadius: 12, padding: "14px 16px", marginBottom: 14, flexWrap: "wrap" },
  explainBanner: { background: "#F4F9FF", border: "1px solid #D6E8FA", borderRadius: 10, padding: "12px 16px", fontSize: 13, color: "#28425E", marginBottom: 14, lineHeight: 1.5 },
  impactRow: { fontSize: 13, color: "#3D4452", padding: "4px 0" },
  impactCompareCard: { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "12px 14px" },
  impactRowDark: { fontSize: 13, color: "#C5D4E3", padding: "4px 0" },
  doublonWarning: { background: "#FAEEDA", border: "1px solid #EF9F27", borderRadius: 10, padding: "14px 16px" },
  aVerifierTag: { fontSize: 9, fontWeight: 600, color: "#854F0B", background: "#FAEEDA", padding: "1px 6px", borderRadius: 6, marginLeft: 6, textTransform: "uppercase" },
  soldeInput: { border: "none", outline: "none", fontSize: 18, fontWeight: 600, color: INK, width: "100%", padding: 0 },
  sidebarGreeting: { padding: "0 18px 16px", borderBottom: "1px solid rgba(255,255,255,0.08)", marginBottom: 8 },
  profilAvatar: { width: 52, height: 52, borderRadius: "50%", background: "#E6F1FB", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 600, color: "#0C447C", flexShrink: 0 },
  heroDetailRow: { display: "flex", justifyContent: "space-between", fontSize: 12, color: "#B5D4F4", padding: "4px 0" },
  projRow: { display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13, color: "#5B6573", padding: "10px 0", borderBottom: "0.5px solid #EEF2F7" },
  label: { display: "flex", flexDirection: "column", gap: 6, fontSize: 13, fontWeight: 500, color: "#3D4452", marginBottom: 14 },
  checkboxLabel: { display: "flex", alignItems: "flex-start", gap: 8, fontSize: 13, color: "#3D4452", marginBottom: 12, lineHeight: 1.4 },
  input: { fontFamily: "inherit", fontSize: 14, padding: "10px 12px", borderRadius: 8, border: "1px solid #DDE5EE", outline: "none", width: "100%" },
  btnPrimary: { width: "100%", background: ACCENT, color: "white", border: "none", borderRadius: 8, padding: "12px 16px", fontSize: 14, fontWeight: 600, cursor: "pointer" },
  btnPrimarySmall: { background: ACCENT, color: "white", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" },
  btnSecondary: { background: "white", color: ACCENT, border: `1px solid ${ACCENT}`, borderRadius: 8, padding: "12px 16px", fontSize: 14, fontWeight: 600, cursor: "pointer" },
  linkBtn: { background: "none", border: "none", color: ACCENT, fontSize: 13, fontWeight: 500, cursor: "pointer", padding: 0 },
  sectionLabel: { fontSize: 12, fontWeight: 600, color: "#6B7A8D", textTransform: "uppercase", letterSpacing: 0.5, margin: "0 0 8px" },
  statutCard: { position: "relative", textAlign: "left", padding: "12px 14px", borderRadius: 10, border: "1px solid #DDE5EE", background: "white", fontSize: 14, fontWeight: 500, cursor: "pointer", color: INK, width: "100%" },
  statutCardActive: { border: `1.5px solid ${ACCENT}`, background: "#E6F1FB" },
  statutCardDisabled: { color: "#9098A6", cursor: "not-allowed", background: "#F7F8F5" },
  comingSoon: { float: "right", fontSize: 10, fontWeight: 600, background: "#EDEAE0", color: "#8A7F5C", padding: "2px 8px", borderRadius: 6 },
  orDivider: { textAlign: "center", fontSize: 12, color: "#8A9182", margin: "8px 0" },
  errorBanner: { background: "#FCEBEB", color: "#A32D2D", border: "1px solid #F7C1C1", borderRadius: 8, padding: "12px 16px", fontSize: 14, marginBottom: 16 },
  switchAuth: { fontSize: 13, color: "#5B6573", textAlign: "center", marginTop: 16 },
  echeanceBanner: { display: "flex", alignItems: "center", justifyContent: "space-between", borderRadius: 12, padding: "14px 18px", marginBottom: 20, gap: 12 },
  echeanceBannerNormal: { background: "#E6F1FB", color: "#0C447C", border: "1px solid #B5D4F4" },
  echeanceBannerWarning: { background: "#FAEEDA", color: "#633806", border: "1px solid #FAC775" },
  echeanceBannerUrgent: { background: "#FCEBEB", color: "#791F1F", border: "1px solid #F7C1C1" },
};
