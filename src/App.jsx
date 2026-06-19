import { useState, useEffect, useRef, useCallback } from "react";

// ──────────────────────────────────────────────────────────
// IMPORTANT : remplacer par l'URL Railway une fois le backend déployé
// ──────────────────────────────────────────────────────────
const API_BASE = "https://provision-backend-production.up.railway.app";

// IMPORTANT : remplacer par votre Client ID Google (Google Cloud Console)
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

function formatEUR(n) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(
    n || 0
  );
}

function formatDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem("token"));
  const [email, setEmail] = useState("");
  const [authMode, setAuthMode] = useState("login");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [profile, setProfile] = useState(null);
  const [profileForm, setProfileForm] = useState({
    statut: "auto_entrepreneur",
    activite: "services",
    periodicite: "mensuelle",
    acre: false,
    versement_liberatoire: false,
  });

  const [estimateData, setEstimateData] = useState(null);
  const [incomeList, setIncomeList] = useState([]);
  const [showAddIncome, setShowAddIncome] = useState(false);
  const [incomeForm, setIncomeForm] = useState({ date: "", amount: "", description: "" });
  const [incomeIsNet, setIncomeIsNet] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const googleButtonRef = useRef(null);

  async function handleGoogleCredential(response) {
    setError("");
    setLoading(true);
    try {
      const data = await apiFetch("/auth/google", {
        method: "POST",
        body: JSON.stringify({ credential: response.credential }),
      });
      localStorage.setItem("token", data.token);
      setToken(data.token);
      setEmail(data.email);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (token || !googleButtonRef.current) return;

    function renderButton() {
      if (window.google && googleButtonRef.current) {
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: handleGoogleCredential,
        });
        window.google.accounts.id.renderButton(googleButtonRef.current, {
          theme: "outline",
          size: "large",
          width: 360,
          text: "continue_with",
        });
      } else {
        setTimeout(renderButton, 200);
      }
    }
    renderButton();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, authMode]);

  const authHeaders = useCallback(
    () => ({ Authorization: `Bearer ${token}` }),
    [token]
  );

  async function apiFetch(path, options = {}) {
    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        ...(options.body && !(options.body instanceof FormData)
          ? { "Content-Type": "application/json" }
          : {}),
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
        const [est, inc] = await Promise.all([
          apiFetch("/estimate"),
          apiFetch("/income"),
        ]);
        setEstimateData(est);
        setIncomeList(inc);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (token) loadEverything();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

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
      setEmail(data.email);
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
    setError("");
    setLoading(true);
    try {
      await apiFetch("/profile", {
        method: "POST",
        body: JSON.stringify(profileForm),
      });
      await loadEverything();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleAddIncome(e) {
    e.preventDefault();
    setError("");
    const taux = estimateData?.taux_global_pct
      ? estimateData.taux_global_pct / 100
      : 0.214;
    const saisie = parseFloat(incomeForm.amount);
    const montantBrut = incomeIsNet
      ? Math.round((saisie / (1 - taux)) * 100) / 100
      : saisie;
    try {
      await apiFetch("/income", {
        method: "POST",
        body: JSON.stringify({
          date: incomeForm.date,
          amount: montantBrut,
          description: incomeForm.description || null,
        }),
      });
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

  // ──────────────────────────────────────────────────────────
  // Écran : authentification
  // ──────────────────────────────────────────────────────────
  if (!token) {
    return (
      <div style={styles.page}>
        <style>{globalCss}</style>
        <div style={styles.authWrap}>
          <div style={styles.logo}>
            <span style={styles.logoMark}>◆</span> Provision
          </div>
          <form style={styles.card} onSubmit={handleAuth}>
            <h1 style={styles.title}>
              {authMode === "login" ? "Connexion" : "Créer un compte"}
            </h1>
            <p style={styles.subtitle}>
              Suivez vos revenus, on calcule ce que vous devez mettre de côté.
            </p>

            {error && <div style={styles.errorBanner}>{error}</div>}

            <div ref={googleButtonRef} style={styles.googleButtonWrap}></div>
            <p style={styles.orDivider}>ou avec un email</p>

            <label style={styles.label}>
              Email
              <input
                style={styles.input}
                type="email"
                value={authEmail}
                onChange={(e) => setAuthEmail(e.target.value)}
                required
              />
            </label>
            <label style={styles.label}>
              Mot de passe
              <input
                style={styles.input}
                type="password"
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
                minLength={8}
                required
              />
            </label>

            <button style={styles.button} type="submit" disabled={loading}>
              {loading
                ? "…"
                : authMode === "login"
                ? "Se connecter"
                : "Créer mon compte"}
            </button>

            <p style={styles.switchAuth}>
              {authMode === "login" ? "Pas encore de compte ?" : "Déjà inscrit ?"}{" "}
              <button
                type="button"
                style={styles.linkButton}
                onClick={() =>
                  setAuthMode(authMode === "login" ? "register" : "login")
                }
              >
                {authMode === "login" ? "Créer un compte" : "Se connecter"}
              </button>
            </p>
          </form>
        </div>
      </div>
    );
  }

  // ──────────────────────────────────────────────────────────
  // Écran : onboarding (profil non configuré)
  // ──────────────────────────────────────────────────────────
  if (profile && !profile.onboarding_complete) {
    return (
      <div style={styles.page}>
        <style>{globalCss}</style>
        <div style={styles.main}>
          <div style={styles.logo}>
            <span style={styles.logoMark}>◆</span> Provision
          </div>
          <form style={styles.card} onSubmit={handleSaveProfile}>
            <h1 style={styles.title}>Votre situation</h1>
            <p style={styles.subtitle}>
              Ça nous permet de calculer le bon taux pour vous.
            </p>

            {error && <div style={styles.errorBanner}>{error}</div>}

            <div style={styles.statutGrid}>
              {STATUTS.map((s) => (
                <button
                  type="button"
                  key={s.id}
                  disabled={!s.disponible}
                  onClick={() =>
                    setProfileForm({ ...profileForm, statut: s.id })
                  }
                  style={{
                    ...styles.statutCard,
                    ...(profileForm.statut === s.id ? styles.statutCardActive : {}),
                    ...(!s.disponible ? styles.statutCardDisabled : {}),
                  }}
                >
                  {s.label}
                  {!s.disponible && (
                    <span style={styles.comingSoonBadge}>Bientôt</span>
                  )}
                </button>
              ))}
            </div>

            {profileForm.statut === "auto_entrepreneur" && (
              <>
                <label style={styles.label}>
                  Type d'activité
                  <select
                    style={styles.input}
                    value={profileForm.activite}
                    onChange={(e) =>
                      setProfileForm({ ...profileForm, activite: e.target.value })
                    }
                  >
                    {ACTIVITES.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.label} ({a.taux})
                      </option>
                    ))}
                  </select>
                </label>

                <label style={styles.label}>
                  Fréquence de déclaration
                  <select
                    style={styles.input}
                    value={profileForm.periodicite}
                    onChange={(e) =>
                      setProfileForm({ ...profileForm, periodicite: e.target.value })
                    }
                  >
                    <option value="mensuelle">Mensuelle</option>
                    <option value="trimestrielle">Trimestrielle</option>
                  </select>
                </label>

                <label style={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={profileForm.acre}
                    onChange={(e) =>
                      setProfileForm({ ...profileForm, acre: e.target.checked })
                    }
                  />
                  Je bénéficie de l'ACRE (1ère année, -50% sur les cotisations)
                </label>

                <label style={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={profileForm.versement_liberatoire}
                    onChange={(e) =>
                      setProfileForm({
                        ...profileForm,
                        versement_liberatoire: e.target.checked,
                      })
                    }
                  />
                  J'ai opté pour le versement libératoire de l'impôt
                </label>
              </>
            )}

            <button style={styles.button} type="submit" disabled={loading}>
              {loading ? "…" : "Valider"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ──────────────────────────────────────────────────────────
  // Écran : dashboard
  // ──────────────────────────────────────────────────────────
  const notDisponible = estimateData && estimateData.disponible === false;

  return (
    <div style={styles.page}>
      <style>{globalCss}</style>
      <div style={styles.mainWide}>
        <header style={styles.dashHeader}>
          <div style={styles.logo}>
            <span style={styles.logoMark}>◆</span> Provision
          </div>
          <button style={styles.linkButton} onClick={handleLogout}>
            Déconnexion
          </button>
        </header>

        {error && <div style={styles.errorBanner}>{error}</div>}

        {notDisponible ? (
          <div style={styles.card}>
            <h1 style={styles.title}>Bientôt disponible</h1>
            <p style={styles.subtitle}>{estimateData.message}</p>
          </div>
        ) : (
          estimateData && (
            <>
              <div style={styles.statGrid} className="stat-grid-responsive">
                <div style={styles.statCard}>
                  <span style={styles.statLabel}>
                    À mettre de côté · {estimateData.periode_courante.label}
                  </span>
                  <span style={styles.statValueBig}>
                    {formatEUR(estimateData.montant_a_provisionner)}
                  </span>
                  <span style={styles.statSub}>
                    sur {formatEUR(estimateData.ca_periode_courante)} encaissés ·{" "}
                    {estimateData.taux_global_pct}%
                  </span>
                </div>

                <div style={styles.statCard}>
                  <span style={styles.statLabel}>Prochaine déclaration</span>
                  <span style={styles.statValueBig}>
                    {estimateData.periode_courante.jours_restants}j
                  </span>
                  <span style={styles.statSub}>
                    avant le {formatDate(estimateData.periode_courante.date_limite_declaration)}
                  </span>
                  <a
                    href="https://www.autoentrepreneur.urssaf.fr"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={styles.urssafLink}
                  >
                    Déclarer sur autoentrepreneur.urssaf.fr →
                  </a>
                </div>
              </div>

              {estimateData.periode_precedente.jours_restants <= 10 &&
                estimateData.ca_periode_precedente > 0 && (
                  <div style={styles.alertBanner}>
                    ⚠️ N'oubliez pas de déclarer {estimateData.periode_precedente.label} (
                    {formatEUR(estimateData.ca_periode_precedente)}) avant le{" "}
                    {formatDate(estimateData.periode_precedente.date_limite_declaration)} (
                    {estimateData.periode_precedente.jours_restants}j restants)
                  </div>
                )}

              <div style={styles.card}>
                <div style={styles.thresholdHeader}>
                  <span style={styles.dashTitle}>Seuil annuel</span>
                  <span style={styles.statSub}>
                    {formatEUR(estimateData.ca_annuel)} / {formatEUR(estimateData.plafond)}
                  </span>
                </div>
                <div style={styles.progressTrack}>
                  <div
                    style={{
                      ...styles.progressFill,
                      width: `${Math.min(estimateData.pourcentage_plafond, 100)}%`,
                      ...(estimateData.pourcentage_plafond > 80
                        ? { background: warning }
                        : {}),
                    }}
                  />
                </div>
                <span style={styles.statSub}>
                  {estimateData.pourcentage_plafond}% du plafond annuel
                </span>
              </div>
            </>
          )
        )}

        <div style={styles.card}>
          <div style={styles.dashSectionHeader}>
            <h2 style={styles.dashTitle}>Revenus</h2>
            <button
              style={styles.buttonSecondary}
              onClick={() => setShowAddIncome(!showAddIncome)}
            >
              {showAddIncome ? "Annuler" : "+ Ajouter"}
            </button>
          </div>

          {showAddIncome && (
            <div style={styles.addIncomeBox}>
              <label style={styles.dropZoneSmall}>
                <input
                  type="file"
                  accept="application/pdf,image/jpeg,image/png,image/webp"
                  onChange={(e) =>
                    e.target.files[0] && handleUploadInvoice(e.target.files[0])
                  }
                  style={{ display: "none" }}
                />
                {uploadingFile
                  ? "Lecture en cours…"
                  : "＋ Importer une facture (PDF, JPG, PNG)"}
              </label>

              <p style={styles.orDivider}>ou saisie manuelle</p>

              <form style={styles.manualForm} onSubmit={handleAddIncome}>
                <input
                  style={styles.input}
                  type="date"
                  value={incomeForm.date}
                  onChange={(e) =>
                    setIncomeForm({ ...incomeForm, date: e.target.value })
                  }
                  required
                />

                <div style={styles.amountToggleRow}>
                  <button
                    type="button"
                    style={{
                      ...styles.toggleBtn,
                      ...(!incomeIsNet ? styles.toggleBtnActive : {}),
                    }}
                    onClick={() => setIncomeIsNet(false)}
                  >
                    Montant brut (CA)
                  </button>
                  <button
                    type="button"
                    style={{
                      ...styles.toggleBtn,
                      ...(incomeIsNet ? styles.toggleBtnActive : {}),
                    }}
                    onClick={() => setIncomeIsNet(true)}
                  >
                    Montant net reçu
                  </button>
                </div>

                <p style={styles.toggleHint}>
                  {incomeIsNet
                    ? "Ce que vous avez gardé après avoir mis de côté les cotisations — on recalcule le CA brut automatiquement."
                    : "Ce que votre client vous a versé, avant de mettre quoi que ce soit de côté pour l'URSSAF."}
                </p>

                <input
                  style={styles.input}
                  type="number"
                  step="0.01"
                  placeholder={incomeIsNet ? "Montant net reçu €" : "Chiffre d'affaires brut €"}
                  value={incomeForm.amount}
                  onChange={(e) =>
                    setIncomeForm({ ...incomeForm, amount: e.target.value })
                  }
                  required
                />

                {incomeIsNet && incomeForm.amount && parseFloat(incomeForm.amount) > 0 && (() => {
                  const taux = estimateData?.taux_global_pct
                    ? estimateData.taux_global_pct / 100
                    : 0.214;
                  const net = parseFloat(incomeForm.amount);
                  const brut = Math.round((net / (1 - taux)) * 100) / 100;
                  const cotisations = Math.round((brut - net) * 100) / 100;
                  return (
                    <div style={styles.netPreview}>
                      <div style={styles.netPreviewRow}>
                        <span>CA brut enregistré</span>
                        <span style={styles.netPreviewValue}>{formatEUR(brut)}</span>
                      </div>
                      <div style={styles.netPreviewRow}>
                        <span style={{ color: warning }}>Cotisations URSSAF ({estimateData?.taux_global_pct ?? 21.4}%)</span>
                        <span style={{ color: warning }}>−{formatEUR(cotisations)}</span>
                      </div>
                      <div style={{ ...styles.netPreviewRow, borderTop: `1px solid ${line}`, paddingTop: 8, marginTop: 4 }}>
                        <span style={{ fontWeight: 500 }}>Net à garder</span>
                        <span style={{ ...styles.netPreviewValue, color: accent }}>{formatEUR(net)}</span>
                      </div>
                    </div>
                  );
                })()}

                <input
                  style={styles.input}
                  type="text"
                  placeholder="Description (optionnel)"
                  value={incomeForm.description}
                  onChange={(e) =>
                    setIncomeForm({ ...incomeForm, description: e.target.value })
                  }
                />
                <button style={styles.button} type="submit">
                  Ajouter
                </button>
              </form>
            </div>
          )}

          <div style={styles.incomeList}>
            {incomeList.length === 0 && (
              <p style={styles.subtitle}>Aucun revenu enregistré pour l'instant.</p>
            )}
            {incomeList.map((entry) => (
              <div key={entry.id} style={styles.incomeRow}>
                <div style={styles.incomeInfo}>
                  <span style={styles.incomeAmount}>{formatEUR(entry.amount)}</span>
                  <span style={styles.incomeMeta}>
                    {formatDate(entry.date)}
                    {entry.description ? ` · ${entry.description}` : ""}
                  </span>
                </div>
                <span
                  style={{
                    ...styles.sourceBadge,
                    ...(entry.source === "facture"
                      ? styles.sourceBadgeFacture
                      : styles.sourceBadgeManuel),
                  }}
                >
                  {entry.source === "facture" ? "Facture" : "Manuel"}
                </span>
                <button
                  style={styles.deleteButton}
                  onClick={() => handleDeleteIncome(entry.id)}
                  aria-label="Supprimer"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────
// Design tokens
// ──────────────────────────────────────────────────────────
const ink = "#182019";
const paper = "#F4F6F1";
const cardBg = "#FFFFFF";
const line = "#DBE0D5";
const accent = "#1F6F58";
const accentDark = "#15493A";
const warning = "#B5651D";
const danger = "#B23B3B";

const globalCss = `
  @import url('https://fonts.googleapis.com/css2?family=Fraunces:wght@500;600&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@500&display=swap');
  * { box-sizing: border-box; }
  body { margin: 0; }
  @media (max-width: 640px) {
    .stat-grid-responsive { grid-template-columns: 1fr !important; }
  }
`;

const styles = {
  page: {
    minHeight: "100vh",
    background: paper,
    color: ink,
    fontFamily: "'Inter', system-ui, sans-serif",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: "32px 16px",
  },
  authWrap: { width: "100%", maxWidth: 420 },
  main: { width: "100%", maxWidth: 480 },
  mainWide: { width: "100%", maxWidth: 720 },
  logo: {
    fontFamily: "'Fraunces', serif",
    fontSize: 22,
    fontWeight: 600,
    marginBottom: 24,
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  logoMark: { color: accent },
  dashHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  card: {
    background: cardBg,
    border: `1px solid ${line}`,
    borderRadius: 12,
    padding: "24px 28px",
    marginBottom: 16,
  },
  title: {
    fontFamily: "'Fraunces', serif",
    fontSize: 22,
    fontWeight: 600,
    margin: "0 0 8px",
  },
  subtitle: { fontSize: 14, color: "#5B6358", margin: "0 0 20px", lineHeight: 1.5 },
  label: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    fontSize: 13,
    fontWeight: 500,
    color: "#3D4439",
    marginBottom: 14,
  },
  checkboxLabel: {
    display: "flex",
    alignItems: "flex-start",
    gap: 8,
    fontSize: 13,
    color: "#3D4439",
    marginBottom: 12,
    lineHeight: 1.4,
  },
  input: {
    fontFamily: "'Inter', sans-serif",
    fontSize: 14,
    padding: "10px 12px",
    borderRadius: 8,
    border: `1px solid ${line}`,
    outline: "none",
    width: "100%",
  },
  button: {
    width: "100%",
    background: accent,
    color: "#fff",
    border: "none",
    borderRadius: 8,
    padding: "12px 16px",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    marginTop: 4,
  },
  buttonSecondary: {
    background: "#fff",
    color: accent,
    border: `1px solid ${accent}`,
    borderRadius: 8,
    padding: "8px 14px",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  linkButton: {
    background: "none",
    border: "none",
    color: accent,
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    padding: 0,
  },
  switchAuth: { fontSize: 13, color: "#5B6358", textAlign: "center", marginTop: 16 },
  googleButtonWrap: { display: "flex", justifyContent: "center", marginBottom: 4 },
  errorBanner: {
    background: "#FBEAEA",
    color: danger,
    border: `1px solid #E8C4C4`,
    borderRadius: 8,
    padding: "12px 16px",
    fontSize: 14,
    marginBottom: 16,
  },
  alertBanner: {
    background: "#FBF1E3",
    color: warning,
    border: `1px solid #ECD3AC`,
    borderRadius: 8,
    padding: "12px 16px",
    fontSize: 13,
    marginBottom: 16,
    lineHeight: 1.5,
  },
  statutGrid: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
    marginBottom: 20,
  },
  statutCard: {
    position: "relative",
    textAlign: "left",
    padding: "14px 16px",
    borderRadius: 10,
    border: `1px solid ${line}`,
    background: "#fff",
    fontSize: 14,
    fontWeight: 500,
    cursor: "pointer",
    color: ink,
  },
  statutCardActive: {
    border: `1.5px solid ${accent}`,
    background: "#EAF4F0",
  },
  statutCardDisabled: {
    color: "#9098A6",
    cursor: "not-allowed",
    background: "#F7F8F5",
  },
  comingSoonBadge: {
    float: "right",
    fontSize: 11,
    fontWeight: 600,
    background: "#EDEAE0",
    color: "#8A7F5C",
    padding: "2px 8px",
    borderRadius: 6,
  },
  statGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 12,
    marginBottom: 16,
  },
  statCard: {
    background: cardBg,
    border: `1px solid ${line}`,
    borderRadius: 12,
    padding: "18px 20px",
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  statLabel: { fontSize: 12, color: "#5B6358" },
  statValueBig: {
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: 26,
    fontWeight: 500,
    color: accentDark,
  },
  statSub: { fontSize: 12, color: "#8A9182" },
  thresholdHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginBottom: 10,
  },
  dashTitle: {
    fontFamily: "'Fraunces', serif",
    fontSize: 16,
    fontWeight: 600,
    margin: 0,
  },
  progressTrack: {
    height: 8,
    background: "#EDEFE8",
    borderRadius: 4,
    overflow: "hidden",
    marginBottom: 8,
  },
  progressFill: { height: "100%", background: accent, borderRadius: 4 },
  dashSectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  addIncomeBox: {
    border: `1px solid ${line}`,
    borderRadius: 10,
    padding: 16,
    marginBottom: 20,
    background: "#FAFBF8",
  },
  dropZoneSmall: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    border: `1.5px dashed ${line}`,
    borderRadius: 8,
    padding: "14px 16px",
    cursor: "pointer",
    fontSize: 13,
    color: "#5B6358",
    background: "#fff",
  },
  orDivider: {
    textAlign: "center",
    fontSize: 12,
    color: "#8A9182",
    margin: "12px 0",
  },
  manualForm: { display: "flex", flexDirection: "column", gap: 10 },
  incomeList: { display: "flex", flexDirection: "column", gap: 8 },
  incomeRow: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "10px 14px",
    border: `1px solid ${line}`,
    borderRadius: 8,
  },
  incomeInfo: { flex: 1, display: "flex", flexDirection: "column", gap: 2 },
  incomeAmount: {
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: 14,
    fontWeight: 500,
  },
  incomeMeta: { fontSize: 12, color: "#8A9182" },
  sourceBadge: {
    fontSize: 10,
    fontWeight: 600,
    padding: "3px 8px",
    borderRadius: 6,
    whiteSpace: "nowrap",
  },
  sourceBadgeFacture: { background: "#E7F4ED", color: accentDark },
  sourceBadgeManuel: { background: "#F1F2EE", color: "#5B6358" },
  deleteButton: {
    background: "none",
    border: "none",
    color: "#B0B6A8",
    cursor: "pointer",
    fontSize: 14,
    padding: 4,
  },
  amountToggleRow: {
    display: "flex",
    gap: 8,
  },
  toggleBtn: {
    flex: 1,
    padding: "8px 12px",
    borderRadius: 8,
    border: `1px solid ${line}`,
    background: "#fff",
    fontSize: 12,
    fontWeight: 500,
    cursor: "pointer",
    color: "#5B6358",
  },
  toggleBtnActive: {
    border: `1.5px solid ${accent}`,
    background: "#EAF4F0",
    color: accentDark,
  },
  toggleHint: {
    fontSize: 12,
    color: "#8A9182",
    margin: "2px 0 4px",
    lineHeight: 1.4,
  },
  netPreview: {
    background: "#F7F9F5",
    border: `1px solid ${line}`,
    borderRadius: 8,
    padding: "10px 14px",
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  netPreviewRow: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: 13,
    color: "#5B6358",
  },
  netPreviewValue: {
    fontFamily: "'IBM Plex Mono', monospace",
    fontWeight: 500,
    color: ink,
  },
  urssafLink: {
    fontSize: 11,
    color: accent,
    textDecoration: "none",
    marginTop: 4,
    fontWeight: 500,
  },
};
