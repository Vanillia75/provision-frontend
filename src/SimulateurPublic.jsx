// ─────────────────────────────────────────────────────────────────────────────
//  SIMULATEUR PUBLIC — montotor.fr/simulateur-allocation-intermittent
//
//  Pourquoi cette page existe (27/07/2026, demande de Camille) : tous les
//  concurrents ont un simulateur en accès libre, et « simulateur allocation
//  intermittent » est une requête à forte intention. C'est une porte d'entrée.
//
//  Notre différence, et il faut qu'elle se voie : les autres s'arrêtent au
//  BRUT. Nous affichons le NET, parce que notre calcul brut vers net a été
//  vérifié au centime contre le simulateur OFFICIEL de France Travail le
//  27/07/2026 (24 cas, les deux annexes). On montre aussi le détail du calcul.
//
//  Aucun compte, aucun email, RIEN n'est enregistré : les gens tapent leur vrai
//  salaire, il faut le dire clairement et que ce soit vrai.
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from "react";
import { CSS } from "./theme";
import { formatEUR } from "./format";
import MontantInput from "./MontantInput";
import { API_BASE } from "./config";

const SERIF = "'Playfair Display', Georgia, serif";
const VERT = "#5DCAA5";
const BLEU = "#378ADD";

const carte = {
  background: "rgba(255,255,255,0.03)",
  border: "1px solid rgba(255,255,255,0.09)",
  borderRadius: 16,
  padding: "22px 24px",
  marginBottom: 16,
};

const label = { display: "block", fontSize: 12.5, color: "#9DB3C8", marginBottom: 6, fontWeight: 600 };

const champ = {
  width: "100%",
  boxSizing: "border-box",
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.14)",
  borderRadius: 10,
  padding: "12px 14px",
  minHeight: 44,
  color: "white",
  fontSize: 15,
  fontFamily: "inherit",
  outline: "none",
};

function LigneDetail({ intitule, valeur, fort, vert }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
      <span style={{ fontSize: 13, color: fort ? "#E4EDF6" : "#9DB3C8", fontWeight: fort ? 700 : 400 }}>{intitule}</span>
      <span style={{ fontSize: fort ? 15 : 13.5, color: vert ? VERT : "#E4EDF6", fontWeight: fort ? 800 : 600, whiteSpace: "nowrap" }}>{valeur}</span>
    </div>
  );
}

