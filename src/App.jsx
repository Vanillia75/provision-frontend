import { useState, useEffect, useRef, useCallback } from "react";

const API_BASE = "https://provision-backend-production.up.railway.app";
const GOOGLE_CLIENT_ID = "1008678142157-vnr5cogc1rvhvenemcahi373adnvvpln.apps.googleusercontent.com";

const STATUTS = [
  { id: "auto_entrepreneur", label: "Auto-entrepreneur", disponible: true },
  { id: "sarl", label: "SARL (gérant)", disponible: false },
  { id: "sas", label: "SAS / SASU", disponible: false },
];

const ACTIVITES = [
  { id: "vente", label: "Vente de marchandises", taux: "12,3%", abattement: 0.71, seuilTva: 85000 },
  { id: "services", label: "Prestations de services", taux: "21,2%", abattement: 0.50, seuilTva: 37500 },
  { id: "bnc", label: "Profession libérale (BNC)", taux: "25,6%", abattement: 0.34, seuilTva: 37500 },
];

const TMI_OPTIONS = [
  { id: "0", label: "0% — je ne paie pas d'impôt actuellement" },
  { id: "11", label: "11%" },
  { id: "30", label: "30%" },
  { id: "41", label: "41%" },
  { id: "45", label: "45%" },
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
  const [factureExtraite, setFactureExtraite] = useState(null);
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
  const [panique, setPanique] = useState({ solde: "", urssaf: "", impots: "0", cfe: "0", dettes: "0" });
  const [tmi, setTmi] = useState(() => localStorage.getItem("tmi") || "0");
  const [simCa, setSimCa] = useState("3000");
  const [simActivite, setSimActivite] = useState("services");
  const [objectifAnnuel, setObjectifAnnuel] = useState(() => localStorage.getItem("objectifAnnuel") || "50000");
  const [objectifMensuel, setObjectifMensuel] = useState(() => localStorage.getItem("objectifMensuel") || "4200");
  const [objectifSaved, setObjectifSaved] = useState(false);
  const objectifMounted = useRef(false);
  const [objectifAnnuelSaved, setObjectifAnnuelSaved] = useState(false);
  const objectifAnnuelMounted = useRef(false);
  const [profilPrenom, setProfilPrenom] = useState(() => localStorage.getItem("profilPrenom") || "");
  const [profilNom, setProfilNom] = useState(() => localStorage.getItem("profilNom") || "");
  const [profilTelephone, setProfilTelephone] = useState(() => localStorage.getItem("profilTelephone") || "");
  const [profilEntreprise, setProfilEntreprise] = useState(() => localStorage.getItem("profilEntreprise") || "");
  const [profilSiret, setProfilSiret] = useState(() => localStorage.getItem("profilSiret") || "");
  const [siretLookupStatus, setSiretLookupStatus] = useState(""); // "", "loading", "success", "error"
  const [siretLookupMessage, setSiretLookupMessage] = useState("");
  const [outilsOpen, setOutilsOpen] = useState(false);
  const [montantCopie, setMontantCopie] = useState(false);
  const [caCopie, setCaCopie] = useState(false);
  const [declarationPeriode, setDeclarationPeriode] = useState("");
  const [declarationCa, setDeclarationCa] = useState("");
  const [declarationCotisations, setDeclarationCotisations] = useState("");
  const [editingDeclarationCa, setEditingDeclarationCa] = useState(false);
  const [editingDeclarationCotisations, setEditingDeclarationCotisations] = useState(false);
  const [historiqueDeclarations, setHistoriqueDeclarations] = useState(() => {
    try { return JSON.parse(localStorage.getItem("historiqueDeclarations") || "[]"); } catch { return []; }
  });
  const [objectifSecurite, setObjectifSecurite] = useState(() => localStorage.getItem("objectifSecurite") || "3000");
  const [depensesMensuelles, setDepensesMensuelles] = useState(() => localStorage.getItem("depensesMensuelles") || "");
  const [achatMontant, setAchatMontant] = useState("");
  const [tarifMontant, setTarifMontant] = useState("");
  const [tarifUnite, setTarifUnite] = useState("heure");
  const [heuresParJour, setHeuresParJourCoach] = useState("7");
  const [heuresParPrestation, setHeuresParPrestation] = useState("3");
  const [joursParSemaineCoach, setJoursParSemaineCoach] = useState("5");
  const [objectifHoraire, setObjectifHoraire] = useState("60");
  const [haussePct, setHaussePct] = useState("10");
  const [simFiscalCa, setSimFiscalCa] = useState("4000");
  const [simFiscalPeriode, setSimFiscalPeriode] = useState("mensuel");
  const [showRetraitTout, setShowRetraitTout] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(() => typeof window !== "undefined" && window.innerWidth <= 768);

  useEffect(() => {
    function handleResize() { setIsMobile(window.innerWidth <= 768); }
    window.addEventListener("resize", handleResize);
    handleResize();
    return () => window.removeEventListener("resize", handleResize);
  }, []);
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
      const isObj = body.detail && typeof body.detail === "object";
      const err = new Error(isObj ? (body.detail.message || "Erreur") : (body.detail || `Erreur (code ${res.status})`));
      if (isObj) err.detail = body.detail;
      throw err;
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
  useEffect(() => {
    if (!objectifAnnuelMounted.current) { objectifAnnuelMounted.current = true; return; }
    setObjectifAnnuelSaved(true);
    const t = setTimeout(() => setObjectifAnnuelSaved(false), 1200);
    return () => clearTimeout(t);
  }, [objectifAnnuel]);
  useEffect(() => { localStorage.setItem("objectifMensuel", objectifMensuel); }, [objectifMensuel]);
  useEffect(() => {
    if (!objectifMounted.current) { objectifMounted.current = true; return; }
    setObjectifSaved(true);
    const t = setTimeout(() => setObjectifSaved(false), 1200);
    return () => clearTimeout(t);
  }, [objectifMensuel]);
  useEffect(() => { localStorage.setItem("profilPrenom", profilPrenom); }, [profilPrenom]);
  useEffect(() => { localStorage.setItem("profilNom", profilNom); }, [profilNom]);
  useEffect(() => { localStorage.setItem("profilTelephone", profilTelephone); }, [profilTelephone]);
  useEffect(() => { localStorage.setItem("profilEntreprise", profilEntreprise); }, [profilEntreprise]);
  useEffect(() => { localStorage.setItem("profilSiret", profilSiret); }, [profilSiret]);
  useEffect(() => { localStorage.setItem("objectifSecurite", objectifSecurite); }, [objectifSecurite]);
  useEffect(() => { localStorage.setItem("depensesMensuelles", depensesMensuelles); }, [depensesMensuelles]);
  useEffect(() => { localStorage.setItem("tmi", tmi); }, [tmi]);

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

  async function handleLookupSiret() {
    if (!profilSiret) return;
    setSiretLookupStatus("loading");
    setSiretLookupMessage("");
    try {
      const data = await apiFetch(`/siret/lookup?siret=${encodeURIComponent(profilSiret)}`);
      if (data.raison_sociale) setProfilEntreprise(data.raison_sociale);
      await apiFetch("/profile/siret", {
        method: "POST",
        body: JSON.stringify({ siret: data.siret, raison_sociale: data.raison_sociale }),
      });
      setSiretLookupStatus("success");
      setSiretLookupMessage(data.raison_sociale ? `Trouvé : ${data.raison_sociale}` : "Établissement trouvé");
    } catch (err) {
      setSiretLookupStatus("error");
      setSiretLookupMessage(err.message);
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
    setError("");
    try {
      const form = new FormData();
      form.append("file", file);
      const data = await apiFetch("/income/extract", { method: "POST", body: form });
      setFactureExtraite({
        amount: String(data.amount),
        date: data.date,
        filename: data.filename,
        client: data.client || "",
        description: data.description || "",
        numero_facture: data.numero_facture || "",
        tva_pct: data.tva_pct,
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setUploadingFile(false);
    }
  }

  async function handleConfirmFacture(force = false) {
    try {
      await apiFetch("/income/confirm", {
        method: "POST",
        body: JSON.stringify({
          date: factureExtraite.date,
          amount: parseFloat(factureExtraite.amount) || 0,
          client: factureExtraite.client || null,
          description: factureExtraite.description || null,
          numero_facture: factureExtraite.numero_facture || null,
          filename: factureExtraite.filename || null,
          force,
        }),
      });
      setFactureExtraite(null);
      setShowAddIncome(false);
      await loadEverything();
    } catch (err) {
      if (err.detail?.code === "DOUBLON_POTENTIEL") {
        setFactureExtraite(f => ({ ...f, doublon: err.detail }));
      } else {
        setError(err.message);
      }
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
    const f = { ...factureForm, numero: num, date: new Date().toISOString().split("T")[0], total: totalFacture(), statut: "Brouillon enregistré" };
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
  const activiteInfo = ACTIVITES.find(a => a.id === profile?.activite);
  const revenuImposableAnnuel = activiteInfo ? (estimateData?.ca_annuel || 0) * (1 - activiteInfo.abattement) : 0;
  const impotsAnnuelEstime = Math.round(revenuImposableAnnuel * (parseFloat(tmi) / 100));
  const impotsNum = profile?.versement_liberatoire ? 0 : Math.round((impotsAnnuelEstime / 12) * 100) / 100;
  const cfeNum = parseFloat(panique.cfe) || 0;
  const totalChargesAVenir = urssafProvision + impotsNum + cfeNum;
  const securiteNum = parseFloat(objectifSecurite) || 0;
  const disponibleAujourdhui = panique.solde !== "" ? Math.round((soldeNum - totalChargesAVenir - securiteNum) * 100) / 100 : null;
  // Argent reellement sur le compte apres charges, AVANT reserve - ne doit jamais etre clampe a 0 a tort
  const argentDisponibleBrut = panique.solde !== "" ? Math.max(0, Math.round((soldeNum - totalChargesAVenir) * 100) / 100) : null;
  const reserveAtteinte = panique.solde !== "" ? (soldeNum - totalChargesAVenir) >= securiteNum : null;
  const manqueReserveDashboard = (panique.solde !== "" && !reserveAtteinte) ? Math.round((securiteNum - Math.max(0, soldeNum - totalChargesAVenir)) * 100) / 100 : 0;

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

  // --- Score sante HECTOR /100 : 5 composantes ponderees ---
  function calculScoreSante() {
    if (panique.solde === "" || !estimateData || estimateData.disponible === false) return null;
    const dettesNum = parseFloat(panique.dettes) || 0;

    // A. Tresorerie vs charges a venir (30 pts)
    let ptsTreso;
    if (totalChargesAVenir <= 0) ptsTreso = soldeNum >= 0 ? 30 : 0;
    else ptsTreso = Math.max(0, Math.min(30, Math.round((soldeNum / totalChargesAVenir) * 15)));

    // B. Reserve de securite couverte (20 pts)
    let ptsReserve;
    if (securiteNum <= 0) ptsReserve = 20;
    else ptsReserve = Math.max(0, Math.min(20, Math.round(((soldeNum - totalChargesAVenir) / securiteNum) * 20)));

    // C. URSSAF specifiquement provisionnee (20 pts)
    let ptsUrssaf;
    if (urssafProvision <= 0) ptsUrssaf = 20;
    else ptsUrssaf = Math.max(0, Math.min(20, Math.round((soldeNum / urssafProvision) * 20)));

    // D. Regularite du CA mois par mois (15 pts)
    const moisActifs = revenusParMois.filter(m => m.total > 0);
    let ptsRegularite = 7;
    if (moisActifs.length >= 2) {
      const moyenne = moisActifs.reduce((s, m) => s + m.total, 0) / moisActifs.length;
      const variance = moisActifs.reduce((s, m) => s + Math.pow(m.total - moyenne, 2), 0) / moisActifs.length;
      const cv = moyenne > 0 ? Math.sqrt(variance) / moyenne : 1;
      ptsRegularite = Math.max(0, Math.min(15, Math.round((1 - Math.min(cv, 1)) * 15)));
    }

    // E. Endettement vs CA annuel (15 pts)
    let ptsDette;
    if (dettesNum <= 0) ptsDette = 15;
    else {
      const ratioDette = dettesNum / Math.max(estimateData.ca_annuel || 1, 1);
      ptsDette = Math.max(0, Math.min(15, Math.round((1 - Math.min(ratioDette, 1)) * 15)));
    }

    return { total: Math.max(0, Math.min(100, ptsTreso + ptsReserve + ptsUrssaf + ptsRegularite + ptsDette)), ptsTreso, ptsReserve, ptsUrssaf, ptsRegularite, ptsDette };
  }
  const scoreDetail = calculScoreSante();
  const scoreSante = scoreDetail?.total ?? null;
  function scoreInfo(s) {
    if (s === null) return { label: "—", color: "#8BA5C0", desc: "Renseignez votre solde dans Scanner Financier pour calculer votre score." };
    if (s >= 75) return { label: "Excellent", color: "#1D9E75", desc: "Trésorerie, réserve et provisions sont solides." };
    if (s >= 45) return { label: "Correct", color: "#EF9F27", desc: "Quelques points de vigilance à surveiller." };
    return { label: "Risque élevé", color: "#E24B4A", desc: "Plusieurs indicateurs sont dans le rouge — agissez rapidement." };
  }

  // --- Coach prix : modele simplifie "combien facturez-vous", avec bornes realistes ---
  const tarifNum = parseFloat(tarifMontant) || 0;
  const hParJourCoach = Math.min(24, Math.max(0.5, parseFloat(heuresParJour) || 7)); // borne 0.5-24h/jour
  const hParPrestation = Math.min(200, Math.max(0.25, parseFloat(heuresParPrestation) || 3)); // borne realiste
  const jParSemaineCoach = Math.min(7, Math.max(0.5, parseFloat(joursParSemaineCoach) || 5)); // borne 0.5-7j/semaine
  const tauxHoraireReel = (() => {
    if (tarifNum <= 0) return null;
    if (tarifUnite === "heure") return Math.round(tarifNum * 100) / 100;
    if (tarifUnite === "jour") return Math.round((tarifNum / hParJourCoach) * 100) / 100;
    if (tarifUnite === "prestation") return Math.round((tarifNum / hParPrestation) * 100) / 100;
    return null;
  })();
  const revenuJournalierCoach = tauxHoraireReel !== null ? Math.round(tauxHoraireReel * hParJourCoach * 100) / 100 : null;
  const revenuMensuelCoach = revenuJournalierCoach !== null ? Math.round(revenuJournalierCoach * jParSemaineCoach * 4.33) : null;
  const revenuAnnuelCoach = revenuMensuelCoach !== null ? revenuMensuelCoach * 12 : null;
  const objHoraireNum = parseFloat(objectifHoraire) || 0;
  const ecartPctVersObjectif = (tauxHoraireReel !== null && tauxHoraireReel > 0 && objHoraireNum > 0)
    ? Math.round(((objHoraireNum - tauxHoraireReel) / tauxHoraireReel) * 100)
    : null;
  const niveauTarif = tauxHoraireReel === null ? null
    : tauxHoraireReel < 25 ? "rouge" : tauxHoraireReel < 45 ? "jaune" : "vert";
  const haussePctNum = Math.min(100, Math.max(0, parseFloat(haussePct) || 0));
  const tauxHoraireApresHausse = tauxHoraireReel !== null ? Math.round(tauxHoraireReel * (1 + haussePctNum / 100) * 100) / 100 : null;
  const gainMensuelHausse = (revenuMensuelCoach !== null && tauxHoraireApresHausse !== null && tauxHoraireReel)
    ? Math.round(revenuMensuelCoach * (haussePctNum / 100))
    : null;
  const gainAnnuelHausse = gainMensuelHausse !== null ? gainMensuelHausse * 12 : null;

  const [revenuViseMensuel, setRevenuViseMensuel] = useState("");
  const [quickAskQuestions, setQuickAskQuestions] = useState([
    "Combien puis-je me verser ce mois-ci ?",
    "Puis-je acheter un MacBook à 2000€ ?",
    "Quand vais-je dépasser mon plafond ?",
    "Mon activité est-elle en bonne santé ?",
  ]);

  // --- Simulateur de vie : combien gagner pour vivre comme je veux ---
  const revenuViseNum = parseFloat(revenuViseMensuel) || 0;
  const tauxGlobalDec = estimateData ? (estimateData.taux_global_pct || 0) / 100 : 0;
  const caMensuelNecessaire = (revenuViseNum > 0 && tauxGlobalDec < 1) ? Math.round(revenuViseNum / (1 - tauxGlobalDec)) : null;
  const caAnnuelNecessaire = caMensuelNecessaire !== null ? caMensuelNecessaire * 12 : null;
  const urssafAnnuelleVie = caAnnuelNecessaire !== null ? Math.round(caAnnuelNecessaire * tauxGlobalDec) : null;
  const impotsAnnuelsVie = (() => {
    if (caAnnuelNecessaire === null || profile?.versement_liberatoire || !activiteInfo) return 0;
    const revenuImposable = caAnnuelNecessaire * (1 - activiteInfo.abattement);
    return Math.round(revenuImposable * (parseFloat(tmi) / 100));
  })();
  const depassePlafondVie = caAnnuelNecessaire !== null && estimateData?.plafond ? caAnnuelNecessaire > estimateData.plafond : false;

  // --- TVA : detection du depassement du seuil de franchise en base ---
  const seuilTva = activiteInfo?.seuilTva || null;
  const pourcentageSeuilTva = seuilTva && estimateData?.ca_annuel != null ? Math.round((estimateData.ca_annuel / seuilTva) * 100) : null;
  const tvaProche = pourcentageSeuilTva !== null && pourcentageSeuilTva >= 80;
  const tvaDepasse = pourcentageSeuilTva !== null && pourcentageSeuilTva >= 100;

  // --- Mode salaire : combien puis-je me verser (3 niveaux) ---
  const baseSalaire = Math.max(0, disponibleAujourdhui || 0);
  const salairePrudent = Math.round(baseSalaire * 0.4);
  const salaireRecommande = Math.round(baseSalaire * 0.7);
  const salaireMaximum = Math.round(baseSalaire);

  // --- Mois de survie (si l'activite s'arrete demain) ---
  const moisEcoulesAnnee = new Date().getMonth() + 1;
  const moyenneMensuelleCA = estimateData?.ca_annuel != null ? estimateData.ca_annuel / moisEcoulesAnnee : 0;
  const depensesMensuellesNum = parseFloat(depensesMensuelles) || 0;
  const baseMensuelleSecurite = depensesMensuellesNum > 0 ? depensesMensuellesNum : moyenneMensuelleCA;
  const securitePrecise = depensesMensuellesNum > 0; // true si base sur vos vraies depenses, false si approxime sur le CA
  const tresorerieApresDettes = soldeNum - totalChargesAVenir;
  const moisSurvie = baseMensuelleSecurite > 0 && panique.solde !== "" ? Math.max(0, Math.round((tresorerieApresDettes / baseMensuelleSecurite) * 10) / 10) : null;
  const joursSurvie = moisSurvie !== null ? Math.round(moisSurvie * 30) : null;
  const dateRupture = joursSurvie !== null ? new Date(Date.now() + joursSurvie * 86400000) : null;

  // --- Projections fin de mois / fin d'annee, pour le Dashboard ---
  const aujourdhui = new Date();
  const jourDuMois = aujourdhui.getDate();
  const joursDansLeMois = new Date(aujourdhui.getFullYear(), aujourdhui.getMonth() + 1, 0).getDate();
  const caCeMoisCi = revenusParMois[aujourdhui.getMonth()]?.total || 0;
  const projectionFinMois = jourDuMois > 0 ? Math.round((caCeMoisCi / jourDuMois) * joursDansLeMois) : caCeMoisCi;
  const projectionFinAnnee = estimateData ? Math.round(moyenneMensuelleCA * 12) : null;

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
          <div style={isMobile ? { ...S.authFeatures, gridTemplateColumns: "1fr" } : S.authFeatures}>
            {[
              { icon: "ti-calculator", t: "Calcul URSSAF automatique", d: "Cotisations recalculées en temps réel selon vos revenus" },
              { icon: "ti-file-invoice", t: "Factures professionnelles", d: "Créez, numérotez et envoyez vos factures en 2 minutes" },
              { icon: "ti-radar-2", t: "Scanner Financier", d: "Sachez en un clic ce qu'il vous reste vraiment disponible" },
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
    <div style={isMobile ? { ...S.appWrap, display: "block" } : S.appWrap}>
      <style>{CSS}</style>

      {isMobile && (
        <div style={S.mobileTopbar}>
          <button style={{ ...S.navItem, padding: "6px 8px", width: "auto" }} onClick={() => setMobileMenuOpen(true)}>
            <i className="ti ti-menu-2" aria-hidden="true" style={{ fontSize: 24, color: "white" }} />
          </button>
          <Logo size={22} />
          <div style={{ width: 36 }} />
        </div>
      )}

      {isMobile && mobileMenuOpen && (
        <div style={S.sidebarBackdrop} onClick={() => setMobileMenuOpen(false)} />
      )}

      <aside
        style={
          isMobile
            ? { ...S.sidebar, position: "fixed", top: 0, left: 0, height: "100vh", width: 250, zIndex: 80, transform: mobileMenuOpen ? "translateX(0)" : "translateX(-100%)", transition: "transform 0.25s ease" }
            : { ...S.sidebar, ...(sidebarOpen ? {} : S.sidebarClosed) }
        }
      >
        <div style={S.sidebarTop}>
          {(!isMobile && !sidebarOpen) ? <LogoIcon size={32} /> : <Logo size={28} />}
          {isMobile && (
            <button style={{ ...S.navItem, padding: "4px 8px", width: "auto", marginLeft: "auto" }} onClick={() => setMobileMenuOpen(false)}>
              <i className="ti ti-x" aria-hidden="true" style={{ fontSize: 20 }} />
            </button>
          )}
        </div>

        {(isMobile || sidebarOpen) && (profilPrenom || profilEntreprise) && (
          <div style={S.sidebarGreeting}>
            {profilPrenom && <div style={{ fontSize: 14, fontWeight: 600, color: "white" }}>{profilPrenom} 👋</div>}
            {profilEntreprise && <div style={{ fontSize: 11, color: "#8BA5C0", marginTop: 2 }}>{profilEntreprise}{profile?.statut === "auto_entrepreneur" ? " · Auto-entrepreneur" : ""}</div>}
          </div>
        )}

        {[
          { id: "dashboard", icon: "ti-home", label: "Dashboard" },
          { id: "achat", icon: "ti-shopping-cart", label: "Mode Achat" },
          { id: "salaire", icon: "ti-cash", label: "Mode Salaire" },
          { id: "simulateur", icon: "ti-chart-pie", label: "Simulateur fiscal" },
          { id: "simvie", icon: "ti-target", label: "Simulateur de vie" },
          { id: "factures", icon: "ti-file", label: "Factures" },
          { id: "assistant", icon: "ti-message", label: "Assistant IA" },
          { id: "profil", icon: "ti-user", label: "Profil" },
        ].map(item => (
          <button key={item.id} style={{ ...S.navItem, ...(nav === item.id ? S.navItemActive : {}) }} onClick={() => { setNav(item.id); setMobileMenuOpen(false); }}>
            <i className={`ti ${item.icon}`} aria-hidden="true" style={{ fontSize: 18, flexShrink: 0 }} />
            {(isMobile || sidebarOpen) && <span style={S.navLabel}>{item.label}</span>}
          </button>
        ))}

        <button style={{ ...S.navItem, borderTop: "1px solid rgba(255,255,255,0.08)", marginTop: 8, paddingTop: 14 }} onClick={() => setOutilsOpen(!outilsOpen)}>
          <i className="ti ti-settings" aria-hidden="true" style={{ fontSize: 18, flexShrink: 0 }} />
          {(isMobile || sidebarOpen) && <span style={S.navLabel}>Outils</span>}
          {(isMobile || sidebarOpen) && <i className={`ti ${outilsOpen ? "ti-chevron-up" : "ti-chevron-down"}`} aria-hidden="true" style={{ fontSize: 14, marginLeft: "auto" }} />}
        </button>
        {outilsOpen && (isMobile || sidebarOpen) && [
          { id: "declaration", icon: "ti-clipboard-check", label: "Préparer ma déclaration" },
          { id: "coach", icon: "ti-target-arrow", label: "Coach prix" },
          { id: "score", icon: "ti-heart-rate-monitor", label: "Score H€CTOR" },
          { id: "revenus", icon: "ti-chart-bar", label: "Revenus" },
          { id: "contacts", icon: "ti-user", label: "Contacts" },
          { id: "actualites", icon: "ti-bell", label: "Actualités" },
          { id: "conseils", icon: "ti-star", label: "Conseils" },
          { id: "modeles", icon: "ti-template", label: "Modèles" },
          { id: "societe", icon: "ti-building", label: "Passage société" },
          { id: "abonnement", icon: "ti-crown", label: "Abonnement" },
        ].map(item => (
          <button key={item.id} style={{ ...S.navItem, paddingLeft: 28, ...(nav === item.id ? S.navItemActive : {}) }} onClick={() => { setNav(item.id); setMobileMenuOpen(false); }}>
            <i className={`ti ${item.icon}`} aria-hidden="true" style={{ fontSize: 15, flexShrink: 0 }} />
            <span style={{ ...S.navLabel, fontSize: 12 }}>{item.label}</span>
          </button>
        ))}
        <div style={S.sidebarBottom}>

          {!isMobile && (
            <button style={S.navItem} onClick={() => setSidebarOpen(!sidebarOpen)}>
              <i className={`ti ${sidebarOpen ? "ti-layout-sidebar-left-collapse" : "ti-layout-sidebar-left-expand"}`} aria-hidden="true" style={{ fontSize: 18 }} />
            </button>
          )}
          <div style={S.userRow}>
            <div style={S.avatar}>{userInitials}</div>
            {(isMobile || sidebarOpen) && <button style={S.linkBtn} onClick={handleLogout}>Déconnexion</button>}
          </div>
        </div>
      </aside>

      <main style={isMobile ? { ...S.mainContent, padding: "16px 14px" } : S.mainContent}>
        {error && <div style={S.errorBanner}>{error}</div>}

        {nav === "dashboard" && estimateData && (
          <div>
            <div style={isMobile ? { ...S.pageHeader, flexDirection: "column", alignItems: "flex-start", gap: 10 } : S.pageHeader}>
              <div>
                <h1 style={S.pageTitle}>Bonjour 👋</h1>
                <p style={S.pageSub}>Votre situation en un coup d'œil</p>
              </div>
              {estimateData.periode_courante?.jours_restants <= 30 && (
                <div style={S.alertChip}>
                  <i className="ti ti-clock" style={{ fontSize: 13 }} aria-hidden="true" />
                  Déclaration dans {estimateData.periode_courante.jours_restants}j
                </div>
              )}
            </div>

            <div style={S.soldeInputCard}>
              <label style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: "#6B7A8D" }}>💳 Solde actuel de votre compte</span>
                <input style={S.soldeInput} type="number" step="0.01" placeholder="Ex : 7842" value={panique.solde} onChange={e => setPanique({ ...panique, solde: e.target.value })} />
              </label>
              {panique.solde !== "" && <span style={{ ...S.badge, ...S.badgeGreen, flexShrink: 0 }}>🟢 Pris en compte</span>}
            </div>

            {estimateData.ca_annuel === 0 && (
              <div style={S.onboardingNotice}>
                <i className="ti ti-info-circle" aria-hidden="true" style={{ fontSize: 20, color: ACCENT, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: INK }}>Pour obtenir des calculs fiables</div>
                  <div style={{ fontSize: 12, color: "#5B6573", marginTop: 4, lineHeight: 1.6 }}>
                    <strong>1.</strong> Indiquez votre solde bancaire (ci-dessus)<br />
                    <strong>2.</strong> Ajoutez vos revenus encaissés
                  </div>
                </div>
                <button style={S.btnSecondary} onClick={() => setNav("revenus")}>+ Ajouter un revenu</button>
              </div>
            )}

            {/* ─── LA STAR : Argent réellement disponible, jamais masqué par la réserve ─── */}
            <div style={S.heroDispo}>
              <div style={S.heroDispoLabel}>💰 Argent disponible</div>
              {argentDisponibleBrut !== null ? (
                <div style={{ ...S.heroDispoValue, color: "#5DCAA5" }}>{formatEUR(argentDisponibleBrut)}</div>
              ) : (
                <div style={S.dispoEmpty}>Renseignez votre solde ci-dessus pour voir ce chiffre</div>
              )}
              {argentDisponibleBrut !== null && (
                <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 3, alignItems: "center", fontSize: 13 }}>
                  <div style={{ color: "rgba(255,255,255,0.85)" }}>
                    🛡️ Réserve de sécurité : <strong>{formatEUR(securiteNum)}</strong>
                    <span style={{ fontSize: 11, color: "#7A93AD", marginLeft: 4 }}>
                      {securitePrecise
                        ? "(basé sur vos dépenses)"
                        : baseMensuelleSecurite > 0 && securiteNum > 0
                          ? `(${Math.round(securiteNum / baseMensuelleSecurite * 10) / 10} mois de sécurité estimé)`
                          : "(montant personnalisé)"}
                    </span>
                  </div>
                  <div style={{ color: reserveAtteinte ? "#5DCAA5" : "#FAC775", fontWeight: 600 }}>
                    ➡️ Marge prudente : {formatEUR(Math.max(0, disponibleAujourdhui))}
                    {!reserveAtteinte && (
                      <span style={{ fontSize: 11, fontWeight: 400, color: "#FAC775", marginLeft: 4 }}>
                        (il manque {formatEUR(manqueReserveDashboard)} pour atteindre la réserve)
                      </span>
                    )}
                  </div>
                </div>
              )}
              {moisSurvie !== null && (
                <div style={{ ...S.heroDispoSub, marginTop: 4, fontSize: 12 }}>
                  🕐 soit environ {moisSurvie} mois de sécurité
                  {!securitePrecise && <span style={{ fontSize: 10, color: "#7A93AD" }}> (estimation sur votre CA — <button style={{ ...S.linkBtnLight, fontSize: 10 }} onClick={() => setNav("profil")}>indiquez vos dépenses réelles</button>)</span>}
                </div>
              )}
              {disponibleAujourdhui !== null && (
                <details style={{ marginTop: 16, textAlign: "left" }}>
                  <summary style={{ cursor: "pointer", fontSize: 12, color: "#8BA5C0", textAlign: "center" }}>Voir d'où vient ce chiffre</summary>
                  <div style={{ marginTop: 12, background: "rgba(255,255,255,0.04)", borderRadius: 10, padding: "12px 16px" }}>
                    <div style={S.heroDetailRow}>
                      <span>CA encaissé (année)</span>
                      <span>{estimateData.ca_annuel === 0 ? <span style={{ color: "#7A93AD", fontStyle: "italic", fontSize: 12 }}>Aucun revenu enregistré pour le moment</span> : formatEUR(estimateData.ca_annuel)}</span>
                    </div>
                    <div style={S.heroDetailRow}><span>Solde bancaire actuel</span><span>{formatEUR(soldeNum)}</span></div>
                    <div style={S.heroDetailRow}><span style={{ color: "#FAC775" }}>− URSSAF</span><span style={{ color: "#FAC775" }}>{formatEUR(urssafProvision)}</span></div>
                    <div style={S.heroDetailRow}><span style={{ color: "#FAC775" }}>− Impôts</span><span style={{ color: "#FAC775" }}>{formatEUR(impotsNum)}</span></div>
                    <div style={{ ...S.heroDetailRow, alignItems: "center" }}>
                      <span style={{ color: "#FAC775" }}>− Cotisation Foncière des Entreprises <span title="Impôt local annuel dû par la plupart des entreprises, même sans local professionnel dédié. Souvent autour de 200€/an pour un auto-entrepreneur, mais variable selon la commune." style={{ cursor: "help", borderBottom: "1px dotted #7A93AD" }}>(CFE) ⓘ</span> <span style={{ fontSize: 10, color: "#7A93AD" }}>{cfeNum === 0 ? "(souvent ~200€/an, à renseigner)" : "(forfait, modifiable)"}</span></span>
                      <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
                        <input
                          style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 6, color: "#FAC775", fontSize: 12, padding: "3px 6px", width: 70, textAlign: "right" }}
                          type="number" step="0.01" value={panique.cfe} onChange={e => setPanique({ ...panique, cfe: e.target.value })}
                        />
                        <span style={{ fontSize: 11, color: "#7A93AD" }}>€</span>
                      </span>
                    </div>
                    <div style={{ ...S.heroDetailRow, borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: 6, marginTop: 2 }}>
                      <span style={{ color: "#5DCAA5" }}>= Argent disponible (avant réserve)</span><span style={{ color: "#5DCAA5" }}>{formatEUR(argentDisponibleBrut)}</span>
                    </div>
                    <div style={{ ...S.heroDetailRow, alignItems: "center" }}>
                      <span style={{ color: "#B5D4F4" }}>− Réserve cible <span style={{ fontSize: 10, color: "#7A93AD" }}>({securiteNum > 0 && baseMensuelleSecurite > 0 ? `≈ ${Math.round(securiteNum / baseMensuelleSecurite * 10) / 10} mois` : "en €"})</span></span>
                      <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
                        <input
                          style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 6, color: "#B5D4F4", fontSize: 12, padding: "3px 6px", width: 70, textAlign: "right" }}
                          type="number" step="50" value={objectifSecurite} onChange={e => setObjectifSecurite(e.target.value)}
                        />
                        <span style={{ fontSize: 11, color: "#7A93AD" }}>€</span>
                      </span>
                    </div>
                    <div style={{ ...S.heroDetailRow, borderTop: "1px solid rgba(255,255,255,0.15)", paddingTop: 8, marginTop: 4, fontWeight: 700 }}>
                      <span style={{ color: reserveAtteinte ? "#5DCAA5" : "#FAC775" }}>= Disponible prudent (réserve gardée)</span><span style={{ color: reserveAtteinte ? "#5DCAA5" : "#FAC775" }}>{formatEUR(Math.max(0, disponibleAujourdhui))}</span>
                    </div>

                    <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid rgba(255,255,255,0.1)" }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "white", marginBottom: 2 }}>Combien de mois de sécurité voulez-vous garder ?</div>
                      <div style={{ fontSize: 11, color: "#8BA5C0", marginBottom: 8 }}>Choisissez une durée pour fixer votre réserve cible {securitePrecise ? "(basé sur vos dépenses réelles)" : "(estimation sur votre CA)"}</div>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {[1, 3, 6].map(m => (
                          <button key={m} type="button"
                            onClick={() => setObjectifSecurite(String(Math.round(baseMensuelleSecurite * m)))}
                            style={{ ...S.toggleBtn, background: "rgba(255,255,255,0.06)", borderColor: "rgba(255,255,255,0.2)", color: "white", flex: "0 1 auto", padding: "6px 12px" }}>
                            {m} mois
                          </button>
                        ))}
                      </div>
                      {depensesMensuellesNum === 0 && (
                        <div style={{ fontSize: 10, color: "#7A93AD", marginTop: 6 }}>
                          Sans vos dépenses réelles, ces boutons utilisent votre CA moyen ({formatEUR(moyenneMensuelleCA)}/mois) comme approximation — <button style={{ ...S.linkBtnLight, fontSize: 10 }} onClick={() => setNav("profil")}>préciser mes dépenses</button>
                        </div>
                      )}
                    </div>
                  </div>
                </details>
              )}
            </div>

            {argentDisponibleBrut !== null && (
              <div style={S.explainBanner}>
                Vous avez <strong>{formatEUR(argentDisponibleBrut)}</strong> disponibles. Après maintien de votre réserve, votre marge prudente est de <strong>{formatEUR(Math.max(0, disponibleAujourdhui))}</strong>{" "}
                <span style={{ fontSize: 11, color: "#5B82A8" }}>— c'est ce 2ème chiffre qu'utilisent Mode Achat et Mode Salaire.</span>
              </div>
            )}

            {/* ─── 4 choses en 5 secondes : mettre de côté / objectifs / projections / sécurité ─── */}
            <div style={isMobile ? { ...S.row2, gridTemplateColumns: "1fr" } : S.row2}>
              <div style={S.card}>
                <div style={S.cardTitle}>💸 Combien mettre de côté</div>
                {estimateData.ca_periode_courante > 0 ? (
                  <div style={{ textAlign: "center", padding: "8px 0" }}>
                    <div style={{ fontSize: 28, fontWeight: 700, color: "#854F0B" }}>{formatEUR(estimateData.montant_a_provisionner)}</div>
                    <div style={{ fontSize: 11, color: "#8BA5C0", marginTop: 4 }}>sur {formatEUR(estimateData.ca_periode_courante)} de revenus enregistrés, pour {estimateData.periode_courante?.label}</div>
                  </div>
                ) : (
                  <div style={{ textAlign: "center", padding: "16px 0" }}>
                    <p style={{ fontSize: 12, color: "#8BA5C0", margin: "0 0 10px" }}>0€ à mettre de côté car aucun revenu n'est encore enregistré.<br />Ceci ne dépend pas de votre solde bancaire.</p>
                    <button style={S.btnSecondary} onClick={() => setNav("revenus")}>+ Ajouter un revenu</button>
                  </div>
                )}
              </div>
              <div style={S.card}>
                <div style={S.cardTitle}>
                  <span>📈 Si ça continue ainsi</span>
                  <button style={S.linkBtn} onClick={() => setNav("revenus")}>Mes revenus →</button>
                </div>
                {estimateData.ca_annuel > 0 ? (
                  <>
                    <div style={S.projRow}>
                      <span>Fin du mois<br /><span style={{ fontSize: 10, color: "#8BA5C0" }}>au rythme de vos encaissements depuis le {jourDuMois} {MOIS[aujourdhui.getMonth()]}</span></span>
                      <strong>{formatEUR(projectionFinMois)}</strong>
                    </div>
                    <div style={S.projRow}>
                      <span>Fin de l'année<br /><span style={{ fontSize: 10, color: "#8BA5C0" }}>au rythme moyen depuis janvier</span></span>
                      <strong>{formatEUR(projectionFinAnnee)}</strong>
                    </div>
                  </>
                ) : (
                  <div style={{ textAlign: "center", padding: "16px 0" }}>
                    <p style={{ fontSize: 12, color: "#8BA5C0", margin: "0 0 10px" }}>Aucune projection disponible.<br />Ajoutez votre premier revenu encaissé.</p>
                    <button style={S.btnSecondary} onClick={() => setNav("revenus")}>+ Ajouter un revenu</button>
                  </div>
                )}
              </div>
            </div>

            {(() => {
              const objM = parseFloat(objectifMensuel) || 1;
              const pctM = Math.min(100, Math.round((caCeMoisCi / objM) * 100));
              const objA = parseFloat(objectifAnnuel) || 1;
              const pctA = Math.min(100, Math.round((estimateData.ca_annuel / objA) * 100));
              return (
                <>
                  <div style={{ ...S.card, marginTop: 14, border: `2px solid ${ACCENT}` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                      <span style={{ fontSize: 15, fontWeight: 700, color: INK }}>🎯 Objectif du mois</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: pctM >= 100 ? "#1D9E75" : ACCENT }}>{pctM}%</span>
                    </div>
                    <div style={{ fontSize: 10, color: "#8BA5C0", marginBottom: 6 }}>basé sur vos revenus encaissés enregistrés, pas sur votre solde bancaire</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, margin: "8px 0 10px" }}>
                      <span style={{ fontSize: 24, fontWeight: 700, color: INK }}>{formatEUR(caCeMoisCi)}</span>
                      <span style={{ fontSize: 13, color: "#8BA5C0" }}>sur</span>
                      <i className="ti ti-pencil" aria-hidden="true" style={{ fontSize: 13, color: "#8BA5C0" }} />
                      <input style={S.objectifInputBig} type="number" value={objectifMensuel} onChange={e => setObjectifMensuel(e.target.value)} />
                      <span style={{ fontSize: 12, color: objectifSaved ? "#1D9E75" : "transparent", transition: "opacity 0.3s", marginLeft: 4 }}>✓ enregistré</span>
                    </div>
                    <div style={{ ...S.progressTrack, height: 10 }}><div style={{ ...S.progressFill, background: pctM >= 100 ? "#1D9E75" : ACCENT, width: `${pctM}%`, transition: "width 0.3s ease" }} /></div>
                    {caCeMoisCi === 0 ? (
                      <div style={{ fontSize: 12, color: "#8BA5C0", marginTop: 6 }}>Aucun revenu enregistré ce mois-ci — <button style={S.linkBtn} onClick={() => setNav("revenus")}>en ajouter un</button></div>
                    ) : pctM >= 100 ? (
                      <div style={{ fontSize: 12, color: "#1D9E75", marginTop: 6, fontWeight: 600 }}>🎉 Objectif du mois atteint !</div>
                    ) : (
                      <div style={{ fontSize: 12, color: "#8BA5C0", marginTop: 6 }}>encore {formatEUR(Math.max(0, objM - caCeMoisCi))} pour l'atteindre</div>
                    )}
                  </div>

                  <div style={{ ...S.card, marginTop: 14, marginBottom: 20, border: "1.5px solid #5DCAA5" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                      <span style={{ fontSize: 15, fontWeight: 700, color: INK }}>🗓️ Objectif de l'année</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: pctA >= 100 ? "#1D9E75" : "#5DCAA5" }}>{pctA}%</span>
                    </div>
                    <div style={{ fontSize: 10, color: "#8BA5C0", marginBottom: 6 }}>basé sur vos revenus encaissés enregistrés, pas sur votre solde bancaire</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, margin: "8px 0 10px" }}>
                      <span style={{ fontSize: 24, fontWeight: 700, color: INK }}>{formatEUR(estimateData.ca_annuel)}</span>
                      <span style={{ fontSize: 13, color: "#8BA5C0" }}>sur</span>
                      <i className="ti ti-pencil" aria-hidden="true" style={{ fontSize: 13, color: "#8BA5C0" }} />
                      <input style={{ ...S.objectifInputBig, color: "#0F6E56", borderColor: "#5DCAA5", background: "#F0FAF6" }} type="number" value={objectifAnnuel} onChange={e => setObjectifAnnuel(e.target.value)} />
                      <span style={{ fontSize: 12, color: objectifAnnuelSaved ? "#1D9E75" : "transparent", transition: "opacity 0.3s", marginLeft: 4 }}>✓ enregistré</span>
                    </div>
                    <div style={S.progressTrack}><div style={{ ...S.progressFill, background: "#5DCAA5", width: `${pctA}%`, transition: "width 0.3s ease" }} /></div>
                    {estimateData.ca_annuel === 0 && (
                      <div style={{ fontSize: 12, color: "#8BA5C0", marginTop: 6 }}>Aucun revenu enregistré cette année — <button style={S.linkBtn} onClick={() => setNav("revenus")}>en ajouter un</button></div>
                    )}
                  </div>
                </>
              );
            })()}

            {statut && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: STATUT_INFO[statut].color }}>
                  {STATUT_INFO[statut].emoji} {STATUT_INFO[statut].label}
                </span>
              </div>
            )}

            {panique.solde !== "" && (() => {
              const manque = (disponibleAujourdhui ?? 0) < 0 ? Math.abs(disponibleAujourdhui) : 0;
              const recos = [];
              if (manque > 0) {
                recos.push({ icon: "ti-alert-triangle", text: `Mettre ${formatEUR(manque)} de côté pour couvrir vos charges et votre réserve de sécurité.`, urgent: true });
              }
              if (urssafProvision > 0 && estimateData?.periode_courante?.jours_restants <= 14) {
                recos.push({ icon: "ti-calendar-due", text: `Déclarer et payer vos cotisations URSSAF avant le ${formatDate(estimateData.periode_courante.date_limite_declaration)} (${estimateData.periode_courante.jours_restants}j restants).`, urgent: estimateData.periode_courante.jours_restants <= 7 });
              }
              if ((disponibleAujourdhui ?? 0) > securiteNum * 0.5 && (disponibleAujourdhui ?? 0) > 0) {
                recos.push({ icon: "ti-cash", text: `Vous avez de la marge — vous pourriez vous verser jusqu'à ${formatEUR(salaireRecommande)} sans risque (voir Mode Salaire).`, urgent: false });
              }
              if (tvaProche) {
                recos.push({ icon: "ti-receipt-tax", text: `Vous approchez du seuil de TVA (${pourcentageSeuilTva}%) — anticipez ce changement.`, urgent: tvaDepasse });
              }
              if (recos.length === 0) {
                recos.push({ icon: "ti-check", text: "Rien à signaler pour l'instant — votre situation est stable.", urgent: false });
              }
              return (
                <div style={{ ...S.card, marginBottom: 14 }}>
                  <div style={S.cardTitle}>🎯 Que faire maintenant ?</div>
                  {recos.map((r, i) => (
                    <div key={i} style={S.recoRow}>
                      <span style={{ ...S.recoNum, background: r.urgent ? "#FCEBEB" : "#E6F1FB", color: r.urgent ? "#A32D2D" : "#0C447C" }}>{i + 1}</span>
                      <span style={{ fontSize: 13, color: INK, lineHeight: 1.5 }}>{r.text}</span>
                    </div>
                  ))}
                </div>
              );
            })()}

            <button style={S.askHectorBtn} onClick={() => {
              setQuickAskQuestions([
                "Combien puis-je me verser ?",
                "Puis-je faire un achat important ?",
                "Combien dois-je mettre de côté ce mois-ci ?",
                "Suis-je en sécurité financièrement ce mois-ci ?",
              ]);
              setNav("assistant");
            }}>
              <i className="ti ti-message-circle-2" aria-hidden="true" style={{ fontSize: 20 }} />
              💬 Demander à H€CTOR — "Puis-je acheter ça ?", "Combien me verser ?"...
            </button>

            {estimateData.periode_courante && estimateData.periode_courante.jours_restants <= 14 && (
              <div style={{
                ...S.echeanceBanner,
                ...(estimateData.periode_courante.jours_restants <= 7 ? S.echeanceBannerUrgent : S.echeanceBannerWarning)
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <i className="ti ti-calendar-due" aria-hidden="true" style={{ fontSize: 20 }} />
                  <div style={{ fontSize: 13, fontWeight: 600 }}>
                    Déclaration URSSAF dans {estimateData.periode_courante.jours_restants} jours
                  </div>
                </div>
                <button onClick={() => setNav("declaration")}
                  style={{ fontSize: 12, fontWeight: 600, color: "inherit", background: "none", border: "none", cursor: "pointer", whiteSpace: "nowrap" }}>
                  Préparer →
                </button>
              </div>
            )}

            <div style={{ ...S.card, marginBottom: 20 }}>
              <div style={S.cardTitle}>
                <span><i className="ti ti-calculator" aria-hidden="true" style={{ fontSize: 16, marginRight: 6, verticalAlign: -2 }} />Simulation rapide</span>
                <span style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <button style={S.linkBtn} onClick={() => setNav("revenus")}>+ Ajouter un revenu →</button>
                  {simCa && <button style={S.linkBtn} onClick={() => setSimCa("")}>↺ Réinitialiser</button>}
                </span>
              </div>
              <p style={{ fontSize: 12, color: "#6B7A8D", margin: "0 0 12px" }}>Testez un montant sans l'ajouter à vos revenus.</p>
              <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
                <input style={{ ...S.input, flex: "1 1 160px" }} type="number" placeholder="J'encaisse..." value={simCa} onChange={e => setSimCa(e.target.value)} />
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
                      <div style={{ fontSize: 11, color: "#6B7A8D" }}>À mettre de côté</div>
                      <div style={{ fontSize: 22, fontWeight: 600, color: "#854F0B" }}>{formatEUR(urssafSim)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: "#6B7A8D" }}>Argent réellement disponible</div>
                      <div style={{ fontSize: 22, fontWeight: 600, color: ACCENT }}>{formatEUR(netSim)}</div>
                    </div>
                  </div>
                );
              })()}
            </div>

            <div style={isMobile ? { ...S.row2, gridTemplateColumns: "1fr" } : S.row2}>
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
                {tvaProche && (
                  <div style={{ ...S.card, background: tvaDepasse ? "#FCEBEB" : "#FAEEDA", border: `1px solid ${tvaDepasse ? "#E24B4A" : "#EF9F27"}` }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <i className="ti ti-receipt-tax" aria-hidden="true" style={{ fontSize: 20, color: tvaDepasse ? "#A32D2D" : "#854F0B" }} />
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: tvaDepasse ? "#A32D2D" : "#854F0B" }}>
                          {tvaDepasse ? "🔴 Franchise TVA dépassée" : "🟠 Vous approchez du seuil TVA"}
                        </div>
                        <div style={{ fontSize: 12, color: tvaDepasse ? "#A32D2D" : "#854F0B", marginTop: 2 }}>
                          Seuil de {formatEUR(seuilTva)} ({pourcentageSeuilTva}% atteint){tvaDepasse ? " — vous devez désormais facturer et reverser la TVA." : ", au-delà vous devrez facturer la TVA."}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
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

        {nav === "declaration" && estimateData && estimateData.disponible !== false && (() => {
          const periodeAffichee = declarationPeriode || estimateData.periode_courante?.label || "";
          const caAffiche = declarationCa !== "" ? parseFloat(declarationCa) || 0 : estimateData.ca_periode_courante;
          const cotisationsAffichees = declarationCotisations !== ""
            ? parseFloat(declarationCotisations) || 0
            : declarationCa !== ""
              ? Math.round((parseFloat(declarationCa) || 0) * ((estimateData.taux_global_pct || 0) / 100) * 100) / 100
              : estimateData.montant_a_provisionner;
          return (
            <div>
              <div style={isMobile ? { ...S.pageHeader, flexDirection: "column", alignItems: "flex-start", gap: 10 } : S.pageHeader}>
                <div><h1 style={S.pageTitle}>📋 Préparer ma déclaration</h1><p style={S.pageSub}>Tout est pré-rempli, modifiez si besoin</p></div>
                <button style={S.btnSecondary} onClick={() => setNav("revenus")}>Voir mes revenus</button>
              </div>

              <div style={{ ...S.card, textAlign: "center", padding: "20px 24px" }}>
                <div style={{ fontSize: 12, color: "#8BA5C0", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>Période de déclaration</div>
                <input style={{ ...S.input, textAlign: "center", fontWeight: 600 }} type="text" placeholder={estimateData.periode_courante?.label} value={declarationPeriode} onChange={e => setDeclarationPeriode(e.target.value)} />
                <div style={{ fontSize: 13, color: "#854F0B", marginTop: 8 }}>à déclarer avant le {formatDate(estimateData.periode_courante?.date_limite_declaration)} ({estimateData.periode_courante?.jours_restants}j restants)</div>
              </div>

              <div style={{ ...S.card, marginTop: 14 }}>
                <div style={S.paniqueLine}>
                  <span style={S.paniqueLineLabel}><i className="ti ti-chart-bar" aria-hidden="true" style={{ fontSize: 15, marginRight: 8, color: "#8BA5C0" }} />CA à déclarer</span>
                  {editingDeclarationCa ? (
                    <input
                      style={{ ...S.inlineEditValue, width: 110 }}
                      type="number" step="0.01" autoFocus
                      value={declarationCa !== "" ? declarationCa : String(estimateData.ca_periode_courante)}
                      onChange={e => setDeclarationCa(e.target.value)}
                      onBlur={() => setEditingDeclarationCa(false)}
                    />
                  ) : (
                    <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <strong style={{ fontFamily: "'IBM Plex Mono', monospace", color: "#0A2540" }}>{formatEUR(caAffiche)}</strong>
                      <button type="button" style={{ ...S.linkBtn, fontSize: 11, padding: 0 }} onClick={() => setEditingDeclarationCa(true)}>✎ Modifier</button>
                    </span>
                  )}
                </div>
                <div style={S.paniqueLine}>
                  <span style={S.paniqueLineLabel}><i className="ti ti-receipt" aria-hidden="true" style={{ fontSize: 15, marginRight: 8, color: "#EF9F27" }} />Cotisations estimées <span style={{ fontWeight: 400, color: "#8BA5C0", fontSize: 11 }}>({estimateData.taux_global_pct}%)</span></span>
                  {editingDeclarationCotisations ? (
                    <input
                      style={{ ...S.inlineEditValue, width: 110 }}
                      type="number" step="0.01" autoFocus
                      value={declarationCotisations !== "" ? declarationCotisations : String(cotisationsAffichees)}
                      onChange={e => setDeclarationCotisations(e.target.value)}
                      onBlur={() => setEditingDeclarationCotisations(false)}
                    />
                  ) : (
                    <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <strong style={{ fontFamily: "'IBM Plex Mono', monospace", color: "#854F0B" }}>{formatEUR(cotisationsAffichees)}</strong>
                      <button type="button" style={{ ...S.linkBtn, fontSize: 11, padding: 0 }} onClick={() => setEditingDeclarationCotisations(true)}>✎ Modifier</button>
                    </span>
                  )}
                </div>
                <div style={S.paniqueLine}>
                  <span style={S.paniqueLineLabel}><i className="ti ti-id" aria-hidden="true" style={{ fontSize: 15, marginRight: 8, color: "#8BA5C0" }} />Activité / statut</span>
                  <span style={{ fontSize: 12, color: "#6B7A8D" }}>{ACTIVITES.find(a => a.id === profile?.activite)?.label || "—"} · {profile?.statut === "auto_entrepreneur" ? "Auto-entrepreneur" : profile?.statut}</span>
                </div>
                {(declarationCa !== "" || declarationCotisations !== "" || declarationPeriode !== "") && (
                  <button style={{ ...S.linkBtn, marginTop: 8 }} onClick={() => { setDeclarationCa(""); setDeclarationCotisations(""); setDeclarationPeriode(""); }}>↺ Revenir aux valeurs calculées par H€CTOR</button>
                )}
              </div>

              <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
                <button
                  style={{ ...S.btnSecondary, flex: "1 1 140px", justifyContent: "center", display: "flex", alignItems: "center", gap: 6 }}
                  onClick={() => {
                    navigator.clipboard?.writeText(String(caAffiche));
                    setCaCopie(true);
                    setTimeout(() => setCaCopie(false), 2000);
                  }}
                >
                  <i className={`ti ${caCopie ? "ti-check" : "ti-copy"}`} aria-hidden="true" style={{ fontSize: 16 }} />
                  {caCopie ? "CA copié !" : "Copier le CA"}
                </button>
                <button
                  style={{ ...S.btnSecondary, flex: "1 1 140px", justifyContent: "center", display: "flex", alignItems: "center", gap: 6 }}
                  onClick={() => {
                    navigator.clipboard?.writeText(String(cotisationsAffichees));
                    setMontantCopie(true);
                    setTimeout(() => setMontantCopie(false), 2000);
                  }}
                >
                  <i className={`ti ${montantCopie ? "ti-check" : "ti-copy"}`} aria-hidden="true" style={{ fontSize: 16 }} />
                  {montantCopie ? "Cotisations copiées !" : "Copier les cotisations"}
                </button>
                <a
                  href="https://www.autoentrepreneur.urssaf.fr"
                  target="_blank" rel="noopener noreferrer"
                  style={{ ...S.btnPrimarySmall, flex: "1 1 140px", justifyContent: "center", display: "flex", alignItems: "center", gap: 6, textDecoration: "none" }}
                >
                  <i className="ti ti-external-link" aria-hidden="true" style={{ fontSize: 16 }} />
                  Ouvrir URSSAF
                </a>
              </div>

              <p style={{ fontSize: 11, color: "#8BA5C0", marginTop: 14, textAlign: "center" }}>
                H€CTOR prépare les montants, mais ne déclare pas à votre place — vérifiez toujours avant de valider sur le site officiel.
              </p>

              <div style={{ ...S.card, marginTop: 14 }}>
                <button
                  style={{ ...S.btnSecondary, width: "100%", justifyContent: "center", display: "flex", alignItems: "center", gap: 6 }}
                  onClick={() => {
                    const entry = { periode: periodeAffichee, ca: caAffiche, cotisations: cotisationsAffichees, date: new Date().toISOString() };
                    const next = [entry, ...historiqueDeclarations].slice(0, 12);
                    setHistoriqueDeclarations(next);
                    localStorage.setItem("historiqueDeclarations", JSON.stringify(next));
                  }}
                >
                  <i className="ti ti-check" aria-hidden="true" style={{ fontSize: 16 }} />
                  Marquer cette déclaration comme faite
                </button>

                {historiqueDeclarations.length > 0 && (
                  <div style={{ marginTop: 16 }}>
                    <div style={S.cardTitle}>Historique</div>
                    {historiqueDeclarations.map((h, i) => (
                      <div key={i} style={S.paniqueLine}>
                        <span style={S.paniqueLineLabel}>{h.periode} <span style={{ color: "#8BA5C0", fontSize: 11 }}>· déclaré le {new Date(h.date).toLocaleDateString("fr-FR")}</span></span>
                        <span style={{ fontSize: 13 }}>{formatEUR(h.ca)} CA · <strong>{formatEUR(h.cotisations)}</strong></span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        {nav === "achat" && (() => {
          const solde = soldeNum;
          const urssaf = urssafProvision;
          const cfe = cfeNum;
          const chargesFutures = totalChargesAVenir;
          const apresReserve = disponibleAujourdhui ?? 0;
          const score = statut || "vert";

          return (
            <div>
              <div style={isMobile ? { ...S.pageHeader, flexDirection: "column", alignItems: "flex-start", gap: 10 } : S.pageHeader}>
                <div><h1 style={S.pageTitle}>🛒 Mode Achat</h1><p style={S.pageSub}>Puis-je acheter ça sans me mettre en danger ?</p></div>
              </div>

              {panique.solde === "" ? (
                <div style={S.card}><p style={S.empty}>Renseignez d'abord votre solde sur le <button style={S.linkBtn} onClick={() => setNav("dashboard")}>Dashboard</button> pour utiliser ce simulateur.</p></div>
              ) : (
                <>
                  <div style={S.explainBanner}>
                    Vous avez <strong>{formatEUR(argentDisponibleBrut)}</strong> disponibles. Après maintien de votre réserve de sécurité, votre marge prudente est de <strong>{formatEUR(Math.max(0, apresReserve))}</strong>.
                    <span style={{ display: "block", fontSize: 11, color: "#5B82A8", marginTop: 4 }}>C'est cette marge prudente que H€CTOR utilise pour ses recommandations d'achat ci-dessous.</span>
                  </div>

                  <div style={{ ...S.card, border: `2px solid ${ACCENT}` }}>
                    <div style={S.cardTitle}>Puis-je me permettre cette dépense ?</div>
                    <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
                      <input style={{ ...S.input, flex: 1 }} type="number" step="0.01" placeholder="Ex : Jaguar E-PACE → tapez 18000" value={achatMontant} onChange={e => setAchatMontant(e.target.value)} />
                    </div>
                    {achatMontant && parseFloat(achatMontant) > 0 && (() => {
                      const montant = parseFloat(achatMontant);
                      const tresorerieApres = solde - montant;
                      const resteApres = apresReserve - montant;
                      const ratioApres = solde > 0 ? resteApres / solde : -1;

                      let verdict = "ok", verdictLabel = "✅ Recommandé", verdictColor = "#0F6E56", verdictBg = "#E1F5EE";
                      if (resteApres < 0) { verdict = "non"; verdictLabel = "❌ Déconseillé"; verdictColor = "#A32D2D"; verdictBg = "#FCEBEB"; }
                      else if (ratioApres < 0.15) { verdict = "prudence"; verdictLabel = "⚠️ Prudence"; verdictColor = "#854F0B"; verdictBg = "#FAEEDA"; }

                      const moisSurvieApres = baseMensuelleSecurite > 0 ? Math.max(0, Math.round(((tresorerieApres - chargesFutures) / baseMensuelleSecurite) * 10) / 10) : null;
                      const joursSurvieApres = moisSurvieApres !== null ? Math.round(moisSurvieApres * 30) : null;

                      return (
                        <div>
                          <div style={{ ...S.achatResult, background: verdictBg, color: verdictColor, marginBottom: 12 }}>
                            <i className={`ti ${verdict === "ok" ? "ti-circle-check" : verdict === "prudence" ? "ti-alert-triangle" : "ti-circle-x"}`} aria-hidden="true" style={{ fontSize: 26 }} />
                            <div style={{ fontWeight: 700, fontSize: 18 }}>{verdictLabel}</div>
                          </div>

                          <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
                            <div style={{ flex: 1, textAlign: "center", padding: "10px", background: "#F7F9F5", borderRadius: 8 }}>
                              <div style={{ fontSize: 10, color: "#8BA5C0", textTransform: "uppercase" }}>Disponible avant</div>
                              <div style={{ fontSize: 18, fontWeight: 700, color: INK }}>{formatEUR(Math.max(0, apresReserve))}</div>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", fontSize: 18, color: "#8BA5C0" }}>→</div>
                            <div style={{ flex: 1, textAlign: "center", padding: "10px", background: "#F7F9F5", borderRadius: 8 }}>
                              <div style={{ fontSize: 10, color: "#8BA5C0", textTransform: "uppercase" }}>Disponible après</div>
                              <div style={{ fontSize: 18, fontWeight: 700, color: resteApres < 0 ? "#A32D2D" : "#1D9E75" }}>{formatEUR(Math.max(0, resteApres))}</div>
                            </div>
                          </div>

                          {moisSurvieApres !== null && (
                            <div style={S.paniqueLine}>
                              <span style={S.paniqueLineLabel}>🛡️ Sécurité après achat</span>
                              <span style={{ fontWeight: 600, color: moisSurvieApres >= 3 ? "#1D9E75" : moisSurvieApres >= 1 ? "#854F0B" : "#A32D2D" }}>{moisSurvieApres} mois ({joursSurvieApres}j)</span>
                            </div>
                          )}
                          <div style={S.paniqueLine}><span style={S.paniqueLineLabel}>Impact sur vos provisions (URSSAF/CFE)</span><span>{tresorerieApres < chargesFutures ? "⚠️ menacées" : "✅ préservées"}</span></div>
                          <div style={{ fontSize: 12, color: "#6B7A8D", marginTop: 8 }}>
                            {verdict === "ok" && "Cet achat ne compromet ni vos charges futures ni votre réserve de sécurité."}
                            {verdict === "prudence" && "L'achat passe, mais il ne vous restera presque plus de marge ensuite."}
                            {verdict === "non" && <>Il vous manquerait <strong>{formatEUR(Math.abs(resteApres))}</strong> pour garder votre réserve de sécurité intacte.</>}
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  <div style={{ ...S.card, marginTop: 14 }}>
                    <div style={S.cardTitle}><i className="ti ti-skull" aria-hidden="true" style={{ fontSize: 16, marginRight: 6, verticalAlign: -2 }} />💀 Que se passe-t-il si je retire tout ?</div>
                    {!showRetraitTout ? (
                      <button style={{ ...S.btnPrimary, background: "#A32D2D" }} onClick={() => setShowRetraitTout(true)}>Simuler le retrait total</button>
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

        {nav === "simvie" && estimateData && estimateData.disponible !== false && (
          <div>
            <div style={isMobile ? { ...S.pageHeader, flexDirection: "column", alignItems: "flex-start", gap: 10 } : S.pageHeader}>
              <div><h1 style={S.pageTitle}>🎯 Combien dois-je gagner ?</h1><p style={S.pageSub}>Pour vivre comme vous voulez, combien faut-il facturer ?</p></div>
            </div>

            <div style={S.card}>
              <label style={S.label}>
                <span style={{ fontSize: 14, fontWeight: 600, color: INK }}>Je veux gagner net, par mois</span>
                <input style={{ ...S.input, fontSize: 22, fontWeight: 600, padding: "14px 16px", marginTop: 8 }} type="number" step="100" placeholder="Ex : 5000" value={revenuViseMensuel} onChange={e => setRevenuViseMensuel(e.target.value)} />
              </label>
            </div>

            {caMensuelNecessaire !== null && (
              <>
                <div style={{ ...S.card, marginTop: 14, textAlign: "center", padding: "32px 24px", background: INK }}>
                  <div style={{ fontSize: 12, color: "#8BA5C0", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>CA mensuel nécessaire</div>
                  <div style={{ fontSize: 44, fontWeight: 700, color: "#5DCAA5", marginTop: 6 }}>{formatEUR(caMensuelNecessaire)}</div>
                  <div style={{ fontSize: 13, color: "#B5D4F4", marginTop: 8 }}>soit {formatEUR(caAnnuelNecessaire)} de CA sur l'année</div>
                </div>

                <div style={{ ...S.card, marginTop: 14 }}>
                  <div style={S.cardTitle}>Le détail</div>
                  <div style={S.paniqueLine}><span style={S.paniqueLineLabel}>CA annuel nécessaire</span><span style={{ fontWeight: 600 }}>{formatEUR(caAnnuelNecessaire)}</span></div>
                  <div style={S.paniqueLine}><span style={S.paniqueLineLabel}>URSSAF (sur l'année)</span><span style={{ color: "#854F0B" }}>−{formatEUR(urssafAnnuelleVie)}</span></div>
                  {impotsAnnuelsVie > 0 && <div style={S.paniqueLine}><span style={S.paniqueLineLabel}>Impôts estimés (sur l'année)</span><span style={{ color: "#854F0B" }}>−{formatEUR(impotsAnnuelsVie)}</span></div>}
                  <div style={S.paniqueResult}>
                    <span style={S.paniqueResultLabel}>Revenu net mensuel obtenu</span>
                    <span style={{ ...S.paniqueResultValue, fontSize: 28, color: "#1D9E75" }}>{formatEUR(revenuViseNum)}/mois</span>
                  </div>
                </div>

                {depassePlafondVie && (
                  <div style={{ ...S.card, marginTop: 14, background: "#FCEBEB", border: "1px solid #E24B4A" }}>
                    <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                      <i className="ti ti-alert-triangle" aria-hidden="true" style={{ fontSize: 20, color: "#A32D2D", flexShrink: 0, marginTop: 2 }} />
                      <div style={{ fontSize: 13, color: "#A32D2D" }}>
                        Ce CA dépasserait le plafond auto-entrepreneur ({formatEUR(estimateData.plafond)}/an). Pour viser ce niveau de revenu durablement, il faudra envisager un passage en société.
                      </div>
                    </div>
                  </div>
                )}

                <p style={{ fontSize: 11, color: "#8BA5C0", marginTop: 14, textAlign: "center" }}>
                  Calcul basé sur votre taux de cotisations actuel ({estimateData.taux_global_pct}%) et votre tranche d'imposition.
                </p>
              </>
            )}
          </div>
        )}

        {nav === "salaire" && (
          <div>
            <div style={isMobile ? { ...S.pageHeader, flexDirection: "column", alignItems: "flex-start", gap: 10 } : S.pageHeader}><div><h1 style={S.pageTitle}>💸 Combien puis-je me verser ?</h1><p style={S.pageSub}>Trois niveaux, selon votre tolérance au risque</p></div></div>
            {panique.solde === "" ? (
              <div style={S.card}><p style={S.empty}>Renseignez d'abord votre solde dans <button style={S.linkBtn} onClick={() => setNav("dashboard")}>Dashboard</button> pour voir ce calcul.</p></div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {[
                  { emoji: "🟢", label: "Prudent", desc: "Marge confortable, idéal en période incertaine", montant: salairePrudent, color: "#1D9E75", border: "1px solid #EEF2F7" },
                  { emoji: "🔵", label: "Recommandé", desc: "Bon équilibre entre revenu et sécurité", montant: salaireRecommande, color: ACCENT, border: `2px solid ${ACCENT}` },
                  { emoji: "🔴", label: "Maximum", desc: "Tout le disponible — zéro marge supplémentaire après", montant: salaireMaximum, color: "#A32D2D", border: "1px solid #EEF2F7" },
                ].map(niveau => {
                  const tresorerieRestante = soldeNum - niveau.montant;
                  const moisApres = baseMensuelleSecurite > 0 ? Math.max(0, Math.round(((tresorerieRestante - totalChargesAVenir) / baseMensuelleSecurite) * 10) / 10) : null;
                  return (
                    <div key={niveau.label} style={{ ...S.card, border: niveau.border }}>
                      <div style={S.salaireRow}>
                        <div><div style={{ fontSize: 13, fontWeight: 600, color: INK }}>{niveau.emoji} {niveau.label}</div><div style={{ fontSize: 11, color: "#8BA5C0" }}>{niveau.desc}</div></div>
                        <div style={{ fontSize: 22, fontWeight: 700, color: niveau.color }}>{formatEUR(niveau.montant)}</div>
                      </div>
                      {moisApres !== null && (
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#6B7A8D", marginTop: 10, paddingTop: 10, borderTop: "0.5px solid #EEF2F7" }}>
                          <span>Trésorerie restante</span>
                          <span style={{ fontWeight: 600 }}>{formatEUR(Math.max(0, tresorerieRestante))} · 🛡️ {moisApres} mois de sécurité</span>
                        </div>
                      )}
                    </div>
                  );
                })}
                <p style={{ fontSize: 11, color: "#8BA5C0", textAlign: "center" }}>
                  Basé sur votre disponible après charges et réserve de sécurité ({formatEUR(disponibleAujourdhui || 0)}).
                </p>
              </div>
            )}
          </div>
        )}

        {nav === "simulateur" && estimateData && estimateData.disponible !== false && (() => {
          const caInput = parseFloat(simFiscalCa) || 0;
          const caAnnuelSim = simFiscalPeriode === "mensuel" ? caInput * 12 : caInput;
          const caAffiche = caInput;
          const tauxUrssaf = (estimateData.taux_global_pct || 0) / 100;
          const cotisationsSim = Math.round(caAffiche * tauxUrssaf * 100) / 100;
          const impotsSim = (() => {
            if (profile?.versement_liberatoire || !activiteInfo) return 0;
            const revenuImposable = caAnnuelSim * (1 - activiteInfo.abattement);
            const impotAnnuel = revenuImposable * (parseFloat(tmi) / 100);
            return Math.round((simFiscalPeriode === "mensuel" ? impotAnnuel / 12 : impotAnnuel) * 100) / 100;
          })();
          const disponibleSim = Math.max(0, Math.round((caAffiche - cotisationsSim - impotsSim) * 100) / 100);
          const total = Math.max(caAffiche, 1);
          const pctCotis = (cotisationsSim / total) * 100;
          const pctImpots = (impotsSim / total) * 100;
          const pctDispo = (disponibleSim / total) * 100;

          return (
            <div>
              <div style={isMobile ? { ...S.pageHeader, flexDirection: "column", alignItems: "flex-start", gap: 10 } : S.pageHeader}>
                <div><h1 style={S.pageTitle}>📊 Simulateur fiscal</h1><p style={S.pageSub}>Modifiez votre CA et voyez l'impact en direct</p></div>
              </div>

              <div style={S.card}>
                <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                  <button type="button" onClick={() => setSimFiscalPeriode("mensuel")} style={{ ...S.toggleBtn, ...(simFiscalPeriode === "mensuel" ? S.toggleBtnActive : {}) }}>Par mois</button>
                  <button type="button" onClick={() => setSimFiscalPeriode("annuel")} style={{ ...S.toggleBtn, ...(simFiscalPeriode === "annuel" ? S.toggleBtnActive : {}) }}>Par an</button>
                </div>
                <input style={{ ...S.input, fontSize: 22, fontWeight: 600, padding: "14px 16px" }} type="number" step="100" value={simFiscalCa} onChange={e => setSimFiscalCa(e.target.value)} />
              </div>

              <div style={{ ...S.card, marginTop: 14 }}>
                <div style={S.cardTitle}>Répartition de votre CA</div>
                <div style={S.simBarTrack}>
                  {pctDispo > 0 && <div style={{ ...S.simBarSeg, width: `${pctDispo}%`, background: "#1D9E75" }} />}
                  {pctCotis > 0 && <div style={{ ...S.simBarSeg, width: `${pctCotis}%`, background: "#EF9F27" }} />}
                  {pctImpots > 0 && <div style={{ ...S.simBarSeg, width: `${pctImpots}%`, background: "#A32D2D" }} />}
                </div>
                <div style={{ display: "flex", gap: 16, marginTop: 10, flexWrap: "wrap", fontSize: 11, color: "#6B7A8D" }}>
                  <span><span style={{ ...S.legendDot, background: "#1D9E75" }} />Disponible {Math.round(pctDispo)}%</span>
                  <span><span style={{ ...S.legendDot, background: "#EF9F27" }} />URSSAF {Math.round(pctCotis)}%</span>
                  {impotsSim > 0 && <span><span style={{ ...S.legendDot, background: "#A32D2D" }} />Impôts {Math.round(pctImpots)}%</span>}
                </div>
              </div>

              <div style={S.kpiGrid} className="kpi-grid-r" >
                <div style={S.kpiCard}><span style={S.kpiLabel}>CA {simFiscalPeriode === "mensuel" ? "mensuel" : "annuel"}</span><span style={S.kpiValue}>{formatEUR(caAffiche)}</span></div>
                <div style={S.kpiCard}><span style={S.kpiLabel}>Cotisations URSSAF</span><span style={{ ...S.kpiValue, color: "#854F0B" }}>{formatEUR(cotisationsSim)}</span></div>
                <div style={S.kpiCard}><span style={S.kpiLabel}>Impôts estimés</span><span style={{ ...S.kpiValue, color: "#A32D2D" }}>{formatEUR(impotsSim)}</span></div>
                <div style={S.kpiCard}><span style={S.kpiLabel}>Revenu réellement disponible</span><span style={{ ...S.kpiValue, color: "#1D9E75" }}>{formatEUR(disponibleSim)}</span></div>
              </div>
            </div>
          );
        })()}

        {nav === "score" && (() => {
          const info = scoreInfo(scoreSante);
          return (
            <div>
              <div style={isMobile ? { ...S.pageHeader, flexDirection: "column", alignItems: "flex-start", gap: 10 } : S.pageHeader}><div><h1 style={S.pageTitle}>Score H€CTOR</h1><p style={S.pageSub}>Votre santé financière en un coup d'œil</p></div></div>
              <div style={{ ...S.card, textAlign: "center", padding: "40px 24px" }}>
                <div style={{ fontSize: 56, fontWeight: 700, color: info.color, lineHeight: 1 }}>{scoreSante !== null ? `${scoreSante}` : "—"}<span style={{ fontSize: 24, color: "#8BA5C0" }}>/100</span></div>
                <div style={{ fontSize: 16, fontWeight: 600, color: info.color, marginTop: 10 }}>{info.label}</div>
                <div style={{ fontSize: 13, color: "#6B7A8D", marginTop: 8, maxWidth: 380, marginLeft: "auto", marginRight: "auto" }}>{info.desc}</div>
              </div>
              {scoreSante !== null && (
                <div style={{ ...S.card, marginTop: 14 }}>
                  <div style={S.cardTitle}>Détail du calcul</div>
                  {[
                    { label: "Trésorerie vs charges à venir", icon: "ti-coin", pts: scoreDetail.ptsTreso, max: 30 },
                    { label: "Réserve de sécurité couverte", icon: "ti-shield", pts: scoreDetail.ptsReserve, max: 20 },
                    { label: "URSSAF provisionnée", icon: "ti-receipt", pts: scoreDetail.ptsUrssaf, max: 20 },
                    { label: "Régularité du CA mensuel", icon: "ti-chart-line", pts: scoreDetail.ptsRegularite, max: 15 },
                    { label: "Endettement", icon: "ti-credit-card", pts: scoreDetail.ptsDette, max: 15 },
                  ].map((f, i) => (
                    <div key={i} style={S.scoreDetailRow}>
                      <span style={S.paniqueLineLabel}><i className={`ti ${f.icon}`} aria-hidden="true" style={{ fontSize: 15, marginRight: 8, color: "#8BA5C0" }} />{f.label}</span>
                      <div style={S.scoreBarTrack}><div style={{ ...S.scoreBarFill, width: `${(f.pts / f.max) * 100}%`, background: f.pts / f.max > 0.6 ? "#1D9E75" : f.pts / f.max > 0.3 ? "#EF9F27" : "#E24B4A" }} /></div>
                      <span style={{ fontSize: 12, color: "#6B7A8D", width: 50, textAlign: "right" }}>{f.pts}/{f.max}</span>
                    </div>
                  ))}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 12, paddingTop: 12, borderTop: "0.5px solid #EEF2F7" }}>
                    <span style={{ fontSize: 12, color: "#6B7A8D" }}><i className="ti ti-credit-card" aria-hidden="true" style={{ fontSize: 14, marginRight: 6 }} />Dettes / emprunts en cours</span>
                    <input style={S.inlineEditValue} type="number" step="0.01" value={panique.dettes} onChange={e => setPanique({ ...panique, dettes: e.target.value })} />
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {nav === "coach" && (
          <div>
            <div style={isMobile ? { ...S.pageHeader, flexDirection: "column", alignItems: "flex-start", gap: 10 } : S.pageHeader}><div><h1 style={S.pageTitle}>💪 Coach prix</h1><p style={S.pageSub}>Est-ce que je suis sous-facturé ?</p></div></div>

            <div style={S.card}>
              <label style={S.label}>
                <span style={{ fontSize: 14, fontWeight: 600, color: INK }}>Combien facturez-vous actuellement ?</span>
                <input style={{ ...S.input, fontSize: 22, fontWeight: 600, padding: "14px 16px", marginTop: 8 }} type="number" step="1" placeholder="Ex : 500" value={tarifMontant} onChange={e => setTarifMontant(e.target.value)} />
              </label>
              <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                {[{ id: "jour", l: "par jour" }, { id: "heure", l: "par heure" }, { id: "prestation", l: "par prestation" }].map(u => (
                  <button key={u.id} type="button" onClick={() => setTarifUnite(u.id)} style={{ ...S.toggleBtn, ...(tarifUnite === u.id ? S.toggleBtnActive : {}) }}>{u.l}</button>
                ))}
              </div>
              {tarifUnite === "jour" && (
                <label style={{ ...S.label, marginTop: 12 }}>Heures travaillées par jour
                  <input style={S.input} type="number" min="0.5" max="24" value={heuresParJour} onChange={e => setHeuresParJourCoach(e.target.value)} />
                </label>
              )}
              {tarifUnite === "prestation" && (
                <label style={{ ...S.label, marginTop: 12 }}>Heures passées en moyenne par prestation
                  <input style={S.input} type="number" min="0.25" max="200" value={heuresParPrestation} onChange={e => setHeuresParPrestation(e.target.value)} />
                </label>
              )}
              <label style={{ ...S.label, marginTop: 12 }}>Jours travaillés par semaine <span style={{ fontWeight: 400, color: "#8BA5C0" }}>(pour estimer vos revenus mensuels)</span>
                <input style={S.input} type="number" min="0.5" max="7" value={joursParSemaineCoach} onChange={e => setJoursParSemaineCoach(e.target.value)} />
              </label>
            </div>

            {tauxHoraireReel !== null && (
              <>
                <div style={{ ...S.card, marginTop: 14, textAlign: "center", padding: "32px 24px" }}>
                  <div style={S.paniqueResultLabel}>Votre vrai revenu horaire</div>
                  <div style={{ ...S.paniqueResultValue, fontSize: 48, color: niveauTarif === "rouge" ? "#A32D2D" : niveauTarif === "jaune" ? "#854F0B" : "#1D9E75" }}>{formatEUR(tauxHoraireReel)}<span style={{ fontSize: 20 }}>/h</span></div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: niveauTarif === "rouge" ? "#A32D2D" : niveauTarif === "jaune" ? "#854F0B" : "#1D9E75", marginTop: 8 }}>
                    {niveauTarif === "rouge" && "🔴 Vous êtes sous-facturé"}
                    {niveauTarif === "jaune" && "🟡 Tarif dans la moyenne"}
                    {niveauTarif === "vert" && "🟢 Bien facturé, au-dessus de la moyenne"}
                  </div>
                </div>

                <div style={{ ...S.card, marginTop: 14 }}>
                  <div style={S.cardTitle}>Vos revenus, à tous les horizons</div>
                  <div style={S.paniqueLine}><span style={S.paniqueLineLabel}>Par heure</span><span style={{ fontWeight: 600 }}>{formatEUR(tauxHoraireReel)}</span></div>
                  <div style={S.paniqueLine}><span style={S.paniqueLineLabel}>Par jour</span><span style={{ fontWeight: 600 }}>{formatEUR(revenuJournalierCoach)}</span></div>
                  <div style={S.paniqueLine}><span style={S.paniqueLineLabel}>Par mois</span><span style={{ fontWeight: 600 }}>{formatEUR(revenuMensuelCoach)}</span></div>
                  <div style={S.paniqueLine}><span style={S.paniqueLineLabel}>Par an</span><span style={{ fontWeight: 600 }}>{formatEUR(revenuAnnuelCoach)}</span></div>
                </div>

                <div style={{ ...S.card, marginTop: 14 }}>
                  <div style={S.cardTitle}>📈 Impact concret d'une hausse de tarifs</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                    {[5, 10, 20].map(p => (
                      <button key={p} type="button" onClick={() => setHaussePct(String(p))} style={{ ...S.toggleBtn, flex: "0 1 auto", padding: "8px 16px", ...(haussePct === String(p) ? S.toggleBtnActive : {}) }}>+{p}%</button>
                    ))}
                    <input style={{ ...S.input, width: 70 }} type="number" min="0" max="100" value={haussePct} onChange={e => setHaussePct(e.target.value)} />
                    <span style={{ fontSize: 13, color: INK }}>%</span>
                  </div>
                  {tauxHoraireApresHausse !== null && (
                    <>
                      <div style={S.paniqueLine}><span style={S.paniqueLineLabel}>Nouveau tarif horaire</span><span style={{ fontWeight: 600, color: "#1D9E75" }}>{formatEUR(tauxHoraireApresHausse)}/h</span></div>
                      <div style={{ ...S.netRow, marginTop: 10, fontSize: 15 }}>
                        <span>Gain concret</span>
                        <span style={{ fontWeight: 700, color: "#1D9E75" }}>+{formatEUR(gainMensuelHausse)}/mois · +{formatEUR(gainAnnuelHausse)}/an</span>
                      </div>
                      <div style={{ fontSize: 11, color: "#8BA5C0", marginTop: 6 }}>Sans travailler une heure de plus.</div>
                    </>
                  )}
                </div>

                <div style={{ ...S.card, marginTop: 14 }}>
                  <div style={S.cardTitle}>🎯 Pour atteindre votre objectif</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                    <input style={{ ...S.input, width: 100 }} type="number" value={objectifHoraire} onChange={e => setObjectifHoraire(e.target.value)} />
                    <span style={{ fontSize: 14, color: INK }}>€/h</span>
                  </div>
                  {ecartPctVersObjectif !== null && (
                    ecartPctVersObjectif > 0 ? (
                      <div style={{ fontSize: 14, color: "#5B6573" }}>
                        Pour atteindre {formatEUR(objHoraireNum)}/h, augmentez vos tarifs de <strong style={{ color: "#1D9E75", fontSize: 18 }}>+{ecartPctVersObjectif}%</strong>.
                      </div>
                    ) : (
                      <div style={{ fontSize: 14, color: "#1D9E75" }}>
                        🎉 Vous dépassez déjà cet objectif !
                      </div>
                    )
                  )}
                </div>
              </>
            )}

            <p style={{ fontSize: 11, color: "#8BA5C0", marginTop: 14, textAlign: "center" }}>
              Comparaison indicative (moyenne basse ~25€/h, moyenne ~45€/h pour des indépendants en France).
            </p>
          </div>
        )}

        {nav === "societe" && (
          <div>
            <div style={isMobile ? { ...S.pageHeader, flexDirection: "column", alignItems: "flex-start", gap: 10 } : S.pageHeader}><div><h1 style={S.pageTitle}>Passage en société ?</h1><p style={S.pageSub}>Auto-entrepreneur, SASU ou EURL — où en êtes-vous</p></div></div>
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
            <div style={isMobile ? { ...S.pageHeader, flexDirection: "column", alignItems: "flex-start", gap: 10 } : S.pageHeader}><div><h1 style={S.pageTitle}>Modèles</h1><p style={S.pageSub}>Des textes prêts à copier-coller</p></div></div>
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

        {nav === "revenus" && (() => {
          const moisActuel = new Date().getMonth();
          const anneeActuelle = new Date().getFullYear();
          const incomeCeMois = incomeList.filter(e => new Date(e.date).getMonth() === moisActuel && new Date(e.date).getFullYear() === anneeActuelle);
          const caMoisCi = incomeCeMois.reduce((s, e) => s + e.amount, 0);
          const nbFactures = incomeCeMois.length;
          const factureMoyenne = nbFactures > 0 ? Math.round((caMoisCi / nbFactures) * 100) / 100 : 0;
          const parClientRevenus = {};
          incomeList.forEach(e => {
            const cle = (e.description?.match(/Client\s*:\s*([^—]+)/)?.[1] || "").trim() || "Non précisé";
            parClientRevenus[cle] = (parClientRevenus[cle] || 0) + e.amount;
          });
          const meilleurClientRevenus = Object.entries(parClientRevenus).filter(([k]) => k !== "Non précisé").sort((a, b) => b[1] - a[1])[0];
          const urssafAProvisionner = estimateData ? Math.round(caMoisCi * ((estimateData.taux_global_pct || 0) / 100) * 100) / 100 : 0;

          return (
            <div>
              <div style={isMobile ? { ...S.pageHeader, flexDirection: "column", alignItems: "flex-start", gap: 10 } : S.pageHeader}>
                <div><h1 style={S.pageTitle}>Revenus & Factures</h1><p style={S.pageSub}>La source de vérité de votre activité</p></div>
                <button style={S.btnPrimarySmall} onClick={() => setShowAddIncome(!showAddIncome)}>+ Ajouter</button>
              </div>

              <div style={isMobile ? { ...S.kpiGrid, gridTemplateColumns: "1fr 1fr" } : S.kpiGrid}>
                <div style={S.kpiCard}><span style={S.kpiLabel}>CA ce mois</span><span style={S.kpiValue}>{formatEUR(caMoisCi)}</span></div>
                <div style={S.kpiCard}><span style={S.kpiLabel}>Factures / revenus</span><span style={S.kpiValue}>{nbFactures}</span></div>
                <div style={S.kpiCard}><span style={S.kpiLabel}>Facture moyenne</span><span style={S.kpiValue}>{formatEUR(factureMoyenne)}</span></div>
                <div style={S.kpiCard}><span style={S.kpiLabel}>Meilleur client</span><span style={{ ...S.kpiValue, fontSize: 16 }}>{meilleurClientRevenus?.[0] || "—"}</span></div>
              </div>
              <p style={{ fontSize: 11, color: "#8BA5C0", margin: "-12px 0 16px" }}>≈ {formatEUR(urssafAProvisionner)} à provisionner d'URSSAF sur le CA de ce mois.</p>

              {showAddIncome && !factureExtraite && (
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

              {/* ─── ECRAN DE CONFIRMATION OBLIGATOIRE avant tout enregistrement ─── */}
              {factureExtraite && (() => {
                const montant = parseFloat(factureExtraite.amount) || 0;
                const tauxPct = estimateData?.taux_global_pct ?? 21.4;
                const urssafSurFacture = Math.round(montant * (tauxPct / 100) * 100) / 100;
                const nouveauCaAnnuel = (estimateData?.ca_annuel || 0) + montant;

                // Comparatif avant / apres, sur les VRAIES variables du Dashboard
                const caMoisAvant = caCeMoisCi;
                const caMoisApres = caCeMoisCi + montant;
                const dispoAvant = argentDisponibleBrut ?? 0;
                const chargesApres = totalChargesAVenir + urssafSurFacture;
                const dispoApres = Math.max(0, Math.round((soldeNum + montant - chargesApres) * 100) / 100);

                return (
                  <div style={{ ...S.card, marginBottom: 16, border: `2px solid ${ACCENT}`, padding: 0, overflow: "hidden" }}>
                    <div style={{ padding: "18px 20px 14px" }}>
                      <div style={S.cardTitle}>📄 Facture détectée — vérifiez avant de valider</div>
                      <p style={{ fontSize: 11, color: "#8BA5C0", margin: "-8px 0 14px" }}>Détection automatique, tous les champs sont modifiables.</p>

                      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12, marginBottom: 6 }}>
                        <label style={S.label}>Montant détecté
                          <input style={S.input} type="number" step="0.01" value={factureExtraite.amount} onChange={e => setFactureExtraite({ ...factureExtraite, amount: e.target.value })} />
                        </label>
                        <label style={S.label}>Date
                          <input style={S.input} type="date" value={factureExtraite.date} onChange={e => setFactureExtraite({ ...factureExtraite, date: e.target.value })} />
                        </label>
                        <label style={S.label}>Client {!factureExtraite.client && <span style={S.aVerifierTag}>à vérifier</span>}
                          <input style={S.input} type="text" placeholder="Non détecté — renseignez-le" value={factureExtraite.client} onChange={e => setFactureExtraite({ ...factureExtraite, client: e.target.value })} />
                        </label>
                        <label style={S.label}>Description {!factureExtraite.description && <span style={S.aVerifierTag}>à vérifier</span>}
                          <input style={S.input} type="text" placeholder="Non détectée — renseignez-la" value={factureExtraite.description} onChange={e => setFactureExtraite({ ...factureExtraite, description: e.target.value })} />
                        </label>
                        <label style={S.label}>N° de facture {!factureExtraite.numero_facture && <span style={S.aVerifierTag}>à vérifier</span>}
                          <input style={S.input} type="text" placeholder="Non détecté — renseignez-le" value={factureExtraite.numero_facture} onChange={e => setFactureExtraite({ ...factureExtraite, numero_facture: e.target.value })} />
                        </label>
                      </div>
                      {factureExtraite.tva_pct != null && (
                        <p style={{ fontSize: 11, color: "#8BA5C0", margin: "0 0 10px" }}>TVA détectée sur le document : {factureExtraite.tva_pct}% — à vérifier, non utilisée dans le calcul.</p>
                      )}
                    </div>

                    {/* ─── LE COMPARATIF QUI CREE L'EFFET WOW ─── */}
                    <div style={{ background: INK, padding: "20px" }}>
                      <div style={{ fontSize: 12, color: "#5DCAA5", fontWeight: 700, marginBottom: 14, textTransform: "uppercase", letterSpacing: 0.5 }}>⚡ Cette facture va immédiatement</div>

                      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 14 }}>
                        <div style={S.impactCompareCard}>
                          <div style={{ fontSize: 11, color: "#8BA5C0" }}>CA du mois</div>
                          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 4 }}>
                            <span style={{ fontSize: 15, color: "#7A93AD", textDecoration: "line-through" }}>{formatEUR(caMoisAvant)}</span>
                            <i className="ti ti-arrow-right" aria-hidden="true" style={{ fontSize: 14, color: "#5DCAA5" }} />
                            <span style={{ fontSize: 22, fontWeight: 700, color: "#5DCAA5" }}>{formatEUR(caMoisApres)}</span>
                          </div>
                        </div>
                        <div style={S.impactCompareCard}>
                          <div style={{ fontSize: 11, color: "#8BA5C0" }}>Disponible réel</div>
                          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 4 }}>
                            <span style={{ fontSize: 15, color: "#7A93AD", textDecoration: "line-through" }}>{formatEUR(dispoAvant)}</span>
                            <i className="ti ti-arrow-right" aria-hidden="true" style={{ fontSize: 14, color: "#5DCAA5" }} />
                            <span style={{ fontSize: 22, fontWeight: 700, color: "#5DCAA5" }}>{formatEUR(dispoApres)}</span>
                          </div>
                        </div>
                      </div>

                      <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid rgba(255,255,255,0.1)" }}>
                        <div style={S.impactRowDark}>✓ Ajoute <strong style={{ color: "white" }}>{formatEUR(montant)}</strong> à votre chiffre d'affaires</div>
                        <div style={S.impactRowDark}>✓ Augmente votre URSSAF estimée de <strong style={{ color: "#FAC775" }}>{formatEUR(urssafSurFacture)}</strong></div>
                        <div style={S.impactRowDark}>✓ Met à jour vos projections (fin de mois, fin d'année)</div>
                        <div style={S.impactRowDark}>✓ Fait avancer votre objectif mensuel ({formatEUR(nouveauCaAnnuel)} de CA annuel après ajout)</div>
                        <div style={S.impactRowDark}>✓ Apparaît dans votre historique de revenus</div>
                      </div>
                      <p style={{ fontSize: 10, color: "#7A93AD", marginTop: 12 }}>
                        Le "Disponible réel" ci-dessus suppose que ce montant arrive sur votre compte. Tant que la connexion bancaire n'existe pas, pensez à mettre à jour votre solde sur le Dashboard une fois le virement reçu.
                      </p>
                    </div>

                    {factureExtraite.doublon && (
                      <div style={{ ...S.doublonWarning, margin: "0 20px 16px" }}>
                        <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                          <i className="ti ti-alert-triangle" aria-hidden="true" style={{ fontSize: 20, color: "#854F0B", flexShrink: 0, marginTop: 2 }} />
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 13, color: "#633806" }}>⚠️ Facture potentiellement déjà importée</div>
                            <div style={{ fontSize: 12, color: "#854F0B", marginTop: 4 }}>
                              Une entrée similaire existe déjà : {formatEUR(factureExtraite.doublon.existing_amount)} le {formatDate(factureExtraite.doublon.existing_date)}{factureExtraite.doublon.existing_description ? ` — ${factureExtraite.doublon.existing_description}` : ""}.
                            </div>
                            <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
                              <button style={S.linkBtn} onClick={() => { setNav("revenus"); }}>Voir l'ancienne facture</button>
                              <button style={{ ...S.linkBtn, color: "#A32D2D" }} onClick={() => handleConfirmFacture(true)}>Importer quand même</button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    <div style={{ display: "flex", gap: 10, padding: "16px 20px" }}>
                      <button style={S.btnPrimary} onClick={() => handleConfirmFacture(false)}>✓ Confirmer et tout mettre à jour</button>
                      <button style={S.btnSecondary} onClick={() => setFactureExtraite(null)}>Annuler</button>
                    </div>
                  </div>
                );
              })()}

              <div style={S.card}>
                {incomeList.length === 0 ? <p style={S.empty}>Aucun revenu enregistré.</p> : incomeList.map(entry => (
                  <div key={entry.id} style={S.incomeRow}>
                    <div style={{ flex: 1 }}>
                      <span style={S.incomeAmt}>{formatEUR(entry.amount)}</span>
                      <span style={S.incomeMeta}>{formatDate(entry.date)}{entry.description ? ` · ${entry.description}` : ""}</span>
                    </div>
                    <span style={{ ...S.badge, ...S.badgeGreen }}>✓ Comptabilisée</span>
                    <span style={{ ...S.badge, ...(entry.source === "facture" ? S.badgeBlue : S.badgeGray) }}>{entry.source === "facture" ? "Import" : "Manuel"}</span>
                    <button style={S.deleteBtn} onClick={() => handleDeleteIncome(entry.id)}>✕</button>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        {nav === "factures" && (
          <div>
            <div style={isMobile ? { ...S.pageHeader, flexDirection: "column", alignItems: "flex-start", gap: 10 } : S.pageHeader}>
              <div><h1 style={S.pageTitle}>Factures</h1><p style={S.pageSub}>Créez vos factures, ou importez-en une depuis Revenus</p></div>
              <div style={{ display: "flex", gap: 8 }}>
                <button style={S.btnSecondary} onClick={() => { setNav("revenus"); setShowAddIncome(true); }}>📄 Importer une facture</button>
                <button style={S.btnPrimarySmall} onClick={() => setShowNewFacture(!showNewFacture)}>+ Nouvelle facture</button>
              </div>
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
                  <button style={S.btnPrimary} onClick={saveFacture}>Enregistrer</button>
                  <button style={S.btnSecondary} onClick={() => setShowNewFacture(false)}>Annuler</button>
                </div>
                <p style={{ fontSize: 11, color: "#8BA5C0", marginTop: 10 }}>
                  La facture est enregistrée dans H€CTOR. <strong>L'envoi par email arrive bientôt</strong> — pour l'instant, téléchargez ou copiez les informations pour l'envoyer vous-même à votre client.
                </p>
              </div>
            )}
            <div style={S.card}>
              {factures.length === 0 ? <p style={S.empty}>Aucune facture créée. Commencez par en créer une !</p> : factures.map((f, i) => (
                <div key={i} style={S.incomeRow}>
                  <div style={{ flex: 1 }}>
                    <span style={S.incomeAmt}>{f.numero} — {f.client_nom}</span>
                    <span style={S.incomeMeta}>{formatDate(f.date)} · {formatEUR(f.total)}</span>
                  </div>
                  <span style={{ ...S.badge, ...S.badgeGray }}>{f.statut}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {nav === "contacts" && (
          <div>
            <div style={isMobile ? { ...S.pageHeader, flexDirection: "column", alignItems: "flex-start", gap: 10 } : S.pageHeader}>
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

        {nav === "profil" && (
          <div>
            <div style={isMobile ? { ...S.pageHeader, flexDirection: "column", alignItems: "flex-start", gap: 10 } : S.pageHeader}>
              <div><h1 style={S.pageTitle}>👤 Profil</h1><p style={S.pageSub}>Personnalisez H€CTOR</p></div>
            </div>

            <div style={S.card}>
              <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 18 }}>
                <div style={S.profilAvatar}>{(profilPrenom?.[0] || profile?.email?.[0] || "?").toUpperCase()}{profilNom?.[0]?.toUpperCase() || ""}</div>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 600, color: INK }}>{profilPrenom || profilNom ? `${profilPrenom} ${profilNom}`.trim() : "Complétez votre profil"}</div>
                  <div style={{ fontSize: 12, color: "#8BA5C0" }}>{profile?.email}</div>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12 }}>
                <label style={S.label}>Prénom
                  <input style={S.input} type="text" value={profilPrenom} onChange={e => setProfilPrenom(e.target.value)} placeholder="Camille" />
                </label>
                <label style={S.label}>Nom
                  <input style={S.input} type="text" value={profilNom} onChange={e => setProfilNom(e.target.value)} placeholder="Gardereau" />
                </label>
                <label style={S.label}>Téléphone
                  <input style={S.input} type="tel" value={profilTelephone} onChange={e => setProfilTelephone(e.target.value)} placeholder="06 12 34 56 78" />
                </label>
                <label style={S.label}>Entreprise
                  <input style={S.input} type="text" value={profilEntreprise} onChange={e => setProfilEntreprise(e.target.value)} placeholder="VANILLA" />
                </label>
                <label style={S.label}>SIRET
                  <div style={{ display: "flex", gap: 8 }}>
                    <input style={{ ...S.input, flex: 1 }} type="text" value={profilSiret} onChange={e => { setProfilSiret(e.target.value); setSiretLookupStatus(""); }} placeholder="123 456 789 00012" />
                    <button type="button" style={{ ...S.btnPrimary, width: "auto", padding: "0 16px", whiteSpace: "nowrap" }} onClick={handleLookupSiret} disabled={!profilSiret || siretLookupStatus === "loading"}>
                      {siretLookupStatus === "loading" ? "…" : "Vérifier"}
                    </button>
                  </div>
                  {siretLookupMessage && (
                    <p style={{ fontSize: 11, marginTop: 4, color: siretLookupStatus === "error" ? "#C0392B" : "#2E8B57" }}>
                      {siretLookupStatus === "error" ? "⚠️ " : "✓ "}{siretLookupMessage}
                    </p>
                  )}
                </label>
                <label style={S.label}>Statut juridique
                  <input style={{ ...S.input, background: "#FAFBFC", color: "#8BA5C0" }} type="text" value={profile?.statut === "auto_entrepreneur" ? "Auto-entrepreneur" : profile?.statut || "—"} readOnly />
                </label>
              </div>
              <p style={{ fontSize: 11, color: "#8BA5C0", marginTop: 10 }}>
                Activité : {ACTIVITES.find(a => a.id === profile?.activite)?.label || "—"} · pour changer de statut ou d'activité, contactez le support.
              </p>
            </div>

            <div style={{ ...S.card, marginTop: 14 }}>
              <div style={S.cardTitle}>💸 Mes dépenses mensuelles réelles <span style={{ fontWeight: 400, fontSize: 11, color: "#8BA5C0" }}>(optionnel)</span></div>
              <p style={{ fontSize: 12, color: "#6B7A8D", margin: "0 0 10px", lineHeight: 1.5 }}>
                Sans cette info, H€CTOR estime votre "réserve de sécurité" sur votre CA moyen — ce qui peut être trompeur si vous facturez beaucoup mais dépensez peu (ou l'inverse). Indiquez vos vraies dépenses pour un calcul fiable.
              </p>
              <input style={S.input} type="number" step="50" placeholder="Ex : 2000" value={depensesMensuelles} onChange={e => setDepensesMensuelles(e.target.value)} />
              {depensesMensuelles !== "" && <p style={{ fontSize: 11, color: "#1D9E75", marginTop: 8 }}>✓ Vos mois de sécurité sont maintenant calculés sur ce montant, pas sur votre CA.</p>}
            </div>

            <div style={{ ...S.card, marginTop: 14 }}>
              <div style={S.cardTitle}>🔗 Banque connectée</div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 13, color: "#5B6573" }}>Aucune banque connectée pour l'instant</span>
                <span style={{ ...S.badge, background: "#FCEBEB", color: "#A32D2D" }}>🔴 Non connectée</span>
              </div>
              <p style={{ fontSize: 11, color: "#8BA5C0", marginTop: 10, lineHeight: 1.5 }}>
                Bientôt : connectez Qonto, Shine, Revolut Business ou une banque classique pour que vos revenus se remplissent automatiquement, sans saisie manuelle.
              </p>
            </div>
          </div>
        )}

        {nav === "actualites" && (
          <div>
            <div style={isMobile ? { ...S.pageHeader, flexDirection: "column", alignItems: "flex-start", gap: 10 } : S.pageHeader}><div><h1 style={S.pageTitle}>Actualités fiscales</h1><p style={S.pageSub}>Les dernières nouvelles URSSAF et impôts</p></div></div>
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
            <div style={isMobile ? { ...S.pageHeader, flexDirection: "column", alignItems: "flex-start", gap: 10 } : S.pageHeader}><div><h1 style={S.pageTitle}>Conseils & optimisation</h1><p style={S.pageSub}>Personnalisés selon votre situation</p></div></div>
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
            <div style={isMobile ? { ...S.pageHeader, flexDirection: "column", alignItems: "flex-start", gap: 10 } : S.pageHeader}><div><h1 style={S.pageTitle}>Assistant IA</h1><p style={S.pageSub}>Posez toutes vos questions fiscales</p></div></div>
            {aiMessages.length <= 1 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
                {quickAskQuestions.map(q => (
                  <button key={q} style={S.quickAskChip} onClick={() => { setAiInput(q); }}>{q}</button>
                ))}
              </div>
            )}
            <div style={{ ...S.card, display: "flex", flexDirection: "column", height: "calc(100vh - 260px)" }}>
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
            <div style={isMobile ? { ...S.pageHeader, flexDirection: "column", alignItems: "flex-start", gap: 10 } : S.pageHeader}><div><h1 style={S.pageTitle}>Abonnement</h1><p style={S.pageSub}>Le système de paiement arrive prochainement — voici ce qui est prévu</p></div></div>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)", gap: 16 }}>
              {PLANS.map((p, i) => (
                <div key={i} style={{ ...S.card, ...(i === 1 ? { border: `2px solid ${ACCENT}` } : {}), position: "relative", opacity: i === 0 ? 1 : 0.85 }}>
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
                  {i === 0 ? (
                    <button style={{ ...S.btnPrimary, marginTop: 16, background: "white", color: ACCENT, border: `1px solid ${ACCENT}` }} onClick={() => setNav("dashboard")}>
                      Continuer gratuitement
                    </button>
                  ) : (
                    <button style={{ ...S.btnPrimary, marginTop: 16, background: "#EEF2F7", color: "#9098A6", cursor: "not-allowed", border: "1px solid #DDE5EE" }} disabled>
                      🔒 Bientôt disponible
                    </button>
                  )}
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
  input[type=number]::-webkit-inner-spin-button, input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
  input[type=number] { -moz-appearance: textfield; }
  input, select, textarea, button { transition: border-color 0.15s, background 0.15s, transform 0.1s; }
  input:focus, select:focus, textarea:focus { border-color: #378ADD !important; box-shadow: 0 0 0 3px rgba(55,138,221,0.12); }
  button:active { transform: scale(0.98); }
`;

const S = {
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
  mobileTopbar: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", background: INK, position: "sticky", top: 0, zIndex: 60 },
  sidebarBackdrop: { position: "fixed", inset: 0, background: "rgba(10,37,64,0.5)", zIndex: 75 },
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
