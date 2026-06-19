import { useState, useEffect, useRef, useCallback } from "react";

const API_BASE = "https://provision-backend-production.up.railway.app";
const GOOGLE_CLIENT_ID = "1008678142157-vnr5cogc1rvhvenemcahi373adnvvpln.apps.googleusercontent.com";

const STATUTS = [
  { id: "auto_entrepreneur", label: "Auto-entrepreneur", disponible: true },
  { id: "sarl", label: "SARL (gérant)", disponible: false },
  { id: "sas", label: "SAS / SASU", disponible: false },
];

const ACTIVITES = [
  { id: "vente", label: "Vente de marchandises", taux: "12,3%" },
  { id: "services", label: "Prestations de services", taux: "21,2%" },
  { id: "bnc", label: "Profession libérale (BNC)", taux: "25,6%" },
];

const NEWS = [
  { source: "URSSAF", title: "Taux BNC à 25,6% depuis janvier 2026", date: "1 jan. 2026", url: "https://www.urssaf.fr" },
  { source: "Impôts", title: "Plafonds auto-entrepreneur revalorisés : 83 600€", date: "2 jan. 2026", url: "https://www.impots.gouv.fr" },
  { source: "URSSAF", title: "Déclaration T2 2026 : date limite le 31 juillet", date: "1 avr. 2026", url: "https://www.autoentrepreneur.urssaf.fr" },
  { source: "Impôts", title: "Ouverture déclaration revenus 2025 : avril 2026", date: "8 avr. 2026", url: "https://www.impots.gouv.fr" },
];

const CONSEILS = [
  { icon: "ti-star", titre: "ACRE — économisez 50% la 1ère année", texte: "Si vous avez créé votre activité après juillet 2025, vos cotisations sont divisées par 2 pendant 12 mois. Pensez à faire la demande dans les 60 jours." },
  { icon: "ti-chart-bar", titre: "Versement libératoire", texte: "Payez votre impôt sur le revenu en même temps que vos cotisations, à 1,7% de votre CA. Simple et prévisible." },
  { icon: "ti-clock", titre: "Mensuel vs trimestriel", texte: "En mensuel, vous payez de petites sommes régulières. En trimestriel, vous avez plus de trésorerie mais attention aux gros versements." },
  { icon: "ti-alert-triangle", titre: "Surveillez le plafond", texte: "Au-delà de 83 600€ deux années consécutives, vous basculez en régime réel. Anticipez ce changement avec votre comptable." },
];

const PLANS = [
  { nom: "Gratuit", prix: "0€", periode: "/mois", couleur: "#E6F1FB", couleurTexte: "#0C447C", features: ["Dashboard & calcul URSSAF", "Ajout manuel de revenus", "3 factures/mois", "Actualités fiscales", "Conseils de base"] },
  { nom: "Pro", prix: "9€", periode: "/mois", couleur: "#378ADD", couleurTexte: "white", badge: "Populaire", features: ["Tout Gratuit +", "Factures illimitées", "Envoi email au client", "Carnet de contacts", "Assistant IA (50 questions/mois)", "Export PDF comptable", "Rappels URSSAF par email"] },
  { nom: "Expert", prix: "19€", periode: "/mois", couleur: "#0A2540", couleurTexte: "white", features: ["Tout Pro +", "Assistant IA illimité", "Multi-activités", "Scan factures fournisseurs", "Historique 3 ans", "Support prioritaire", "Bientôt : connexion bancaire"] },
];

const MOIS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"];

function formatEUR(n) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n || 0);
}

function formatDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

function Logo({ size = 28 }) {
  const h = size;
  const ratio = 160 / 44;
  const w = h * ratio;
  return (
    <svg width={w} height={h} viewBox="0 0 160 44" fill="none">
      <rect width="160" height="44" rx="8" fill="#378ADD"/>
      <text x="12" y="31" fontFamily="Georgia,serif" fontSize="24" fontWeight="700" fill="white" letterSpacing="2">H</text>
      <text x="33" y="31" fontFamily="Georgia,serif" fontSize="24" fontWeight="700" fill="#0A2540" letterSpacing="2">€</text>
      <text x="52" y="31" fontFamily="Georgia,serif" fontSize="24" fontWeight="700" fill="white" letterSpacing="2">CTOR</text>
    </svg>
  );
}

function LogoIcon({ size = 32 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 44 44" fill="none">
      <rect width="44" height="44" rx="8" fill="#378ADD"/>
      <text x="5" y="32" fontFamily="Georgia,serif" fontSize="28" fontWeight="700" fill="white">€</text>
    </svg>
  );
}