// dansLApp : rendu à l'intérieur de l'espace intermittent connecté. On enlève
//   alors l'habillage de page publique (le grand titre, le contenu explicatif
//   écrit pour Google, l'invitation à s'inscrire) et on garde l'outil.
// initial : les vrais chiffres de la personne, pour que l'écran s'ouvre déjà
//   rempli. Retaper ce que Totor sait déjà n'aurait aucun sens : ici l'outil
//   sert à tester une AUTRE situation que la sienne.
export function SimulateurPublic({ onBack, onInscription, initial, dansLApp }) {
  const [annexe, setAnnexe] = useState(initial?.annexe === "annexe8" ? "annexe8" : "annexe10");
  const [heures, setHeures] = useState(initial?.heures != null ? String(initial.heures) : "");
  // Saisie en heures OU en cachets (retour réel du 04/08 : « on ne pense pas
  // toujours en heures, on pense en cachets »). 1 cachet artiste = 12 h, la
  // même conversion que partout dans l'app.
  const [saisieMode, setSaisieMode] = useState("heures");
  const [cachets, setCachets] = useState("");
  const [salaire, setSalaire] = useState(initial?.salaire != null ? String(initial.salaire) : "");
  const [avance, setAvance] = useState(false);
  const [hEnseignement, setHEnseignement] = useState("");
  const [hFormation, setHFormation] = useState("");
  const [dateFin, setDateFin] = useState("");
  const [joursTravailles, setJoursTravailles] = useState("");

  const [res, setRes] = useState(null);
  const [erreur, setErreur] = useState("");
  const [charge, setCharge] = useState(false);

  const heuresEffectives = saisieMode === "cachets" ? (Number(cachets) || 0) * 12 : Number(heures);
  const pret = heuresEffectives > 0 && Number(salaire) > 0;

  async function calculer(e) {
    e.preventDefault();
    if (!pret || charge) return;
    setCharge(true);
    setErreur("");
    setRes(null);
    try {
      const r = await fetch(`${API_BASE}/public/simulateur-allocation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          annexe,
          heures: heuresEffectives,
          salaire_reference: Number(salaire),
          heures_enseignement: Number(hEnseignement) || 0,
          heures_formation: Number(hFormation) || 0,
          date_fin_contrat: dateFin || null,
          jours_travailles: joursTravailles ? Number(joursTravailles) : null,
        }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        setErreur(typeof data.detail === "string" ? data.detail : "Le calcul n'a pas abouti, réessaie dans un instant.");
      } else {
        setRes(data);
      }
    } catch {
      setErreur("Connexion impossible. Vérifie ta connexion internet et réessaie.");
    } finally {
      setCharge(false);
    }
  }

  // Le haut réserve la barre d'état de l'iPhone : sans ça, le bouton Retour passe
  // DESSOUS et devient invisible. C'est la porte d'entrée mise en avant sur la
  // landing, donc vue avant connexion : elle doit être irréprochable. En mode
  // « dansLApp », la mise en page de l'app gère déjà la marge.
  return (
    <div style={dansLApp ? undefined : { minHeight: "100vh", background: "#07192E", padding: "calc(32px + env(safe-area-inset-top, 0px)) 20px 32px" }}>
      {!dansLApp && <style>{CSS}</style>}
      <div style={dansLApp ? undefined : { maxWidth: 720, margin: "0 auto" }}>

        {onBack && !dansLApp && (
          <button type="button" onClick={onBack}
            style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.15)", color: "#8BA5C0", borderRadius: 8, padding: "9px 14px", minHeight: 40, fontSize: 12.5, cursor: "pointer", fontFamily: "inherit", marginBottom: 24 }}>
            ← Retour
          </button>
        )}

        {dansLApp ? (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: "#0a1322", border: "1.5px solid rgba(93,202,165,0.4)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <i className="ti ti-coins" aria-hidden="true" style={{ color: VERT, fontSize: 22 }} />
              </div>
              <div>
                <div style={{ fontSize: 17, fontWeight: 800, color: "white" }}>Simuler une allocation 🐾</div>
                <div style={{ fontSize: 12.5, color: "#8BA5C0" }}>Change un chiffre, je recalcule tout.</div>
              </div>
            </div>
            <p style={{ fontSize: 13.5, color: "#8BA5C0", lineHeight: 1.7, margin: "0 0 22px" }}>
              {initial?.heures != null
                ? <>J'ai déjà mis <strong style={{ color: "#C5D4E3" }}>tes chiffres à toi</strong>. Modifie ce que tu veux pour voir l'effet : plus d'heures, un meilleur cachet, l'autre annexe. Ton dossier réel n'est pas touché, c'est un brouillon.</>
                : <>Entre des heures et des salaires pour voir ce que ça donnerait. Ton dossier réel n'est pas touché, c'est un brouillon.</>}
            </p>
          </>
        ) : (
          <>
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "1.5px", textTransform: "uppercase", color: VERT, marginBottom: 10 }}>Gratuit, sans compte</div>
            <h1 style={{ fontFamily: SERIF, fontSize: 32, fontWeight: 800, color: "white", lineHeight: 1.2, margin: "0 0 12px" }}>
              Simulateur d'allocation intermittent du spectacle
            </h1>
            <p style={{ fontSize: 14.5, color: "#8BA5C0", lineHeight: 1.7, margin: "0 0 10px", maxWidth: 620 }}>
              Calcule ton allocation journalière (ARE) en annexe 8 ou annexe 10, à partir de tes heures
              et de tes salaires bruts des 12 derniers mois.
            </p>
            <p style={{ fontSize: 14.5, color: "#C5D4E3", lineHeight: 1.7, margin: "0 0 26px", maxWidth: 620 }}>
              <strong style={{ color: VERT }}>Ici tu vois ton NET, pas seulement ton brut.</strong>{" "}
              La plupart des simulateurs s'arrêtent au montant brut. Je déduis pour toi la retraite
              complémentaire et la CSG, écrêtement compris, et je te montre le détail du calcul.
            </p>
          </>
        )}

        {/* ── Le formulaire ─────────────────────────────────────────────── */}
        <form onSubmit={calculer} style={carte}>
          <div style={{ marginBottom: 18 }}>
            <span style={label}>Ton régime</span>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {[
                { v: "annexe10", t: "Annexe 10", s: "Artiste" },
                { v: "annexe8", t: "Annexe 8", s: "Technicien, ouvrier" },
              ].map(o => (
                <button key={o.v} type="button" onClick={() => setAnnexe(o.v)}
                  style={{
                    flex: "1 1 160px", textAlign: "left", cursor: "pointer", fontFamily: "inherit",
                    background: annexe === o.v ? "rgba(93,202,165,0.14)" : "rgba(255,255,255,0.04)",
                    border: `1px solid ${annexe === o.v ? VERT : "rgba(255,255,255,0.14)"}`,
                    borderRadius: 10, padding: "12px 14px", minHeight: 44,
                  }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: annexe === o.v ? VERT : "#E4EDF6" }}>{o.t}</div>
                  <div style={{ fontSize: 11.5, color: "#8BA5C0", marginTop: 2 }}>{o.s}</div>
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 16 }}>
            <div style={{ flex: "1 1 200px" }}>
              <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                {[["heures", "En heures"], ["cachets", "En cachets"]].map(([m, lib]) => (
                  <button key={m} type="button" onClick={() => setSaisieMode(m)}
                    style={{ background: saisieMode === m ? "rgba(55,138,221,0.25)" : "transparent", border: `1px solid ${saisieMode === m ? BLEU : "rgba(255,255,255,0.14)"}`, borderRadius: 999, padding: "3px 11px", fontSize: 11.5, fontWeight: 700, color: saisieMode === m ? "#C5D4E3" : "#8BA5C0", cursor: "pointer", fontFamily: "inherit" }}>
                    {lib}
                  </button>
                ))}
              </div>
              {saisieMode === "cachets" ? (
                <>
                  <label style={label} htmlFor="simu-cachets">Cachets sur 12 mois</label>
                  <MontantInput id="simu-cachets" value={cachets} onChange={setCachets}
                    placeholder="43" style={champ} />
                  <div style={{ fontSize: 11.5, color: "#8BA5C0", marginTop: 5 }}>
                    = {(Number(cachets) || 0) * 12} h (1 cachet artiste = 12 h)
                  </div>
                </>
              ) : (
                <>
                  <label style={label} htmlFor="simu-heures">Heures travaillées sur 12 mois</label>
                  <MontantInput id="simu-heures" value={heures} onChange={setHeures}
                    placeholder="507" style={champ} />
                </>
              )}
            </div>
            <div style={{ flex: "1 1 200px" }}>
              <label style={label} htmlFor="simu-salaire">Salaire de référence brut (€)</label>
              <MontantInput id="simu-salaire" value={salaire} onChange={setSalaire} decimales
                placeholder="20 000" style={champ} />
            </div>
          </div>

          <button type="button" onClick={() => setAvance(v => !v)}
            style={{ background: "transparent", border: "none", color: BLEU, fontSize: 12.5, cursor: "pointer", fontFamily: "inherit", padding: "6px 0", fontWeight: 600 }}>
            {avance ? "− Masquer" : "+ Affiner"} : formation, enseignement, franchises, date anniversaire
          </button>

          {avance && (
            <div style={{ marginTop: 12, paddingTop: 14, borderTop: "1px solid rgba(255,255,255,0.08)" }}>
              <p style={{ fontSize: 12, color: "#8BA5C0", lineHeight: 1.6, margin: "0 0 14px" }}>
                Les heures de formation et d'enseignement comptent pour atteindre les 507 heures,
                mais elles n'augmentent jamais le montant de ton allocation.
              </p>
              <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 14 }}>
                <div style={{ flex: "1 1 160px" }}>
                  <label style={label} htmlFor="simu-ens">Heures d'enseignement</label>
                  <MontantInput id="simu-ens" value={hEnseignement} onChange={setHEnseignement}
                    placeholder="0" style={champ} />
                </div>
                <div style={{ flex: "1 1 160px" }}>
                  <label style={label} htmlFor="simu-form">Heures de formation suivie</label>
                  <MontantInput id="simu-form" value={hFormation} onChange={setHFormation}
                    placeholder="0" style={champ} />
                </div>
              </div>
              <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
                <div style={{ flex: "1 1 160px" }}>
                  <label style={label} htmlFor="simu-jours">Jours travaillés (franchise congés payés)</label>
                  <MontantInput id="simu-jours" value={joursTravailles} onChange={setJoursTravailles}
                    placeholder="0" style={champ} />
                </div>
                <div style={{ flex: "1 1 160px" }}>
                  <label style={label} htmlFor="simu-date">Fin de ton dernier contrat</label>
                  <input id="simu-date" type="date" value={dateFin} onChange={e => setDateFin(e.target.value)}
                    style={champ} />
                </div>
              </div>
            </div>
          )}

          <button type="submit" disabled={!pret || charge}
            style={{
              width: "100%", marginTop: 20, minHeight: 48, borderRadius: 10, border: "none",
              background: pret && !charge ? VERT : "rgba(255,255,255,0.10)",
              color: pret && !charge ? "#07192E" : "#7E93A8",
              fontSize: 15, fontWeight: 800, fontFamily: "inherit",
              cursor: pret && !charge ? "pointer" : "default",
            }}>
            {charge ? "Je calcule…" : "Calculer mon allocation"}
          </button>

          <p style={{ fontSize: 11.5, color: "#7E93A8", lineHeight: 1.6, margin: "12px 0 0", textAlign: "center" }}>
            Aucun compte, aucun email. <strong style={{ color: "#9DB3C8" }}>Rien de ce que tu tapes n'est enregistré.</strong>
          </p>
        </form>

        {erreur && (
          <div style={{ ...carte, borderColor: "rgba(255,150,150,0.3)" }}>
            <p style={{ fontSize: 13.5, color: "#F0C0C0", margin: 0, lineHeight: 1.6 }}>{erreur}</p>
          </div>
        )}

        {/* ── Le résultat ───────────────────────────────────────────────── */}
        {res && (
          <>
            <div style={{ ...carte, background: "rgba(93,202,165,0.07)", borderColor: "rgba(93,202,165,0.28)" }}>
              {res.affichable ? (
                <>
                  <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase", color: VERT, marginBottom: 8 }}>Ton allocation journalière</div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap", marginBottom: 4 }}>
                    <span style={{ fontFamily: SERIF, fontSize: 42, fontWeight: 800, color: "white", lineHeight: 1 }}>
                      {formatEUR(res.aj_nette)}
                    </span>
                    <span style={{ fontSize: 15, color: "#9DB3C8" }}>net par jour</span>
                  </div>
                  <p style={{ fontSize: 13, color: "#8BA5C0", margin: "10px 0 0", lineHeight: 1.6 }}>
                    Soit environ <strong style={{ color: "#C5D4E3" }}>{formatEUR(res.allocation_mensuelle_indicative)}</strong> pour
                    un mois de 30 jours entièrement indemnisé. Ton versement réel dépend de tes jours travaillés
                    dans le mois : c'est ce que TOTOR calcule ensuite pour toi.
                  </p>
                </>
              ) : (
                <p style={{ fontSize: 13.5, color: "#C5D4E3", margin: 0, lineHeight: 1.7 }}>
                  Il me manque quelque chose pour calculer ton allocation avec certitude, et je préfère
                  me taire plutôt que t'avancer un chiffre à l'aveugle.
                </p>
              )}
            </div>

            {/* Les 507 heures */}
            <div style={carte}>
              <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase", color: res.eligible ? VERT : "#E8B87A", marginBottom: 10 }}>
                {res.eligible ? "Tu as tes 507 heures" : "Il te manque des heures"}
              </div>
              <LigneDetail intitule="Heures de travail" valeur={`${res.heures_travail} h`} />
              {res.heures_assimilees > 0 && (
                <LigneDetail intitule="Heures assimilées (formation, enseignement)" valeur={`${res.heures_assimilees} h`} />
              )}
              <LigneDetail intitule="Total retenu pour les 507 h" valeur={`${res.heures_total_507} h`} fort />
              {!res.eligible && (
                <p style={{ fontSize: 13, color: "#E8B87A", margin: "12px 0 0", lineHeight: 1.6 }}>
                  Il te manque <strong>{res.manque_heures} heures</strong> pour ouvrir tes droits.
                </p>
              )}
            </div>

            {/* Le détail du calcul */}
            {res.affichable && (
              <div style={carte}>
                <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase", color: "#9DB3C8", marginBottom: 10 }}>D'où vient ce montant</div>
                <LigneDetail intitule="Part liée à tes salaires" valeur={formatEUR(res.partie_a)} />
                <LigneDetail intitule="Part liée à tes heures" valeur={formatEUR(res.partie_b)} />
                <LigneDetail intitule="Part fixe" valeur={formatEUR(res.partie_c)} />
                <LigneDetail intitule="Allocation journalière initiale" valeur={formatEUR(res.aj_initiale)} fort />
                <LigneDetail intitule="Retraite complémentaire" valeur={`− ${formatEUR(res.retenue_retraite)}`} />
                <LigneDetail intitule="Allocation brute" valeur={formatEUR(res.aj_brute)} />
                <LigneDetail intitule="CSG / CRDS" valeur={res.retenue_csg_crds > 0 ? `− ${formatEUR(res.retenue_csg_crds)}` : "aucune"} />
                <LigneDetail intitule="Allocation nette, avant impôt à la source" valeur={formatEUR(res.aj_nette)} fort vert />
                {res.retenue_csg_crds === 0 && res.aj_brute > 0 && (
                  <p style={{ fontSize: 12, color: "#8BA5C0", margin: "12px 0 0", lineHeight: 1.6 }}>
                    Pas de CSG dans ton cas : elle ne peut pas faire descendre une allocation sous un
                    plancher légal, et tu es déjà en dessous.
                  </p>
                )}
                {res.plancher_applique && (
                  <p style={{ fontSize: 12, color: "#8BA5C0", margin: "12px 0 0", lineHeight: 1.6 }}>
                    Ton calcul tombe sous le minimum garanti par ton annexe : c'est ce minimum qui s'applique.
                  </p>
                )}
                {res.plafond_applique && (
                  <p style={{ fontSize: 12, color: "#8BA5C0", margin: "12px 0 0", lineHeight: 1.6 }}>
                    Ton calcul dépasse le plafond de l'allocation journalière : c'est le plafond qui s'applique.
                  </p>
                )}
              </div>
            )}

            {/* Franchise et date anniversaire */}
            {(res.franchise_cp_jours != null || res.date_anniversaire) && (
              <div style={carte}>
                <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase", color: "#9DB3C8", marginBottom: 10 }}>Tes repères de calendrier</div>
                {res.franchise_cp_jours != null && (
                  <LigneDetail intitule="Franchise congés payés" valeur={`${res.franchise_cp_jours} jour${res.franchise_cp_jours > 1 ? "s" : ""}`} />
                )}
                {res.date_anniversaire && (
                  <LigneDetail intitule="Date anniversaire de tes droits" valeur={new Date(res.date_anniversaire).toLocaleDateString("fr-FR")} />
                )}
                <p style={{ fontSize: 12, color: "#8BA5C0", margin: "12px 0 0", lineHeight: 1.6 }}>
                  Une franchise salaires peut aussi s'ajouter selon tes revenus de la période. France Travail
                  te la donne sur ta notification, et TOTOR la prend en compte dans ton estimation mensuelle.
                </p>
              </div>
            )}

            {/* L'invitation, sans forcer. Inutile pour quelqu'un déjà connecté. */}
            {!dansLApp && (
            <div style={{ ...carte, background: "rgba(55,138,221,0.08)", borderColor: "rgba(55,138,221,0.28)" }}>
              <h2 style={{ fontFamily: SERIF, fontSize: 20, fontWeight: 700, color: "white", margin: "0 0 10px", lineHeight: 1.3 }}>
                Et ton mois prochain, il ressemble à quoi ?
              </h2>
              <p style={{ fontSize: 13.5, color: "#C5D4E3", lineHeight: 1.7, margin: "0 0 16px" }}>
                Ce calcul te donne ton montant par jour. Ce qui compte vraiment, c'est ce que tu vas
                toucher à la fin du mois : ça dépend de tes contrats, de tes jours non indemnisables et
                de tes franchises. TOTOR suit tes 507 heures, lit tes AEM en photo et calcule ton mois
                tout seul.
              </p>
              {onInscription && (
                <button type="button" onClick={onInscription}
                  style={{ background: VERT, color: "#07192E", border: "none", borderRadius: 10, padding: "13px 22px", minHeight: 46, fontSize: 14.5, fontWeight: 800, fontFamily: "inherit", cursor: "pointer" }}>
                  Essayer TOTOR gratuitement
                </button>
              )}
            </div>
            )}

            <p style={{ fontSize: 11.5, color: "#7E93A8", lineHeight: 1.7, margin: "0 0 24px" }}>
              {res.avertissement}
            </p>
          </>
        )}

        {/* ── Contenu explicatif (utile aux gens, et lu par Google). Dans
             l'application, c'est du bruit : la page « Comprendre » est là. ── */}
        {!dansLApp && (<>
        <div style={carte}>
          <h2 style={{ fontFamily: SERIF, fontSize: 22, fontWeight: 700, color: "white", margin: "0 0 14px", lineHeight: 1.3 }}>
            Comment se calcule l'allocation d'un intermittent ?
          </h2>
          <p style={{ fontSize: 13.5, color: "#C5D4E3", lineHeight: 1.75, margin: "0 0 14px" }}>
            L'allocation journalière des annexes 8 et 10 n'est pas un pourcentage de ton salaire. Elle
            additionne trois parts : une part calculée sur tes <strong>salaires bruts</strong> des 12
            derniers mois, une part calculée sur tes <strong>heures travaillées</strong>, et une part
            fixe. C'est pour ça que travailler plus d'heures au même tarif fait monter ton allocation,
            et qu'un gros cachet ne la fait pas exploser.
          </p>
          <p style={{ fontSize: 13.5, color: "#C5D4E3", lineHeight: 1.75, margin: "0 0 14px" }}>
            Sur ce montant, France Travail retient d'abord une <strong>retraite complémentaire</strong>,
            puis la <strong>CSG et la CRDS</strong>. Mais ces retenues ne peuvent pas faire descendre ton
            allocation sous un plancher : si tu es déjà en dessous, tu ne paies rien, et si tu es juste
            au dessus, la retenue est rabotée pour t'y ramener. C'est cette règle que la plupart des
            simulateurs ignorent, et c'est pour ça qu'ils s'arrêtent au brut.
          </p>
          <h2 style={{ fontFamily: SERIF, fontSize: 22, fontWeight: 700, color: "white", margin: "22px 0 14px", lineHeight: 1.3 }}>
            Annexe 8 ou annexe 10 ?
          </h2>
          <p style={{ fontSize: 13.5, color: "#C5D4E3", lineHeight: 1.75, margin: "0 0 14px" }}>
            L'<strong>annexe 10</strong> couvre les artistes : comédiens, musiciens, danseurs, circassiens.
            Chaque cachet y compte pour 12 heures. L'<strong>annexe 8</strong> couvre les techniciens et
            ouvriers du spectacle : régisseurs, éclairagistes, ingénieurs du son, machinistes, habilleuses,
            monteurs. Leurs heures sont comptées réellement. Les deux annexes demandent
            <strong> 507 heures sur 12 mois</strong>, mais leurs formules de calcul sont différentes.
          </p>
          <h2 style={{ fontFamily: SERIF, fontSize: 22, fontWeight: 700, color: "white", margin: "22px 0 14px", lineHeight: 1.3 }}>
            D'où viennent ces chiffres ?
          </h2>
          <p style={{ fontSize: 13.5, color: "#C5D4E3", lineHeight: 1.75, margin: 0 }}>
            Des formules publiées par France Travail. Et pour être sûr de ne pas te raconter n'importe
            quoi, j'ai confronté mon calcul au simulateur officiel de France Travail sur vingt-quatre
            situations différentes, couvrant les deux annexes, de 2 000 à un million d'euros de salaire
            de référence. J'y ai même trouvé une erreur chez moi, que j'ai corrigée. Cette estimation
            reste indicative : seule ta notification France Travail fait foi.
          </p>
        </div>

        <p style={{ fontSize: 12.5, color: "#8BA5C0", lineHeight: 1.7, margin: "24px 0 8px", textAlign: "center" }}>
          Une question, une erreur, un cas que je ne gère pas ?{" "}
          <a href="mailto:bonjour@montotor.fr" style={{ color: VERT, fontWeight: 700, textDecoration: "none" }}>bonjour@montotor.fr</a>
        </p>
        </>)}
      </div>
    </div>
  );
}
