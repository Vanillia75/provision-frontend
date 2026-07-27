// ============================================================================
//  MontantInput — champ de saisie de MONTANT (€) avec séparateur de milliers.
//  - Affichage FR pendant la frappe : "8787850" → "8 787 850" (espace insécable).
//  - Valeur STOCKÉE propre : `onChange` renvoie un nombre-string sans espaces
//    ("8787850" / "1234.56"), drop-in des `setX(e.target.value)` existants.
//  - type="text" + inputMode (un type="number" ne peut pas afficher d'espaces).
//  - Curseur préservé : on compte les chiffres à gauche du curseur et on le
//    repositionne après reformatage (pas de saut quand on corrige au milieu).
//  - decimales : true → autorise la virgule (2 décimales max) ; false → entier.
//
//  Sorti de App.jsx le 27/07/2026 pour être utilisable par les pages publiques
//  (le simulateur en accès libre) sans importer tout App.jsx, ce qui créerait
//  une boucle d'imports. Règle maison : TOUT nouveau champ € passe par ici.
// ============================================================================
import { useRef, useLayoutEffect } from "react";

const NBSP = " ";

export default function MontantInput({ value, onChange, decimales = false, style, ...rest }) {
  const ref = useRef(null);
  const caretDigits = useRef(null);   // nb de chiffres à gauche du curseur à restaurer
  const caretAfterSep = useRef(false); // le curseur était juste après la virgule

  const toDisplay = (clean) => {
    if (clean == null || clean === "") return "";
    const [ent, dec] = String(clean).split(".");
    const e = (ent || "").replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
    return dec != null ? `${e},${dec}` : e;
  };

  const handleChange = (e) => {
    const el = e.target;
    const pos = el.selectionStart ?? el.value.length;
    const left = el.value.slice(0, pos);
    caretDigits.current = (left.match(/\d/g) || []).length;
    caretAfterSep.current = /[.,]$/.test(left);

    let raw = el.value.replace(/[^\d.,]/g, "").replace(/,/g, ".");
    if (decimales) {
      const i = raw.indexOf(".");
      if (i !== -1) raw = raw.slice(0, i + 1) + raw.slice(i + 1).replace(/\./g, "").slice(0, 2);
    } else {
      raw = raw.replace(/\./g, "");
    }
    onChange(raw);
  };

  useLayoutEffect(() => {
    if (caretDigits.current == null || !ref.current) return;
    const disp = ref.current.value;
    let seen = 0, pos = 0;
    while (pos < disp.length && seen < caretDigits.current) {
      if (/\d/.test(disp[pos])) seen++;
      pos++;
    }
    if (caretAfterSep.current) {
      const c = disp.indexOf(",");
      if (c !== -1) pos = c + 1;
    }
    ref.current.setSelectionRange(pos, pos);
    caretDigits.current = null;
  });

  return (
    <input
      ref={ref}
      type="text"
      inputMode={decimales ? "decimal" : "numeric"}
      value={toDisplay(value)}
      onChange={handleChange}
      style={style}
      {...rest}
    />
  );
}