export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem("token"));
  const [authMode, setAuthMode] = useState("login");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [nav, setNav] = useState("dashboard");
  const [profile, setProfile] = useState(null);
  const [profileForm, setProfileForm] = useState({ statut: "auto_entrepreneur", activite: "services", periodicite: "mensuelle", acre: false, versement_liberatoire: false });
  const [estimateData, setEstimateData] = useState(null);
  const [incomeList, setIncomeList] = useState([]);
  const [showAddIncome, setShowAddIncome] = useState(false);
  const [incomeForm, setIncomeForm] = useState({ date: "", amount: "", description: "" });
  const [uploadingFile, setUploadingFile] = useState(false);
  const [contacts, setContacts] = useState([]);
  const [showAddContact, setShowAddContact] = useState(false);
  const [contactForm, setContactForm] = useState({ nom: "", email: "", siret: "", adresse: "" });
  const [factures, setFactures] = useState([]);
  const [showNewFacture, setShowNewFacture] = useState(false);
  const [factureForm, setFactureForm] = useState({ client_nom: "", client_email: "", client_adresse: "", lignes: [{ description: "", quantite: 1, prix_unitaire: "" }], notes: "" });
  const [aiMessages, setAiMessages] = useState([{ role: "assistant", content: "Bonjour ! Je suis H€CTOR, votre assistant fiscal. Posez-moi vos questions sur l'URSSAF, la TVA, l'ACRE, vos cotisations..." }]);
  const [aiInput, setAiInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [panique, setPanique] = useState({ solde: "", urssaf: "", impots: "0", cfe: "200" });
  const [simCa, setSimCa] = useState("3000");
  const [simActivite, setSimActivite] = useState("services");
  const [objectifAnnuel, setObjectifAnnuel] = useState(() => localStorage.getItem("objectifAnnuel") || "50000");
  const [objectifSecurite, setObjectifSecurite] = useState(() => localStorage.getItem("objectifSecurite") || "3000");
  const [achatMontant, setAchatMontant] = useState("");
  const [heuresTravaillees, setHeuresTravaillees] = useState("");
  const [showRetraitTout, setShowRetraitTout] = useState(false);
  const googleButtonRef = useRef(null);

  const authHeaders = useCallback(() => ({ Authorization: `Bearer ${token}` }), [token]);

  async function apiFetch(path, options = {}) {
    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        ...(options.body && !(options.body instanceof FormData) ? { "Content-Type": "application/json" } : {}),
        ...(token ? authHeaders() : {}),
        ...options.headers,
      },
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.detail || `Erreur (code ${res.status})`);
    }
    return res.json();
  }

  async function loadEverything() {
    setLoading(true);
    setError("");
    try {
      const p = await apiFetch("/profile");
      setProfile(p);
      if (p.onboarding_complete) {
        const [est, inc] = await Promise.all([apiFetch("/estimate"), apiFetch("/income")]);
        setEstimateData(est);
        setIncomeList(inc);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function handleGoogleCredential(response) {
    setError("");
    setLoading(true);
    apiFetch("/auth/google", { method: "POST", body: JSON.stringify({ credential: response.credential }) })
      .then(data => { localStorage.setItem("token", data.token); setToken(data.token); })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => { localStorage.setItem("objectifAnnuel", objectifAnnuel); }, [objectifAnnuel]);
  useEffect(() => { localStorage.setItem("objectifSecurite", objectifSecurite); }, [objectifSecurite]);

  useEffect(() => {
    if (token) loadEverything();
  }, [token]);

  useEffect(() => {
    if (estimateData && estimateData.disponible !== false) {
      const urssafCourante = estimateData.montant_a_provisionner || 0;
      const urssafPrecedente = estimateData.periode_precedente?.jours_restants > 0 ? Math.round(estimateData.ca_periode_precedente * (estimateData.taux_global_pct / 100) * 100) / 100 : 0;
      setPanique(p => ({ ...p, urssaf: String(Math.round((urssafCourante + urssafPrecedente) * 100) / 100) }));
    }
  }, [estimateData]);

  useEffect(() => {
    if (token || !googleButtonRef.current) return;
    function renderButton() {
      if (window.google && googleButtonRef.current) {
        window.google.accounts.id.initialize({ client_id: GOOGLE_CLIENT_ID, callback: handleGoogleCredential });
        window.google.accounts.id.renderButton(googleButtonRef.current, { theme: "outline", size: "large", width: 360, text: "continue_with" });
      } else {
        setTimeout(renderButton, 200);
      }
    }
    renderButton();
  }, [token, authMode]);

  async function handleAuth(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await apiFetch(`/auth/${authMode === "login" ? "login" : "register"}`, {
        method: "POST",
        body: JSON.stringify({ email: authEmail, password: authPassword }),
      });
      localStorage.setItem("token", data.token);
      setToken(data.token);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function handleLogout() {
    localStorage.removeItem("token");
    setToken(null);
    setProfile(null);
    setEstimateData(null);
    setIncomeList([]);
  }

  async function handleSaveProfile(e) {
    e.preventDefault();
    setLoading(true);
    try {
      await apiFetch("/profile", { method: "POST", body: JSON.stringify(profileForm) });
      await loadEverything();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleAddIncome(e) {
    e.preventDefault();
    try {
      await apiFetch("/income", { method: "POST", body: JSON.stringify({ date: incomeForm.date, amount: parseFloat(incomeForm.amount), description: incomeForm.description || null }) });
      setIncomeForm({ date: "", amount: "", description: "" });
      setShowAddIncome(false);
      await loadEverything();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleUploadInvoice(file) {
    setUploadingFile(true);
    try {
      const form = new FormData();
      form.append("file", file);
      await apiFetch("/income/upload", { method: "POST", body: form });
      await loadEverything();
    } catch (err) {
      setError(err.message);
    } finally {
      setUploadingFile(false);
    }
  }

  async function handleDeleteIncome(id) {
    try {
      await apiFetch(`/income/${id}`, { method: "DELETE" });
      await loadEverything();
    } catch (err) {
      setError(err.message);
    }
  }

  function addFactureLigne() {
    setFactureForm(f => ({ ...f, lignes: [...f.lignes, { description: "", quantite: 1, prix_unitaire: "" }] }));
  }

  function updateLigne(i, field, value) {
    setFactureForm(f => {
      const lignes = [...f.lignes];
      lignes[i] = { ...lignes[i], [field]: value };
      return { ...f, lignes };
    });
  }

  function totalFacture() {
    return factureForm.lignes.reduce((sum, l) => sum + (parseFloat(l.quantite) || 0) * (parseFloat(l.prix_unitaire) || 0), 0);
  }

  function saveFacture() {
    const num = `F-${new Date().getFullYear()}-${String(factures.length + 1).padStart(3, "0")}`;
    const f = { ...factureForm, numero: num, date: new Date().toISOString().split("T")[0], total: totalFacture(), statut: "envoyée" };
    setFactures(prev => [f, ...prev]);
    setShowNewFacture(false);
    setFactureForm({ client_nom: "", client_email: "", client_adresse: "", lignes: [{ description: "", quantite: 1, prix_unitaire: "" }], notes: "" });
  }

  async function askAI(e) {
    e.preventDefault();
    if (!aiInput.trim() || aiLoading) return;
    const userMsg = { role: "user", content: aiInput };
    const newMessages = [...aiMessages, userMsg];
    setAiMessages(newMessages);
    setAiInput("");
    setAiLoading(true);
    try {
      const data = await apiFetch("/assistant/chat", {
        method: "POST",
        body: JSON.stringify({ messages: newMessages.map(m => ({ role: m.role, content: m.content })) }),
      });
      setAiMessages(m => [...m, { role: "assistant", content: data.reply }]);
    } catch (err) {
      setAiMessages(m => [...m, { role: "assistant", content: `Erreur : ${err.message}` }]);
    } finally {
      setAiLoading(false);
    }
  }

  const revenusParMois = Array.from({ length: 12 }, (_, i) => {
    const total = incomeList.filter(e => new Date(e.date).getMonth() === i && new Date(e.date).getFullYear() === new Date().getFullYear()).reduce((s, e) => s + e.amount, 0);
    const taux = estimateData?.taux_global_pct ? estimateData.taux_global_pct / 100 : 0.214;
    return { mois: MOIS[i], total, urssaf: Math.round(total * taux * 100) / 100 };
  });
  const maxRevenu = Math.max(...revenusParMois.map(m => m.total), 1);

  // --- Calcul central : "Disponible aujourd'hui" ---
  // Source unique de verite, reutilisee partout : dashboard, simulateur d'achat, mode panique, score sante
  const soldeNum = parseFloat(panique.solde) || 0;
  const urssafProvision = estimateData?.disponible !== false
    ? (estimateData?.montant_a_provisionner || 0) +
      (estimateData?.periode_precedente?.jours_restants > 0
        ? Math.round((estimateData.ca_periode_precedente || 0) * ((estimateData?.taux_global_pct || 0) / 100) * 100) / 100
        : 0)
    : 0;
  const impotsNum = profile?.versement_liberatoire ? 0 : (parseFloat(panique.impots) || 0);
  const cfeNum = parseFloat(panique.cfe) || 0;
  const totalChargesAVenir = urssafProvision + impotsNum + cfeNum;
  const securiteNum = parseFloat(objectifSecurite) || 0;
  const disponibleAujourdhui = soldeNum > 0 ? Math.round((soldeNum - totalChargesAVenir - securiteNum) * 100) / 100 : null;

  // --- Statut unifie (memes seuils que Mode Panique : >0 vert, 0 a -1000 orange, <-1000 rouge) ---
  function statutFinancier() {
    if (disponibleAujourdhui === null) return null;
    if (disponibleAujourdhui > 0) return "vert";
    if (disponibleAujourdhui >= -1000) return "orange";
    return "rouge";
  }
  const statut = statutFinancier();
  const STATUT_INFO = {
    vert: { emoji: "🟢", label: "Situation saine", color: "#1D9E75", bg: "#E1F5EE", border: "#1D9E75" },
    orange: { emoji: "🟠", label: "Situation fragile", color: "#854F0B", bg: "#FAEEDA", border: "#EF9F27" },
    rouge: { emoji: "🔴", label: "Situation critique", color: "#A32D2D", bg: "#FCEBEB", border: "#E24B4A" },
  };

  // --- Score sante HECTOR /100, calcule a partir du MEME disponibleAujourdhui ---
  function calculScoreSante() {
    if (disponibleAujourdhui === null) return null;
    if (disponibleAujourdhui > 0) return Math.min(100, Math.round(50 + disponibleAujourdhui / 50));
    if (disponibleAujourdhui >= -1000) return Math.round(50 + (disponibleAujourdhui / 1000) * 30);
    return Math.max(0, Math.round(20 + (disponibleAujourdhui + 1000) / 100));
  }
  const scoreSante = calculScoreSante();
  function scoreInfo(s) {
    if (s === null) return { label: "—", color: "#8BA5C0", desc: "Renseignez votre solde dans Mode Panique pour calculer votre score." };
    const st = statutFinancier();
    return {
      label: STATUT_INFO[st].label,
      color: STATUT_INFO[st].color,
      desc: st === "vert" ? "Votre réserve de sécurité est couverte, vous pouvez dépenser sereinement."
        : st === "orange" ? "Votre disponible après charges et réserve est tout juste à l'équilibre."
        : "Votre solde actuel ne couvre pas vos charges à venir et votre réserve. Anticipez avant l'échéance.",
    };
  }

  // --- Coach prix ---
  const heuresNum = parseFloat(heuresTravaillees) || 0;
  const tauxHoraireReel = heuresNum > 0 && estimateData ? Math.round(((estimateData.ca_annuel || 0) * (1 - (estimateData.taux_global_pct || 0) / 100)) / heuresNum * 100) / 100 : null;

  if (!token) {
    const tauxSim = { vente: 0.123, services: 0.212, bnc: 0.256 }[simActivite];
    const caSim = parseFloat(simCa) || 0;
    const urssafSim = Math.round(caSim * tauxSim * 100) / 100;
    const netSim = Math.round((caSim - urssafSim) * 100) / 100;
    return (
      <div style={S.authPage}>
        <style>{CSS}</style>
        <div style={S.authLeft}>
          <Logo size={36} />
          <h1 style={S.authHero}>Votre assistant fiscal<br />intelligent</h1>
          <p style={S.authSub}>H€CTOR calcule vos cotisations URSSAF, crée vos factures et répond à toutes vos questions fiscales en temps réel.</p>
          <div style={S.authFeatures}>
            {[
              { icon: "ti-calculator", t: "Calcul URSSAF automatique", d: "Cotisations recalculées en temps réel selon vos revenus" },
              { icon: "ti-file-invoice", t: "Factures professionnelles", d: "Créez, numérotez et envoyez vos factures en 2 minutes" },
              { icon: "ti-alert-triangle", t: "Mode panique", d: "Sachez en un clic ce qu'il vous reste vraiment disponible" },
              { icon: "ti-message-circle", t: "Assistant IA fiscal", d: "Posez vos questions URSSAF, TVA, ACRE 24h/24" },
              { icon: "ti-bell", t: "Actualités & échéances", d: "Alertes avant chaque déclaration, zéro oubli" },
              { icon: "ti-building-bank", t: "Connexion bancaire", d: "Qonto, Shine, Revolut... bientôt 100% automatique" },
            ].map(f => (
              <div key={f.t} style={S.authFeatureCard}>
                <i className={`ti ${f.icon}`} aria-hidden="true" style={{ fontSize: 18, color: "#5DCAA5" }} />
                <div>
                  <div style={S.authFeatureTitle}>{f.t}</div>
                  <div style={S.authFeatureDesc}>{f.d}</div>
                </div>
              </div>
            ))}
          </div>

          <div style={S.simWidget}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#8BA5C0", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 12 }}>
              Essayez sans créer de compte
            </div>
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <input style={S.simInput} type="number" placeholder="CA encaissé" value={simCa} onChange={e => setSimCa(e.target.value)} />
              <select style={S.simSelect} value={simActivite} onChange={e => setSimActivite(e.target.value)}>
                <option value="vente">Vente (12,3%)</option>
                <option value="services">Services (21,2%)</option>
                <option value="bnc">Libéral (25,6%)</option>
              </select>
            </div>
            {caSim > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <div>
                  <div style={{ fontSize: 11, color: "#8BA5C0" }}>À mettre de côté URSSAF</div>
                  <div style={{ fontSize: 20, fontWeight: 600, color: "#FAC775" }}>{formatEUR(urssafSim)}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 11, color: "#8BA5C0" }}>Dans votre poche</div>
                  <div style={{ fontSize: 20, fontWeight: 600, color: "#5DCAA5" }}>{formatEUR(netSim)}</div>
                </div>
              </div>
            )}
          </div>
        </div>
        <div style={S.authRight}>
          <form style={S.authCard} onSubmit={handleAuth}>
            <h2 style={S.authTitle}>{authMode === "login" ? "Connexion" : "Créer un compte"}</h2>
            {error && <div style={S.errorBanner}>{error}</div>}
            <div ref={googleButtonRef} style={{ display: "flex", justifyContent: "center", marginBottom: 8 }} />
            <p style={S.orDivider}>ou avec un email</p>
            <label style={S.label}>Email<input style={S.input} type="email" value={authEmail} onChange={e => setAuthEmail(e.target.value)} required /></label>
            <label style={S.label}>Mot de passe<input style={S.input} type="password" value={authPassword} onChange={e => setAuthPassword(e.target.value)} minLength={8} required /></label>
            <button style={S.btnPrimary} type="submit" disabled={loading}>{loading ? "…" : authMode === "login" ? "Se connecter" : "Créer mon compte"}</button>
            <p style={S.switchAuth}>
              {authMode === "login" ? "Pas encore de compte ?" : "Déjà inscrit ?"}{" "}
              <button type="button" style={S.linkBtn} onClick={() => setAuthMode(authMode === "login" ? "register" : "login")}>{authMode === "login" ? "Créer un compte" : "Se connecter"}</button>
            </p>
          </form>
        </div>
      </div>
    );
  }

  if (profile && !profile.onboarding_complete) {
    return (
      <div style={S.authPage}>
        <style>{CSS}</style>
        <div style={S.authLeft}>
          <Logo size={36} />
          <h1 style={S.authHero}>Configurons votre profil</h1>
          <p style={S.authSub}>H€CTOR s'adapte à votre situation pour calculer exactement ce que vous devez mettre de côté.</p>
        </div>
        <div style={S.authRight}>
          <form style={S.authCard} onSubmit={handleSaveProfile}>
            <h2 style={S.authTitle}>Votre situation</h2>
            {error && <div style={S.errorBanner}>{error}</div>}
            <p style={S.sectionLabel}>Statut juridique</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
              {STATUTS.map(s => (
                <button type="button" key={s.id} disabled={!s.disponible} onClick={() => setProfileForm({ ...profileForm, statut: s.id })}
                  style={{ ...S.statutCard, ...(profileForm.statut === s.id ? S.statutCardActive : {}), ...(!s.disponible ? S.statutCardDisabled : {}) }}>
                  {s.label}{!s.disponible && <span style={S.comingSoon}>Bientôt</span>}
                </button>
              ))}
            </div>
            {profileForm.statut === "auto_entrepreneur" && (
              <>
                <label style={S.label}>Type d'activité
                  <select style={S.input} value={profileForm.activite} onChange={e => setProfileForm({ ...profileForm, activite: e.target.value })}>
                    {ACTIVITES.map(a => <option key={a.id} value={a.id}>{a.label} ({a.taux})</option>)}
                  </select>
                </label>
                <label style={S.label}>Fréquence de déclaration
                  <select style={S.input} value={profileForm.periodicite} onChange={e => setProfileForm({ ...profileForm, periodicite: e.target.value })}>
                    <option value="mensuelle">Mensuelle</option>
                    <option value="trimestrielle">Trimestrielle</option>
                  </select>
                </label>
                <label style={S.checkboxLabel}><input type="checkbox" checked={profileForm.acre} onChange={e => setProfileForm({ ...profileForm, acre: e.target.checked })} />Je bénéficie de l'ACRE (1ère année, -50%)</label>
                <label style={S.checkboxLabel}><input type="checkbox" checked={profileForm.versement_liberatoire} onChange={e => setProfileForm({ ...profileForm, versement_liberatoire: e.target.checked })} />Versement libératoire de l'impôt</label>

                <p style={S.sectionLabel}>Réserve de sécurité souhaitée</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
                  {[1000, 3000, 5000].map(v => (
                    <button type="button" key={v} onClick={() => setObjectifSecurite(String(v))}
                      style={{ ...S.statutCard, ...(objectifSecurite === String(v) ? S.statutCardActive : {}) }}>
                      {formatEUR(v)}
                    </button>
                  ))}
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <button type="button" onClick={() => setObjectifSecurite("")}
                      style={{ ...S.statutCard, flex: 1, ...(![1000, 3000, 5000].includes(parseFloat(objectifSecurite)) ? S.statutCardActive : {}) }}>
                      Personnalisée
                    </button>
                    {![1000, 3000, 5000].includes(parseFloat(objectifSecurite)) && (
                      <input style={{ ...S.input, width: 100 }} type="number" placeholder="€" value={objectifSecurite} onChange={e => setObjectifSecurite(e.target.value)} />
                    )}
                  </div>
                </div>
              </>
            )}
            <button style={S.btnPrimary} type="submit" disabled={loading}>{loading ? "…" : "Valider"}</button>
          </form>
        </div>
      </div>
    );
  }

  const userInitials = (profile?.email || "").slice(0, 2).toUpperCase();

  return (
    <div style={S.appWrap}>
      <style>{CSS}</style>

      <aside style={{ ...S.sidebar, ...(sidebarOpen ? {} : S.sidebarClosed) }}>
        <div style={S.sidebarTop}>
          {sidebarOpen ? <Logo size={28} /> : <LogoIcon size={32} />}
        </div>
        {[
          { id: "dashboard", icon: "ti-home", label: "Dashboard" },
          { id: "panique", icon: "ti-alert-triangle", label: "Mode panique" },
          { id: "score", icon: "ti-heart-rate-monitor", label: "Score H€CTOR" },
          { id: "revenus", icon: "ti-chart-bar", label: "Revenus" },
          { id: "factures", icon: "ti-file", label: "Factures" },
          { id: "contacts", icon: "ti-user", label: "Contacts" },
          { id: "coach", icon: "ti-target-arrow", label: "Coach prix" },
          { id: "societe", icon: "ti-building", label: "Passage société" },
          { id: "modeles", icon: "ti-template", label: "Modèles" },
          { id: "banque", icon: "ti-building-bank", label: "Connexion bancaire" },
          { id: "echeances", icon: "ti-calendar", label: "Échéances" },
          { id: "actualites", icon: "ti-bell", label: "Actualités" },
          { id: "conseils", icon: "ti-star", label: "Conseils" },
          { id: "assistant", icon: "ti-message", label: "Assistant IA" },
          { id: "abonnement", icon: "ti-crown", label: "Abonnement" },
        ].map(item => (
          <button key={item.id} style={{ ...S.navItem, ...(nav === item.id ? S.navItemActive : {}) }} onClick={() => setNav(item.id)}>
            <i className={`ti ${item.icon}`} aria-hidden="true" style={{ fontSize: 18 }} />
            {sidebarOpen && <span style={S.navLabel}>{item.label}</span>}
          </button>
        ))}
        <div style={S.sidebarBottom}>
          <button style={S.navItem} onClick={() => setSidebarOpen(!sidebarOpen)}>
            <i className={`ti ${sidebarOpen ? "ti-layout-sidebar-left-collapse" : "ti-layout-sidebar-left-expand"}`} aria-hidden="true" style={{ fontSize: 18 }} />
          </button>
          <div style={S.userRow}>
            <div style={S.avatar}>{userInitials}</div>
            {sidebarOpen && <button style={S.linkBtn} onClick={handleLogout}>Déconnexion</button>}
          </div>
        </div>
      </aside>

      <main style={S.mainContent}>
        {error && <div style={S.errorBanner}>{error}</div>}

        {nav === "dashboard" && estimateData && (
          <div>
            <div style={S.pageHeader}>
              <div>
                <h1 style={S.pageTitle}>Bonjour 👋</h1>
                <p style={S.pageSub}>Votre situation fiscale en un coup d'œil</p>
              </div>
              {estimateData.periode_courante?.jours_restants <= 30 && (
                <div style={S.alertChip}>
                  <i className="ti ti-clock" style={{ fontSize: 13 }} aria-hidden="true" />
                  Déclaration dans {estimateData.periode_courante.jours_restants}j
                </div>
              )}
            </div>

            {statut && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: STATUT_INFO[statut].color }}>
                  {STATUT_INFO[statut].emoji} {STATUT_INFO[statut].label}
                </span>
                <button style={S.linkBtn} onClick={() => setNav("panique")}>voir le détail →</button>
              </div>
            )}

            <div style={S.dispoHero}>
              <div>
                <div style={S.dispoLabel}>💰 Disponible aujourd'hui</div>
                {disponibleAujourdhui !== null ? (
                  <div style={{ ...S.dispoValue, color: disponibleAujourdhui < 0 ? "#FF8A80" : "#5DCAA5" }}>{formatEUR(disponibleAujourdhui)}</div>
                ) : (
                  <div style={S.dispoEmpty}>Renseignez votre solde dans <button style={S.linkBtnLight} onClick={() => setNav("panique")}>Mode panique</button> pour voir ce chiffre</div>
                )}
                {disponibleAujourdhui !== null && <div style={S.dispoSub}>après URSSAF, impôts, CFE et votre réserve de sécurité de {formatEUR(securiteNum)}</div>}
              </div>
              {disponibleAujourdhui !== null && (
                <div style={{ textAlign: "right" }}>
                  <div style={S.dispoPlaisirLabel}>🎯 Budget plaisir</div>
                  <div style={S.dispoPlaisirValue}>{formatEUR(Math.max(0, Math.round(disponibleAujourdhui * 0.3)))}</div>
                  <div style={{ fontSize: 10, color: "#8BA5C0" }}>30% du disponible, à dépenser sans culpabiliser</div>
                </div>
              )}
            </div>

            {estimateData.periode_courante && (
              <div style={{
                ...S.echeanceBanner,
                ...(estimateData.periode_courante.jours_restants <= 7 ? S.echeanceBannerUrgent :
                    estimateData.periode_courante.jours_restants <= 14 ? S.echeanceBannerWarning :
                    S.echeanceBannerNormal)
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <i className="ti ti-calendar-due" aria-hidden="true" style={{ fontSize: 20 }} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>
                      Prochaine échéance — dans {estimateData.periode_courante.jours_restants} jours
                    </div>
                    <div style={{ fontSize: 12, marginTop: 2, opacity: 0.85 }}>
                      Déclaration URSSAF {estimateData.periode_courante.label} avant le {formatDate(estimateData.periode_courante.date_limite_declaration)}
                      {estimateData.ca_periode_courante > 0 && ` · ${formatEUR(estimateData.ca_periode_courante)} à déclarer`}
                    </div>
                  </div>
                </div>
                <a href="https://www.autoentrepreneur.urssaf.fr" target="_blank" rel="noopener noreferrer"
                  style={{ fontSize: 12, fontWeight: 600, color: "inherit", textDecoration: "none", whiteSpace: "nowrap", opacity: 0.9 }}>
                  Déclarer maintenant →
                </a>
              </div>
            )}

            <div style={S.kpiGrid} className="kpi-grid-r">
              <div style={S.kpiCard}>
                <span style={S.kpiLabel}>À mettre de côté · {estimateData.periode_courante?.label}</span>
                <span style={S.kpiValue}>{formatEUR(estimateData.montant_a_provisionner)}</span>
                <span style={S.kpiSub}>sur {formatEUR(estimateData.ca_periode_courante)} encaissés · {estimateData.taux_global_pct}%</span>
              </div>
              <div style={S.kpiCard}>
                <span style={S.kpiLabel}>CA annuel {new Date().getFullYear()}</span>
                <span style={S.kpiValue}>{formatEUR(estimateData.ca_annuel)}</span>
                <span style={{ ...S.kpiSub, color: "#0F6E56" }}>{estimateData.pourcentage_plafond}% du plafond</span>
              </div>
              <div style={S.kpiCard}>
                <span style={S.kpiLabel}>URSSAF à provisionner</span>
                <span style={S.kpiValue}>{formatEUR(incomeList.reduce((s, e) => s + e.amount, 0) * (estimateData.taux_global_pct / 100))}</span>
                <span style={{ ...S.kpiSub, color: "#854F0B" }}>sur l'année complète</span>
              </div>
              <div style={S.kpiCard}>
                <span style={S.kpiLabel}>Factures émises</span>
                <span style={S.kpiValue}>{factures.length}</span>
                <span style={S.kpiSub}>ce mois</span>
              </div>
            </div>

            <div style={{ ...S.card, marginBottom: 20 }}>
              <div style={S.cardTitle}>
                Objectif annuel
                <input style={S.objectifInput} type="number" value={objectifAnnuel} onChange={e => setObjectifAnnuel(e.target.value)} />
              </div>
              {(() => {
                const obj = parseFloat(objectifAnnuel) || 1;
                const pct = Math.min(Math.round((estimateData.ca_annuel / obj) * 100), 100);
                return (
                  <>
                    <div style={S.progressTrack}><div style={{ ...S.progressFill, width: `${pct}%` }} /></div>
                    <span style={S.kpiSub}>{formatEUR(estimateData.ca_annuel)} sur {formatEUR(obj)} visés · {pct}%</span>
                  </>
                );
              })()}
              <div style={{ borderTop: "0.5px solid #EEF2F7", marginTop: 16, paddingTop: 14 }}>
                <div style={S.cardTitle}>
                  Réserve de sécurité <span style={{ fontWeight: 400, fontSize: 11, color: "#8BA5C0" }}>(utilisée dans Mode panique)</span>
                  <input style={S.objectifInput} type="number" value={objectifSecurite} onChange={e => setObjectifSecurite(e.target.value)} />
                </div>
              </div>
            </div>

            <div style={{ ...S.card, marginBottom: 20 }}>
              <div style={S.cardTitle}><i className="ti ti-calculator" aria-hidden="true" style={{ fontSize: 16, marginRight: 6, verticalAlign: -2 }} />Simulation rapide</div>
              <p style={{ fontSize: 12, color: "#6B7A8D", margin: "0 0 12px" }}>Testez un montant sans l'ajouter à vos revenus.</p>
              <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
                <input style={{ ...S.input, flex: "1 1 160px" }} type="number" placeholder="CA encaissé" value={simCa} onChange={e => setSimCa(e.target.value)} />
                <select style={{ ...S.input, flex: "1 1 200px" }} value={simActivite} onChange={e => setSimActivite(e.target.value)}>
                  <option value="vente">Vente de marchandises (12,3%)</option>
                  <option value="services">Prestations de services (21,2%)</option>
                  <option value="bnc">Profession libérale (25,6%)</option>
                </select>
              </div>
              {(() => {
                const tauxSim = { vente: 0.123, services: 0.212, bnc: 0.256 }[simActivite];
                const caSim = parseFloat(simCa) || 0;
                const urssafSim = Math.round(caSim * tauxSim * 100) / 100;
                const netSim = Math.round((caSim - urssafSim) * 100) / 100;
                if (caSim <= 0) return null;
                return (
                  <div style={{ display: "flex", gap: 24 }}>
                    <div>
                      <div style={{ fontSize: 11, color: "#6B7A8D" }}>À mettre de côté URSSAF</div>
                      <div style={{ fontSize: 22, fontWeight: 600, color: "#854F0B" }}>{formatEUR(urssafSim)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: "#6B7A8D" }}>Dans votre poche</div>
                      <div style={{ fontSize: 22, fontWeight: 600, color: ACCENT }}>{formatEUR(netSim)}</div>
                    </div>
                  </div>
                );
              })()}
            </div>

            <div style={S.row2} className="row2-r">
              <div style={S.card}>
                <div style={S.cardTitle}>Revenus par mois</div>
                {revenusParMois.map((m, i) => (
                  <div key={i} style={S.monthRow}>
                    <span style={S.monthName}>{m.mois}</span>
                    <div style={S.barTrack}><div style={{ ...S.barFill, width: `${(m.total / maxRevenu) * 100}%` }} /></div>
                    <span style={S.monthAmt}>{m.total ? formatEUR(m.total) : "—"}</span>
                    <span style={S.monthUrssaf}>{m.urssaf ? `-${formatEUR(m.urssaf)}` : ""}</span>
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {(() => {
                  const today = new Date();
                  const moisEcoules = today.getMonth() + 1;
                  const moyenneMensuelle = estimateData.ca_annuel / moisEcoules;
                  const caProjete = Math.round(moyenneMensuelle * 12);
                  const cotisationsProjetees = Math.round(caProjete * (estimateData.taux_global_pct / 100));
                  const moisAvantDepassement = moyenneMensuelle > 0 ? Math.ceil((estimateData.plafond - estimateData.ca_annuel) / moyenneMensuelle) : null;
                  return (
                    <div style={S.card}>
                      <div style={S.cardTitle}>À ce rythme, sur l'année</div>
                      <div style={S.netRow}><span>CA annuel estimé</span><span style={{ fontWeight: 600 }}>{formatEUR(caProjete)}</span></div>
                      <div style={S.netRow}><span>Cotisations estimées</span><span style={{ color: "#854F0B" }}>{formatEUR(cotisationsProjetees)}</span></div>
                      {moisAvantDepassement && moisAvantDepassement > 0 && moisAvantDepassement <= 12 && (
                        <div style={{ ...S.netRow, color: "#A32D2D", marginTop: 4 }}><span>Dépassement du plafond dans</span><span>~{moisAvantDepassement} mois</span></div>
                      )}
                    </div>
                  );
                })()}
                <div style={S.card}>
                  <div style={S.cardTitle}>Seuil annuel
                    <span style={S.cardSub}>{formatEUR(estimateData.ca_annuel)} / {formatEUR(estimateData.plafond)}</span>
                  </div>
                  <div style={S.progressTrack}><div style={{ ...S.progressFill, width: `${Math.min(estimateData.pourcentage_plafond, 100)}%` }} /></div>
                  <span style={S.kpiSub}>Vous pouvez encore encaisser <strong>{formatEUR(estimateData.plafond - estimateData.ca_annuel)}</strong> avant le plafond</span>
                  <a href="https://www.autoentrepreneur.urssaf.fr" target="_blank" rel="noopener noreferrer" style={S.urssafLink}>
                    Déclarer sur autoentrepreneur.urssaf.fr →
                  </a>
                </div>
                <div style={S.card}>
                  <div style={S.cardTitle}>Actualités récentes</div>
                  {NEWS.slice(0, 3).map((n, i) => (
                    <div key={i} style={S.newsItem}>
                      <span style={S.newsSource}>{n.source}</span>
                      <a href={n.url} target="_blank" rel="noopener noreferrer" style={S.newsTitle}>{n.title}</a>
                      <span style={S.newsDate}>{n.date}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {nav === "panique" && (() => {
          const solde = soldeNum;
          const urssaf = urssafProvision; // calcule automatiquement par H€CTOR
          const impots = impotsNum; // deja inclus dans le taux si versement liberatoire
          const cfe = cfeNum;
          const chargesFutures = totalChargesAVenir;
          const apresReserve = disponibleAujourdhui ?? 0;

          const score = statut || "vert"; // meme source que le Score H€CTOR et le Dashboard
          const c = { ...STATUT_INFO[score], dot: STATUT_INFO[score].border, text: STATUT_INFO[score].color };
          const scoreLabel = c.label;
          const manque = apresReserve < 0 ? Math.abs(apresReserve) : 0;

          return (
            <div>
              <div style={S.pageHeader}>
                <div><h1 style={S.pageTitle}>🚨 Mode panique</h1><p style={S.pageSub}>Un seul chiffre à donner, H€CTOR fait le reste</p></div>
              </div>

              <div style={S.card}>
                <label style={S.label}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: INK }}>💳 Quel est le solde de votre compte ?</span>
                  <input style={{ ...S.input, fontSize: 22, fontWeight: 600, padding: "14px 16px", marginTop: 8 }} type="number" step="0.01" placeholder="Ex : 1224" value={panique.solde} onChange={e => setPanique({ ...panique, solde: e.target.value })} />
                </label>
                <p style={{ fontSize: 11, color: "#8BA5C0", margin: "10px 0 0" }}>
                  H€CTOR connaît déjà votre CA, votre activité, votre taux URSSAF et votre réserve cible — rien d'autre à remplir.
                </p>
              </div>

              {solde > 0 && (
                <>
                  <div style={{ ...S.card, marginTop: 14, background: c.bg, border: `1px solid ${c.dot}` }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14 }}>
                      <div style={{ width: 44, height: 44, borderRadius: "50%", background: c.dot, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <i className={`ti ${score === "vert" ? "ti-check" : score === "orange" ? "ti-alert-triangle" : "ti-alert-octagon"}`} aria-hidden="true" style={{ fontSize: 22, color: "white" }} />
                      </div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: c.text }}>{c.emoji} {scoreLabel}</div>
                    </div>
                    <div style={{ ...S.netRow, color: c.text }}><span>Solde détecté</span><span style={{ fontWeight: 600 }}>{formatEUR(solde)}</span></div>
                    <div style={{ ...S.netRow, color: c.text }}><span>Charges futures (URSSAF + CFE{!profile?.versement_liberatoire ? " + impôts" : ""})</span><span>−{formatEUR(chargesFutures)}</span></div>
                    {manque > 0 && (
                      <div style={{ fontSize: 12, color: c.text, marginTop: 8, fontWeight: 500 }}>
                        Il manque {formatEUR(manque)} pour couvrir vos prochaines échéances{securiteNum > 0 ? " et garder votre réserve" : ""}.
                      </div>
                    )}
                  </div>

                  <div style={{ ...S.card, marginTop: 14, textAlign: "center", padding: "28px 24px" }}>
                    <div style={S.paniqueResultLabel}>Vous pouvez dépenser</div>
                    <div style={{ ...S.paniqueResultValue, fontSize: 44, color: apresReserve > 0 ? ACCENT : "#A32D2D" }}>{formatEUR(Math.max(0, apresReserve))}</div>
                    <div style={{ fontSize: 11, color: "#8BA5C0", marginTop: 4 }}>
                      sans toucher à votre réserve de {formatEUR(securiteNum)} · <button style={S.linkBtn} onClick={() => setNav("dashboard")}>modifier ma réserve</button>
                    </div>
                  </div>

                  <details style={{ ...S.card, marginTop: 14 }}>
                    <summary style={{ cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#5B6573" }}>⚙️ Paramètres avancés (CFE, impôts)</summary>
                    <div style={{ marginTop: 14 }}>
                      <div style={S.paniqueLine}>
                        <span style={S.paniqueLineLabel}><i className="ti ti-home" aria-hidden="true" style={{ fontSize: 15, marginRight: 8, color: "#8BA5C0" }} />CFE estimée</span>
                        <input style={S.inlineEditValue} type="number" step="0.01" value={panique.cfe} onChange={e => setPanique({ ...panique, cfe: e.target.value })} />
                      </div>
                      {profile?.versement_liberatoire ? (
                        <p style={{ fontSize: 11, color: "#8BA5C0", margin: "8px 0 0" }}>Impôts déjà inclus dans votre taux URSSAF (versement libératoire activé).</p>
                      ) : (
                        <div style={S.paniqueLine}>
                          <span style={S.paniqueLineLabel}><i className="ti ti-percentage" aria-hidden="true" style={{ fontSize: 15, marginRight: 8, color: "#8BA5C0" }} />Impôts estimés (hors versement libératoire)</span>
                          <input style={S.inlineEditValue} type="number" step="0.01" value={panique.impots} onChange={e => setPanique({ ...panique, impots: e.target.value })} />
                        </div>
                      )}
                    </div>
                  </details>

                  <div style={{ ...S.card, marginTop: 14 }}>
                    <div style={S.cardTitle}><i className="ti ti-shopping-cart" aria-hidden="true" style={{ fontSize: 16, marginRight: 6, verticalAlign: -2 }} />Puis-je me permettre cet achat ?</div>
                    <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
                      <input style={{ ...S.input, flex: 1 }} type="number" step="0.01" placeholder="Ex : iPhone 1500€ → tapez 1500" value={achatMontant} onChange={e => setAchatMontant(e.target.value)} />
                    </div>
                    {achatMontant && parseFloat(achatMontant) > 0 && (() => {
                      const montant = parseFloat(achatMontant);
                      const resteApres = apresReserve - montant;
                      const possible = resteApres >= 0;
                      return (
                        <div style={{ ...S.achatResult, background: possible ? "#E1F5EE" : "#FCEBEB", color: possible ? "#0F6E56" : "#A32D2D" }}>
                          <i className={`ti ${possible ? "ti-circle-check" : "ti-circle-x"}`} aria-hidden="true" style={{ fontSize: 24 }} />
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 16 }}>{possible ? "Oui" : "Non"}</div>
                            <div style={{ fontSize: 12, marginTop: 2 }}>
                              {possible
                                ? `Après achat, il vous resterait ${formatEUR(resteApres)} au-delà de votre réserve.`
                                : `Il vous manquerait ${formatEUR(Math.abs(resteApres))} pour garder votre réserve de sécurité intacte.`}
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  <div style={{ ...S.card, marginTop: 14 }}>
                    <div style={S.cardTitle}><i className="ti ti-skull" aria-hidden="true" style={{ fontSize: 16, marginRight: 6, verticalAlign: -2 }} />Si je retire tout aujourd'hui ?</div>
                    {!showRetraitTout ? (
                      <button style={{ ...S.btnPrimary, background: "#A32D2D" }} onClick={() => setShowRetraitTout(true)}>RETIRER TOUT (simulation)</button>
                    ) : (
                      <div style={{ ...S.achatResult, background: "#FCEBEB", color: "#A32D2D", flexDirection: "column", alignItems: "flex-start" }}>
                        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 8 }}>
                          Dans {estimateData?.periode_courante?.jours_restants ?? "?"} jours, vos charges arrivent quand même :
                        </div>
                        <div style={S.netRow}><span>URSSAF</span><span>{formatEUR(urssaf)}</span></div>
                        <div style={S.netRow}><span>CFE</span><span>{formatEUR(cfe)}</span></div>
                        <div style={{ ...S.netRow, fontWeight: 700, borderTop: "1px solid #F7C1C1", paddingTop: 6, marginTop: 4 }}>
                          <span>Manque estimé</span><span>{formatEUR(chargesFutures)}</span>
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 700, marginTop: 10 }}>
                          {chargesFutures > 0 ? "🔴 Très mauvaise idée" : "🟢 Vous n'avez rien à provisionner pour l'instant"}
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })()}

        {nav === "score" && (() => {
          const info = scoreInfo(scoreSante);
          return (
            <div>
              <div style={S.pageHeader}><div><h1 style={S.pageTitle}>Score H€CTOR</h1><p style={S.pageSub}>Votre santé financière en un coup d'œil</p></div></div>
              <div style={{ ...S.card, textAlign: "center", padding: "40px 24px" }}>
                <div style={{ fontSize: 56, fontWeight: 700, color: info.color, lineHeight: 1 }}>{scoreSante !== null ? `${scoreSante}` : "—"}<span style={{ fontSize: 24, color: "#8BA5C0" }}>/100</span></div>
                <div style={{ fontSize: 16, fontWeight: 600, color: info.color, marginTop: 10 }}>{info.label}</div>
                <div style={{ fontSize: 13, color: "#6B7A8D", marginTop: 8, maxWidth: 380, marginLeft: "auto", marginRight: "auto" }}>{info.desc}</div>
              </div>
              {scoreSante !== null && (
                <div style={{ ...S.card, marginTop: 14 }}>
                  <div style={S.cardTitle}>Basé sur</div>
                  {[
                    { label: "Trésorerie vs charges à venir", icon: "ti-coin" },
                    { label: "Proximité de la prochaine échéance", icon: "ti-calendar-due" },
                    { label: "Position vis-à-vis du plafond annuel", icon: "ti-gauge" },
                    { label: "Disponible après réserve de sécurité", icon: "ti-shield" },
                  ].map((f, i) => (
                    <div key={i} style={S.paniqueLine}><span style={S.paniqueLineLabel}><i className={`ti ${f.icon}`} aria-hidden="true" style={{ fontSize: 15, marginRight: 8, color: "#8BA5C0" }} />{f.label}</span></div>
                  ))}
                </div>
              )}
            </div>
          );
        })()}

        {nav === "coach" && (
          <div>
            <div style={S.pageHeader}><div><h1 style={S.pageTitle}>Coach prix</h1><p style={S.pageSub}>Savez-vous combien vous gagnez vraiment de l'heure ?</p></div></div>
            <div style={S.card}>
              <label style={S.label}>Heures travaillées cette année (estimation)
                <input style={S.input} type="number" placeholder="Ex : 800" value={heuresTravaillees} onChange={e => setHeuresTravaillees(e.target.value)} />
              </label>
              {tauxHoraireReel !== null && estimateData && (
                <div style={{ marginTop: 16 }}>
                  <div style={S.paniqueResult}>
                    <span style={S.paniqueResultLabel}>Votre taux horaire réel (après charges)</span>
                    <span style={{ ...S.paniqueResultValue, color: tauxHoraireReel < 25 ? "#A32D2D" : tauxHoraireReel < 40 ? "#854F0B" : ACCENT }}>{formatEUR(tauxHoraireReel)}/h</span>
                  </div>
                  {tauxHoraireReel < 40 && (
                    <div style={{ ...S.achatResult, background: "#FAEEDA", color: "#854F0B", marginTop: 12 }}>
                      <i className="ti ti-trending-up" aria-hidden="true" style={{ fontSize: 20 }} />
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>Pour viser 40€/h réel</div>
                        <div style={{ fontSize: 12, marginTop: 2 }}>
                          Il faudrait facturer au moins {formatEUR(Math.round((40 * heuresNum) / (1 - (estimateData.taux_global_pct / 100))))} de CA brut sur l'année, contre {formatEUR(estimateData.ca_annuel)} actuellement.
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
              <p style={{ fontSize: 11, color: "#8BA5C0", marginTop: 14 }}>Calcul basé sur votre CA annuel actuel et le nombre d'heures que vous indiquez — à ajuster au fil de l'année.</p>
            </div>
          </div>
        )}

        {nav === "societe" && (
          <div>
            <div style={S.pageHeader}><div><h1 style={S.pageTitle}>Passage en société ?</h1><p style={S.pageSub}>Auto-entrepreneur, SASU ou EURL — où en êtes-vous</p></div></div>
            {estimateData && estimateData.disponible !== false && (() => {
              const pct = estimateData.pourcentage_plafond;
              let niveau = "vert", titre = "Pas encore nécessaire", texte = "Votre activité reste confortablement dans le cadre du régime micro-entrepreneur.";
              if (pct > 80) { niveau = "rouge"; titre = "À étudier sérieusement"; texte = "Vous approchez du plafond. Une société vous permettrait de continuer à grandir sans limite de CA, avec une vraie déduction des charges."; }
              else if (pct > 50) { niveau = "orange"; titre = "À garder en tête"; texte = "Pas urgent, mais commencez à vous renseigner — le passage en société prend du temps à préparer."; }
              const colors = { vert: "#1D9E75", orange: "#EF9F27", rouge: "#E24B4A" };
              return (
                <div style={{ ...S.card, display: "flex", alignItems: "center", gap: 16 }}>
                  <div style={{ width: 16, height: 16, borderRadius: "50%", background: colors[niveau], flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 600, color: INK }}>{titre}</div>
                    <div style={{ fontSize: 13, color: "#6B7A8D", marginTop: 4 }}>{texte}</div>
                  </div>
                </div>
              );
            })()}
            <div style={{ ...S.card, marginTop: 14 }}>
              <div style={S.cardTitle}>Les grandes différences</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, fontSize: 12 }}>
                <div><strong>Auto-entrepreneur</strong><p style={{ color: "#6B7A8D" }}>Simple, % fixe sur le CA, plafonné</p></div>
                <div><strong>EURL</strong><p style={{ color: "#6B7A8D" }}>Charges déductibles, IS ou IR, comptabilité complète</p></div>
                <div><strong>SASU</strong><p style={{ color: "#6B7A8D" }}>Statut assimilé salarié, charges plus lourdes mais protection sociale renforcée</p></div>
              </div>
              <p style={{ fontSize: 11, color: "#8BA5C0", marginTop: 14 }}>Cette analyse est indicative. Un expert-comptable reste indispensable avant de changer de statut.</p>
            </div>
          </div>
        )}

        {nav === "modeles" && (
          <div>
            <div style={S.pageHeader}><div><h1 style={S.pageTitle}>Modèles</h1><p style={S.pageSub}>Des textes prêts à copier-coller</p></div></div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {[
                { titre: "Relance impayé", texte: "Bonjour [Nom],\n\nJe me permets de revenir vers vous concernant la facture [N°] du [date], d'un montant de [montant]€, dont l'échéance est dépassée.\n\nPourriez-vous me confirmer la date de règlement prévue ?\n\nBien à vous," },
                { titre: "Hausse de tarifs", texte: "Bonjour [Nom],\n\nJe vous informe qu'à compter du [date], mes tarifs évoluent à [nouveau tarif].\n\nCette révision reflète [raison : montée en compétence / coûts / etc.]. Je reste à votre disposition pour en discuter.\n\nCordialement," },
                { titre: "Email de prospection", texte: "Bonjour [Nom],\n\nJe me permets de vous contacter au sujet de [besoin identifié]. Je propose [votre service] et pense pouvoir vous aider sur ce point.\n\nSeriez-vous disponible pour un échange rapide cette semaine ?\n\nBien à vous," },
                { titre: "CGV simplifiées", texte: "Conditions Générales de Vente\n\n1. Les prestations sont facturées au tarif en vigueur au moment de la commande.\n2. Le règlement est dû à réception de facture, sauf accord contraire.\n3. Tout retard de paiement entraîne des pénalités au taux légal en vigueur.\n4. TVA non applicable, article 293 B du CGI." },
              ].map((m, i) => (
                <div key={i} style={S.card}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: INK }}>{m.titre}</span>
                    <button style={S.btnSecondary} onClick={() => navigator.clipboard?.writeText(m.texte)}>
                      <i className="ti ti-copy" aria-hidden="true" style={{ fontSize: 14, marginRight: 4 }} />Copier
                    </button>
                  </div>
                  <pre style={S.modelText}>{m.texte}</pre>
                </div>
              ))}
            </div>
          </div>
        )}

        {nav === "revenus" && (
          <div>
            <div style={S.pageHeader}>
              <div><h1 style={S.pageTitle}>Revenus</h1><p style={S.pageSub}>Tous vos encaissements</p></div>
              <button style={S.btnPrimarySmall} onClick={() => setShowAddIncome(!showAddIncome)}>+ Ajouter</button>
            </div>

            {showAddIncome && (
              <div style={{ ...S.card, marginBottom: 16 }}>
                <label style={S.dropZoneSmall}>
                  <input type="file" accept="application/pdf,image/jpeg,image/png" onChange={e => e.target.files[0] && handleUploadInvoice(e.target.files[0])} style={{ display: "none" }} />
                  {uploadingFile ? "Lecture en cours…" : "＋ Importer une facture (PDF, JPG, PNG)"}
                </label>
                <p style={S.orDivider}>ou saisie manuelle</p>
                <form style={{ display: "flex", flexDirection: "column", gap: 10 }} onSubmit={handleAddIncome}>
                  <input style={S.input} type="date" value={incomeForm.date} onChange={e => setIncomeForm({ ...incomeForm, date: e.target.value })} required />
                  <input style={S.input} type="number" step="0.01" placeholder="Montant reçu du client €" value={incomeForm.amount} onChange={e => setIncomeForm({ ...incomeForm, amount: e.target.value })} required />
                  {incomeForm.amount && parseFloat(incomeForm.amount) > 0 && (() => {
                    const taux = estimateData?.taux_global_pct ? estimateData.taux_global_pct / 100 : 0.214;
                    const brut = parseFloat(incomeForm.amount);
                    const urssaf = Math.round(brut * taux * 100) / 100;
                    const net = Math.round((brut - urssaf) * 100) / 100;
                    return (
                      <div style={S.netPreview}>
                        <div style={S.netRow}><span style={{ color: "#854F0B" }}>URSSAF à mettre de côté ({estimateData?.taux_global_pct ?? 21.4}%)</span><span style={{ color: "#854F0B" }}>−{formatEUR(urssaf)}</span></div>
                        <div style={{ ...S.netRow, borderTop: "1px solid #DDE5EE", paddingTop: 8, marginTop: 4 }}><span style={{ fontWeight: 500 }}>Dans votre poche</span><span style={{ fontWeight: 600, color: ACCENT }}>{formatEUR(net)}</span></div>
                      </div>
                    );
                  })()}
                  <input style={S.input} type="text" placeholder="Description (optionnel)" value={incomeForm.description} onChange={e => setIncomeForm({ ...incomeForm, description: e.target.value })} />
                  <button style={S.btnPrimary} type="submit">Ajouter</button>
                </form>
              </div>
            )}
            <div style={S.card}>
              {incomeList.length === 0 ? <p style={S.empty}>Aucun revenu enregistré.</p> : incomeList.map(entry => (
                <div key={entry.id} style={S.incomeRow}>
                  <div style={{ flex: 1 }}>
                    <span style={S.incomeAmt}>{formatEUR(entry.amount)}</span>
                    <span style={S.incomeMeta}>{formatDate(entry.date)}{entry.description ? ` · ${entry.description}` : ""}</span>
                  </div>
                  <span style={{ ...S.badge, ...(entry.source === "facture" ? S.badgeGreen : S.badgeGray) }}>{entry.source === "facture" ? "Facture" : "Manuel"}</span>
                  <button style={S.deleteBtn} onClick={() => handleDeleteIncome(entry.id)}>✕</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {nav === "factures" && (
          <div>
            <div style={S.pageHeader}>
              <div><h1 style={S.pageTitle}>Factures</h1><p style={S.pageSub}>Créez et envoyez vos factures</p></div>
              <button style={S.btnPrimarySmall} onClick={() => setShowNewFacture(!showNewFacture)}>+ Nouvelle facture</button>
            </div>
            {showNewFacture && (
              <div style={{ ...S.card, marginBottom: 16 }}>
                <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 500 }}>Nouvelle facture</h3>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                  <input style={S.input} placeholder="Nom du client" value={factureForm.client_nom} onChange={e => setFactureForm({ ...factureForm, client_nom: e.target.value })} />
                  <input style={S.input} placeholder="Email du client" type="email" value={factureForm.client_email} onChange={e => setFactureForm({ ...factureForm, client_email: e.target.value })} />
                </div>
                <input style={{ ...S.input, marginBottom: 16 }} placeholder="Adresse du client" value={factureForm.client_adresse} onChange={e => setFactureForm({ ...factureForm, client_adresse: e.target.value })} />
                <div style={S.factureHeaderRow}>
                  <span style={{ flex: 3, fontSize: 12, color: "#6B7A8D" }}>Description</span>
                  <span style={{ flex: 1, fontSize: 12, color: "#6B7A8D", textAlign: "center" }}>Qté</span>
                  <span style={{ flex: 1, fontSize: 12, color: "#6B7A8D", textAlign: "right" }}>Prix unitaire</span>
                  <span style={{ flex: 1, fontSize: 12, color: "#6B7A8D", textAlign: "right" }}>Total</span>
                </div>
                {factureForm.lignes.map((l, i) => (
                  <div key={i} style={S.factureRow}>
                    <input style={{ ...S.input, flex: 3 }} placeholder="Prestation" value={l.description} onChange={e => updateLigne(i, "description", e.target.value)} />
                    <input style={{ ...S.input, flex: 1, textAlign: "center" }} type="number" min="1" value={l.quantite} onChange={e => updateLigne(i, "quantite", e.target.value)} />
                    <input style={{ ...S.input, flex: 1, textAlign: "right" }} type="number" step="0.01" placeholder="0,00" value={l.prix_unitaire} onChange={e => updateLigne(i, "prix_unitaire", e.target.value)} />
                    <span style={{ flex: 1, textAlign: "right", fontSize: 13, fontWeight: 500, padding: "0 8px" }}>{formatEUR((parseFloat(l.quantite) || 0) * (parseFloat(l.prix_unitaire) || 0))}</span>
                  </div>
                ))}
                <button style={{ ...S.linkBtn, marginBottom: 16 }} onClick={addFactureLigne}>+ Ajouter une ligne</button>
                <div style={{ ...S.netPreview, marginBottom: 12 }}>
                  <div style={{ ...S.netRow, fontWeight: 600 }}><span>Total HT</span><span>{formatEUR(totalFacture())}</span></div>
                  <div style={{ ...S.netRow, fontSize: 11, color: "#6B7A8D" }}><span>TVA non applicable — article 293 B du CGI</span><span>0,00 €</span></div>
                  <div style={{ ...S.netRow, fontWeight: 600, borderTop: "1px solid #DDE5EE", paddingTop: 8, marginTop: 4 }}><span>Total TTC</span><span>{formatEUR(totalFacture())}</span></div>
                </div>
                <textarea style={{ ...S.input, height: 60, resize: "none" }} placeholder="Notes (optionnel)" value={factureForm.notes} onChange={e => setFactureForm({ ...factureForm, notes: e.target.value })} />
                <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
                  <button style={S.btnPrimary} onClick={saveFacture}>Enregistrer et envoyer</button>
                  <button style={S.btnSecondary} onClick={() => setShowNewFacture(false)}>Annuler</button>
                </div>
              </div>
            )}
            <div style={S.card}>
              {factures.length === 0 ? <p style={S.empty}>Aucune facture créée. Commencez par en créer une !</p> : factures.map((f, i) => (
                <div key={i} style={S.incomeRow}>
                  <div style={{ flex: 1 }}>
                    <span style={S.incomeAmt}>{f.numero} — {f.client_nom}</span>
                    <span style={S.incomeMeta}>{formatDate(f.date)} · {formatEUR(f.total)}</span>
                  </div>
                  <span style={{ ...S.badge, ...S.badgeGreen }}>{f.statut}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {nav === "contacts" && (
          <div>
            <div style={S.pageHeader}>
              <div><h1 style={S.pageTitle}>Contacts</h1><p style={S.pageSub}>Vos clients</p></div>
              <button style={S.btnPrimarySmall} onClick={() => setShowAddContact(!showAddContact)}>+ Ajouter</button>
            </div>
            {showAddContact && (
              <div style={{ ...S.card, marginBottom: 16 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <input style={S.input} placeholder="Nom / Société" value={contactForm.nom} onChange={e => setContactForm({ ...contactForm, nom: e.target.value })} />
                  <input style={S.input} placeholder="Email" value={contactForm.email} onChange={e => setContactForm({ ...contactForm, email: e.target.value })} />
                  <input style={S.input} placeholder="SIRET (optionnel)" value={contactForm.siret} onChange={e => setContactForm({ ...contactForm, siret: e.target.value })} />
                  <input style={S.input} placeholder="Adresse" value={contactForm.adresse} onChange={e => setContactForm({ ...contactForm, adresse: e.target.value })} />
                </div>
                <button style={{ ...S.btnPrimary, marginTop: 12 }} onClick={() => { setContacts(c => [...c, { ...contactForm, id: Date.now() }]); setContactForm({ nom: "", email: "", siret: "", adresse: "" }); setShowAddContact(false); }}>Enregistrer</button>
              </div>
            )}
            {factures.length > 0 && (() => {
              const parClient = {};
              factures.forEach(f => { parClient[f.client_nom] = (parClient[f.client_nom] || 0) + f.total; });
              const totalCa = Object.values(parClient).reduce((a, b) => a + b, 0);
              const meilleur = Object.entries(parClient).sort((a, b) => b[1] - a[1])[0];
              const concentration = meilleur && totalCa > 0 ? Math.round((meilleur[1] / totalCa) * 100) : 0;
              return (
                <div style={{ ...S.card, marginBottom: 16 }}>
                  <div style={S.cardTitle}>Analyse client</div>
                  <div style={S.paniqueLine}><span style={S.paniqueLineLabel}><i className="ti ti-trophy" aria-hidden="true" style={{ fontSize: 15, marginRight: 8, color: "#EF9F27" }} />Meilleur client</span><span style={{ fontWeight: 600 }}>{meilleur?.[0]} ({formatEUR(meilleur?.[1])})</span></div>
                  {concentration >= 50 && (
                    <div style={{ ...S.achatResult, background: "#FAEEDA", color: "#854F0B", marginTop: 10 }}>
                      <i className="ti ti-alert-triangle" aria-hidden="true" style={{ fontSize: 18 }} />
                      <div style={{ fontSize: 12 }}><strong>{concentration}%</strong> de votre CA facturé vient d'un seul client. Risque de dépendance élevé.</div>
                    </div>
                  )}
                </div>
              );
            })()}
            <div style={S.card}>
              {contacts.length === 0 ? <p style={S.empty}>Aucun contact. Ajoutez vos clients pour pré-remplir vos factures.</p> : contacts.map(c => (
                <div key={c.id} style={S.incomeRow}>
                  <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#E6F1FB", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 500, color: "#0C447C", flexShrink: 0 }}>{c.nom.slice(0, 2).toUpperCase()}</div>
                  <div style={{ flex: 1, marginLeft: 10 }}>
                    <span style={S.incomeAmt}>{c.nom}</span>
                    <span style={S.incomeMeta}>{c.email}{c.siret ? ` · SIRET ${c.siret}` : ""}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {nav === "banque" && (
          <div>
            <div style={S.pageHeader}>
              <div><h1 style={S.pageTitle}>Connexion bancaire</h1><p style={S.pageSub}>Fini la saisie manuelle</p></div>
            </div>

            <div style={S.bankHero}>
              <i className="ti ti-plug-connected" aria-hidden="true" style={{ fontSize: 28, color: ACCENT, marginBottom: 12 }} />
              <h2 style={{ fontSize: 17, fontWeight: 600, color: INK, margin: "0 0 8px" }}>Bientôt : connectez votre banque en 30 secondes</h2>
              <p style={{ fontSize: 13, color: "#5B6573", lineHeight: 1.6, maxWidth: 520, margin: "0 auto" }}>
                Aujourd'hui, vous ajoutez vos revenus à la main ou via une facture. Une fois cette fonction activée, H€CTOR ira chercher directement vos encaissements sur votre compte bancaire — votre dashboard se remplira tout seul, chaque jour, sans rien faire.
              </p>
            </div>

            <div style={S.row2} className="row2-r">
              <div style={S.card}>
                <div style={S.cardTitle}>Comment ça marchera</div>
                {[
                  { n: "1", t: "Vous choisissez votre banque", d: "Qonto, Shine, Revolut Business, ou n'importe quelle banque classique." },
                  { n: "2", t: "Vous autorisez l'accès en lecture seule", d: "Comme sur l'appli officielle de votre banque — H€CTOR ne peut rien dépenser, juste lire vos encaissements." },
                  { n: "3", t: "Vos revenus se remplissent automatiquement", d: "Chaque virement reçu apparaît dans votre dashboard, et le calcul URSSAF se met à jour en temps réel." },
                ].map(s => (
                  <div key={s.n} style={S.conseilItem}>
                    <div style={{ ...S.conseilIcon, background: "#E6F1FB", color: "#0C447C", fontWeight: 600, fontSize: 13 }}>{s.n}</div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500, color: INK, marginBottom: 2 }}>{s.t}</div>
                      <div style={{ fontSize: 12, color: "#6B7A8D", lineHeight: 1.5 }}>{s.d}</div>
                    </div>
                  </div>
                ))}
              </div>

              <div style={S.card}>
                <div style={S.cardTitle}>Banques prévues au lancement</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  {[
                    { nom: "Qonto", icon: "ti-building-bank" },
                    { nom: "Shine", icon: "ti-sun" },
                    { nom: "Revolut Business", icon: "ti-credit-card" },
                    { nom: "Banque classique", icon: "ti-building-bank" },
                  ].map(b => (
                    <div key={b.nom} style={S.bankCard}>
                      <i className={`ti ${b.icon}`} aria-hidden="true" style={{ fontSize: 22, color: "#8BA5C0" }} />
                      <span style={{ fontSize: 12, color: "#6B7A8D", marginTop: 6, textAlign: "center" }}>{b.nom}</span>
                    </div>
                  ))}
                </div>
                <p style={{ fontSize: 11, color: "#8BA5C0", margin: "14px 0 0", textAlign: "center" }}>
                  Connexion sécurisée via un prestataire agréé (Open Banking / DSP2)
                </p>
              </div>
            </div>
          </div>
        )}

        {nav === "echeances" && (
          <div>
            <div style={S.pageHeader}><div><h1 style={S.pageTitle}>Échéances</h1><p style={S.pageSub}>Ne manquez aucune date importante</p></div></div>
            <div style={{ display: "flex", gap: 16, marginBottom: 14, fontSize: 12, color: "#6B7A8D" }}>
              <span>🔴 ≤ 7 jours</span><span>🟠 ≤ 15 jours</span><span>🟢 30+ jours</span>
            </div>
            <div style={S.card}>
              {[
                { date: "31 juillet 2026", label: "Déclaration URSSAF T2 2026", type: "URSSAF", urgence: estimateData?.periode_courante?.jours_restants },
                { date: "31 octobre 2026", label: "Déclaration URSSAF T3 2026", type: "URSSAF", urgence: null },
                { date: "15 décembre 2026", label: "CFE (Cotisation Foncière des Entreprises)", type: "Impôts", urgence: null },
                { date: "31 janvier 2027", label: "Déclaration URSSAF T4 2026", type: "URSSAF", urgence: null },
              ].map((e, i) => {
                const dotColor = e.urgence == null ? "#8BA5C0" : e.urgence <= 7 ? "#E24B4A" : e.urgence <= 15 ? "#EF9F27" : "#1D9E75";
                return (
                  <div key={i} style={{ ...S.newsItem, display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ width: 10, height: 10, borderRadius: "50%", background: dotColor, flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: INK }}>{e.label}</div>
                      <div style={{ fontSize: 12, color: "#6B7A8D", marginTop: 2 }}>{e.date}</div>
                    </div>
                    {e.urgence != null && <span style={{ ...S.alertChip, background: dotColor + "22", color: dotColor }}>{e.urgence}j restants</span>}
                    <span style={{ ...S.badge, ...(e.type === "URSSAF" ? S.badgeBlue : S.badgeOrange) }}>{e.type}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {nav === "actualites" && (
          <div>
            <div style={S.pageHeader}><div><h1 style={S.pageTitle}>Actualités fiscales</h1><p style={S.pageSub}>Les dernières nouvelles URSSAF et impôts</p></div></div>
            <div style={S.card}>
              {NEWS.map((n, i) => (
                <div key={i} style={{ ...S.newsItem, padding: "14px 0" }}>
                  <span style={S.newsSource}>{n.source}</span>
                  <a href={n.url} target="_blank" rel="noopener noreferrer" style={{ ...S.newsTitle, fontSize: 14, fontWeight: 500 }}>{n.title}</a>
                  <span style={S.newsDate}>{n.date}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {nav === "conseils" && (
          <div>
            <div style={S.pageHeader}><div><h1 style={S.pageTitle}>Conseils & optimisation</h1><p style={S.pageSub}>Personnalisés selon votre situation</p></div></div>
            <div style={S.card}>
              {CONSEILS.map((c, i) => (
                <div key={i} style={S.conseilItem}>
                  <div style={S.conseilIcon}><i className={`ti ${c.icon}`} aria-hidden="true" style={{ fontSize: 16 }} /></div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: INK, marginBottom: 4 }}>{c.titre}</div>
                    <div style={{ fontSize: 13, color: "#5B6573", lineHeight: 1.5 }}>{c.texte}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {nav === "assistant" && (
          <div>
            <div style={S.pageHeader}><div><h1 style={S.pageTitle}>Assistant IA</h1><p style={S.pageSub}>Posez toutes vos questions fiscales</p></div></div>
            <div style={{ ...S.card, display: "flex", flexDirection: "column", height: "calc(100vh - 200px)" }}>
              <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 12, paddingBottom: 16 }}>
                {aiMessages.map((m, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
                    <div style={{ ...S.aiMsg, ...(m.role === "user" ? S.aiMsgUser : S.aiMsgBot) }}>{m.content}</div>
                  </div>
                ))}
                {aiLoading && <div style={{ ...S.aiMsg, ...S.aiMsgBot, color: "#8BA5C0" }}>H€CTOR réfléchit…</div>}
              </div>
              <form style={{ display: "flex", gap: 10, borderTop: "1px solid #DDE5EE", paddingTop: 14 }} onSubmit={askAI}>
                <input style={{ ...S.input, flex: 1 }} placeholder="Posez votre question fiscale…" value={aiInput} onChange={e => setAiInput(e.target.value)} />
                <button style={S.btnPrimarySmall} type="submit" disabled={aiLoading}>Envoyer</button>
              </form>
            </div>
          </div>
        )}

        {nav === "abonnement" && (
          <div>
            <div style={S.pageHeader}><div><h1 style={S.pageTitle}>Abonnement</h1><p style={S.pageSub}>Choisissez la formule adaptée à vos besoins</p></div></div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
              {PLANS.map((p, i) => (
                <div key={i} style={{ ...S.card, ...(i === 1 ? { border: `2px solid ${ACCENT}` } : {}), position: "relative" }}>
                  {p.badge && <span style={{ position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)", background: ACCENT, color: "white", fontSize: 11, fontWeight: 600, padding: "3px 12px", borderRadius: 20 }}>{p.badge}</span>}
                  <div style={{ fontSize: 16, fontWeight: 600, color: INK, marginBottom: 4 }}>{p.nom}</div>
                  <div style={{ marginBottom: 16 }}>
                    <span style={{ fontSize: 30, fontWeight: 700, color: ACCENT }}>{p.prix}</span>
                    <span style={{ fontSize: 13, color: "#6B7A8D" }}>{p.periode}</span>
                  </div>
                  {p.features.map((f, j) => (
                    <div key={j} style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 13, color: "#3D4452", marginBottom: 8, lineHeight: 1.4 }}>
                      <span style={{ color: ACCENT, flexShrink: 0, marginTop: 1 }}>✓</span>{f}
                    </div>
                  ))}
                  <button style={{ ...S.btnPrimary, marginTop: 16, ...(i !== 1 ? { background: "white", color: ACCENT, border: `1px solid ${ACCENT}` } : {}) }}>
                    {i === 0 ? "Continuer gratuitement" : "Choisir ce plan"}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

const INK = "#0A2540";
const ACCENT = "#378ADD";
const PAPER = "#F0F4F8";

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap');
  * { box-sizing: border-box; }
  body { margin: 0; font-family: 'Inter', system-ui, sans-serif; background: ${PAPER}; }
  button { font-family: inherit; }
  @media (max-width: 768px) {
    .sidebar { width: 60px !important; }
    .kpi-grid-r { grid-template-columns: 1fr 1fr !important; }
    .row2-r { grid-template-columns: 1fr !important; }
    .plans-r { grid-template-columns: 1fr !important; }
  }
  input[type=number]::-webkit-inner-spin-button, input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
  input[type=number] { -moz-appearance: textfield; }
  input, select, textarea, button { transition: border-color 0.15s, background 0.15s, transform 0.1s; }
  input:focus, select:focus, textarea:focus { border-color: #378ADD !important; box-shadow: 0 0 0 3px rgba(55,138,221,0.12); }
  button:active { transform: scale(0.98); }
`;

const S = {
  authPage: { display: "flex", minHeight: "100vh" },
  authLeft: { flex: 1, background: INK, padding: "60px 48px", display: "flex", flexDirection: "column", justifyContent: "center" },
  authHero: { fontFamily: "Georgia, serif", fontSize: 32, fontWeight: 700, color: "white", margin: "24px 0 12px", lineHeight: 1.2 },
  authSub: { fontSize: 14, color: "#8BA5C0", lineHeight: 1.5, margin: "0 0 24px" },
  authFeatures: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 },
  authFeatureCard: { display: "flex", alignItems: "flex-start", gap: 10, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "12px 14px" },
  authFeatureTitle: { fontSize: 12, fontWeight: 600, color: "white", lineHeight: 1.3 },
  authFeatureDesc: { fontSize: 11, color: "#8BA5C0", lineHeight: 1.4, marginTop: 3 },
  simWidget: { marginTop: 36, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 14, padding: 18 },
  simInput: { flex: 1, fontFamily: "inherit", fontSize: 14, padding: "10px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.15)", outline: "none", background: "rgba(255,255,255,0.08)", color: "white" },
  simSelect: { flex: 1, fontFamily: "inherit", fontSize: 13, padding: "10px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.15)", outline: "none", background: "rgba(255,255,255,0.08)", color: "white" },
  authRight: { width: 460, background: PAPER, display: "flex", alignItems: "center", justifyContent: "center", padding: 40 },
  authCard: { width: "100%", background: "white", borderRadius: 16, border: "0.5px solid #DDE5EE", padding: 32 },
  authTitle: { fontSize: 20, fontWeight: 600, color: INK, margin: "0 0 20px" },
  appWrap: { display: "flex", minHeight: "100vh", background: PAPER },
  sidebar: { width: 220, background: INK, display: "flex", flexDirection: "column", padding: "20px 0", flexShrink: 0, transition: "width 0.2s" },
  sidebarClosed: { width: 64 },
  sidebarTop: { padding: "0 16px 24px", display: "flex", justifyContent: "center" },
  sidebarBottom: { marginTop: "auto", borderTop: "1px solid rgba(255,255,255,0.08)", padding: "16px 0 0" },
  navItem: { display: "flex", alignItems: "center", gap: 10, padding: "10px 18px", fontSize: 13, color: "#8BA5C0", cursor: "pointer", background: "none", border: "none", width: "100%", textAlign: "left", borderLeft: "3px solid transparent" },
  navItemActive: { color: "white", background: "rgba(255,255,255,0.06)", borderLeftColor: ACCENT },
  navLabel: { whiteSpace: "nowrap" },
  userRow: { display: "flex", alignItems: "center", gap: 10, padding: "10px 18px" },
  avatar: { width: 30, height: 30, borderRadius: "50%", background: ACCENT, display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: 11, fontWeight: 600, flexShrink: 0 },
  mainContent: { flex: 1, padding: "28px 32px", overflowY: "auto" },
  pageHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 },
  pageTitle: { fontSize: 22, fontWeight: 600, color: INK, margin: 0 },
  pageSub: { fontSize: 13, color: "#6B7A8D", margin: "4px 0 0" },
  kpiGrid: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 20 },
  kpiCard: { background: "white", borderRadius: 12, border: "0.5px solid #DDE5EE", padding: "16px 18px", display: "flex", flexDirection: "column", gap: 4 },
  kpiLabel: { fontSize: 11, color: "#6B7A8D", textTransform: "uppercase", letterSpacing: 0.5 },
  kpiValue: { fontSize: 24, fontWeight: 600, color: INK, fontVariantNumeric: "tabular-nums" },
  kpiSub: { fontSize: 11, color: "#8BA5C0" },
  row2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 },
  card: { background: "white", borderRadius: 12, border: "0.5px solid #DDE5EE", padding: "18px 20px", marginBottom: 0 },
  cardTitle: { fontSize: 14, fontWeight: 500, color: INK, marginBottom: 14, display: "flex", justifyContent: "space-between", alignItems: "center" },
  cardSub: { fontSize: 12, color: "#6B7A8D", fontWeight: 400 },
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
  achatResult: { display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderRadius: 10 },
  modelText: { fontSize: 12, color: "#3D4452", whiteSpace: "pre-wrap", fontFamily: "inherit", background: "#FAFBFC", border: "1px solid #EEF2F7", borderRadius: 8, padding: "12px 14px", margin: 0, lineHeight: 1.6 },
  inlineEditValue: { width: 90, fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, color: "#854F0B", padding: "4px 8px", borderRadius: 6, border: "1px solid #EEF2F7", textAlign: "right" },
  paniqueLine: { display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13, color: "#5B6573", padding: "9px 0", borderBottom: "0.5px solid #EEF2F7" },
  paniqueLineLabel: { display: "flex", alignItems: "center" },
  paniqueResult: { display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", paddingTop: 20, marginTop: 8 },
  paniqueResultLabel: { fontSize: 12, color: "#6B7A8D", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 },
  paniqueResultValue: { fontSize: 40, fontWeight: 700, fontVariantNumeric: "tabular-nums" },
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
