import React, { useState, useEffect, useRef, useMemo } from "react";
import { supabase } from "./lib/supabase.js";
import {
  BarChart, Bar, AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell,
  PieChart, Pie, CartesianGrid,
} from "recharts";
import {
  Home, Building2, DoorOpen, Users, Wallet, BarChart3, Mic, Send, Plus, Search,
  LogOut, X, Check, AlertTriangle, TrendingUp, Sparkles, Volume2, VolumeX, Pencil,
  Trash2, Receipt, Menu, Phone, Mail, MapPin, ChevronRight, ArrowLeft, ArrowUpRight,
  CalendarClock, Calendar, ArrowDownRight, Layers, Coins, FolderOpen, Settings, FileText, Tag, Upload, RotateCcw, Bell, Banknote, Sun, Moon, Monitor, MessageCircle, MessageSquare, Share2, Printer, Download,
} from "lucide-react";

/* ============================ Helpers ============================ */
const STORAGE_KEY = "drame-gestion-data-v10";
// Gestion du bouton "retour" matériel (Android) et du geste retour :
// quand une couche fermable s'ouvre (modale, tiroir…), on empile une entrée
// d'historique ; le retour déclenche 'popstate' et on ferme la couche au lieu
// de quitter l'application. Chaque couche a une clé unique pour éviter les conflits.
function useBackClose(isOpen, onClose) {
  const pushedRef = useRef(false);
  useEffect(() => {
    if (!isOpen) return;
    const key = "layer-" + Math.random().toString(36).slice(2);
    window.history.pushState({ layer: key }, "");
    pushedRef.current = true;
    const onPop = () => { pushedRef.current = false; onClose(); };
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("popstate", onPop);
      // Fermeture "manuelle" (croix, clic dehors) : on retire l'entrée ajoutée
      // pour rester synchronisé avec l'historique du navigateur.
      if (pushedRef.current) { pushedRef.current = false; window.history.back(); }
    };
  }, [isOpen]);
}
// Résout la préférence de thème ("light" | "dark" | "system") en booléen effectif,
// et reste réactif si l'utilisateur change le thème de son téléphone en mode "system".
function useIsDark(pref) {
  const getSystem = () => typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  const [systemDark, setSystemDark] = useState(getSystem);
  useEffect(() => {
    if (!window.matchMedia) return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setSystemDark(mq.matches);
    mq.addEventListener ? mq.addEventListener("change", onChange) : mq.addListener(onChange);
    return () => { mq.removeEventListener ? mq.removeEventListener("change", onChange) : mq.removeListener(onChange); };
  }, []);
  return pref === "dark" || (pref === "system" && systemDark);
}
const gnf = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "GNF", maximumFractionDigits: 0 });
const money = (n) => gnf.format(n || 0);
const gnfC = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "GNF", notation: "compact", maximumFractionDigits: 1 });
const moneyC = (n) => gnfC.format(n || 0); // format compact : 4 800 000 -> "4,8 M GNF"
const uid = () => Math.random().toString(36).slice(2, 9);
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const initials = (t) => `${(t?.prenom || "").trim()[0] || ""}${(t?.nom || "").trim()[0] || "?"}`.toUpperCase();
// Partage : liens standards (fonctionnent sans backend, ouvrent l'appli installée sur le téléphone)
const digitsOnly = (phone) => (phone || "").replace(/[^\d]/g, "");
const waLink = (phone, message) => `https://wa.me/${digitsOnly(phone)}?text=${encodeURIComponent(message)}`;
const smsLink = (phone, message) => `sms:${phone || ""}?body=${encodeURIComponent(message)}`;
const canShareNative = () => typeof navigator !== "undefined" && !!navigator.share;

// Montant en toutes lettres (convention des quittances francophones) — ex. 600000 -> "six cent mille francs guinéens"
function nombreEnLettres(n) {
  if (n === 0) return "zéro";
  const unites = ["", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf"];
  const dix19 = ["dix", "onze", "douze", "treize", "quatorze", "quinze", "seize", "dix-sept", "dix-huit", "dix-neuf"];
  const dizaines = ["", "", "vingt", "trente", "quarante", "cinquante", "soixante"];
  // isFinal : ce segment est-il le tout dernier mot du nombre complet ? "Cent" et
  // "quatre-vingts" ne prennent un "s" que dans ce cas précis — pas quand ils sont
  // suivis d'un multiplicateur (mille/million/milliard), ex. "six cent mille" (sans s).
  function deuxChiffres(x, isFinal) {
    if (x < 10) return unites[x];
    if (x < 20) return dix19[x - 10];
    if (x < 70) {
      const d = Math.floor(x / 10), u = x % 10;
      if (u === 0) return dizaines[d];
      if (u === 1) return dizaines[d] + "-et-un";
      return dizaines[d] + "-" + unites[u];
    }
    if (x < 80) { const u = x - 60; return u === 11 ? "soixante-et-onze" : "soixante-" + dix19[u - 10]; }
    const u = x - 80;
    if (u === 0) return isFinal ? "quatre-vingts" : "quatre-vingt";
    return u < 10 ? "quatre-vingt-" + unites[u] : "quatre-vingt-" + dix19[u - 10];
  }
  function troisChiffres(x, isFinal) {
    const c = Math.floor(x / 100), r = x % 100;
    let s = "";
    if (c > 0) { s += c === 1 ? "cent" : unites[c] + " cent"; if (c > 1 && r === 0 && isFinal) s += "s"; }
    if (r > 0) s += (s ? " " : "") + deuxChiffres(r, isFinal);
    return s;
  }
  const groupes = [{ v: 1e9, s: "milliard", p: "milliards" }, { v: 1e6, s: "million", p: "millions" }, { v: 1e3, s: "mille", p: "mille" }];
  let reste = Math.round(n), parties = [];
  for (const g of groupes) {
    const q = Math.floor(reste / g.v);
    // Un groupe (milliard/million/mille) est toujours suivi de son mot-multiplicateur :
    // "cent"/"quatre-vingts" à l'intérieur ne sont donc jamais en position finale.
    if (q > 0) { parties.push(g.v === 1e3 && q === 1 ? "mille" : troisChiffres(q, false) + " " + (q > 1 ? g.p : g.s)); reste %= g.v; }
  }
  if (reste > 0 || parties.length === 0) parties.push(troisChiffres(reste, true)); // dernier segment : vraiment final
  return parties.join(" ").replace(/\s+/g, " ").trim();
}
const montantEnLettres = (n) => `${cap(nombreEnLettres(n))} franc${n > 1 ? "s" : ""} guinéen${n > 1 ? "s" : ""}`;
// Signature utilisée dans les messages de confirmation de paiement envoyés aux locataires —
// dérivée du nom du gestionnaire (Paramètres) plutôt que figée, pour rester à jour si ça change.
const signatureGestionnaire = (data) => `Le Gestionnaire Mr ${(data.parametres?.gestionnaire || "Sanoussy DRAMÉ").trim().split(" ").pop()}`;
// Arriérés d'un locataire (autres loyers impayés que celui de la quittance en cours),
// pour avertir dans le message/PDF plutôt que de laisser croire qu'il est à jour.
function arrieresLocataire(data, locataireId, excludePaiementId) {
  const lignes = data.paiements
    .filter((p) => p.locataireId === locataireId && p.id !== excludePaiementId && p.statut !== "paye")
    .sort((a, b) => a.mois.localeCompare(b.mois));
  const total = lignes.reduce((s, p) => s + p.montant, 0);
  const mois = lignes.map((p) => cap(moisNom(p.mois))).join(", ");
  const note = lignes.length > 0 ? ` Attention : un arriéré de ${money(total)} reste dû pour ${mois}.` : "";
  return { lignes, total, mois, note };
}

/* ============================ Génération de PDF (sans bibliothèque) ============================
   L'aperçu Claude ne donne pas accès à une bibliothèque de génération de PDF (jsPDF, etc.).
   Le format PDF étant un format texte assez simple pour un document basique, ce générateur
   construit un PDF valide à la main (page A4, rectangles de couleur, texte, lignes) —
   validé structurellement (qpdf), en extraction de texte (pdftotext/pypdf) et visuellement. */
function pdfEscapeText(str) {
  let out = "";
  for (const ch of String(str)) {
    const code = ch.codePointAt(0);
    if (code === 0x2019) { out += "'"; continue; }
    if (code === 0x20ac) { out += String.fromCharCode(0x80); continue; } // €
    // Espaces Unicode variées (insécable, fine insécable utilisée par Intl.NumberFormat
    // pour séparer les milliers, etc.) -> espace normale, sinon le "?" de repli s'affiche.
    if (code === 0x00a0 || code === 0x202f || code === 0x2009 || code === 0x2007 || code === 0x2002 || code === 0x2003) { out += " "; continue; }
    const c = code <= 0xff ? String.fromCharCode(code) : "?";
    out += (c === "(" || c === ")" || c === "\\") ? "\\" + c : c;
  }
  return out;
}
function buildPdfBytes({ width = 595, height = 842, ops }) {
  let stream = "";
  for (const op of ops) {
    if (op.type === "rect") {
      const [r, g, b] = op.color;
      stream += `q ${r} ${g} ${b} rg ${op.x.toFixed(2)} ${op.y.toFixed(2)} ${op.w.toFixed(2)} ${op.h.toFixed(2)} re f Q\n`;
    } else if (op.type === "line") {
      const [r, g, b] = op.color;
      stream += `q ${r} ${g} ${b} RG ${op.width || 1} w`;
      if (op.dash) stream += ` [${op.dash.join(" ")}] 0 d`;
      stream += ` ${op.x1.toFixed(2)} ${op.y1.toFixed(2)} m ${op.x2.toFixed(2)} ${op.y2.toFixed(2)} l S Q\n`;
    } else if (op.type === "text") {
      const [r, g, b] = op.color || [0, 0, 0];
      const font = op.font === "B" ? "/F2" : "/F1";
      stream += `q ${r} ${g} ${b} rg BT ${font} ${op.size} Tf ${op.x.toFixed(2)} ${op.y.toFixed(2)} Td (${pdfEscapeText(op.text)}) Tj ET Q\n`;
    }
  }
  const objects = [
    `<< /Type /Catalog /Pages 2 0 R >>`,
    `<< /Type /Pages /Kids [3 0 R] /Count 1 >>`,
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> /Contents 4 0 R >>`,
    `<< /Length ${stream.length} >>\nstream\n${stream}endstream`,
    `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>`,
    `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>`,
  ];
  let out = "%PDF-1.4\n%\xE2\xE3\xCF\xD3\n";
  const offsets = [0];
  objects.forEach((obj, i) => { offsets.push(out.length); out += `${i + 1} 0 obj\n${obj}\nendobj\n`; });
  const xrefStart = out.length;
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objects.length; i++) out += String(offsets[i]).padStart(10, "0") + " 00000 n \n";
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
  // Conversion en octets bruts (chaque caractère = 1 octet, cohérent avec l'encodage WinAnsi ci-dessus)
  const bytes = new Uint8Array(out.length);
  for (let i = 0; i < out.length; i++) bytes[i] = out.charCodeAt(i) & 0xff;
  return bytes;
}
function telechargerPdf(bytes, nomFichier) {
  const blob = new Blob([bytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = nomFichier;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
// Partage natif du fichier PDF (WhatsApp, etc. via le sélecteur du téléphone) si l'appareil
// le permet ; sinon, replie sur le partage du texte via ShareRow.
async function partagerPdf(bytes, nomFichier, texte) {
  try {
    const file = new File([bytes], nomFichier, { type: "application/pdf" });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], text: texte });
      return true;
    }
  } catch {}
  return false;
}
const TPL_GENERAL = "Bonjour {locataire}, nous vous rappelons que le loyer de votre local {local} d'un montant de {montant} est à régler au plus tard le {jour} de ce mois. Merci de votre diligence. {societe}";
const TPL_RETARD = "Bonjour {locataire}, notre relevé indique un loyer impayé pour le local {local} ({mois}) d'un montant de {montant}. Merci de bien vouloir régulariser dans les meilleurs délais. {societe}";
const DOC_CATS = ["Bail", "Quittance", "Pièce d'identité", "État des lieux", "Assurance", "Autre"];
const DOC_CAT_CLS = { "Bail": "bg-teal-50 text-teal-700", "Quittance": "bg-emerald-50 text-emerald-700", "Pièce d'identité": "bg-indigo-50 text-indigo-700", "État des lieux": "bg-amber-50 text-amber-700", "Assurance": "bg-cyan-50 text-cyan-700", "Autre": "bg-slate-100 text-slate-600" };
const buildRappelMessage = (tpl, t, info, societe) => tpl.split("{locataire}").join(`${t.prenom} ${t.nom}`).split("{local}").join(info.local.nom).split("{montant}").join(money(info.montant)).split("{mois}").join(cap(moisNom(info.mois))).split("{jour}").join("5").split("{societe}").join(societe);
// Ancienneté lisible depuis une date d'entrée (ex. "2 ans et 4 mois")
function anciennete(dateStr) {
  if (!dateStr) return null;
  const debut = new Date(dateStr), maintenant = new Date();
  let mois = (maintenant.getFullYear() - debut.getFullYear()) * 12 + (maintenant.getMonth() - debut.getMonth());
  if (maintenant.getDate() < debut.getDate()) mois -= 1;
  mois = Math.max(0, mois);
  const ans = Math.floor(mois / 12), reste = mois % 12;
  if (ans === 0) return reste === 0 ? "moins d'un mois" : `${reste} mois`;
  if (reste === 0) return `${ans} an${ans > 1 ? "s" : ""}`;
  return `${ans} an${ans > 1 ? "s" : ""} et ${reste} mois`;
}

const now = new Date();
const curMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
const shiftMonth = (base, delta) => {
  const [y, m] = base.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};
const moisLong = (m) => { const [y, mo] = m.split("-").map(Number); return new Date(y, mo - 1, 1).toLocaleDateString("fr-FR", { month: "long", year: "numeric" }); };
const moisNom = (m) => { const [y, mo] = m.split("-").map(Number); return new Date(y, mo - 1, 1).toLocaleDateString("fr-FR", { month: "long" }); };
const moisCourt = (m) => { const [y, mo] = m.split("-").map(Number); return new Date(y, mo - 1, 1).toLocaleDateString("fr-FR", { month: "short" }).replace(".", ""); };

const moisAvance = curMonth;                 // ex. juillet — immeubles "en avance"
const moisEchu = shiftMonth(curMonth, -1);   // ex. juin — immeubles "terme échu"
const echeanceLabel = `5 ${moisNom(curMonth)}`;

/* ============================ Seed ============================ */
function seed() {
  const immeubles = [
    { id: "im1", nom: "Ex EDG Damakania", adresse: "Damakania, Ratoma — Conakry", mode: "avance" },
    { id: "im2", nom: "Damakania 142", adresse: "Damakania 142, Ratoma — Conakry", mode: "echu" },
  ];
  const locaux = [
    // Ex EDG Damakania — duplex : rez-de-chaussée (R20) + étage loué en bloc (2 appartements, un seul bail)
    { id: "r20", immeubleId: "im1", nom: "R20", type: "Appartement", bloc: "", pieces: 2, surface: 0, loyer: 1000000, charges: 0, statut: "loue" },
    { id: "etage", immeubleId: "im1", nom: "R31 & R32", type: "Appartement", bloc: "", pieces: 6, surface: 0, loyer: 4000000, charges: 0, statut: "loue" },
    // Damakania 142 — Bloc A : 4 appartements de 2 chambres et salon, 600 000 GNF
    { id: "a21", immeubleId: "im2", nom: "A21", type: "Appartement", bloc: "A", pieces: 2, surface: 0, loyer: 600000, charges: 0, statut: "loue" },
    { id: "a22", immeubleId: "im2", nom: "A22", type: "Appartement", bloc: "A", pieces: 2, surface: 0, loyer: 600000, charges: 0, statut: "loue" },
    { id: "a23", immeubleId: "im2", nom: "A23", type: "Appartement", bloc: "A", pieces: 2, surface: 0, loyer: 600000, charges: 0, statut: "loue" },
    { id: "a24", immeubleId: "im2", nom: "A24", type: "Appartement", bloc: "A", pieces: 2, surface: 0, loyer: 600000, charges: 0, statut: "loue" },
    // Damakania 142 — Bloc B : 3 appartements de 1 chambre et salon (400 000) + 1 chambre douche (200 000)
    { id: "b10", immeubleId: "im2", nom: "B10", type: "Chambre", bloc: "B", pieces: 1, surface: 0, loyer: 200000, charges: 0, statut: "loue" },
    { id: "b11", immeubleId: "im2", nom: "B11", type: "Appartement", bloc: "B", pieces: 1, surface: 0, loyer: 400000, charges: 0, statut: "loue" },
    { id: "b12", immeubleId: "im2", nom: "B12", type: "Appartement", bloc: "B", pieces: 1, surface: 0, loyer: 400000, charges: 0, statut: "loue" },
    { id: "b13", immeubleId: "im2", nom: "B13", type: "Appartement", bloc: "B", pieces: 1, surface: 0, loyer: 400000, charges: 0, statut: "loue" },
    // Damakania 142 — Bloc C : 5 appartements de 1 chambre et salon, 400 000 GNF
    { id: "c1", immeubleId: "im2", nom: "C1", type: "Appartement", bloc: "C", pieces: 1, surface: 0, loyer: 400000, charges: 0, statut: "loue" },
    { id: "c2", immeubleId: "im2", nom: "C2", type: "Appartement", bloc: "C", pieces: 1, surface: 0, loyer: 400000, charges: 0, statut: "loue" },
    { id: "c3", immeubleId: "im2", nom: "C3", type: "Appartement", bloc: "C", pieces: 1, surface: 0, loyer: 400000, charges: 0, statut: "loue" },
    { id: "c4", immeubleId: "im2", nom: "C4", type: "Appartement", bloc: "C", pieces: 1, surface: 0, loyer: 400000, charges: 0, statut: "loue" },
    { id: "c5", immeubleId: "im2", nom: "C5", type: "Appartement", bloc: "C", pieces: 1, surface: 0, loyer: 400000, charges: 0, statut: "loue" },
  ];
  // Coordonnées (téléphone/email) et date d'entrée non fournies : laissées vides,
  // à compléter par vos soins plutôt que d'être devinées.
  const locataires = [
    { id: "t1", prenom: "Docteur", nom: "Mamy", email: "", telephone: "+224613 90 99 37", localId: "a21", dateEntree: "" },
    { id: "t2", prenom: "Madame", nom: "COMPAORÉ", email: "", telephone: "+224623 11 94 35", localId: "a22", dateEntree: "" },
    { id: "t3", prenom: "Sidiki", nom: "TOUNKARA", email: "", telephone: "+224627 47 37 91", localId: "a23", dateEntree: "" },
    { id: "t4", prenom: "François", nom: "KOLIÉ", email: "", telephone: "+224620 01 90 99", localId: "a24", dateEntree: "" },
    { id: "t5", prenom: "Alhassane", nom: "MARA", email: "", telephone: "+224624 81 05 69", localId: "b10", dateEntree: "" },
    { id: "t6", prenom: "Kpoghomou", nom: "KPAKILÉ", email: "", telephone: "+224620 14 69 67", localId: "b11", dateEntree: "" },
    { id: "t7", prenom: "Julien Kaka", nom: "KAMANO", email: "", telephone: "+224622 37 26 28", localId: "b12", dateEntree: "" },
    { id: "t8", prenom: "Madame", nom: "CISSÉ", email: "", telephone: "+224 623 33 04 55", localId: "b13", dateEntree: "" },
    { id: "t15", prenom: "Mamadou Samba", nom: "DIALLO", email: "", telephone: "+224 612 31 48 29", localId: "c1", dateEntree: "" },
    { id: "t14", prenom: "Moussa", nom: "KONATÉ", email: "", telephone: "+224 622 35 97 16", localId: "c2", dateEntree: "" },
    { id: "t9", prenom: "Fodé", nom: "OULARÉ", email: "", telephone: "+224620 23 58 01", localId: "c3", dateEntree: "" },
    { id: "t12", prenom: "Koumandjan", nom: "COULIBALY", email: "", telephone: "+224611 47 81 43", localId: "c4", dateEntree: "" },
    { id: "t13", prenom: "Alpha Oumar", nom: "DIALLO", email: "", telephone: "+224620 98 25 00", localId: "c5", dateEntree: "" },
    { id: "t11", prenom: "Mr", nom: "ARZUNE", email: "", telephone: "+224627 07 22 53", localId: "etage", dateEntree: "" },
    { id: "t10", prenom: "Ingénieur", nom: "DAOUDA", email: "", telephone: "+224610 67 85 78", localId: "r20", dateEntree: "" },
  ];

  const modeOf = (imId) => immeubles.find((i) => i.id === imId).mode;
  // On ne connaît pas le véritable historique de paiement : on ne crée que
  // l'échéance du cycle en cours, "en attente" — à vous de la marquer payée
  // une fois le loyer réellement encaissé. Aucun historique n'est inventé.
  const paiements = locaux.filter((l) => l.statut === "loue").map((l) => {
    const t = locataires.find((x) => x.localId === l.id);
    const mois = modeOf(l.immeubleId) === "avance" ? moisAvance : moisEchu;
    return { id: uid(), localId: l.id, immeubleId: l.immeubleId, locataireId: t?.id || null, mois, montant: l.loyer + l.charges, statut: "en_attente", datePaiement: null };
  });
  // Dépenses, documents et versements : aucune donnée réelle fournie pour l'instant.
  const depenses = [];
  const documents = [];
  const versements = [];
  const parametres = { societe: "Gérance Damakania", gerant: "Administrateur", email: "gerant@drame-gestion.gn", telephone: "+224 620 00 00 00", devise: "GNF", gestionnaire: "Sanoussy DRAMÉ", proprietaire: "Elhadj Ousmane MAGASSOUBA", proprietaireTelephone: "", commissionPct: 0, theme: "system", rappelGeneral: TPL_GENERAL, rappelRetard: TPL_RETARD };
  const rappels = [];
  return { immeubles, locaux, locataires, paiements, depenses, documents, parametres, versements, rappels };
}

/* ============================ Atoms ============================ */
const STATUT_META = {
  paye: { label: "Payé", cls: "bg-emerald-50 text-emerald-700 ring-emerald-600/20", dot: "bg-emerald-500" },
  en_attente: { label: "En attente", cls: "bg-amber-50 text-amber-700 ring-amber-600/20", dot: "bg-amber-500" },
  en_retard: { label: "En retard", cls: "bg-rose-50 text-rose-700 ring-rose-600/20", dot: "bg-rose-500" },
  loue: { label: "Occupé", cls: "bg-teal-50 text-teal-700 ring-teal-600/20", dot: "bg-teal-500" },
  vacant: { label: "Vacant", cls: "bg-slate-100 text-slate-600 ring-slate-500/20", dot: "bg-slate-400" },
  avance: { label: "En avance", cls: "bg-indigo-50 text-indigo-700 ring-indigo-600/20", dot: "bg-indigo-500" },
  echu: { label: "Terme échu", cls: "bg-cyan-50 text-cyan-700 ring-cyan-600/20", dot: "bg-cyan-500" },
};
function Badge({ statut }) {
  const m = STATUT_META[statut] || STATUT_META.vacant;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${m.cls}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${m.dot}`} />{m.label}
    </span>
  );
}
function Modal({ open, onClose, title, children, wide }) {
  useBackClose(!!open, onClose);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto bg-slate-900/40 backdrop-blur-sm" onClick={onClose}>
      <div className="flex min-h-full items-end justify-center sm:items-center sm:p-4">
        <div
          className={`w-full overflow-hidden rounded-t-3xl bg-white shadow-2xl ring-1 ring-slate-900/5 sm:my-8 sm:rounded-3xl ${wide ? "sm:max-w-2xl" : "sm:max-w-md"}`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between border-b border-slate-100 bg-white px-6 py-4">
            <h3 className="font-display text-lg font-semibold text-slate-900">{title}</h3>
            <button onClick={onClose} className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><X size={18} /></button>
          </div>
          <div className="px-6 py-5 pb-[35vh] sm:pb-5">{children}</div>
        </div>
      </div>
    </div>
  );
}
function Field({ label, children }) {
  return <label className="block"><span className="mb-1.5 block text-xs font-medium text-slate-600">{label}</span>{children}</label>;
}
const inputCls = "w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:bg-white focus:ring-2 focus:ring-teal-500/20";
// Neutralise le rendu natif du sélecteur de date (variable selon navigateur/WebView,
// parfois confondu avec un chevron de <select>) et impose une icône calendrier cohérente.
function DateField({ value, onChange }) {
  return (
    <div className="relative">
      <input
        type="date"
        value={value}
        onChange={onChange}
        className={`${inputCls} appearance-none pr-10 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0`}
      />
      <Calendar size={16} className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
    </div>
  );
}
function PrimaryBtn({ children, className = "", ...p }) {
  return <button {...p} className={`inline-flex items-center justify-center gap-2 rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-800 focus:outline-none focus:ring-2 focus:ring-teal-600/30 disabled:opacity-50 ${className}`}>{children}</button>;
}
function GhostBtn({ children, ...p }) {
  return <button {...p} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">{children}</button>;
}
// Ligne de partage réutilisable : WhatsApp, SMS, partage natif du téléphone, copie du texte.
// N'apparaît jamais à l'impression (bloc d'actions à l'écran uniquement).
function ShareRow({ phone: initialPhone, message, pdfBytes, pdfFilename }) {
  const [phone, setPhone] = useState(initialPhone || "");
  const [copied, setCopied] = useState(false);
  const [partageEchoue, setPartageEchoue] = useState(false);
  const nativeShare = async () => {
    setPartageEchoue(false);
    if (pdfBytes) { const ok = await partagerPdf(pdfBytes, pdfFilename, message); if (ok) return; }
    try { await navigator.share({ text: message }); }
    catch { if (pdfBytes) setPartageEchoue(true); }
  };
  const copyText = async () => { try { await navigator.clipboard.writeText(message); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch {} };
  return (
    <div className="no-print space-y-2.5 rounded-xl border border-slate-200 bg-slate-50 p-3">
      <div className="flex items-center gap-2">
        <Phone size={14} className="shrink-0 text-slate-400" />
        <input className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-teal-500" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Numéro (+224 ...)" />
      </div>
      <div className="flex flex-wrap gap-2">
        <a
          href={phone ? waLink(phone, message) : undefined}
          target="_blank" rel="noopener noreferrer"
          onClick={(e) => { if (!phone) e.preventDefault(); }}
          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white transition ${phone ? "bg-emerald-600 hover:bg-emerald-700" : "cursor-not-allowed bg-slate-300"}`}
        ><MessageCircle size={14} /> WhatsApp</a>
        <a
          href={phone ? smsLink(phone, message) : undefined}
          onClick={(e) => { if (!phone) e.preventDefault(); }}
          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white transition ${phone ? "bg-slate-700 hover:bg-slate-800" : "cursor-not-allowed bg-slate-300"}`}
        ><MessageSquare size={14} /> SMS</a>
        {canShareNative() && (
          <button onClick={nativeShare} className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700"><Share2 size={14} /> {pdfBytes ? "Partager le PDF…" : "Partager…"}</button>
        )}
        <button onClick={copyText} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100">{copied ? <><Check size={14} /> Copié</> : "Copier le texte"}</button>
      </div>
      {pdfBytes ? (
        <p className="text-[11px] text-slate-400">WhatsApp et SMS envoient ce message texte (limite de ces services, pas de fichier joint possible par ce biais). Pour joindre le PDF lui-même, utilisez « Partager le PDF » ci-dessus, ou téléchargez-le puis joignez-le manuellement.</p>
      ) : (
        <p className="text-[11px] text-slate-400">Pour joindre un PDF à votre message, téléchargez-le d'abord puis joignez-le manuellement.</p>
      )}
    </div>
  );
}
function useCountUp(target, dur = 850) {
  const [v, setV] = useState(0);
  useEffect(() => {
    let raf; const start = performance.now();
    const tick = (t) => { const p = Math.min(1, (t - start) / dur); setV(Math.round(target * (1 - Math.pow(1 - p, 3)))); if (p < 1) raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick); return () => cancelAnimationFrame(raf);
  }, [target]);
  return v;
}
function Ring({ pct, size = 116, stroke = 11, track = "rgba(255,255,255,0.22)", color = "#fff" }) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r, off = c * (1 - Math.min(100, pct) / 100);
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={stroke} fill="none" />
      <circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none" strokeDasharray={c} strokeDashoffset={off} strokeLinecap="round" style={{ transition: "stroke-dashoffset 1.1s cubic-bezier(.2,.8,.2,1)" }} />
    </svg>
  );
}

/* ============================ Dashboard ============================ */
function Dashboard({ data, go, isDark }) {
  const gridColor = isDark ? "#334155" : "#f1f5f9";
  const tickColor = isDark ? "#94a3b8" : "#94a3b8";
  const axisColor = isDark ? "#64748b" : "#64748b";
  const { immeubles, locaux, locataires, paiements } = data;
  const modeOf = (id) => immeubles.find((i) => i.id === id)?.mode;
  const nom = (id) => { const l = locataires.find((x) => x.id === id); return l ? `${l.prenom} ${l.nom}` : "—"; };
  const localNom = (id) => locaux.find((x) => x.id === id)?.nom || "—";
  const imAvance = immeubles.find((i) => i.mode === "avance");
  const imEchu = immeubles.find((i) => i.mode === "echu");

  const sum = (arr) => arr.reduce((s, p) => s + p.montant, 0);
  const avancePaie = paiements.filter((p) => modeOf(p.immeubleId) === "avance" && p.mois === moisAvance);
  const echuPaie = paiements.filter((p) => modeOf(p.immeubleId) === "echu" && p.mois === moisEchu);
  const encAvance = sum(avancePaie.filter((p) => p.statut === "paye"));
  const encEchu = sum(echuPaie.filter((p) => p.statut === "paye"));
  const duAvance = sum(avancePaie), duEchu = sum(echuPaie);
  const encaisseTotal = encAvance + encEchu;
  const attenduTotal = duAvance + duEchu;
  const impayeTotal = attenduTotal - encaisseTotal;
  const pct = attenduTotal ? Math.round((encaisseTotal / attenduTotal) * 100) : 0;

  const occ = locaux.filter((l) => l.statut === "loue").length;
  const tauxOcc = locaux.length ? Math.round((occ / locaux.length) * 100) : 0;

  const encAnim = useCountUp(encaisseTotal);
  const jaAnim = useCountUp(encAvance);
  const jeAnim = useCountUp(encEchu);

  // encaissements par échéance (5 du mois) sur 6 mois
  const serie = useMemo(() => Array.from({ length: 6 }, (_, i) => {
    const X = shiftMonth(curMonth, -(5 - i));
    const av = sum(paiements.filter((p) => modeOf(p.immeubleId) === "avance" && p.mois === X && p.statut === "paye"));
    const ec = sum(paiements.filter((p) => modeOf(p.immeubleId) === "echu" && p.mois === shiftMonth(X, -1) && p.statut === "paye"));
    return { mois: cap(moisCourt(X)), montant: av + ec };
  }), [paiements]);

  const parImmeuble = immeubles.map((im) => ({
    nom: im.nom, potentiel: sum(locaux.filter((l) => l.immeubleId === im.id && l.statut === "loue").map((l) => ({ montant: l.loyer + l.charges }))),
  }));

  const aRecouvrer = [...avancePaie, ...echuPaie].filter((p) => p.statut !== "paye");

  const kpis = [
    { label: "Taux d'occupation", value: `${tauxOcc}%`, sub: `${occ}/${locaux.length} locaux`, icon: TrendingUp, grad: "from-teal-400 to-teal-600", go: () => go("locaux") },
    { label: "Impayés du cycle", value: moneyC(impayeTotal), sub: `${aRecouvrer.length} à relancer`, icon: AlertTriangle, grad: "from-rose-400 to-rose-600", go: () => go("recouvrement") },
    { label: "Locataires", value: locataires.length, sub: `${immeubles.length} immeubles`, icon: Users, grad: "from-violet-400 to-violet-600", go: () => go("locataires") },
    { label: "Locaux", value: locaux.length, sub: `${locaux.length - occ} vacants`, icon: DoorOpen, grad: "from-orange-400 to-orange-600", go: () => go("locaux") },
  ];

  return (
    <div className="space-y-5">
      {/* HERO — cycle de recouvrement */}
      <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-teal-800 via-teal-700 to-emerald-700 p-6 text-white shadow-lg lg:p-7">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-center">
          {/* Encaissé total */}
          <button onClick={() => go("recouvrement")} className="group w-full text-left">
            <div className="flex items-center gap-2 text-teal-100/90">
              <CalendarClock size={16} className="shrink-0" /><span className="text-sm font-medium">Cycle de recouvrement · échéance du {echeanceLabel}</span>
            </div>
            <div className="mt-4 flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:gap-6">
              <div className="relative shrink-0">
                <Ring pct={pct} />
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="font-display text-2xl font-bold">{pct}%</span>
                  <span className="text-[11px] text-teal-100/80">recouvré</span>
                </div>
              </div>
              <div className="min-w-0">
                <div className="text-xs font-medium uppercase tracking-wide text-teal-100/70">Encaissé</div>
                <div className="font-display text-3xl font-bold leading-tight tabular-nums lg:text-[2.4rem]">{money(encAnim)}</div>
                <div className="mt-1 text-xs text-teal-100/80 sm:text-sm">sur {money(attenduTotal)} attendu · <span className="text-rose-100">{money(impayeTotal)} à recouvrer</span></div>
                <div className="mt-2 inline-flex items-center gap-1 text-xs text-teal-50 opacity-0 transition group-hover:opacity-100">Voir les paiements <ArrowUpRight size={13} /></div>
              </div>
            </div>
          </button>

          {/* Deux recouvrements : Juin (échu) + Juillet (avance) */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <button onClick={() => go("recouvrement")}
              className="rounded-2xl bg-white/10 p-4 text-left ring-1 ring-white/15 backdrop-blur transition hover:bg-white/15">
              <div className="flex items-center justify-between">
                <span className="rounded-lg bg-cyan-400/20 px-2 py-0.5 text-[11px] font-semibold text-cyan-50">Terme échu</span>
                <ArrowDownRight size={15} className="text-teal-100/70" />
              </div>
              <div className="mt-2 text-sm font-medium text-teal-50">{cap(moisNom(moisEchu))}</div>
              <div className="text-[11px] text-teal-100/70">{imEchu?.nom}</div>
              <div className="mt-2 font-display text-xl font-bold tabular-nums">{money(jeAnim)}</div>
              <div className="text-[11px] text-teal-100/70">/ {money(duEchu)}</div>
            </button>
            <button onClick={() => go("recouvrement")}
              className="rounded-2xl bg-white/10 p-4 text-left ring-1 ring-white/15 backdrop-blur transition hover:bg-white/15">
              <div className="flex items-center justify-between">
                <span className="rounded-lg bg-indigo-400/25 px-2 py-0.5 text-[11px] font-semibold text-indigo-50">En avance</span>
                <ArrowUpRight size={15} className="text-teal-100/70" />
              </div>
              <div className="mt-2 text-sm font-medium text-teal-50">{cap(moisNom(moisAvance))}</div>
              <div className="text-[11px] text-teal-100/70">{imAvance?.nom}</div>
              <div className="mt-2 font-display text-xl font-bold tabular-nums">{money(jaAnim)}</div>
              <div className="text-[11px] text-teal-100/70">/ {money(duAvance)}</div>
            </button>
          </div>
        </div>
      </div>

      {/* KPIs cliquables */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map((k) => (
          <button key={k.label} onClick={k.go} className="group rounded-2xl border border-slate-200/70 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md lg:p-5">
            <div className="flex items-start justify-between">
              <span className="text-xs font-medium text-slate-500">{k.label}</span>
              <span className={`grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br shadow-sm ${k.grad}`}><k.icon size={15} className="text-white" /></span>
            </div>
            <div className="mt-3 font-display text-xl font-semibold tabular-nums text-slate-900 lg:text-2xl">{k.value}</div>
            <div className="mt-0.5 flex items-center gap-1 text-xs text-slate-400">{k.sub}<ChevronRight size={12} className="opacity-0 transition group-hover:opacity-100" /></div>
          </button>
        ))}
      </div>

      {/* Graphiques */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-display text-base font-semibold text-slate-900">Encaissements par échéance</h3>
            <span className="text-xs text-slate-400">6 dernières échéances</span>
          </div>
          <ResponsiveContainer width="100%" height={230}>
            <AreaChart data={serie} margin={{ top: 8, right: 6, left: -16, bottom: 0 }}>
              <defs>
                <linearGradient id="gEnc" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0f766e" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#0f766e" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke={gridColor} />
              <XAxis dataKey="mois" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: tickColor }} />
              <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: tickColor }} tickFormatter={(v) => (v >= 1e6 ? `${v / 1e6}M` : v >= 1e3 ? `${v / 1e3}k` : v)} />
              <Tooltip formatter={(v) => [money(v), "Encaissé"]} contentStyle={{ borderRadius: 12, border: `1px solid ${isDark ? "#334155" : "#e2e8f0"}`, fontSize: 12, background: isDark ? "#1e293b" : "#fff", color: isDark ? "#f1f5f9" : "#0f172a" }} />
              <Area type="monotone" dataKey="montant" stroke="#0f766e" strokeWidth={2.5} fill="url(#gEnc)" dot={{ r: 3, fill: "#0f766e" }} activeDot={{ r: 5 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm">
          <h3 className="mb-3 font-display text-base font-semibold text-slate-900">Loyers par immeuble</h3>
          <ResponsiveContainer width="100%" height={230}>
            <BarChart data={parImmeuble} layout="vertical" margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
              <XAxis type="number" hide tickFormatter={(v) => `${v / 1e6}M`} />
              <YAxis type="category" dataKey="nom" width={96} tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: axisColor }} />
              <Tooltip formatter={(v) => [money(v), "Potentiel/mois"]} contentStyle={{ borderRadius: 12, border: `1px solid ${isDark ? "#334155" : "#e2e8f0"}`, fontSize: 12, background: isDark ? "#1e293b" : "#fff", color: isDark ? "#f1f5f9" : "#0f172a" }} />
              <Bar dataKey="potentiel" radius={[0, 6, 6, 0]} maxBarSize={30}>
                <Cell fill="#6366f1" /><Cell fill="#06b6d4" />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="mt-1 flex flex-col gap-1 text-xs text-slate-500">
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-indigo-500" />{imAvance?.nom} · avance</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-cyan-500" />{imEchu?.nom} · échu</span>
          </div>
        </div>
      </div>

      {/* À recouvrer — cliquable */}
      <div className="rounded-2xl border border-slate-200/70 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h3 className="font-display text-base font-semibold text-slate-900">À recouvrer · cycle du {echeanceLabel}</h3>
          <button onClick={() => go("recouvrement")} className="flex items-center gap-1 text-xs font-medium text-teal-700 hover:text-teal-800">Tout voir <ChevronRight size={14} /></button>
        </div>
        {aRecouvrer.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-slate-400">Cycle intégralement recouvré. 🎉</div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {aRecouvrer.map((p) => (
              <li key={p.id}>
                <button onClick={() => go("locataire", p.locataireId)} className="flex w-full items-center justify-between px-5 py-3 text-left hover:bg-slate-50/70">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900">{nom(p.locataireId)}</p>
                    <p className="truncate text-xs text-slate-400">{localNom(p.localId)} · loyer de {cap(moisNom(p.mois))}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-display text-sm font-semibold tabular-nums text-slate-900">{money(p.montant)}</span>
                    <Badge statut={p.statut} />
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/* ============================ Petites vues partagées ============================ */
function MiniStat({ label, value, tint = "text-slate-900" }) {
  return (
    <div className="rounded-xl border border-slate-200/70 bg-white px-4 py-3">
      <div className="text-[11px] font-medium text-slate-500">{label}</div>
      <div className={`mt-0.5 font-display text-base font-semibold leading-tight tabular-nums ${tint}`}>{value}</div>
    </div>
  );
}
// Génère le PDF d'une quittance de loyer (utilisé par la fenêtre de détail et par le
// bouton PDF direct de chaque tableau de paiements) — une seule version, pour que les
// deux endroits produisent toujours exactement le même document.
function genererQuittancePdf(paiement, data) {
  const tenant = data.locataires.find((x) => x.id === paiement.locataireId);
  const nomLocataire = tenant ? `${tenant.prenom} ${tenant.nom}` : "—";
  const localNom = data.locaux.find((x) => x.id === paiement.localId)?.nom || "—";
  const imNom = data.immeubles.find((x) => x.id === paiement.immeubleId)?.nom || "—";
  const societe = data.parametres?.societe || "DRAMÉ Gestion";
  const signature = signatureGestionnaire(data);
  const ref = `Q-${paiement.mois.replace("-", "")}-${paiement.id.slice(-4).toUpperCase()}`;
  const { total: totalArrieres, mois: moisArrieres, lignes: arrieres } = arrieresLocataire(data, paiement.locataireId, paiement.id);
  const decalage = arrieres.length > 0 ? 34 : 0;
  const ops = [
    { type: "rect", x: 0, y: 700, w: 595, h: 142, color: [0.06, 0.29, 0.28] },
    { type: "text", x: 50, y: 803, size: 18, font: "B", color: [1, 1, 1], text: societe },
    { type: "text", x: 50, y: 778, size: 10, font: "R", color: [0.8, 0.95, 0.9], text: "QUITTANCE DE LOYER" },
    { type: "text", x: 460, y: 803, size: 9, font: "R", color: [0.85, 0.95, 0.92], text: "N°" },
    { type: "text", x: 460, y: 790, size: 11, font: "B", color: [1, 1, 1], text: ref },
    { type: "text", x: 50, y: 660, size: 11, font: "R", color: [0.35, 0.35, 0.35], text: "Reçu de la part de" },
    { type: "text", x: 50, y: 638, size: 17, font: "B", color: [0.05, 0.05, 0.08], text: nomLocataire },
    { type: "rect", x: 50, y: 578, w: 495, h: 50, color: [0.96, 0.97, 0.98] },
    { type: "text", x: 65, y: 607, size: 20, font: "B", color: [0.05, 0.05, 0.08], text: money(paiement.montant) },
    { type: "text", x: 65, y: 590, size: 9, font: "R", color: [0.42, 0.42, 0.42], text: cap(montantEnLettres(paiement.montant)) },
    { type: "text", x: 480, y: 600, size: 11, font: "B", color: [0.02, 0.4, 0.25], text: "PAYÉ" },
    { type: "text", x: 50, y: 545, size: 10, font: "R", color: [0.4, 0.4, 0.4], text: `Local : ${localNom}` },
    { type: "text", x: 300, y: 545, size: 10, font: "R", color: [0.4, 0.4, 0.4], text: `Immeuble : ${imNom}` },
    { type: "text", x: 50, y: 527, size: 10, font: "R", color: [0.4, 0.4, 0.4], text: `Période : ${cap(moisLong(paiement.mois))}` },
    { type: "text", x: 300, y: 527, size: 10, font: "R", color: [0.4, 0.4, 0.4], text: `Payé le : ${paiement.datePaiement}` },
  ];
  if (arrieres.length > 0) {
    ops.push({ type: "rect", x: 50, y: 495, w: 495, h: 24, color: [0.996, 0.95, 0.78] });
    ops.push({ type: "text", x: 60, y: 511, size: 9, font: "B", color: [0.6, 0.4, 0.02], text: `Arriéré en cours : ${money(totalArrieres)}` });
    ops.push({ type: "text", x: 60, y: 500, size: 8, font: "R", color: [0.55, 0.4, 0.1], text: `Loyer(s) impayé(s) : ${moisArrieres}` });
  }
  ops.push(
    { type: "line", x1: 50, y1: 495 - decalage, x2: 545, y2: 495 - decalage, color: [0.75, 0.75, 0.75], width: 1, dash: [3, 3] },
    { type: "text", x: 50, y: 472 - decalage, size: 9, font: "R", color: [0.45, 0.45, 0.45], text: "Le bailleur reconnaît avoir reçu la somme ci-dessus au titre du loyer et des" },
    { type: "text", x: 50, y: 460 - decalage, size: 9, font: "R", color: [0.45, 0.45, 0.45], text: "charges pour la période mentionnée, et en donne quittance sans réserve." },
    { type: "text", x: 50, y: 435 - decalage, size: 9, font: "B", color: [0.2, 0.2, 0.2], text: signature },
  );
  return { bytes: buildPdfBytes({ ops }), fichier: `${ref}.pdf`, ref };
}

function QuittanceModal({ paiement, data, onClose }) {
  const tenant = (id) => data.locataires.find((x) => x.id === id);
  const nom = (id) => { const l = tenant(id); return l ? `${l.prenom} ${l.nom}` : "—"; };
  const localNom = (id) => data.locaux.find((x) => x.id === id)?.nom || "—";
  const imNom = (id) => data.immeubles.find((x) => x.id === id)?.nom || "—";
  const societe = data.parametres?.societe || "DRAMÉ Gestion";
  return (
    <Modal open={!!paiement} onClose={onClose} title="Quittance de loyer">
      {paiement && (() => {
        const t = tenant(paiement.locataireId);
        const signature = signatureGestionnaire(data);
        // Autres loyers impayés de ce même locataire (arriérés), à part le paiement de cette quittance.
        const { lignes: arrieres, total: totalArrieres, mois: moisArrieres, note: noteArrieres } = arrieresLocataire(data, paiement.locataireId, paiement.id);
        const message = `Bonjour ${nom(paiement.locataireId)}, voici la confirmation de réception de votre loyer pour ${moisLong(paiement.mois)} : ${money(paiement.montant)} (local ${localNom(paiement.localId)}), payé le ${paiement.datePaiement}.${noteArrieres} Merci ! — ${signature}`;
        const { bytes: pdfBytes, fichier, ref } = genererQuittancePdf(paiement, data);
        return (
          <div>
            <div className="print-area overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <div className="relative overflow-hidden bg-gradient-to-br from-teal-800 via-teal-700 to-emerald-700 px-6 py-5 text-white">
                <div className="absolute inset-0 opacity-[0.08]" style={{ backgroundImage: "radial-gradient(circle, #fff 1.5px, transparent 1.5px)", backgroundSize: "16px 16px" }} />
                <div className="relative flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2"><div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/15"><Building2 size={16} /></div><span className="truncate font-display text-lg font-bold">{societe}</span></div>
                    <p className="mt-2 text-[11px] font-medium uppercase tracking-[0.2em] text-teal-100/80">Quittance de loyer</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-[10px] uppercase tracking-wide text-teal-100/70">N°</div>
                    <div className="font-display text-sm font-semibold tabular-nums">{ref}</div>
                  </div>
                </div>
              </div>

              <div className="px-6 py-6">
                <p className="text-sm text-slate-500">Reçu de la part de</p>
                <p className="font-display text-xl font-semibold text-slate-900">{nom(paiement.locataireId)}</p>

                <div className="mt-5 flex flex-wrap items-end justify-between gap-3 rounded-2xl bg-slate-50 p-5">
                  <div className="min-w-0">
                    <p className="font-display text-3xl font-bold tabular-nums text-slate-900 sm:text-4xl">{money(paiement.montant)}</p>
                    <p className="mt-1.5 text-xs italic text-slate-500">{montantEnLettres(paiement.montant)}</p>
                  </div>
                  <span className="shrink-0 -rotate-6 rounded-lg border-2 border-emerald-600 px-3 py-1 text-sm font-bold uppercase tracking-wide text-emerald-600">Payé</span>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-4 text-sm">
                  <div><p className="text-xs text-slate-400">Local</p><p className="font-medium text-slate-900">{localNom(paiement.localId)}</p></div>
                  <div><p className="text-xs text-slate-400">Immeuble</p><p className="font-medium text-slate-900">{imNom(paiement.immeubleId)}</p></div>
                  <div><p className="text-xs text-slate-400">Période</p><p className="font-medium text-slate-900">{cap(moisLong(paiement.mois))}</p></div>
                  <div><p className="text-xs text-slate-400">Payé le</p><p className="font-medium text-slate-900">{paiement.datePaiement}</p></div>
                </div>

                {arrieres.length > 0 && (
                  <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3.5">
                    <p className="flex items-center gap-1.5 text-xs font-semibold text-amber-700"><AlertTriangle size={13} /> Arriéré en cours</p>
                    <p className="mt-1 font-display text-base font-semibold tabular-nums text-amber-800">{money(totalArrieres)}</p>
                    <p className="mt-0.5 text-xs text-amber-700">Loyer(s) impayé(s) : {moisArrieres}</p>
                  </div>
                )}

                <div className="my-5 border-t border-dashed border-slate-300" />

                <p className="text-xs leading-relaxed text-slate-500">Le bailleur reconnaît avoir reçu la somme indiquée ci-dessus au titre du loyer et des charges pour la période mentionnée, et en donne quittance sans réserve.</p>
                <p className="mt-3 text-xs font-semibold text-slate-700">{signature}</p>
              </div>
            </div>
            <div className="no-print mt-4 flex flex-wrap justify-end gap-2">
              <GhostBtn onClick={onClose}>Fermer</GhostBtn>
              <GhostBtn onClick={() => window.print()}><Printer size={15} /> Imprimer</GhostBtn>
              <PrimaryBtn onClick={() => telechargerPdf(pdfBytes, fichier)}><Download size={15} /> Télécharger PDF</PrimaryBtn>
            </div>
            <div className="mt-4"><ShareRow phone={t?.telephone} message={message} pdfBytes={pdfBytes} pdfFilename={fichier} /></div>
          </div>
        );
      })()}
    </Modal>
  );
}

function PaymentsTable({ list, data, setData, go }) {
  const nom = (id) => { const l = data.locataires.find((x) => x.id === id); return l ? `${l.prenom} ${l.nom}` : "—"; };
  const localNom = (id) => data.locaux.find((x) => x.id === id)?.nom || "—";
  const encaisser = (id) => setData((d) => ({ ...d, paiements: d.paiements.map((p) => p.id === id ? { ...p, statut: "paye", datePaiement: new Date().toISOString().slice(0, 10) } : p) }));
  const [quittance, setQuittance] = useState(null);
  if (!list.length) return <div className="px-5 py-10 text-center text-sm text-slate-400">Aucun paiement.</div>;
  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-xs font-medium uppercase tracking-wide text-slate-400">
              <th className="px-5 py-3">Locataire</th><th className="px-5 py-3">Local</th><th className="px-5 py-3">Mois</th>
              <th className="px-5 py-3 text-right">Montant</th><th className="px-5 py-3">Statut</th><th className="px-5 py-3 text-right">Quittance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {list.map((p) => {
              const tel = data.locataires.find((x) => x.id === p.locataireId)?.telephone;
              const msg = `Bonjour ${nom(p.locataireId)}, voici la confirmation de réception de votre loyer pour ${moisLong(p.mois)} : ${money(p.montant)} (local ${localNom(p.localId)}), payé le ${p.datePaiement}.${arrieresLocataire(data, p.locataireId, p.id).note} Merci ! — ${signatureGestionnaire(data)}`;
              return (
                <tr key={p.id} className="hover:bg-slate-50/60">
                  <td className="px-5 py-3.5">{go ? <button onClick={() => go("locataire", p.locataireId)} className="font-medium text-slate-900 hover:text-teal-700">{nom(p.locataireId)}</button> : <span className="font-medium text-slate-900">{nom(p.locataireId)}</span>}</td>
                  <td className="px-5 py-3.5 text-slate-500">{go ? <button onClick={() => go("local", p.localId)} className="hover:text-teal-700">{localNom(p.localId)}</button> : localNom(p.localId)}</td>
                  <td className="px-5 py-3.5 text-slate-500">{cap(moisNom(p.mois))} {p.mois.slice(0, 4)}</td>
                  <td className="px-5 py-3.5 text-right font-display font-semibold tabular-nums text-slate-900">{money(p.montant)}</td>
                  <td className="px-5 py-3.5"><Badge statut={p.statut} /></td>
                  <td className="px-5 py-3.5 text-right">
                    {p.statut !== "paye"
                      ? <button onClick={() => encaisser(p.id)} className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100"><Check size={14} /> Encaisser</button>
                      : (
                        <div className="flex items-center justify-end gap-1.5">
                          <a
                            href={tel ? waLink(tel, msg) : undefined}
                            target="_blank" rel="noopener noreferrer"
                            onClick={(e) => { if (!tel) e.preventDefault(); }}
                            title={tel ? "Envoyer par WhatsApp" : "Aucun numéro enregistré"}
                            className={`inline-flex items-center rounded-lg px-2 py-1.5 text-xs font-medium text-white ${tel ? "bg-emerald-600 hover:bg-emerald-700" : "cursor-not-allowed bg-slate-200 text-slate-400"}`}
                          ><MessageCircle size={14} /></a>
                          <button onClick={() => { const { bytes, fichier } = genererQuittancePdf(p, data); telechargerPdf(bytes, fichier); }} title="Télécharger la quittance en PDF" className="inline-flex items-center rounded-lg bg-teal-50 px-2 py-1.5 text-xs font-medium text-teal-700 hover:bg-teal-100"><Download size={14} /></button>
                          <button onClick={() => setQuittance(p)} className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-200"><Receipt size={14} /> Voir</button>
                        </div>
                      )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <QuittanceModal paiement={quittance} data={data} onClose={() => setQuittance(null)} />
    </>
  );
}

/* ============================ Immeubles ============================ */
function Immeubles({ data, setData, go }) {
  const [edit, setEdit] = useState(null);
  const [confirmDel, setConfirmDel] = useState(null);
  const blank = { nom: "", adresse: "", mode: "avance" };
  const [form, setForm] = useState(blank);
  const open = (im) => { setEdit(im ? im.id : "new"); setForm(im ? { ...im } : blank); };
  const save = () => { if (!form.nom.trim()) return; setData((d) => edit === "new" ? { ...d, immeubles: [...d.immeubles, { ...form, id: uid() }] } : { ...d, immeubles: d.immeubles.map((x) => x.id === edit ? { ...form } : x) }); setEdit(null); };
  const del = (id) => {
    setData((d) => {
      const locauxDuIm = d.locaux.filter((l) => l.immeubleId === id).map((l) => l.id);
      return {
        ...d,
        immeubles: d.immeubles.filter((x) => x.id !== id),
        locaux: d.locaux.filter((l) => l.immeubleId !== id),
        locataires: d.locataires.map((t) => (locauxDuIm.includes(t.localId) ? { ...t, localId: null } : t)),
        paiements: d.paiements.filter((p) => p.immeubleId !== id),
        depenses: (d.depenses || []).filter((x) => x.immeubleId !== id),
        documents: (d.documents || []).filter((x) => !locauxDuIm.includes(x.localId)),
      };
    });
    setConfirmDel(null);
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-slate-500">{data.immeubles.length} immeuble(s)</p>
        <PrimaryBtn onClick={() => open(null)}><Plus size={16} /> Ajouter un immeuble</PrimaryBtn>
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {data.immeubles.map((im) => {
          const locaux = data.locaux.filter((l) => l.immeubleId === im.id);
          const occ = locaux.filter((l) => l.statut === "loue").length;
          const potentiel = locaux.filter((l) => l.statut === "loue").reduce((s, l) => s + l.loyer + l.charges, 0);
          return (
            <div key={im.id} className="group rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm transition hover:shadow-md">
              <button onClick={() => go("immeuble", im.id)} className="block w-full text-left">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`grid h-11 w-11 place-items-center rounded-xl ${im.mode === "avance" ? "bg-indigo-50" : "bg-cyan-50"}`}><Building2 size={20} className={im.mode === "avance" ? "text-indigo-600" : "text-cyan-600"} /></div>
                    <div>
                      <h3 className="font-display font-semibold text-slate-900">{im.nom}</h3>
                      <p className="flex items-center gap-1 text-xs text-slate-400"><MapPin size={12} />{im.adresse}</p>
                    </div>
                  </div>
                  <Badge statut={im.mode} />
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2 border-t border-slate-100 pt-3">
                  <div><div className="font-display text-lg font-semibold text-slate-900">{locaux.length}</div><div className="text-[11px] text-slate-400">locaux</div></div>
                  <div><div className="font-display text-lg font-semibold text-slate-900">{occ}/{locaux.length}</div><div className="text-[11px] text-slate-400">occupés</div></div>
                  <div><div className="font-display text-lg font-semibold tabular-nums text-teal-700">{moneyC(potentiel)}</div><div className="text-[11px] text-slate-400">/ mois</div></div>
                </div>
              </button>
              {confirmDel === im.id ? (
                <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
                  <span className="text-xs text-rose-600">Supprimer avec ses {locaux.length} local/locaux et leur historique ?</span>
                  <button onClick={() => del(im.id)} className="rounded-lg bg-rose-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-rose-700">Confirmer</button>
                  <button onClick={() => setConfirmDel(null)} className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50">Annuler</button>
                </div>
              ) : (
                <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
                  <span className="flex items-center gap-1 text-xs font-medium text-teal-700 opacity-0 transition group-hover:opacity-100">Ouvrir <ChevronRight size={13} /></span>
                  <div className="flex gap-1 opacity-0 transition group-hover:opacity-100">
                    <button onClick={() => open(im)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><Pencil size={15} /></button>
                    <button onClick={() => setConfirmDel(im.id)} className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"><Trash2 size={15} /></button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit === "new" ? "Nouvel immeuble" : "Modifier l'immeuble"}>
        <div className="space-y-4">
          <Field label="Nom"><input className={inputCls} value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} placeholder="Ex EDG Damakania" /></Field>
          <Field label="Adresse"><input className={inputCls} value={form.adresse} onChange={(e) => setForm({ ...form, adresse: e.target.value })} /></Field>
          <Field label="Mode de paiement">
            <select className={inputCls} value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value })}>
              <option value="avance">En avance (loyer du mois payé le 5 du même mois)</option>
              <option value="echu">Terme échu (loyer du mois payé le 5 du mois suivant)</option>
            </select>
          </Field>
        </div>
        <div className="mt-6 flex justify-end gap-2"><GhostBtn onClick={() => setEdit(null)}>Annuler</GhostBtn><PrimaryBtn onClick={save}>Enregistrer</PrimaryBtn></div>
      </Modal>
    </div>
  );
}

function ImmeubleDetail({ id, data, setData, go }) {
  const im = data.immeubles.find((x) => x.id === id);
  if (!im) return null;
  const locaux = data.locaux.filter((l) => l.immeubleId === id);
  const occ = locaux.filter((l) => l.statut === "loue");
  const potentiel = occ.reduce((s, l) => s + l.loyer + l.charges, 0);
  const moisPertinent = im.mode === "avance" ? moisAvance : moisEchu;
  const paie = data.paiements.filter((p) => p.immeubleId === id && p.mois === moisPertinent);
  const enc = paie.filter((p) => p.statut === "paye").reduce((s, p) => s + p.montant, 0);
  const occupant = (lid) => data.locataires.find((t) => t.localId === lid);
  const aDesBlocs = locaux.some((l) => l.bloc);
  const groupes = aDesBlocs
    ? Object.entries(locaux.reduce((acc, l) => { const k = l.bloc || "Sans bloc"; (acc[k] = acc[k] || []).push(l); return acc; }, {})).sort(([a], [b]) => a.localeCompare(b))
    : [["", locaux]];

  const LigneLocal = (l) => {
    const t = occupant(l.id);
    return (
      <li key={l.id}>
        <button onClick={() => go("local", l.id)} className="flex w-full items-center justify-between px-5 py-3.5 text-left hover:bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-slate-100"><DoorOpen size={17} className="text-slate-500" /></div>
            <div><p className="text-sm font-medium text-slate-900">{l.nom}</p><p className="text-xs text-slate-400">{l.type}{l.pieces ? ` · ${l.pieces} ch.` : ""}{l.surface ? ` · ${l.surface} m²` : ""} · {t ? `${t.prenom} ${t.nom}` : "vacant"}</p></div>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-display text-sm font-semibold tabular-nums text-slate-900">{money(l.loyer + l.charges)}</span>
            <Badge statut={l.statut} />
          </div>
        </button>
      </li>
    );
  };

  return (
    <div className="space-y-5">
      <button onClick={() => go("immeubles")} className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800"><ArrowLeft size={16} /> Immeubles</button>
      <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={`grid h-12 w-12 place-items-center rounded-xl ${im.mode === "avance" ? "bg-indigo-50" : "bg-cyan-50"}`}><Building2 size={22} className={im.mode === "avance" ? "text-indigo-600" : "text-cyan-600"} /></div>
            <div><h2 className="font-display text-xl font-semibold text-slate-900">{im.nom}</h2><p className="flex items-center gap-1 text-sm text-slate-400"><MapPin size={13} />{im.adresse}</p></div>
          </div>
          <Badge statut={im.mode} />
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MiniStat label="Locaux" value={locaux.length} />
          <MiniStat label="Occupés" value={`${occ.length}/${locaux.length}`} />
          <MiniStat label="Potentiel / mois" value={money(potentiel)} tint="text-teal-700" />
          <MiniStat label={`Encaissé ${cap(moisNom(moisPertinent))}`} value={money(enc)} tint="text-emerald-600" />
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200/70 bg-white shadow-sm">
        <h3 className="border-b border-slate-100 px-5 py-4 font-display text-base font-semibold text-slate-900">Locaux de l'immeuble</h3>
        {groupes.map(([bloc, ls]) => (
          <div key={bloc || "unique"}>
            {aDesBlocs && <div className="border-b border-slate-100 bg-slate-50/60 px-5 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Bloc {bloc}</div>}
            <ul className="divide-y divide-slate-100">{ls.map(LigneLocal)}</ul>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ============================ Locaux ============================ */
function Locaux({ data, setData, go }) {
  const [edit, setEdit] = useState(null);
  const blank = { immeubleId: data.immeubles[0]?.id || "", nom: "", type: "Commerce", bloc: "", pieces: 1, surface: 0, loyer: 0, charges: 0, statut: "vacant" };
  const [form, setForm] = useState(blank);
  const open = (l) => { setEdit(l ? l.id : "new"); setForm(l ? { ...l } : blank); };
  const save = () => {
    if (!form.nom.trim()) return;
    setData((d) => {
      let locataires = d.locataires;
      if (edit !== "new" && form.statut === "vacant") {
        locataires = locataires.map((t) => (t.localId === edit ? { ...t, localId: null } : t));
      }
      const locaux = edit === "new" ? [...d.locaux, { ...form, id: uid() }] : d.locaux.map((x) => (x.id === edit ? { ...form } : x));
      return { ...d, locaux, locataires };
    });
    setEdit(null);
  };
  const del = (id) => setData((d) => ({ ...d, locaux: d.locaux.filter((x) => x.id !== id), locataires: d.locataires.map((t) => t.localId === id ? { ...t, localId: null } : t) }));
  const imNom = (id) => data.immeubles.find((x) => x.id === id)?.nom || "—";
  const occupant = (lid) => data.locataires.find((t) => t.localId === lid);
  const [filtreIm, setFiltreIm] = useState("all");
  const list = data.locaux.filter((l) => filtreIm === "all" || l.immeubleId === filtreIm);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <select className={`${inputCls} w-auto`} value={filtreIm} onChange={(e) => setFiltreIm(e.target.value)}>
          <option value="all">Tous les immeubles</option>
          {data.immeubles.map((im) => <option key={im.id} value={im.id}>{im.nom}</option>)}
        </select>
        <PrimaryBtn onClick={() => open(null)}><Plus size={16} /> Ajouter un local</PrimaryBtn>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((l) => {
          const t = occupant(l.id);
          return (
            <div key={l.id} className="group rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm transition hover:shadow-md">
              <button onClick={() => go("local", l.id)} className="block w-full text-left">
                <div className="flex items-start justify-between">
                  <div className="rounded-xl bg-slate-100 p-2.5"><DoorOpen size={20} className="text-slate-500" /></div>
                  <Badge statut={l.statut} />
                </div>
                <h3 className="mt-3 flex items-center gap-2 font-display font-semibold text-slate-900">{l.nom}{l.bloc && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-500">Bloc {l.bloc}</span>}</h3>
                <p className="text-xs text-slate-400">{imNom(l.immeubleId)}</p>
                <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                  <span>{l.type}</span>
                  {l.pieces ? <><span className="text-slate-300">·</span><span>{l.pieces} chambre{l.pieces > 1 ? "s" : ""}</span></> : null}
                  {l.surface ? <><span className="text-slate-300">·</span><span>{l.surface} m²</span></> : null}
                </div>
                <p className="mt-2 text-xs text-slate-500">{t ? `Occupé par ${t.prenom} ${t.nom}` : "Aucun locataire"}</p>
              </button>
              <div className="mt-4 flex items-end justify-between border-t border-slate-100 pt-3">
                <span className="font-display text-lg font-semibold tabular-nums text-slate-900">{money(l.loyer + l.charges)}</span>
                <div className="flex gap-1 opacity-0 transition group-hover:opacity-100">
                  <button onClick={() => open(l)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><Pencil size={15} /></button>
                  <button onClick={() => del(l.id)} className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"><Trash2 size={15} /></button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit === "new" ? "Nouveau local" : "Modifier le local"} wide>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Immeuble"><select className={inputCls} value={form.immeubleId} onChange={(e) => setForm({ ...form, immeubleId: e.target.value })}>{data.immeubles.map((im) => <option key={im.id} value={im.id}>{im.nom}</option>)}</select></Field>
          <Field label="Nom / n°"><input className={inputCls} value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} placeholder="Local RC-01" /></Field>
          <Field label="Bloc (optionnel)"><input className={inputCls} value={form.bloc || ""} onChange={(e) => setForm({ ...form, bloc: e.target.value })} placeholder="A, B, C…" /></Field>
          <Field label="Type"><select className={inputCls} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}><option>Appartement</option><option>Chambre</option><option>Studio</option><option>Duplex</option><option>Commerce</option><option>Bureau</option><option>Dépôt</option></select></Field>
          <Field label="Statut"><select className={inputCls} value={form.statut} onChange={(e) => setForm({ ...form, statut: e.target.value })}><option value="loue">Occupé</option><option value="vacant">Vacant</option></select></Field>
          <Field label="Chambres"><input type="number" inputMode="numeric" min="0" className={inputCls} value={form.pieces || ""} placeholder="0" onChange={(e) => setForm({ ...form, pieces: +e.target.value })} /></Field>
          <Field label="Surface (m²)"><input type="number" inputMode="numeric" className={inputCls} value={form.surface || ""} placeholder="0" onChange={(e) => setForm({ ...form, surface: +e.target.value })} /></Field>
          <Field label="Loyer (GNF)"><input type="number" inputMode="numeric" className={inputCls} value={form.loyer || ""} placeholder="0" onChange={(e) => setForm({ ...form, loyer: +e.target.value })} /></Field>
          <Field label="Charges (GNF)"><input type="number" inputMode="numeric" className={inputCls} value={form.charges || ""} placeholder="0" onChange={(e) => setForm({ ...form, charges: +e.target.value })} /></Field>
        </div>
        <div className="mt-6 flex justify-end gap-2"><GhostBtn onClick={() => setEdit(null)}>Annuler</GhostBtn><PrimaryBtn onClick={save}>Enregistrer</PrimaryBtn></div>
      </Modal>
    </div>
  );
}

function LocalDetail({ id, data, setData, go }) {
  const l = data.locaux.find((x) => x.id === id);
  if (!l) return null;
  const im = data.immeubles.find((x) => x.id === l.immeubleId);
  const t = data.locataires.find((x) => x.localId === id);
  const paie = data.paiements.filter((p) => p.localId === id).sort((a, b) => b.mois.localeCompare(a.mois));
  return (
    <div className="space-y-5">
      <button onClick={() => go("locaux")} className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800"><ArrowLeft size={16} /> Locaux</button>
      <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-xl bg-slate-100"><DoorOpen size={22} className="text-slate-500" /></div>
            <div>
              <h2 className="font-display text-xl font-semibold text-slate-900">{l.nom}</h2>
              <button onClick={() => go("immeuble", im.id)} className="flex items-center gap-1 text-sm text-teal-700 hover:underline"><Building2 size={13} />{im?.nom}</button>
            </div>
          </div>
          <Badge statut={l.statut} />
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MiniStat label="Type" value={l.type} />
          {l.bloc && <MiniStat label="Bloc" value={l.bloc} />}
          <MiniStat label="Chambres" value={l.pieces ? `${l.pieces} chambre${l.pieces > 1 ? "s" : ""}` : "—"} />
          <MiniStat label="Surface" value={l.surface ? `${l.surface} m²` : "Non renseignée"} />
          <MiniStat label="Loyer / mois" value={money(l.loyer + l.charges)} tint="text-teal-700" />
          <MiniStat label="Mode" value={im?.mode === "avance" ? "En avance" : "Terme échu"} />
        </div>
        <div className="mt-4 rounded-xl bg-slate-50 p-4">
          <div className="text-xs font-medium text-slate-500">Locataire</div>
          {t ? (
            <button onClick={() => go("locataire", t.id)} className="mt-1 flex items-center gap-3 hover:opacity-80">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-teal-500 to-teal-700 text-xs font-semibold text-white">{initials(t)}</div>
              <div className="text-left"><p className="text-sm font-medium text-slate-900">{t.prenom} {t.nom}</p><p className="text-xs text-slate-400">{t.telephone}</p></div>
            </button>
          ) : <p className="mt-1 text-sm text-slate-400">Local vacant</p>}
        </div>
      </div>
      <div className="rounded-2xl border border-slate-200/70 bg-white shadow-sm">
        <h3 className="border-b border-slate-100 px-5 py-4 font-display text-base font-semibold text-slate-900">Historique des loyers</h3>
        <PaymentsTable list={paie} data={data} setData={setData} go={go} />
      </div>
    </div>
  );
}

/* ============================ Locataires : logique partagée ============================ */
// Utilisée à la fois par la liste et par la fiche détail, pour garantir que
// l'invariant local <-> locataire (un seul occupant par local) reste toujours respecté.
function saveLocataire(setData, editId, form) {
  if (!form.nom.trim()) return;
  setData((d) => {
    const avant = editId === "new" ? null : d.locataires.find((x) => x.id === editId);
    const ancienLocalId = avant?.localId || null;
    const nouveauLocalId = form.localId || null;
    let locaux = d.locaux;
    let locataires = d.locataires;
    if (ancienLocalId && ancienLocalId !== nouveauLocalId) {
      locaux = locaux.map((l) => (l.id === ancienLocalId ? { ...l, statut: "vacant" } : l));
    }
    if (nouveauLocalId) {
      locataires = locataires.map((t) => (t.localId === nouveauLocalId && t.id !== editId ? { ...t, localId: null } : t));
      locaux = locaux.map((l) => (l.id === nouveauLocalId ? { ...l, statut: "loue" } : l));
    }
    locataires = editId === "new" ? [...locataires, { ...form, id: uid() }] : locataires.map((x) => (x.id === editId ? { ...form } : x));
    return { ...d, locataires, locaux };
  });
}
function delLocataire(setData, id) {
  setData((d) => {
    const t = d.locataires.find((x) => x.id === id);
    const locaux = t?.localId ? d.locaux.map((l) => (l.id === t.localId ? { ...l, statut: "vacant" } : l)) : d.locaux;
    return { ...d, locataires: d.locataires.filter((x) => x.id !== id), locaux };
  });
}
const blankLocataire = { nom: "", prenom: "", email: "", telephone: "", localId: "", dateEntree: curMonth + "-01" };

function LocataireFormModal({ open, editId, initial, data, setData, onClose }) {
  const [form, setForm] = useState(initial || blankLocataire);
  useEffect(() => { if (open) setForm(initial || blankLocataire); }, [open, editId]);
  const save = () => { saveLocataire(setData, editId, form); onClose(); };
  return (
    <Modal open={open} onClose={onClose} title={editId === "new" ? "Nouveau locataire" : "Modifier le locataire"} wide>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Prénom"><input className={inputCls} value={form.prenom} onChange={(e) => setForm({ ...form, prenom: e.target.value })} /></Field>
        <Field label="Nom"><input className={inputCls} value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} /></Field>
        <Field label="Email"><input className={inputCls} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
        <Field label="Téléphone"><input className={inputCls} value={form.telephone} onChange={(e) => setForm({ ...form, telephone: e.target.value })} /></Field>
        <Field label="Local occupé"><select className={inputCls} value={form.localId || ""} onChange={(e) => setForm({ ...form, localId: e.target.value })}><option value="">— aucun —</option>{data.locaux.map((l) => { const occ = data.locataires.find((x) => x.localId === l.id && x.id !== editId); return <option key={l.id} value={l.id}>{l.nom} · {data.immeubles.find((i) => i.id === l.immeubleId)?.nom}{occ ? ` — occupé par ${occ.prenom} ${occ.nom}` : ""}</option>; })}</select></Field>
        <Field label="Date d'entrée"><DateField value={form.dateEntree} onChange={(e) => setForm({ ...form, dateEntree: e.target.value })} /></Field>
      </div>
      <div className="mt-6 flex justify-end gap-2"><GhostBtn onClick={onClose}>Annuler</GhostBtn><PrimaryBtn onClick={save}>Enregistrer</PrimaryBtn></div>
    </Modal>
  );
}

/* ============================ Locataires ============================ */
function Locataires({ data, setData, go }) {
  const [edit, setEdit] = useState(null);
  const open = (t) => setEdit(t ? t.id : "new");
  const initial = edit && edit !== "new" ? data.locataires.find((x) => x.id === edit) : blankLocataire;
  const del = (id) => delLocataire(setData, id);
  const localNom = (id) => data.locaux.find((x) => x.id === id)?.nom;
  // Ordre d'affichage : par numéro de local (A21, A22… B10… C1… puis Étage, R20…),
  // calculé dynamiquement pour rester correct même après un ajout/modif via l'app.
  // Les locataires sans local sont renvoyés à la fin.
  const rangLocal = (t) => { const l = data.locaux.find((x) => x.id === t.localId); return l ? l.nom.toLowerCase() : "zzz"; };
  const liste = [...data.locataires].sort((a, b) => rangLocal(a).localeCompare(rangLocal(b), "fr", { numeric: true }));

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-slate-500">{data.locataires.length} locataire(s)</p>
        <PrimaryBtn onClick={() => open(null)}><Plus size={16} /> Ajouter un locataire</PrimaryBtn>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {liste.map((t) => (
          <div key={t.id} className="group rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm transition hover:shadow-md">
            <button onClick={() => go("locataire", t.id)} className="block w-full text-left">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-teal-500 to-teal-700 font-display text-sm font-semibold text-white">{initials(t)}</div>
                <div className="min-w-0"><h3 className="truncate font-display font-semibold text-slate-900">{t.prenom} {t.nom}</h3><p className="truncate text-xs text-slate-400">{localNom(t.localId) || "Sans local"}</p></div>
              </div>
              <div className="mt-4 space-y-1.5 text-xs text-slate-500">
                <p className="flex min-w-0 items-center gap-2"><Mail size={13} className="shrink-0 text-slate-400" /><span className="truncate">{t.email || "—"}</span></p>
                <p className="flex min-w-0 items-center gap-2"><Phone size={13} className="shrink-0 text-slate-400" /><span className="truncate">{t.telephone || "—"}</span></p>
              </div>
            </button>
            <div className="mt-3 flex justify-end gap-1 border-t border-slate-100 pt-3 opacity-0 transition group-hover:opacity-100">
              <button onClick={() => open(t)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><Pencil size={15} /></button>
              <button onClick={() => del(t.id)} className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"><Trash2 size={15} /></button>
            </div>
          </div>
        ))}
      </div>
      <LocataireFormModal open={!!edit} editId={edit} initial={initial} data={data} setData={setData} onClose={() => setEdit(null)} />
    </div>
  );
}

function LocataireDetail({ id, data, setData, go }) {
  const t = data.locataires.find((x) => x.id === id);
  if (!t) return null;
  const l = data.locaux.find((x) => x.id === t.localId);
  const im = l && data.immeubles.find((x) => x.id === l.immeubleId);
  const paie = data.paiements.filter((p) => p.locataireId === id).sort((a, b) => b.mois.localeCompare(a.mois));
  const impaye = paie.filter((p) => p.statut !== "paye").reduce((s, p) => s + p.montant, 0);
  const docs = (data.documents || []).filter((d) => d.locataireId === id).sort((a, b) => b.date.localeCompare(a.date));
  const hist = (data.rappels || []).filter((r) => r.locataireId === id).sort((a, b) => b.date.localeCompare(a.date));

  let infoActuel = null;
  if (l) {
    const mode = data.immeubles.find((i) => i.id === l.immeubleId)?.mode;
    const mois = mode === "avance" ? moisAvance : moisEchu;
    const pay = data.paiements.find((x) => x.localId === l.id && x.mois === mois);
    infoActuel = { local: l, mois, montant: l.loyer + l.charges, statut: pay ? pay.statut : "en_attente" };
  }

  const [editOpen, setEditOpen] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [docModal, setDocModal] = useState(false);
  const docBlank = { categorie: "Bail", nom: "", date: new Date().toISOString().slice(0, 10) };
  const [docForm, setDocForm] = useState(docBlank);
  const [rappelModal, setRappelModal] = useState(null);

  const del = () => { delLocataire(setData, id); go("locataires"); };
  const saveDoc = () => {
    if (!docForm.nom.trim()) return;
    setData((d) => ({ ...d, documents: [...(d.documents || []), { id: uid(), nom: docForm.nom, categorie: docForm.categorie, date: docForm.date, locataireId: id, localId: t.localId || null }] }));
    setDocModal(false);
  };
  const delDoc = (docId) => setData((d) => ({ ...d, documents: (d.documents || []).filter((x) => x.id !== docId) }));

  const p = data.parametres || {};
  const societe = p.societe || "La gérance";
  const envoyerRappel = () => {
    if (!infoActuel) return;
    const type = infoActuel.statut !== "paye" ? "retard" : "general";
    const tpl = type === "retard" ? (p.rappelRetard || TPL_RETARD) : (p.rappelGeneral || TPL_GENERAL);
    setRappelModal({ type, msg: buildRappelMessage(tpl, t, infoActuel, societe) });
  };
  const confirmRappel = () => {
    setData((d) => ({ ...d, rappels: [...(d.rappels || []), { id: uid(), locataireId: id, type: rappelModal.type, message: rappelModal.msg, date: new Date().toISOString().slice(0, 10) }] }));
    setRappelModal(null);
  };

  return (
    <div className="space-y-5">
      <button onClick={() => go("locataires")} className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800"><ArrowLeft size={16} /> Locataires</button>

      <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-teal-500 to-teal-700 font-display text-lg font-semibold text-white">{initials(t)}</div>
            <div>
              <h2 className="font-display text-xl font-semibold text-slate-900">{t.prenom} {t.nom}</h2>
              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500">
                <span className="flex items-center gap-1"><Mail size={13} />{t.email || "—"}</span>
                <span className="flex items-center gap-1"><Phone size={13} />{t.telephone || "—"}</span>
              </div>
            </div>
          </div>
          <div className="flex gap-1">
            <button onClick={() => setEditOpen(true)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><Pencil size={16} /></button>
            <button onClick={() => setConfirmDel(true)} className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600"><Trash2 size={16} /></button>
          </div>
        </div>

        {confirmDel && (
          <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
            <span>Supprimer {t.prenom} {t.nom} ? Son local sera libéré, l'historique des paiements sera conservé.</span>
            <button onClick={del} className="rounded-lg bg-rose-600 px-3 py-1 text-xs font-semibold text-white hover:bg-rose-700">Confirmer</button>
            <button onClick={() => setConfirmDel(false)} className="rounded-lg border border-rose-200 bg-white px-3 py-1 text-xs font-medium text-rose-700 hover:bg-rose-50">Annuler</button>
          </div>
        )}

        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-slate-200/70 bg-white px-4 py-3">
            <div className="text-[11px] font-medium text-slate-500">Local</div>
            {l ? <button onClick={() => go("local", l.id)} className="mt-0.5 font-display text-sm font-semibold text-teal-700 hover:underline">{l.nom}</button> : <div className="mt-0.5 text-sm text-slate-400">—</div>}
          </div>
          <div className="rounded-xl border border-slate-200/70 bg-white px-4 py-3">
            <div className="text-[11px] font-medium text-slate-500">Immeuble</div>
            {im ? <button onClick={() => go("immeuble", im.id)} className="mt-0.5 font-display text-sm font-semibold text-teal-700 hover:underline">{im.nom}</button> : <div className="mt-0.5 text-sm text-slate-400">—</div>}
          </div>
          <MiniStat label="Loyer / mois" value={money(l ? l.loyer + l.charges : 0)} />
          <MiniStat label="Impayé" value={money(impaye)} tint={impaye ? "text-rose-600" : "text-emerald-600"} />
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-slate-200/70 bg-white px-4 py-3">
            <div className="text-[11px] font-medium text-slate-500">Locataire depuis</div>
            <div className="mt-0.5 text-sm font-medium text-slate-900">{t.dateEntree || "—"}</div>
          </div>
          <div className="rounded-xl border border-slate-200/70 bg-white px-4 py-3">
            <div className="text-[11px] font-medium text-slate-500">Ancienneté</div>
            <div className="mt-0.5 text-sm font-medium text-slate-900">{anciennete(t.dateEntree) || "—"}</div>
          </div>
          {infoActuel && (
            <div className="rounded-xl border border-slate-200/70 bg-white px-4 py-3 sm:col-span-2">
              <div className="text-[11px] font-medium text-slate-500">Cycle en cours · {cap(moisNom(infoActuel.mois))}</div>
              <div className="mt-1"><Badge statut={infoActuel.statut} /></div>
            </div>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200/70 bg-white shadow-sm">
        <h3 className="border-b border-slate-100 px-5 py-4 font-display text-base font-semibold text-slate-900">Paiements</h3>
        <PaymentsTable list={paie} data={data} setData={setData} go={go} />
      </div>

      <div className="rounded-2xl border border-slate-200/70 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h3 className="font-display text-base font-semibold text-slate-900">Documents</h3>
          <button onClick={() => { setDocForm(docBlank); setDocModal(true); }} className="flex items-center gap-1 text-xs font-medium text-teal-700 hover:text-teal-800"><Plus size={14} /> Ajouter</button>
        </div>
        {docs.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-slate-400">Aucun document.</div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {docs.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-3 px-5 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-slate-100"><FileText size={16} className="text-slate-500" /></div>
                  <div className="min-w-0"><p className="truncate text-sm font-medium text-slate-900">{d.nom}</p><p className="text-xs text-slate-400">{d.date}</p></div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${DOC_CAT_CLS[d.categorie] || "bg-slate-100 text-slate-600"}`}>{d.categorie}</span>
                  <button onClick={() => delDoc(d.id)} className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"><Trash2 size={14} /></button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200/70 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h3 className="font-display text-base font-semibold text-slate-900">Rappels envoyés</h3>
          {infoActuel && <button onClick={envoyerRappel} className="flex items-center gap-1 text-xs font-medium text-teal-700 hover:text-teal-800"><Bell size={14} /> Envoyer un rappel</button>}
        </div>
        {hist.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-slate-400">Aucun rappel envoyé.</div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {hist.map((r) => (
              <li key={r.id} className="px-5 py-3">
                <div className="flex items-center justify-between">
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${r.type === "retard" ? "bg-rose-50 text-rose-700" : "bg-teal-50 text-teal-700"}`}>{r.type === "retard" ? "Relance retard" : "Rappel général"}</span>
                  <span className="text-xs text-slate-400">{r.date}</span>
                </div>
                {r.message && <p className="mt-1.5 text-xs text-slate-500">{r.message}</p>}
              </li>
            ))}
          </ul>
        )}
      </div>

      <LocataireFormModal open={editOpen} editId={id} initial={t} data={data} setData={setData} onClose={() => setEditOpen(false)} />

      <Modal open={docModal} onClose={() => setDocModal(false)} title="Ajouter un document">
        <div className="space-y-4">
          <Field label="Nom du document"><input className={inputCls} value={docForm.nom} onChange={(e) => setDocForm({ ...docForm, nom: e.target.value })} placeholder="Contrat de bail — …" /></Field>
          <Field label="Catégorie"><select className={inputCls} value={docForm.categorie} onChange={(e) => setDocForm({ ...docForm, categorie: e.target.value })}>{DOC_CATS.map((c) => <option key={c}>{c}</option>)}</select></Field>
          <Field label="Date"><DateField value={docForm.date} onChange={(e) => setDocForm({ ...docForm, date: e.target.value })} /></Field>
        </div>
        <div className="mt-6 flex justify-end gap-2"><GhostBtn onClick={() => setDocModal(false)}>Annuler</GhostBtn><PrimaryBtn onClick={saveDoc}>Enregistrer</PrimaryBtn></div>
      </Modal>

      <Modal open={!!rappelModal} onClose={() => setRappelModal(null)} title="Envoyer un rappel">
        {rappelModal && (
          <div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">{rappelModal.msg}</div>
            <p className="mt-3 flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2 text-[11px] text-amber-700"><Upload size={13} className="mt-0.5 shrink-0" />En production, l'envoi réel se fait via une fonction Supabase. Ici, l'action enregistre le rappel.</p>
            <div className="mt-4 flex justify-end gap-2"><GhostBtn onClick={() => setRappelModal(null)}>Annuler</GhostBtn><PrimaryBtn onClick={confirmRappel}>Marquer comme envoyé</PrimaryBtn></div>
          </div>
        )}
      </Modal>
    </div>
  );
}

/* ============================ Paiements (enregistrement) ============================ */
function Paiements({ data, setData, go, filter, setFilter }) {
  const { immeubles } = data;
  const f = filter;
  const modeOf = (id) => immeubles.find((i) => i.id === id)?.mode;
  const [addOpen, setAddOpen] = useState(false);
  const blankAdd = { localId: "", mois: curMonth, montant: 0, statut: "paye", datePaiement: new Date().toISOString().slice(0, 10) };
  const [form, setForm] = useState(blankAdd);
  const [tenantQuery, setTenantQuery] = useState("");
  const [showSugg, setShowSugg] = useState(false);

  // "Tous les immeubles" mélange des immeubles en avance et à terme échu, qui n'ont
  // jamais le même mois pertinent au même moment (ex. le 5 juillet : juin pour l'un,
  // juillet pour l'autre). f.mois sert alors d'ancre de cycle (son mois "avance"),
  // et on inclut pour chaque paiement le mois réellement dû par son propre immeuble.
  const list = data.paiements
    .filter((p) => f.immeuble === "all"
      ? (modeOf(p.immeubleId) === "avance" ? p.mois === f.mois : p.mois === shiftMonth(f.mois, -1))
      : p.mois === f.mois)
    .filter((p) => f.immeuble === "all" || !f.immeuble || p.immeubleId === f.immeuble)
    .filter((p) => (!f.statut || f.statut === "tous") ? true : f.statut === "impayes" ? p.statut !== "paye" : p.statut === f.statut)
    .slice().sort((a, b) => (a.locataireId || "").localeCompare(b.locataireId || ""));
  const enc = list.filter((p) => p.statut === "paye").reduce((s, p) => s + p.montant, 0);
  const du = list.reduce((s, p) => s + p.montant, 0);

  // Changer d'immeuble recale le mois affiché sur ce qui est réellement pertinent :
  // le cycle courant (les deux mois) pour "Tous les immeubles", ou le mois dû par
  // cet immeuble précis selon son mode.
  const changerImmeuble = (val) => {
    if (val === "all") { setFilter({ ...f, immeuble: val, mois: curMonth }); return; }
    const mode = modeOf(val);
    setFilter({ ...f, immeuble: val, mois: mode === "echu" ? moisEchu : moisAvance });
  };

  const localOccupe = data.locaux.filter((l) => l.statut === "loue");
  const pickLocal = (localId) => {
    const l = data.locaux.find((x) => x.id === localId);
    const t = data.locataires.find((x) => x.localId === localId);
    setForm((fm) => ({ ...fm, localId, montant: l ? l.loyer + l.charges : fm.montant }));
    setTenantQuery(t ? `${t.prenom} ${t.nom}` : "");
  };
  const suggestions = tenantQuery.trim()
    ? data.locataires.filter((t) => t.localId && `${t.prenom} ${t.nom}`.toLowerCase().includes(tenantQuery.trim().toLowerCase())).slice(0, 6)
    : [];
  const pickTenant = (t) => { pickLocal(t.localId); setShowSugg(false); };
  const existant = form.localId ? data.paiements.find((p) => p.localId === form.localId && p.mois === form.mois) : null;
  const saveAdd = () => {
    const l = data.locaux.find((x) => x.id === form.localId); if (!l) return;
    const t = data.locataires.find((x) => x.localId === l.id);
    const rec = { localId: l.id, immeubleId: l.immeubleId, locataireId: t?.id || null, mois: form.mois, montant: +form.montant, statut: form.statut, datePaiement: form.statut === "paye" ? form.datePaiement : null };
    setData((d) => {
      const dejaLa = d.paiements.find((p) => p.localId === l.id && p.mois === form.mois);
      if (dejaLa) return { ...d, paiements: d.paiements.map((p) => (p.id === dejaLa.id ? { ...p, ...rec } : p)) };
      return { ...d, paiements: [...d.paiements, { id: uid(), ...rec }] };
    });
    setAddOpen(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <select className={`${inputCls} w-auto`} value={f.mois} onChange={(e) => setFilter({ ...f, mois: e.target.value })}>
          {Array.from({ length: 8 }, (_, i) => shiftMonth(curMonth, -i)).map((m) => (
            <option key={m} value={m}>{f.immeuble === "all" ? `${cap(moisNom(shiftMonth(m, -1)))} - ${cap(moisNom(m))} ${m.slice(0, 4)}` : cap(moisLong(m))}</option>
          ))}
        </select>
        <select className={`${inputCls} w-auto`} value={f.immeuble || "all"} onChange={(e) => changerImmeuble(e.target.value)}>
          <option value="all">Tous les immeubles</option>
          {immeubles.map((im) => <option key={im.id} value={im.id}>{im.nom}</option>)}
        </select>
        <div className="flex rounded-xl border border-slate-200 bg-white p-1">
          {[{ k: "tous", l: "Tous" }, { k: "paye", l: "Payés" }, { k: "impayes", l: "Impayés" }].map((s) => (
            <button key={s.k} onClick={() => setFilter({ ...f, statut: s.k })} className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${f.statut === s.k ? "bg-teal-700 text-white" : "text-slate-500 hover:text-slate-800"}`}>{s.l}</button>
          ))}
        </div>
        <PrimaryBtn onClick={() => { setForm(blankAdd); setTenantQuery(""); setAddOpen(true); }}><Plus size={16} /> Nouveau paiement</PrimaryBtn>
        <div className="ml-auto text-sm text-slate-500">Encaissé <span className="font-display font-semibold tabular-nums text-teal-700">{money(enc)}</span> / {money(du)}</div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-sm">
        <PaymentsTable list={list} data={data} setData={setData} go={go} />
      </div>

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Enregistrer un paiement" wide>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2"><Field label="Local"><select className={inputCls} value={form.localId} onChange={(e) => pickLocal(e.target.value)}><option value="">— choisir un local —</option>{localOccupe.map((l) => <option key={l.id} value={l.id}>{l.nom} · {data.immeubles.find((i) => i.id === l.immeubleId)?.nom}</option>)}</select></Field></div>
          <div className="relative sm:col-span-2">
            <Field label="Locataire">
              <input
                className={inputCls}
                value={tenantQuery}
                placeholder="Tapez un nom pour rechercher…"
                onChange={(e) => { setTenantQuery(e.target.value); setShowSugg(true); if (!e.target.value.trim()) setForm((fm) => ({ ...fm, localId: "" })); }}
                onFocus={() => setShowSugg(true)}
                onBlur={() => setTimeout(() => setShowSugg(false), 150)}
              />
            </Field>
            {showSugg && tenantQuery.trim() && (
              <div className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
                {suggestions.length === 0 ? (
                  <div className="px-4 py-3 text-sm text-slate-400">Aucun locataire ne correspond.</div>
                ) : (
                  <ul className="max-h-52 divide-y divide-slate-100 overflow-y-auto">
                    {suggestions.map((t) => {
                      const l = data.locaux.find((x) => x.id === t.localId);
                      return (
                        <li key={t.id}>
                          <button type="button" onClick={() => pickTenant(t)} className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left hover:bg-slate-50">
                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-teal-500 to-teal-700 text-[10px] font-semibold text-white">{initials(t)}</div>
                            <span className="min-w-0 flex-1 truncate text-sm text-slate-700">{t.prenom} {t.nom}</span>
                            <span className="shrink-0 text-xs text-slate-400">{l?.nom}</span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            )}
          </div>
          <Field label="Mois concerné"><select className={inputCls} value={form.mois} onChange={(e) => setForm({ ...form, mois: e.target.value })}>{Array.from({ length: 8 }, (_, i) => shiftMonth(curMonth, -i)).map((m) => <option key={m} value={m}>{cap(moisLong(m))}</option>)}</select></Field>
          <Field label="Montant (GNF)"><input type="number" inputMode="numeric" className={inputCls} value={form.montant || ""} placeholder="0" onChange={(e) => setForm({ ...form, montant: +e.target.value })} /></Field>
          <Field label="Statut"><select className={inputCls} value={form.statut} onChange={(e) => setForm({ ...form, statut: e.target.value })}><option value="paye">Payé</option><option value="en_attente">En attente</option><option value="en_retard">En retard</option></select></Field>
          {form.statut === "paye" && <Field label="Date de paiement"><DateField value={form.datePaiement} onChange={(e) => setForm({ ...form, datePaiement: e.target.value })} /></Field>}
        </div>
        {existant && <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">Un paiement existe déjà pour ce local sur {cap(moisLong(form.mois))} — il sera mis à jour (pas de doublon créé).</p>}
        <div className="mt-6 flex justify-end gap-2"><GhostBtn onClick={() => setAddOpen(false)}>Annuler</GhostBtn><PrimaryBtn onClick={saveAdd}>Enregistrer</PrimaryBtn></div>
      </Modal>
    </div>
  );
}

/* ============================ Recouvrement (consultation) ============================ */
function Recouvrement({ data, go, openPaie }) {
  const { immeubles } = data;
  const modeOf = (id) => immeubles.find((i) => i.id === id)?.mode;
  const nom = (id) => { const l = data.locataires.find((x) => x.id === id); return l ? `${l.prenom} ${l.nom}` : "—"; };
  const localNom = (id) => data.locaux.find((x) => x.id === id)?.nom || "—";
  const imAvance = immeubles.find((i) => i.mode === "avance");
  const imEchu = immeubles.find((i) => i.mode === "echu");
  const sum = (a) => a.reduce((s, p) => s + p.montant, 0);
  const avancePaie = data.paiements.filter((p) => modeOf(p.immeubleId) === "avance" && p.mois === moisAvance);
  const echuPaie = data.paiements.filter((p) => modeOf(p.immeubleId) === "echu" && p.mois === moisEchu);
  const encA = sum(avancePaie.filter((p) => p.statut === "paye")), encE = sum(echuPaie.filter((p) => p.statut === "paye"));
  const duA = sum(avancePaie), duE = sum(echuPaie);
  const total = encA + encE, attendu = duA + duE, impaye = attendu - total;
  const pct = attendu ? Math.round((total / attendu) * 100) : 0;
  const encAnim = useCountUp(total);
  const retards = [...echuPaie, ...avancePaie].filter((p) => p.statut !== "paye");
  const parIm = immeubles.map((im) => { const mois = im.mode === "avance" ? moisAvance : moisEchu; const pl = data.paiements.filter((p) => p.immeubleId === im.id && p.mois === mois); return { im, mois, enc: sum(pl.filter((p) => p.statut === "paye")), du: sum(pl) }; });

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500"><Layers size={14} className="mt-0.5 shrink-0 text-slate-400" /><span>Consultation du recouvrement au {echeanceLabel}. Pour enregistrer un encaissement, ouvrez <button onClick={() => openPaie({ mois: moisAvance, immeuble: "all", statut: "tous" })} className="font-medium text-teal-700 underline">Paiements</button>.</span></div>

      <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-teal-800 via-teal-700 to-emerald-700 p-6 text-white shadow-lg lg:p-7">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-center">
          <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:gap-6">
            <div className="relative shrink-0">
              <Ring pct={pct} />
              <div className="absolute inset-0 flex flex-col items-center justify-center"><span className="font-display text-2xl font-bold">{pct}%</span><span className="text-[11px] text-teal-100/80">recouvré</span></div>
            </div>
            <div className="min-w-0">
              <div className="text-xs font-medium uppercase tracking-wide text-teal-100/70">Encaissé · {echeanceLabel}</div>
              <div className="font-display text-3xl font-bold leading-tight tabular-nums lg:text-[2.4rem]">{money(encAnim)}</div>
              <div className="mt-1 text-xs text-teal-100/80 sm:text-sm">sur {money(attendu)} attendu · <span className="text-rose-100">{money(impaye)} en retard</span></div>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <button onClick={() => openPaie({ mois: moisEchu, immeuble: imEchu?.id, statut: "tous" })} className="rounded-2xl bg-white/10 p-4 text-left ring-1 ring-white/15 backdrop-blur transition hover:bg-white/15">
              <span className="rounded-lg bg-cyan-400/20 px-2 py-0.5 text-[11px] font-semibold text-cyan-50">Terme échu</span>
              <div className="mt-2 text-sm font-medium text-teal-50">{cap(moisNom(moisEchu))}</div>
              <div className="text-[11px] text-teal-100/70">{imEchu?.nom}</div>
              <div className="mt-2 font-display text-xl font-bold tabular-nums">{money(encE)}</div>
              <div className="text-[11px] text-teal-100/70">/ {money(duE)}</div>
            </button>
            <button onClick={() => openPaie({ mois: moisAvance, immeuble: imAvance?.id, statut: "tous" })} className="rounded-2xl bg-white/10 p-4 text-left ring-1 ring-white/15 backdrop-blur transition hover:bg-white/15">
              <span className="rounded-lg bg-indigo-400/25 px-2 py-0.5 text-[11px] font-semibold text-indigo-50">En avance</span>
              <div className="mt-2 text-sm font-medium text-teal-50">{cap(moisNom(moisAvance))}</div>
              <div className="text-[11px] text-teal-100/70">{imAvance?.nom}</div>
              <div className="mt-2 font-display text-xl font-bold tabular-nums">{money(encA)}</div>
              <div className="text-[11px] text-teal-100/70">/ {money(duA)}</div>
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200/70 bg-white shadow-sm">
        <h3 className="border-b border-slate-100 px-5 py-4 font-display text-base font-semibold text-slate-900">Recouvrement par immeuble</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-slate-100 text-left text-xs font-medium uppercase tracking-wide text-slate-400"><th className="px-5 py-3">Immeuble</th><th className="px-5 py-3">Mode</th><th className="px-5 py-3">Mois</th><th className="px-5 py-3 text-right">Encaissé</th><th className="px-5 py-3 text-right">Attendu</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {parIm.map(({ im, mois, enc, du }) => (
                <tr key={im.id} className="hover:bg-slate-50/60">
                  <td className="px-5 py-3.5"><button onClick={() => go("immeuble", im.id)} className="font-medium text-slate-900 hover:text-teal-700">{im.nom}</button></td>
                  <td className="px-5 py-3.5"><Badge statut={im.mode} /></td>
                  <td className="px-5 py-3.5 text-slate-500">{cap(moisNom(mois))}</td>
                  <td className="px-5 py-3.5 text-right font-display font-semibold tabular-nums text-emerald-600">{money(enc)}</td>
                  <td className="px-5 py-3.5 text-right tabular-nums text-slate-500">{money(du)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200/70 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h3 className="font-display text-base font-semibold text-slate-900">Locataires en retard</h3>
          <span className="rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-medium text-rose-600">{retards.length}</span>
        </div>
        {retards.length === 0 ? <div className="px-5 py-10 text-center text-sm text-slate-400">Aucun retard sur ce cycle. 🎉</div> : (
          <ul className="divide-y divide-slate-100">
            {retards.map((p) => (
              <li key={p.id}>
                <button onClick={() => go("locataire", p.locataireId)} className="flex w-full items-center justify-between px-5 py-3 text-left hover:bg-slate-50/70">
                  <div className="min-w-0"><p className="truncate text-sm font-medium text-slate-900">{nom(p.locataireId)}</p><p className="truncate text-xs text-slate-400">{localNom(p.localId)} · loyer de {cap(moisNom(p.mois))}</p></div>
                  <div className="flex items-center gap-3"><span className="font-display text-sm font-semibold tabular-nums text-slate-900">{money(p.montant)}</span><Badge statut={p.statut} /></div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/* ============================ Locataires en retard ============================ */
function Retards({ data, setData, go }) {
  const modeOf = (id) => data.immeubles.find((i) => i.id === id)?.mode;
  const nom = (id) => { const l = data.locataires.find((x) => x.id === id); return l ? `${l.prenom} ${l.nom}` : "—"; };
  const localNom = (id) => data.locaux.find((x) => x.id === id)?.nom || "—";
  const imNom = (id) => data.immeubles.find((x) => x.id === id)?.nom || "—";

  // Tous les paiements dus mais non réglés (retard ou en attente), tous mois confondus jusqu'au cycle courant.
  const retards = data.paiements
    .filter((p) => {
      if (p.statut === "paye") return false;
      const dernier = modeOf(p.immeubleId) === "avance" ? moisAvance : moisEchu; // dernier mois exigible pour cet immeuble
      return p.mois <= dernier;
    })
    .sort((a, b) => a.mois.localeCompare(b.mois) || (a.locataireId || "").localeCompare(b.locataireId || ""));

  // Regroupement par locataire pour un total dû et un nb de mois en retard
  const parLocataire = {};
  retards.forEach((p) => {
    const k = p.locataireId || p.localId;
    if (!parLocataire[k]) parLocataire[k] = { locataireId: p.locataireId, localId: p.localId, immeubleId: p.immeubleId, lignes: [], total: 0 };
    parLocataire[k].lignes.push(p);
    parLocataire[k].total += p.montant;
  });
  const groupes = Object.values(parLocataire).sort((a, b) => b.total - a.total);
  const totalGeneral = retards.reduce((s, p) => s + p.montant, 0);

  const encaisser = (pid) => setData((d) => ({ ...d, paiements: d.paiements.map((p) => p.id === pid ? { ...p, statut: "paye", datePaiement: new Date().toISOString().slice(0, 10) } : p) }));

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm">
          <div className="text-xs font-medium text-slate-500">Locataires en retard</div>
          <div className="mt-2 font-display text-2xl font-semibold text-rose-600">{groupes.length}</div>
        </div>
        <div className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm">
          <div className="text-xs font-medium text-slate-500">Loyers impayés</div>
          <div className="mt-2 font-display text-2xl font-semibold text-slate-900">{retards.length}</div>
        </div>
        <div className="col-span-2 rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm sm:col-span-1">
          <div className="text-xs font-medium text-slate-500">Montant total dû</div>
          <div className="mt-2 font-display text-2xl font-semibold tabular-nums text-rose-600">{moneyC(totalGeneral)}</div>
        </div>
      </div>

      {groupes.length === 0 ? (
        <div className="rounded-2xl border border-slate-200/70 bg-white px-5 py-12 text-center text-sm text-slate-400 shadow-sm">Aucun locataire en retard. 🎉</div>
      ) : (
        <div className="space-y-4">
          {groupes.map((g) => (
            <div key={g.locataireId || g.localId} className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
                <button onClick={() => g.locataireId && go("locataire", g.locataireId)} className="flex min-w-0 items-center gap-3 text-left">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-rose-400 to-rose-600 text-xs font-semibold text-white">{initials(data.locataires.find((x) => x.id === g.locataireId) || { nom: "?" })}</div>
                  <div className="min-w-0">
                    <p className="truncate font-display font-semibold text-slate-900">{nom(g.locataireId)}</p>
                    <p className="truncate text-xs text-slate-400">{localNom(g.localId)} · {imNom(g.immeubleId)}</p>
                  </div>
                </button>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="font-display text-sm font-semibold tabular-nums text-rose-600">{money(g.total)}</div>
                    <div className="text-[11px] text-slate-400">{g.lignes.length} mois en retard</div>
                  </div>
                  {g.locataireId && <button onClick={() => go("locataire", g.locataireId)} className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-200">Fiche</button>}
                </div>
              </div>
              <ul className="divide-y divide-slate-100">
                {g.lignes.map((p) => (
                  <li key={p.id} className="flex items-center justify-between px-5 py-2.5">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-slate-700">{cap(moisNom(p.mois))} {p.mois.slice(0, 4)}</span>
                      <Badge statut={p.statut} />
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-display text-sm font-semibold tabular-nums text-slate-900">{money(p.montant)}</span>
                      <button onClick={() => encaisser(p.id)} className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100"><Check size={14} /> Encaisser</button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500">
        <Bell size={14} className="mt-0.5 shrink-0 text-slate-400" />
        <span>Pour envoyer une relance à ces locataires, utilisez le module <button onClick={() => go("rappels")} className="font-medium text-teal-700 underline">Rappels</button> (relance automatique aux retardataires).</span>
      </div>
    </div>
  );
}

/* ============================ Rappels de paiement ============================ */
function Rappels({ data, setData, go }) {
  const p = data.parametres || {};
  const societe = p.societe || "La gérance";
  const modeOf = (id) => data.immeubles.find((i) => i.id === id)?.mode;
  const [tplG, setTplG] = useState(p.rappelGeneral || TPL_GENERAL);
  const [tplR, setTplR] = useState(p.rappelRetard || TPL_RETARD);
  const [showTpl, setShowTpl] = useState(false);
  const [modal, setModal] = useState(null);
  const [toast, setToast] = useState("");
  const [copied, setCopied] = useState(false);

  const tenants = data.locataires.filter((t) => t.localId);
  const infoFor = (t) => { const l = data.locaux.find((x) => x.id === t.localId); if (!l) return null; const mode = modeOf(l.immeubleId); const mois = mode === "avance" ? moisAvance : moisEchu; const pay = data.paiements.find((x) => x.localId === l.id && x.mois === mois); return { local: l, mois, montant: l.loyer + l.charges, statut: pay ? pay.statut : "en_attente" }; };
  const build = (tpl, t, info) => buildRappelMessage(tpl, t, info, societe);
  const lastRappel = (id) => { const rs = (data.rappels || []).filter((r) => r.locataireId === id); return rs.length ? rs.slice().sort((a, b) => b.date.localeCompare(a.date))[0].date : null; };
  const saveTpl = () => { setData((d) => ({ ...d, parametres: { ...(d.parametres || {}), rappelGeneral: tplG, rappelRetard: tplR } })); setToast("Modèles enregistrés"); setTimeout(() => setToast(""), 2000); };

  const openSend = (type) => {
    let recs = tenants.map((t) => ({ t, info: infoFor(t) })).filter((r) => r.info);
    if (type === "retard") recs = recs.filter((r) => r.info.statut !== "paye");
    const tpl = type === "retard" ? tplR : tplG;
    setModal({ type, title: type === "retard" ? "Relance aux retardataires" : "Rappel de paiement · échéance du 5", recipients: recs.map((r) => ({ ...r, msg: build(tpl, r.t, r.info) })) });
  };
  const openOne = (t) => { const info = infoFor(t); if (!info) return; const type = info.statut !== "paye" ? "retard" : "general"; const tpl = type === "retard" ? tplR : tplG; setModal({ type, title: `Rappel — ${t.prenom} ${t.nom}`, recipients: [{ t, info, msg: build(tpl, t, info) }] }); };
  const confirmSend = () => { const today = new Date().toISOString().slice(0, 10); setData((d) => ({ ...d, rappels: [...(d.rappels || []), ...modal.recipients.map((r) => ({ id: uid(), locataireId: r.t.id, type: modal.type, message: r.msg, date: today }))] })); setToast(`${modal.recipients.length} rappel(s) enregistré(s)`); setModal(null); setTimeout(() => setToast(""), 2500); };
  const copyAll = async () => { try { await navigator.clipboard.writeText(modal.recipients.map((r) => r.msg).join("\n\n")); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch {} };
  const nbRetard = tenants.map(infoFor).filter((i) => i && i.statut !== "paye").length;

  return (
    <div className="space-y-5">
      {toast && <div className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-full bg-slate-900 px-4 py-2 text-sm text-white shadow-lg">{toast}</div>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-teal-200 bg-teal-50/60 p-5">
          <div className="flex items-center gap-2 text-teal-800"><Bell size={18} /><h3 className="font-display font-semibold">Rappel général</h3></div>
          <p className="mt-1 text-sm text-teal-700/80">Informer tous les locataires que le loyer est dû le 5 de ce mois.</p>
          <p className="mt-2 text-xs text-teal-700/70">{tenants.length} destinataire(s)</p>
          <PrimaryBtn className="mt-3" onClick={() => openSend("general")}><Bell size={15} /> Rappeler à tous</PrimaryBtn>
        </div>
        <div className="rounded-2xl border border-rose-200 bg-rose-50/60 p-5">
          <div className="flex items-center gap-2 text-rose-700"><AlertTriangle size={18} /><h3 className="font-display font-semibold">Relance retard</h3></div>
          <p className="mt-1 text-sm text-rose-600/80">Envoyer une relance aux locataires en retard de paiement.</p>
          <p className="mt-2 text-xs text-rose-600/70">{nbRetard} en retard</p>
          <button onClick={() => openSend("retard")} disabled={nbRetard === 0} className="mt-3 inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:opacity-50"><AlertTriangle size={15} /> Relancer les retardataires</button>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200/70 bg-white shadow-sm">
        <button onClick={() => setShowTpl((s) => !s)} className="flex w-full items-center justify-between px-5 py-4 text-left"><h3 className="font-display text-base font-semibold text-slate-900">Modèles de message</h3><ChevronRight size={16} className={`text-slate-400 transition ${showTpl ? "rotate-90" : ""}`} /></button>
        {showTpl && (
          <div className="space-y-4 border-t border-slate-100 px-5 py-4">
            <p className="text-xs text-slate-400">Variables : {"{locataire}"}, {"{local}"}, {"{montant}"}, {"{mois}"}, {"{jour}"}, {"{societe}"}.</p>
            <Field label="Rappel général"><textarea rows={3} className={inputCls} value={tplG} onChange={(e) => setTplG(e.target.value)} /></Field>
            <Field label="Relance retard"><textarea rows={3} className={inputCls} value={tplR} onChange={(e) => setTplR(e.target.value)} /></Field>
            <PrimaryBtn onClick={saveTpl}>Enregistrer les modèles</PrimaryBtn>
          </div>
        )}
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-sm">
        <h3 className="border-b border-slate-100 px-5 py-4 font-display text-base font-semibold text-slate-900">Locataires</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-slate-100 text-left text-xs font-medium uppercase tracking-wide text-slate-400"><th className="px-5 py-3">Locataire</th><th className="px-5 py-3">Local</th><th className="px-5 py-3">Statut</th><th className="px-5 py-3">Dernier rappel</th><th className="px-5 py-3 text-right">Action</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {tenants.map((t) => { const info = infoFor(t); const lr = lastRappel(t.id); return (
                <tr key={t.id} className="hover:bg-slate-50/60">
                  <td className="px-5 py-3.5"><button onClick={() => go("locataire", t.id)} className="font-medium text-slate-900 hover:text-teal-700">{t.prenom} {t.nom}</button></td>
                  <td className="px-5 py-3.5 text-slate-500">{info?.local.nom}</td>
                  <td className="px-5 py-3.5">{info && <Badge statut={info.statut} />}</td>
                  <td className="whitespace-nowrap px-5 py-3.5 text-slate-500">{lr || "—"}</td>
                  <td className="px-5 py-3.5 text-right"><button onClick={() => openOne(t)} className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-200"><Bell size={14} /> Rappeler</button></td>
                </tr>
              ); })}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={!!modal} onClose={() => setModal(null)} title={modal?.title || "Rappel"} wide>
        {modal && (
          <div>
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm text-slate-500">{modal.recipients.length} message(s)</span>
              <button onClick={copyAll} className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-200">{copied ? <><Check size={14} /> Copié</> : <>Copier tout</>}</button>
            </div>
            <div className="max-h-80 space-y-3 overflow-y-auto">
              {modal.recipients.map((r, i) => (
                <div key={i} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-700">{r.t.prenom} {r.t.nom}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-slate-400">{r.t.telephone || "sans numéro"}</span>
                      <a
                        href={r.t.telephone ? waLink(r.t.telephone, r.msg) : undefined}
                        target="_blank" rel="noopener noreferrer"
                        onClick={(e) => { if (!r.t.telephone) e.preventDefault(); }}
                        className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold text-white ${r.t.telephone ? "bg-emerald-600 hover:bg-emerald-700" : "cursor-not-allowed bg-slate-300"}`}
                      ><MessageCircle size={12} /> Envoyer</a>
                    </div>
                  </div>
                  <p className="text-sm text-slate-600">{r.msg}</p>
                </div>
              ))}
            </div>
            <div className="mt-3 flex items-start gap-2 rounded-xl bg-teal-50 px-3 py-2 text-[11px] text-teal-700"><MessageCircle size={13} className="mt-0.5 shrink-0" />Le bouton « Envoyer » ouvre WhatsApp avec le message prêt, un destinataire à la fois (WhatsApp ne permet pas l'envoi groupé sans compte professionnel). Pensez à cliquer sur chacun.</div>
            <div className="mt-4 flex justify-end gap-2"><GhostBtn onClick={() => setModal(null)}>Fermer</GhostBtn><PrimaryBtn onClick={confirmSend}>Marquer comme envoyés</PrimaryBtn></div>
          </div>
        )}
      </Modal>
    </div>
  );
}

/* ============================ Versements ============================ */
// Calcul du recouvrement d'un versement (montants collectés, commission, net) — partagé
// entre la fenêtre de détail et l'assistant vocal, pour ne jamais diverger.
function calcVersement(versement, data) {
  const modeOf = (id) => data.immeubles.find((i) => i.id === id)?.mode;
  const items = [
    ...data.paiements.filter((x) => modeOf(x.immeubleId) === "avance" && x.mois === versement.mois && x.statut === "paye"),
    ...data.paiements.filter((x) => modeOf(x.immeubleId) === "echu" && x.mois === shiftMonth(versement.mois, -1) && x.statut === "paye"),
  ];
  const recouvre = items.reduce((s, x) => s + x.montant, 0);
  const commission = Math.round(recouvre * (versement.commissionPct || 0) / 100);
  return { items, recouvre, commission, net: recouvre - commission };
}
function genererVersementPdf(versement, data) {
  const p = data.parametres || {};
  const gestionnaire = p.gestionnaire || "Sanoussy DRAMÉ";
  const proprietaire = p.proprietaire || "Elhadj Ousmane MAGASSOUBA";
  const societe = p.societe || "La gérance";
  const nom = (id) => { const l = data.locataires.find((x) => x.id === id); return l ? `${l.prenom} ${l.nom}` : "—"; };
  const localNom = (id) => data.locaux.find((x) => x.id === id)?.nom || "—";
  const c = calcVersement(versement, data);
  const ref = `V-${versement.mois.replace("-", "")}-${versement.id.slice(-4).toUpperCase()}`;
  const ops = [
    { type: "rect", x: 0, y: 700, w: 595, h: 142, color: [0.06, 0.29, 0.28] },
    { type: "text", x: 50, y: 803, size: 18, font: "B", color: [1, 1, 1], text: societe },
    { type: "text", x: 50, y: 778, size: 10, font: "R", color: [0.8, 0.95, 0.9], text: "REÇU DE VERSEMENT" },
    { type: "text", x: 460, y: 803, size: 9, font: "R", color: [0.85, 0.95, 0.92], text: "N°" },
    { type: "text", x: 460, y: 790, size: 11, font: "B", color: [1, 1, 1], text: ref },
    { type: "text", x: 460, y: 778, size: 9, font: "R", color: [0.85, 0.95, 0.92], text: versement.date },
    { type: "text", x: 50, y: 660, size: 9, font: "R", color: [0.5, 0.5, 0.5], text: "Remis par (gestionnaire)" },
    { type: "text", x: 50, y: 645, size: 13, font: "B", color: [0.05, 0.05, 0.08], text: gestionnaire },
    { type: "text", x: 310, y: 660, size: 9, font: "R", color: [0.5, 0.5, 0.5], text: "Reçu par (propriétaire)" },
    { type: "text", x: 310, y: 645, size: 13, font: "B", color: [0.05, 0.05, 0.08], text: proprietaire },
    { type: "rect", x: 50, y: 585, w: 495, h: 45, color: [0.96, 0.97, 0.98] },
    { type: "text", x: 65, y: 610, size: 18, font: "B", color: [0.02, 0.4, 0.25], text: `${money(c.net)} net versé` },
    { type: "text", x: 65, y: 594, size: 9, font: "R", color: [0.42, 0.42, 0.42], text: cap(montantEnLettres(c.net)) },
    { type: "text", x: 50, y: 560, size: 10, font: "B", color: [0.3, 0.3, 0.3], text: "Détail des recouvrements :" },
  ];
  let y = 540;
  ops.push({ type: "line", x1: 50, y1: y + 10, x2: 545, y2: y + 10, color: [0.8, 0.8, 0.8], width: 0.5 });
  if (c.items.length === 0) {
    ops.push({ type: "text", x: 50, y, size: 9, font: "R", color: [0.5, 0.5, 0.5], text: "Aucun recouvrement." });
    y -= 18;
  } else {
    for (const x of c.items) {
      ops.push({ type: "text", x: 50, y, size: 9, font: "R", color: [0.2, 0.2, 0.2], text: nom(x.locataireId) });
      ops.push({ type: "text", x: 260, y, size: 9, font: "R", color: [0.45, 0.45, 0.45], text: localNom(x.localId) });
      ops.push({ type: "text", x: 460, y, size: 9, font: "R", color: [0.1, 0.1, 0.1], text: money(x.montant) });
      y -= 16;
    }
  }
  ops.push({ type: "line", x1: 50, y1: y + 10, x2: 545, y2: y + 10, color: [0.8, 0.8, 0.8], width: 0.5 });
  y -= 8;
  ops.push({ type: "text", x: 350, y, size: 9, font: "R", color: [0.4, 0.4, 0.4], text: `Total recouvré : ${money(c.recouvre)}` }); y -= 15;
  ops.push({ type: "text", x: 350, y, size: 9, font: "R", color: [0.4, 0.4, 0.4], text: `Commission (${versement.commissionPct || 0}%) : − ${money(c.commission)}` }); y -= 25;
  ops.push({ type: "line", x1: 50, y1: y + 10, x2: 545, y2: y + 10, color: [0.75, 0.75, 0.75], width: 1, dash: [3, 3] }); y -= 20;
  ops.push({ type: "text", x: 50, y, size: 8, font: "R", color: [0.5, 0.5, 0.5], text: "Le gestionnaire" });
  ops.push({ type: "text", x: 310, y, size: 8, font: "R", color: [0.5, 0.5, 0.5], text: "Le propriétaire" }); y -= 25;
  ops.push({ type: "text", x: 50, y, size: 9, font: "B", color: [0.2, 0.2, 0.2], text: gestionnaire });
  ops.push({ type: "text", x: 310, y, size: 9, font: "B", color: [0.2, 0.2, 0.2], text: proprietaire });
  return { bytes: buildPdfBytes({ ops }), fichier: `${ref}.pdf`, ref };
}

function VersementRecuModal({ versement, data, onClose }) {
  const p = data.parametres || {};
  const gestionnaire = p.gestionnaire || "Sanoussy DRAMÉ";
  const proprietaire = p.proprietaire || "Elhadj Ousmane MAGASSOUBA";
  const societe = p.societe || "La gérance";
  const modeOf = (id) => data.immeubles.find((i) => i.id === id)?.mode;
  const nom = (id) => { const l = data.locataires.find((x) => x.id === id); return l ? `${l.prenom} ${l.nom}` : "—"; };
  const localNom = (id) => data.locaux.find((x) => x.id === id)?.nom || "—";
  const calc = (v) => calcVersement(v, data);
  return (
    <Modal open={!!versement} onClose={onClose} title="Reçu de versement" wide>
      {versement && (() => { const c = calc(versement); const { bytes: pdfBytes, fichier, ref } = genererVersementPdf(versement, data);
        const messageVersement = `Versement du ${versement.date} — période ${cap(moisNom(versement.mois))} ${versement.mois.slice(0, 4)} : ${money(c.recouvre)} recouvré, ${money(c.net)} net transmis. — ${gestionnaire}`;
        return (
        <div>
          <div className="print-area overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <div className="relative overflow-hidden bg-gradient-to-br from-teal-800 via-teal-700 to-emerald-700 px-6 py-5 text-white">
              <div className="absolute inset-0 opacity-[0.08]" style={{ backgroundImage: "radial-gradient(circle, #fff 1.5px, transparent 1.5px)", backgroundSize: "16px 16px" }} />
              <div className="relative flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2"><div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/15"><Banknote size={16} /></div><span className="truncate font-display text-lg font-bold">{societe}</span></div>
                  <p className="mt-2 text-[11px] font-medium uppercase tracking-[0.2em] text-teal-100/80">Reçu de versement</p>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-[10px] uppercase tracking-wide text-teal-100/70">N°</div>
                  <div className="font-display text-sm font-semibold tabular-nums">{ref}</div>
                  <div className="mt-1 text-[11px] text-teal-100/80">{versement.date}</div>
                </div>
              </div>
            </div>

            <div className="px-6 py-6">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-[10px] uppercase tracking-wide text-slate-400">Remis par</p>
                  <p className="mt-1 truncate font-display text-sm font-semibold text-slate-900">{gestionnaire}</p>
                  <p className="text-[11px] text-slate-400">Gestionnaire</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-[10px] uppercase tracking-wide text-slate-400">Reçu par</p>
                  <p className="mt-1 truncate font-display text-sm font-semibold text-slate-900">{proprietaire}</p>
                  <p className="text-[11px] text-slate-400">Propriétaire</p>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap items-end justify-between gap-3 rounded-2xl bg-slate-50 p-5">
                <div className="min-w-0">
                  <p className="text-xs text-slate-400">Net versé au propriétaire · {cap(moisNom(versement.mois))} {versement.mois.slice(0, 4)}</p>
                  <p className="font-display text-3xl font-bold tabular-nums text-emerald-600 sm:text-4xl">{money(c.net)}</p>
                  <p className="mt-1.5 text-xs italic text-slate-500">{montantEnLettres(c.net)}</p>
                </div>
                <span className="shrink-0 -rotate-6 rounded-lg border-2 border-emerald-600 px-3 py-1 text-sm font-bold uppercase tracking-wide text-emerald-600">Versé</span>
              </div>

              <p className="mt-5 text-xs text-slate-500">Détail des recouvrements (loyers encaissés au {`5 ${moisNom(versement.mois)}`}) :</p>
              <div className="mt-2 overflow-x-auto rounded-xl border border-slate-100">
                <table className="w-full text-sm">
                  <thead><tr className="bg-slate-50 text-left text-[11px] uppercase text-slate-400"><th className="px-3 py-2">Locataire</th><th className="px-3 py-2">Local</th><th className="px-3 py-2">Loyer</th><th className="px-3 py-2 text-right">Montant</th></tr></thead>
                  <tbody className="divide-y divide-slate-100">
                    {c.items.length === 0 ? <tr><td colSpan={4} className="px-3 py-4 text-center text-slate-400">Aucun recouvrement.</td></tr> : c.items.map((x) => (
                      <tr key={x.id}><td className="px-3 py-2 text-slate-700">{nom(x.locataireId)}</td><td className="px-3 py-2 text-slate-500">{localNom(x.localId)}</td><td className="px-3 py-2 text-slate-500">{cap(moisNom(x.mois))}</td><td className="px-3 py-2 text-right tabular-nums text-slate-900">{money(x.montant)}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-3 space-y-1 text-sm">
                <div className="flex justify-between"><span className="text-slate-500">Total recouvré</span><span className="font-medium tabular-nums text-slate-900">{money(c.recouvre)}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Commission gestionnaire ({versement.commissionPct || 0}%)</span><span className="font-medium tabular-nums text-slate-900">− {money(c.commission)}</span></div>
              </div>

              <div className="my-5 border-t border-dashed border-slate-300" />

              <div className="grid grid-cols-2 gap-6 text-center text-xs text-slate-400">
                <div><div className="mb-6">Le gestionnaire</div><div className="border-t border-slate-200 pt-1">{gestionnaire}</div></div>
                <div><div className="mb-6">Le propriétaire</div><div className="border-t border-slate-200 pt-1">{proprietaire}</div></div>
              </div>
            </div>
          </div>
          <div className="no-print mt-4 flex flex-wrap justify-end gap-2">
            <GhostBtn onClick={onClose}>Fermer</GhostBtn>
            <GhostBtn onClick={() => window.print()}><Printer size={15} /> Imprimer</GhostBtn>
            <PrimaryBtn onClick={() => telechargerPdf(genererPdf(), fichier)}><Download size={15} /> Télécharger PDF</PrimaryBtn>
          </div>
          <div className="mt-4"><ShareRow phone={p.proprietaireTelephone} message={messageVersement} pdfBytes={genererPdf()} pdfFilename={fichier} /></div>
        </div>
      ); })()}
    </Modal>
  );
}

function Versements({ data, setData, go }) {
  const p = data.parametres || {};
  const gestionnaire = p.gestionnaire || "Sanoussy DRAMÉ";
  const proprietaire = p.proprietaire || "Elhadj Ousmane MAGASSOUBA";
  const societe = p.societe || "La gérance";
  const modeOf = (id) => data.immeubles.find((i) => i.id === id)?.mode;
  const nom = (id) => { const l = data.locataires.find((x) => x.id === id); return l ? `${l.prenom} ${l.nom}` : "—"; };
  const localNom = (id) => data.locaux.find((x) => x.id === id)?.nom || "—";
  const paidCycle = (M) => [
    ...data.paiements.filter((x) => modeOf(x.immeubleId) === "avance" && x.mois === M && x.statut === "paye"),
    ...data.paiements.filter((x) => modeOf(x.immeubleId) === "echu" && x.mois === shiftMonth(M, -1) && x.statut === "paye"),
  ];
  const calc = (v) => { const items = paidCycle(v.mois); const recouvre = items.reduce((s, x) => s + x.montant, 0); const commission = Math.round(recouvre * (v.commissionPct || 0) / 100); return { items, recouvre, commission, net: recouvre - commission }; };
  const versements = (data.versements || []).slice().sort((a, b) => b.mois.localeCompare(a.mois));
  const moisDisponibles = Array.from({ length: 8 }, (_, i) => shiftMonth(curMonth, -i)).filter((m) => !(data.versements || []).some((v) => v.mois === m));
  const [recu, setRecu] = useState(null);
  const [addOpen, setAddOpen] = useState(false);
  const [addMois, setAddMois] = useState(moisDisponibles[0] || curMonth);
  const [addPct, setAddPct] = useState(p.commissionPct ?? 0);
  const gen = () => { if (!addMois) return; setData((d) => { const vs = d.versements || []; if (vs.some((v) => v.mois === addMois)) return d; return { ...d, versements: [...vs, { id: uid(), mois: addMois, date: `${addMois}-10`, commissionPct: +addPct, statut: "en_attente" }] }; }); setAddOpen(false); };
  const marquer = (id) => setData((d) => ({ ...d, versements: (d.versements || []).map((v) => v.id === id ? { ...v, statut: "verse" } : v) }));
  const del = (id) => setData((d) => ({ ...d, versements: (d.versements || []).filter((v) => v.id !== id) }));

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3 text-sm">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-teal-50"><Banknote size={20} className="text-teal-700" /></div>
          <div className="min-w-0"><p className="text-slate-900"><span className="font-semibold">{gestionnaire}</span> <span className="text-slate-400">(gestionnaire)</span> → <span className="font-semibold">{proprietaire}</span> <span className="text-slate-400">(propriétaire)</span></p><p className="text-xs text-slate-400">Versement le 10 de chaque mois · {societe}</p></div>
        </div>
        <PrimaryBtn onClick={() => { setAddMois(moisDisponibles[0] || ""); setAddPct(p.commissionPct ?? 0); setAddOpen(true); }}><Plus size={16} /> Nouveau versement</PrimaryBtn>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-sm">
        {versements.length === 0 ? <div className="px-5 py-10 text-center text-sm text-slate-400">Aucun versement.</div> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-slate-100 text-left text-xs font-medium uppercase tracking-wide text-slate-400"><th className="px-5 py-3">Période</th><th className="px-5 py-3">Date</th><th className="px-5 py-3 text-right">Recouvré</th><th className="px-5 py-3 text-right">Commission</th><th className="px-5 py-3 text-right">Net versé</th><th className="px-5 py-3">Statut</th><th className="px-5 py-3 text-right">Actions</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {versements.map((v) => { const c = calc(v); return (
                  <tr key={v.id} className="hover:bg-slate-50/60">
                    <td className="whitespace-nowrap px-5 py-3.5 font-medium text-slate-900">{cap(moisNom(v.mois))} {v.mois.slice(0, 4)}</td>
                    <td className="whitespace-nowrap px-5 py-3.5 text-slate-500">{v.date}</td>
                    <td className="px-5 py-3.5 text-right tabular-nums text-slate-900">{money(c.recouvre)}</td>
                    <td className="px-5 py-3.5 text-right tabular-nums text-slate-500">{money(c.commission)}</td>
                    <td className="px-5 py-3.5 text-right font-display font-semibold tabular-nums text-emerald-600">{money(c.net)}</td>
                    <td className="px-5 py-3.5">{v.statut === "verse" ? <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />Versé</span> : <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-600/20"><span className="h-1.5 w-1.5 rounded-full bg-amber-500" />En attente</span>}</td>
                    <td className="px-5 py-3.5"><div className="flex items-center justify-end gap-1">
                      <button onClick={() => setRecu(v)} className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-200"><Receipt size={14} /> Reçu</button>
                      {v.statut !== "verse" && <button onClick={() => marquer(v.id)} className="rounded-lg p-1.5 text-slate-400 hover:bg-emerald-50 hover:text-emerald-600" title="Marquer versé"><Check size={15} /></button>}
                      <button onClick={() => del(v.id)} className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"><Trash2 size={15} /></button>
                    </div></td>
                  </tr>
                ); })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <VersementRecuModal versement={recu} data={data} onClose={() => setRecu(null)} />

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Nouveau versement">
        <div className="space-y-4">
          {moisDisponibles.length === 0 ? (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">Les 8 derniers mois ont déjà un versement enregistré. Supprimez-en un pour en recréer un, ou attendez le prochain cycle.</p>
          ) : (
            <>
              <Field label="Période (cycle recouvré)"><select className={inputCls} value={addMois} onChange={(e) => setAddMois(e.target.value)}>{moisDisponibles.map((m) => <option key={m} value={m}>{cap(moisNom(m))} {m.slice(0, 4)}</option>)}</select></Field>
              <Field label="Commission gestionnaire (%)"><input type="number" inputMode="numeric" min="0" max="100" className={inputCls} value={addPct || ""} placeholder="0" onChange={(e) => setAddPct(Math.max(0, Math.min(100, +e.target.value)))} /></Field>
              <p className="text-xs text-slate-400">Le montant recouvré est calculé automatiquement à partir des loyers encaissés du cycle.</p>
            </>
          )}
        </div>
        <div className="mt-6 flex justify-end gap-2"><GhostBtn onClick={() => setAddOpen(false)}>Annuler</GhostBtn><PrimaryBtn onClick={gen} disabled={!addMois}>Créer le versement</PrimaryBtn></div>
      </Modal>
    </div>
  );
}

/* ============================ Rapports ============================ */
function Rapports({ data, isDark }) {
  const gridColor = isDark ? "#334155" : "#f1f5f9";
  const tickColor = "#94a3b8";
  const tooltipStyle = { borderRadius: 12, border: `1px solid ${isDark ? "#334155" : "#e2e8f0"}`, fontSize: 12, background: isDark ? "#1e293b" : "#fff", color: isDark ? "#f1f5f9" : "#0f172a" };
  const modeOf = (id) => data.immeubles.find((i) => i.id === id)?.mode;
  const serie = Array.from({ length: 6 }, (_, i) => {
    const X = shiftMonth(curMonth, -(5 - i));
    const paie = [...data.paiements.filter((p) => modeOf(p.immeubleId) === "avance" && p.mois === X), ...data.paiements.filter((p) => modeOf(p.immeubleId) === "echu" && p.mois === shiftMonth(X, -1))];
    const du = paie.reduce((s, p) => s + p.montant, 0);
    const enc = paie.filter((p) => p.statut === "paye").reduce((s, p) => s + p.montant, 0);
    const dep = (data.depenses || []).filter((d) => d.date.slice(0, 7) === X).reduce((s, d) => s + d.montant, 0);
    return { mois: cap(moisCourt(X)), du, enc, dep, net: enc - dep };
  });
  const totalEnc = serie.reduce((s, x) => s + x.enc, 0);
  const totalDep = serie.reduce((s, x) => s + x.dep, 0);
  const totalDu = serie.reduce((s, x) => s + x.du, 0);
  const net = totalEnc - totalDep;
  const taux = totalDu ? Math.round((totalEnc / totalDu) * 100) : 0;

  const debut = shiftMonth(curMonth, -5);
  const parCat = {};
  (data.depenses || []).filter((d) => d.date.slice(0, 7) >= debut).forEach((d) => { parCat[d.categorie] = (parCat[d.categorie] || 0) + d.montant; });
  const cats = Object.entries(parCat).sort((a, b) => b[1] - a[1]);
  const maxCat = cats.length ? cats[0][1] : 1;

  const cards = [
    { label: "Revenus (6 mois)", value: moneyC(totalEnc), tint: "text-teal-700" },
    { label: "Dépenses (6 mois)", value: moneyC(totalDep), tint: "text-rose-600" },
    { label: "Résultat net", value: moneyC(net), tint: net >= 0 ? "text-emerald-600" : "text-rose-600" },
    { label: "Taux de recouvrement", value: `${taux}%`, tint: "text-slate-900" },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm">
            <div className="text-xs font-medium text-slate-500">{c.label}</div>
            <div className={`mt-2 font-display text-xl font-semibold tabular-nums lg:text-2xl ${c.tint}`}>{c.value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm lg:col-span-2">
          <h3 className="mb-4 font-display text-base font-semibold text-slate-900">Revenus, dépenses & net</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={serie} margin={{ top: 6, right: 0, left: -8, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke={gridColor} />
              <XAxis dataKey="mois" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: tickColor }} />
              <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: tickColor }} tickFormatter={(v) => (v >= 1e6 ? `${v / 1e6}M` : v)} />
              <Tooltip formatter={(v, n) => [money(v), n === "enc" ? "Encaissé" : n === "dep" ? "Dépenses" : "Net"]} contentStyle={tooltipStyle} />
              <Bar dataKey="enc" fill="#0f766e" radius={[6, 6, 0, 0]} maxBarSize={20} />
              <Bar dataKey="dep" fill="#fb7185" radius={[6, 6, 0, 0]} maxBarSize={20} />
              <Bar dataKey="net" fill="#34d399" radius={[6, 6, 0, 0]} maxBarSize={20} />
            </BarChart>
          </ResponsiveContainer>
          <div className="mt-2 flex flex-wrap justify-center gap-4 text-xs text-slate-500">
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-teal-700" />Encaissé</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-rose-400" />Dépenses</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-400" />Net</span>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm">
          <h3 className="mb-4 font-display text-base font-semibold text-slate-900">Dépenses par catégorie</h3>
          {cats.length === 0 ? <p className="text-sm text-slate-400">Aucune dépense sur la période.</p> : (
            <div className="space-y-3">
              {cats.map(([c, v]) => (
                <div key={c}>
                  <div className="mb-1 flex items-center justify-between text-xs"><span className="text-slate-600">{c}</span><span className="font-medium tabular-nums text-slate-900">{moneyC(v)}</span></div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-rose-400" style={{ width: `${Math.round((v / maxCat) * 100)}%` }} /></div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ============================ Dépenses ============================ */
/* ============================ Reçus ============================ */
function Recus({ data, go }) {
  const [tab, setTab] = useState("quittances");
  const [mois, setMois] = useState("all");
  const [immeuble, setImmeuble] = useState("all");
  const [quittance, setQuittance] = useState(null);
  const [recu, setRecu] = useState(null);

  const nom = (id) => { const l = data.locataires.find((x) => x.id === id); return l ? `${l.prenom} ${l.nom}` : "—"; };
  const localNom = (id) => data.locaux.find((x) => x.id === id)?.nom || "—";
  const imNom = (id) => data.immeubles.find((x) => x.id === id)?.nom || "—";

  const moisDisponibles = Array.from(new Set(data.paiements.filter((p) => p.statut === "paye").map((p) => p.mois))).sort((a, b) => b.localeCompare(a));
  const quittances = data.paiements
    .filter((p) => p.statut === "paye")
    .filter((p) => mois === "all" || p.mois === mois)
    .filter((p) => immeuble === "all" || p.immeubleId === immeuble)
    .sort((a, b) => (b.datePaiement || "").localeCompare(a.datePaiement || ""));
  const versements = (data.versements || []).slice().sort((a, b) => b.mois.localeCompare(a.mois));

  return (
    <div className="space-y-4">
      <div className="flex rounded-xl border border-slate-200 bg-white p-1">
        <button onClick={() => setTab("quittances")} className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${tab === "quittances" ? "bg-teal-700 text-white" : "text-slate-500 hover:text-slate-800"}`}><Receipt size={14} /> Quittances de loyer</button>
        <button onClick={() => setTab("versements")} className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${tab === "versements" ? "bg-teal-700 text-white" : "text-slate-500 hover:text-slate-800"}`}><Banknote size={14} /> Reçus de versement</button>
      </div>

      {tab === "quittances" ? (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <select className={`${inputCls} w-auto`} value={mois} onChange={(e) => setMois(e.target.value)}>
              <option value="all">Tous les mois</option>
              {moisDisponibles.map((m) => <option key={m} value={m}>{cap(moisLong(m))}</option>)}
            </select>
            <select className={`${inputCls} w-auto`} value={immeuble} onChange={(e) => setImmeuble(e.target.value)}>
              <option value="all">Tous les immeubles</option>
              {data.immeubles.map((im) => <option key={im.id} value={im.id}>{im.nom}</option>)}
            </select>
            <span className="ml-auto text-sm text-slate-500">{quittances.length} quittance{quittances.length > 1 ? "s" : ""}</span>
          </div>
          <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-sm">
            {quittances.length === 0 ? (
              <div className="px-5 py-10 text-center text-sm text-slate-400">Aucune quittance pour ce filtre.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-slate-100 text-left text-xs font-medium uppercase tracking-wide text-slate-400"><th className="px-5 py-3">Locataire</th><th className="px-5 py-3">Local</th><th className="px-5 py-3">Immeuble</th><th className="px-5 py-3">Mois</th><th className="px-5 py-3">Payé le</th><th className="px-5 py-3 text-right">Montant</th><th className="px-5 py-3 text-right">Action</th></tr></thead>
                  <tbody className="divide-y divide-slate-100">
                    {quittances.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-50/60">
                        <td className="px-5 py-3.5"><button onClick={() => go("locataire", p.locataireId)} className="font-medium text-slate-900 hover:text-teal-700">{nom(p.locataireId)}</button></td>
                        <td className="px-5 py-3.5 text-slate-500"><button onClick={() => go("local", p.localId)} className="hover:text-teal-700">{localNom(p.localId)}</button></td>
                        <td className="px-5 py-3.5 text-slate-500">{imNom(p.immeubleId)}</td>
                        <td className="px-5 py-3.5 text-slate-500">{cap(moisNom(p.mois))} {p.mois.slice(0, 4)}</td>
                        <td className="whitespace-nowrap px-5 py-3.5 text-slate-500">{p.datePaiement || "—"}</td>
                        <td className="px-5 py-3.5 text-right font-display font-semibold tabular-nums text-slate-900">{money(p.montant)}</td>
                        <td className="px-5 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {(() => { const tel = data.locataires.find((x) => x.id === p.locataireId)?.telephone; const msg = `Bonjour ${nom(p.locataireId)}, confirmation de réception de votre loyer pour ${moisLong(p.mois)} : ${money(p.montant)}, payé le ${p.datePaiement}.${arrieresLocataire(data, p.locataireId, p.id).note} Merci ! — ${signatureGestionnaire(data)}`; return (
                              <a href={tel ? waLink(tel, msg) : undefined} target="_blank" rel="noopener noreferrer" onClick={(e) => { if (!tel) e.preventDefault(); }} title={tel ? "Envoyer par WhatsApp" : "Aucun numéro enregistré"} className={`inline-flex items-center rounded-lg px-2 py-1.5 text-xs font-medium text-white ${tel ? "bg-emerald-600 hover:bg-emerald-700" : "cursor-not-allowed bg-slate-200 text-slate-400"}`}><MessageCircle size={14} /></a>
                            ); })()}
                            <button onClick={() => { const { bytes, fichier } = genererQuittancePdf(p, data); telechargerPdf(bytes, fichier); }} title="Télécharger la quittance en PDF" className="inline-flex items-center rounded-lg bg-teal-50 px-2 py-1.5 text-xs font-medium text-teal-700 hover:bg-teal-100"><Download size={14} /></button>
                            <button onClick={() => setQuittance(p)} className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-200"><Receipt size={14} /> Voir</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-sm">
          {versements.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-slate-400">Aucun versement enregistré. <button onClick={() => go("versements")} className="font-medium text-teal-700 underline">Créer un versement</button></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-slate-100 text-left text-xs font-medium uppercase tracking-wide text-slate-400"><th className="px-5 py-3">Période</th><th className="px-5 py-3">Date</th><th className="px-5 py-3">Statut</th><th className="px-5 py-3 text-right">Action</th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {versements.map((v) => (
                    <tr key={v.id} className="hover:bg-slate-50/60">
                      <td className="px-5 py-3.5 font-medium text-slate-900">{cap(moisNom(v.mois))} {v.mois.slice(0, 4)}</td>
                      <td className="whitespace-nowrap px-5 py-3.5 text-slate-500">{v.date}</td>
                      <td className="px-5 py-3.5">{v.statut === "verse" ? <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />Versé</span> : <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-600/20"><span className="h-1.5 w-1.5 rounded-full bg-amber-500" />En attente</span>}</td>
                      <td className="px-5 py-3.5 text-right"><button onClick={() => setRecu(v)} className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-200"><Receipt size={14} /> Voir</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <QuittanceModal paiement={quittance} data={data} onClose={() => setQuittance(null)} />
      <VersementRecuModal versement={recu} data={data} onClose={() => setRecu(null)} />
    </div>
  );
}

/* ============================ Dépenses ============================ */
function Depenses({ data, setData, go }) {
  const cats = ["Entretien", "Réparation", "Taxe", "Eau/Électricité", "Gardiennage", "Assurance", "Autre"];
  const [edit, setEdit] = useState(null);
  const [filtreIm, setFiltreIm] = useState("all");
  const blank = { immeubleId: data.immeubles[0]?.id || "", localId: "", categorie: "Entretien", libelle: "", montant: 0, date: new Date().toISOString().slice(0, 10) };
  const [form, setForm] = useState(blank);
  const imNom = (id) => data.immeubles.find((x) => x.id === id)?.nom || "—";
  const localNom = (id) => data.locaux.find((x) => x.id === id)?.nom;
  const list = (data.depenses || []).filter((d) => filtreIm === "all" || d.immeubleId === filtreIm).sort((a, b) => b.date.localeCompare(a.date));
  const total = list.reduce((s, d) => s + d.montant, 0);
  const open = (d) => { setEdit(d ? d.id : "new"); setForm(d ? { ...d, localId: d.localId || "" } : blank); };
  const save = () => { if (!form.libelle.trim()) return; setData((dd) => { const dep = dd.depenses || []; const rec = { ...form, localId: form.localId || null, montant: +form.montant }; return { ...dd, depenses: edit === "new" ? [...dep, { ...rec, id: uid() }] : dep.map((x) => x.id === edit ? { ...rec, id: edit } : x) }; }); setEdit(null); };
  const del = (id) => setData((dd) => ({ ...dd, depenses: (dd.depenses || []).filter((x) => x.id !== id) }));

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <select className={`${inputCls} w-auto`} value={filtreIm} onChange={(e) => setFiltreIm(e.target.value)}>
          <option value="all">Tous les immeubles</option>
          {data.immeubles.map((im) => <option key={im.id} value={im.id}>{im.nom}</option>)}
        </select>
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-500">Total <span className="font-display font-semibold tabular-nums text-rose-600">{money(total)}</span></span>
          <PrimaryBtn onClick={() => open(null)}><Plus size={16} /> Ajouter</PrimaryBtn>
        </div>
      </div>
      <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-sm">
        {list.length === 0 ? <div className="px-5 py-10 text-center text-sm text-slate-400">Aucune dépense.</div> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-slate-100 text-left text-xs font-medium uppercase tracking-wide text-slate-400">
                <th className="px-5 py-3">Date</th><th className="px-5 py-3">Catégorie</th><th className="px-5 py-3">Libellé</th><th className="px-5 py-3">Immeuble</th><th className="px-5 py-3 text-right">Montant</th><th className="px-5 py-3"></th>
              </tr></thead>
              <tbody className="divide-y divide-slate-100">
                {list.map((d) => (
                  <tr key={d.id} className="group hover:bg-slate-50/60">
                    <td className="whitespace-nowrap px-5 py-3.5 text-slate-500">{d.date}</td>
                    <td className="px-5 py-3.5"><span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600"><Tag size={11} />{d.categorie}</span></td>
                    <td className="px-5 py-3.5 font-medium text-slate-900">{d.libelle}</td>
                    <td className="px-5 py-3.5 text-slate-500"><button onClick={() => go("immeuble", d.immeubleId)} className="hover:text-teal-700">{imNom(d.immeubleId)}</button>{d.localId ? <span className="text-slate-400"> · {localNom(d.localId)}</span> : null}</td>
                    <td className="whitespace-nowrap px-5 py-3.5 text-right font-display font-semibold tabular-nums text-rose-600">{money(d.montant)}</td>
                    <td className="px-5 py-3.5"><div className="flex justify-end gap-1 opacity-0 transition group-hover:opacity-100"><button onClick={() => open(d)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><Pencil size={15} /></button><button onClick={() => del(d.id)} className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"><Trash2 size={15} /></button></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit === "new" ? "Nouvelle dépense" : "Modifier la dépense"} wide>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Immeuble"><select className={inputCls} value={form.immeubleId} onChange={(e) => setForm({ ...form, immeubleId: e.target.value, localId: "" })}>{data.immeubles.map((im) => <option key={im.id} value={im.id}>{im.nom}</option>)}</select></Field>
          <Field label="Local (optionnel)"><select className={inputCls} value={form.localId} onChange={(e) => setForm({ ...form, localId: e.target.value })}><option value="">— tout l'immeuble —</option>{data.locaux.filter((l) => l.immeubleId === form.immeubleId).map((l) => <option key={l.id} value={l.id}>{l.nom}</option>)}</select></Field>
          <Field label="Catégorie"><select className={inputCls} value={form.categorie} onChange={(e) => setForm({ ...form, categorie: e.target.value })}>{cats.map((c) => <option key={c}>{c}</option>)}</select></Field>
          <Field label="Date"><DateField value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
          <div className="sm:col-span-2"><Field label="Libellé"><input className={inputCls} value={form.libelle} onChange={(e) => setForm({ ...form, libelle: e.target.value })} placeholder="Réparation plomberie…" /></Field></div>
          <Field label="Montant (GNF)"><input type="number" inputMode="numeric" className={inputCls} value={form.montant || ""} placeholder="0" onChange={(e) => setForm({ ...form, montant: +e.target.value })} /></Field>
        </div>
        <div className="mt-6 flex justify-end gap-2"><GhostBtn onClick={() => setEdit(null)}>Annuler</GhostBtn><PrimaryBtn onClick={save}>Enregistrer</PrimaryBtn></div>
      </Modal>
    </div>
  );
}

/* ============================ Documents ============================ */
function Documents({ data, setData, go }) {
  const cats = DOC_CATS;
  const [edit, setEdit] = useState(null);
  const blank = { localId: "", locataireId: "", categorie: "Bail", nom: "", date: new Date().toISOString().slice(0, 10) };
  const [form, setForm] = useState(blank);
  const list = (data.documents || []).slice().sort((a, b) => b.date.localeCompare(a.date));
  const localNom = (id) => data.locaux.find((x) => x.id === id)?.nom;
  const locNom = (id) => { const t = data.locataires.find((x) => x.id === id); return t ? `${t.prenom} ${t.nom}` : null; };
  const open = (d) => { setEdit(d ? d.id : "new"); setForm(d ? { ...d, localId: d.localId || "", locataireId: d.locataireId || "" } : blank); };
  const save = () => { if (!form.nom.trim()) return; setData((dd) => { const docs = dd.documents || []; const rec = { ...form, localId: form.localId || null, locataireId: form.locataireId || null }; return { ...dd, documents: edit === "new" ? [...docs, { ...rec, id: uid() }] : docs.map((x) => x.id === edit ? { ...rec, id: edit } : x) }; }); setEdit(null); };
  const del = (id) => setData((dd) => ({ ...dd, documents: (dd.documents || []).filter((x) => x.id !== id) }));
  const catCls = DOC_CAT_CLS;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-slate-500">{list.length} document(s)</p>
        <PrimaryBtn onClick={() => open(null)}><Plus size={16} /> Ajouter un document</PrimaryBtn>
      </div>
      <div className="mb-4 flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500"><Upload size={14} className="mt-0.5 shrink-0 text-slate-400" /><span>En démo, seuls les libellés sont enregistrés. Le téléversement des fichiers se fera via Supabase Storage une fois l'app connectée.</span></div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((d) => (
          <div key={d.id} className="group rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm transition hover:shadow-md">
            <div className="flex items-start justify-between">
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-slate-100"><FileText size={20} className="text-slate-500" /></div>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${catCls[d.categorie] || "bg-slate-100 text-slate-600"}`}>{d.categorie}</span>
            </div>
            <h3 className="mt-3 truncate font-display font-semibold text-slate-900">{d.nom}</h3>
            <div className="mt-1 space-y-0.5 text-xs text-slate-400">
              {d.localId && <button onClick={() => go("local", d.localId)} className="block truncate hover:text-teal-700">{localNom(d.localId)}</button>}
              {d.locataireId && <button onClick={() => go("locataire", d.locataireId)} className="block truncate hover:text-teal-700">{locNom(d.locataireId)}</button>}
              <span className="block">{d.date}</span>
            </div>
            <div className="mt-3 flex justify-end gap-1 border-t border-slate-100 pt-3 opacity-0 transition group-hover:opacity-100">
              <button onClick={() => open(d)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><Pencil size={15} /></button>
              <button onClick={() => del(d.id)} className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"><Trash2 size={15} /></button>
            </div>
          </div>
        ))}
      </div>
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit === "new" ? "Nouveau document" : "Modifier le document"} wide>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2"><Field label="Nom du document"><input className={inputCls} value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} placeholder="Contrat de bail — …" /></Field></div>
          <Field label="Catégorie"><select className={inputCls} value={form.categorie} onChange={(e) => setForm({ ...form, categorie: e.target.value })}>{cats.map((c) => <option key={c}>{c}</option>)}</select></Field>
          <Field label="Date"><DateField value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
          <Field label="Local (optionnel)"><select className={inputCls} value={form.localId} onChange={(e) => setForm({ ...form, localId: e.target.value })}><option value="">— aucun —</option>{data.locaux.map((l) => <option key={l.id} value={l.id}>{l.nom}</option>)}</select></Field>
          <Field label="Locataire (optionnel)"><select className={inputCls} value={form.locataireId} onChange={(e) => setForm({ ...form, locataireId: e.target.value })}><option value="">— aucun —</option>{data.locataires.map((t) => <option key={t.id} value={t.id}>{t.prenom} {t.nom}</option>)}</select></Field>
          <div className="sm:col-span-2"><div className="grid place-items-center rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 py-6 text-center text-xs text-slate-400"><Upload size={18} className="mb-1 text-slate-300" />Zone de téléversement (Supabase Storage) — active après connexion</div></div>
        </div>
        <div className="mt-6 flex justify-end gap-2"><GhostBtn onClick={() => setEdit(null)}>Annuler</GhostBtn><PrimaryBtn onClick={save}>Enregistrer</PrimaryBtn></div>
      </Modal>
    </div>
  );
}

/* ============================ Paramètres ============================ */
function Parametres({ data, setData, resetDemo, theme, setTheme }) {
  const p = data.parametres || {};
  const [form, setForm] = useState({ societe: p.societe || "", gerant: p.gerant || "", email: p.email || "", telephone: p.telephone || "", gestionnaire: p.gestionnaire || "", proprietaire: p.proprietaire || "", proprietaireTelephone: p.proprietaireTelephone || "", commissionPct: p.commissionPct ?? 0 });
  const [saved, setSaved] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const save = () => { setData((d) => ({ ...d, parametres: { ...(d.parametres || {}), ...form } })); setSaved(true); setTimeout(() => setSaved(false), 2000); };
  const stats = [
    { l: "Immeubles", v: data.immeubles.length }, { l: "Locaux", v: data.locaux.length },
    { l: "Locataires", v: data.locataires.length }, { l: "Documents", v: (data.documents || []).length },
  ];
  return (
    <div className="max-w-3xl space-y-5">
      <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm">
        <h3 className="font-display text-base font-semibold text-slate-900">Profil & société</h3>
        <p className="mt-0.5 text-xs text-slate-400">Ces informations pourront figurer sur vos quittances et documents.</p>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Société / gérance"><input className={inputCls} value={form.societe} onChange={(e) => setForm({ ...form, societe: e.target.value })} /></Field>
          <Field label="Gérant"><input className={inputCls} value={form.gerant} onChange={(e) => setForm({ ...form, gerant: e.target.value })} /></Field>
          <Field label="Email"><input className={inputCls} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
          <Field label="Téléphone"><input className={inputCls} value={form.telephone} onChange={(e) => setForm({ ...form, telephone: e.target.value })} /></Field>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <PrimaryBtn onClick={save}>Enregistrer</PrimaryBtn>
          {saved && <span className="flex items-center gap-1 text-sm text-emerald-600"><Check size={15} /> Enregistré</span>}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm">
        <h3 className="font-display text-base font-semibold text-slate-900">Versements — parties</h3>
        <p className="mt-0.5 text-xs text-slate-400">Utilisées sur les reçus de versement (remise du 10 de chaque mois).</p>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Gestionnaire"><input className={inputCls} value={form.gestionnaire} onChange={(e) => setForm({ ...form, gestionnaire: e.target.value })} /></Field>
          <Field label="Propriétaire"><input className={inputCls} value={form.proprietaire} onChange={(e) => setForm({ ...form, proprietaire: e.target.value })} /></Field>
          <Field label="Téléphone du propriétaire"><input className={inputCls} value={form.proprietaireTelephone} onChange={(e) => setForm({ ...form, proprietaireTelephone: e.target.value })} placeholder="+224 ..." /></Field>
          <Field label="Commission gestionnaire (%)"><input type="number" inputMode="numeric" min="0" max="100" className={inputCls} value={form.commissionPct || ""} placeholder="0" onChange={(e) => setForm({ ...form, commissionPct: Math.max(0, Math.min(100, +e.target.value)) })} /></Field>
        </div>
        <div className="mt-4 flex items-center gap-3"><PrimaryBtn onClick={save}>Enregistrer</PrimaryBtn>{saved && <span className="flex items-center gap-1 text-sm text-emerald-600"><Check size={15} /> Enregistré</span>}</div>
      </div>

      <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm">
        <h3 className="font-display text-base font-semibold text-slate-900">Apparence</h3>
        <p className="mt-0.5 text-xs text-slate-400">Choisissez l'affichage clair ou sombre, ou laissez l'application suivre le réglage de votre téléphone.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {[{ k: "light", l: "Clair", icon: Sun }, { k: "dark", l: "Sombre", icon: Moon }, { k: "system", l: "Système", icon: Monitor }].map((o) => (
            <button key={o.k} onClick={() => setTheme(o.k)} className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition ${theme === o.k ? "border-teal-600 bg-teal-50 text-teal-800" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}>
              <o.icon size={16} />{o.l}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm">
        <h3 className="font-display text-base font-semibold text-slate-900">Application</h3>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MiniStat label="Monnaie" value="GNF" />
          <MiniStat label="Jour d'échéance" value="Le 5" />
          {stats.map((s) => <MiniStat key={s.l} label={s.l} value={s.v} />)}
        </div>
        <p className="mt-3 text-xs text-slate-400">Règle de recouvrement : le 5 de chaque mois. Immeubles « en avance » = loyer du mois courant ; « terme échu » = loyer du mois précédent.</p>
      </div>

      <div className="rounded-2xl border border-rose-200 bg-rose-50/50 p-6">
        <h3 className="font-display text-base font-semibold text-rose-700">Zone sensible</h3>
        <p className="mt-0.5 text-xs text-rose-600/80">Réinitialise toutes les données locales et recharge le jeu de démonstration.</p>
        {!confirm ? (
          <button onClick={() => setConfirm(true)} className="mt-4 inline-flex items-center gap-2 rounded-xl border border-rose-300 bg-white px-4 py-2.5 text-sm font-semibold text-rose-600 hover:bg-rose-50"><RotateCcw size={15} /> Réinitialiser les données</button>
        ) : (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="text-sm text-rose-700">Confirmer ?</span>
            <button onClick={() => { resetDemo(); setConfirm(false); }} className="rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-rose-700">Oui, réinitialiser</button>
            <GhostBtn onClick={() => setConfirm(false)}>Annuler</GhostBtn>
          </div>
        )}
      </div>
    </div>
  );
}

/* ============================ Assistant vocal ============================ */
function buildContext(data) {
  const modeOf = (id) => data.immeubles.find((i) => i.id === id)?.mode;
  const imNom = (id) => data.immeubles.find((i) => i.id === id)?.nom || "?";
  const nom = (id) => { const l = data.locataires.find((x) => x.id === id); return l ? `${l.prenom} ${l.nom}` : "?"; };
  const sum = (a) => a.reduce((s, p) => s + p.montant, 0);
  const av = data.paiements.filter((p) => modeOf(p.immeubleId) === "avance" && p.mois === moisAvance);
  const ec = data.paiements.filter((p) => modeOf(p.immeubleId) === "echu" && p.mois === moisEchu);
  return {
    echeance: echeanceLabel, devise: "GNF",
    depenses_mois: (data.depenses || []).filter((d) => d.date.slice(0, 7) === curMonth).reduce((s, d) => s + d.montant, 0),
    nb_documents: (data.documents || []).length,
    nb_rappels_envoyes: (data.rappels || []).length,
    versement_du_10: (data.versements || []).find((v) => v.mois === curMonth) || null,
    parties_versement: { gestionnaire: data.parametres?.gestionnaire, proprietaire: data.parametres?.proprietaire },
    immeubles: data.immeubles.map((i) => ({ nom: i.nom, mode: i.mode === "avance" ? "en avance" : "terme échu" })),
    locaux: data.locaux.map((l) => {
      const occ = data.locataires.find((t) => t.localId === l.id);
      return { nom: l.nom, immeuble: imNom(l.immeubleId), bloc: l.bloc || null, type: l.type, statut: l.statut, loyer: l.loyer + l.charges, occupant: occ ? `${occ.prenom} ${occ.nom}` : null };
    }),
    locataires: data.locataires.map((t) => ({ nom: `${t.prenom} ${t.nom}`, telephone: t.telephone || null, local: data.locaux.find((l) => l.id === t.localId)?.nom || null })),
    recouvrement: {
      [`${moisNom(moisEchu)}_echu`]: { encaisse: sum(ec.filter((p) => p.statut === "paye")), du: sum(ec) },
      [`${moisNom(moisAvance)}_avance`]: { encaisse: sum(av.filter((p) => p.statut === "paye")), du: sum(av) },
      encaisse_total: sum([...av, ...ec].filter((p) => p.statut === "paye")),
      locataires_en_retard: [...av, ...ec].filter((p) => p.statut !== "paye").map((p) => `${nom(p.locataireId)} (${moisNom(p.mois)})`),
    },
  };
}
function VoiceAssistant({ data, setData, go, openPaie }) {
  const [open, setOpen] = useState(false);
  const [listening, setListening] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [voiceOn, setVoiceOn] = useState(true);
  const [log, setLog] = useState([]);
  const [text, setText] = useState("");
  const recRef = useRef(null);
  const scrollRef = useRef(null);
  const supported = typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition);
  useBackClose(open, () => setOpen(false));
  useEffect(() => { scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight); }, [log, thinking]);

  const speak = (t) => { if (!voiceOn || !window.speechSynthesis) return; try { const u = new SpeechSynthesisUtterance(t); u.lang = "fr-FR"; window.speechSynthesis.cancel(); window.speechSynthesis.speak(u); } catch {} };

  const execute = (action, params = {}) => {
    const vueMap = { dashboard: "dashboard", tableau: "dashboard", immeubles: "immeubles", immeuble: "immeubles", locaux: "locaux", local: "locaux", locataires: "locataires", locataire: "locataires", paiements: "paiements", loyers: "paiements", recouvrement: "recouvrement", recouvrements: "recouvrement", retards: "retards", retard: "retards", "en retard": "retards", impayes: "retards", "impayés": "retards", rappels: "rappels", rappel: "rappels", versements: "versements", versement: "versements", recus: "recus", "reçus": "recus", "reçu": "recus", quittance: "recus", quittances: "recus", depenses: "depenses", "dépenses": "depenses", charges: "depenses", documents: "documents", document: "documents", rapports: "rapports", rapport: "rapports", parametres: "parametres", "paramètres": "parametres", reglages: "parametres" };
    // Résout un locataire à partir de ce que l'IA a extrait — un nom ("Docteur Mamy")
    // ou un numéro de local ("A21", "B11", "C1", "R20"...). On cherche d'abord un local
    // correspondant (exact, puis approché) et on prend son occupant ; à défaut, on
    // cherche directement par nom de locataire.
    const trouverLocataire = (q) => {
      const query = (q || "").trim();
      if (!query) return null;
      const ql = query.toLowerCase();
      const local = data.locaux.find((l) => l.nom.toLowerCase() === ql) || data.locaux.find((l) => l.nom.toLowerCase().includes(ql));
      if (local) { const occ = data.locataires.find((t) => t.localId === local.id); if (occ) return occ; }
      return data.locataires.find((l) => `${l.prenom} ${l.nom}`.toLowerCase().includes(ql));
    };
    const parseMontant = (m) => { const n = +String(m || "").replace(/[^\d]/g, ""); return n > 0 ? n : null; };
    const parseMois = (m) => (/^\d{4}-\d{2}$/.test(m || "") ? m : null);
    const ouvrirWhatsapp = (tel, message, label) => {
      if (!tel) return null;
      const href = waLink(tel, message);
      try { window.open(href, "_blank"); } catch {}
      return { waHref: href, waLabel: label }; // lien de secours affiché dans le journal, au cas où le navigateur bloque l'ouverture automatique
    };

    // Enregistre/actualise le paiement d'un local en "payé", puis génère, télécharge et
    // prépare l'envoi WhatsApp de la quittance — le cœur de "L'IA doit enregistrer des
    // paiements et générer/envoyer les quittances automatiquement".
    const enregistrerPaiement = (locataire, moisParam, montantParam) => {
      const local = data.locaux.find((l) => l.id === locataire.localId);
      if (!local) return null;
      const im = data.immeubles.find((i) => i.id === local.immeubleId);
      const mois = parseMois(moisParam) || (im?.mode === "avance" ? moisAvance : moisEchu);
      const montant = parseMontant(montantParam) || (local.loyer + local.charges);
      const existant = data.paiements.find((p) => p.localId === local.id && p.mois === mois);
      const paiement = { id: existant?.id || uid(), localId: local.id, immeubleId: local.immeubleId, locataireId: locataire.id, mois, montant, statut: "paye", datePaiement: new Date().toISOString().slice(0, 10) };
      const paiementsApres = existant ? data.paiements.map((p) => (p.id === existant.id ? paiement : p)) : [...data.paiements, paiement];
      setData((d) => ({ ...d, paiements: existant ? d.paiements.map((p) => (p.id === existant.id ? paiement : p)) : [...d.paiements, paiement] }));
      const ancreCycle = im?.mode === "echu" ? shiftMonth(mois, 1) : mois;
      openPaie({ mois: ancreCycle, immeuble: "all", statut: "tous" });

      const dataApres = { ...data, paiements: paiementsApres };
      const { bytes, fichier } = genererQuittancePdf(paiement, dataApres);
      telechargerPdf(bytes, fichier);
      const { note } = arrieresLocataire(dataApres, locataire.id, paiement.id);
      const message = `Bonjour ${locataire.prenom} ${locataire.nom}, voici la confirmation de réception de votre loyer pour ${moisLong(mois)} : ${money(montant)} (local ${local.nom}), payé le ${paiement.datePaiement}.${note} Merci ! — ${signatureGestionnaire(data)}`;
      return ouvrirWhatsapp(locataire.telephone, message, `Envoyer la quittance à ${locataire.prenom} ${locataire.nom}`);
    };

    if (action === "naviguer") { go(vueMap[(params.vue || "").toLowerCase()] || "dashboard"); return null; }

    if (action === "filtrer_loyers") {
      const statut = params.statut === "en_retard" || params.statut === "impayes" ? "impayes" : params.statut === "paye" ? "paye" : "tous";
      if (statut === "impayes") go("retards"); else openPaie({ mois: curMonth, immeuble: "all", statut });
      return null;
    }

    if (action === "enregistrer_paiement" || action === "marquer_paye") {
      const locataire = trouverLocataire(params.locataire);
      if (!locataire || !locataire.localId) return null;
      return enregistrerPaiement(locataire, params.mois, params.montant);
    }

    if (action === "envoyer_quittance") {
      const locataire = trouverLocataire(params.locataire);
      if (!locataire) return null;
      const dernier = data.paiements.filter((p) => p.locataireId === locataire.id && p.statut === "paye").sort((a, b) => b.mois.localeCompare(a.mois))[0];
      if (!dernier) return null;
      const { bytes, fichier } = genererQuittancePdf(dernier, data);
      telechargerPdf(bytes, fichier);
      const { note } = arrieresLocataire(data, locataire.id, dernier.id);
      const local = data.locaux.find((l) => l.id === dernier.localId);
      const message = `Bonjour ${locataire.prenom} ${locataire.nom}, voici la confirmation de réception de votre loyer pour ${moisLong(dernier.mois)} : ${money(dernier.montant)} (local ${local?.nom}), payé le ${dernier.datePaiement}.${note} Merci ! — ${signatureGestionnaire(data)}`;
      return ouvrirWhatsapp(locataire.telephone, message, `Renvoyer à ${locataire.prenom} ${locataire.nom}`);
    }

    if (action === "creer_versement") {
      const moisDisponibles = Array.from({ length: 8 }, (_, i) => shiftMonth(curMonth, -i)).filter((m) => !(data.versements || []).some((v) => v.mois === m));
      const mois = parseMois(params.mois) || moisDisponibles[moisDisponibles.length - 1] || curMonth;
      const versement = { id: uid(), mois, date: `${mois}-10`, commissionPct: data.parametres?.commissionPct || 0, statut: "en_attente" };
      setData((d) => ({ ...d, versements: [...(d.versements || []), versement] }));
      go("versements");
      const dataApres = { ...data, versements: [...(data.versements || []), versement] };
      const { bytes, fichier } = genererVersementPdf(versement, dataApres);
      telechargerPdf(bytes, fichier);
      const c = calcVersement(versement, dataApres);
      const message = `Versement du ${versement.date} — période ${cap(moisNom(mois))} ${mois.slice(0, 4)} : ${money(c.recouvre)} recouvré, ${money(c.net)} net transmis. — ${signatureGestionnaire(data)}`;
      return ouvrirWhatsapp(data.parametres?.proprietaireTelephone, message, "Envoyer le reçu au propriétaire");
    }

    if (action === "ajouter_locataire") {
      if (!(params.nom || "").trim() && !(params.prenom || "").trim()) return null;
      setData((d) => {
        const vacant = d.locaux.find((l) => l.statut === "vacant");
        const locaux = vacant ? d.locaux.map((l) => l.id === vacant.id ? { ...l, statut: "loue" } : l) : d.locaux;
        return { ...d, locaux, locataires: [...d.locataires, { id: uid(), nom: params.nom || "", prenom: params.prenom || "", email: params.email || "", telephone: params.telephone || "", localId: vacant?.id || null, dateEntree: curMonth + "-01" }] };
      });
      go("locataires");
      return null;
    }

    return null;
  };

  const ask = async (userText) => {
    const clean = userText.trim(); if (!clean) return;
    setLog((l) => [...l, { role: "user", text: clean }]); setText(""); setThinking(true);
    const ctx = buildContext(data);
    const system = `Tu es l'assistant vocal de "DRAMÉ Gestion", une application de gestion locative en Guinée (monnaie : franc guinéen GNF).
Contexte de paiement : le 5 de chaque mois est la date butoir. À l'échéance du 5, deux recouvrements ont lieu : le mois précédent pour les immeubles à "terme échu", et le mois courant pour les immeubles "en avance".
Réponds en français, court et naturel (1-2 phrases). Les montants se disent en francs guinéens.
Réponds UNIQUEMENT avec un JSON valide, sans texte ni balise : {"reponse":"<phrase>","action":"<action>","params":{}}
Actions disponibles :
- "aucune" : répondre à une question avec les données fournies, sans agir.
- "naviguer" {"vue":"dashboard|immeubles|locaux|locataires|paiements|recouvrement|retards|rappels|versements|recus|depenses|documents|rapports|parametres"}
- "filtrer_loyers" {"statut":"paye|impayes"} : ouvre les paiements filtrés.
- "enregistrer_paiement" (ou "marquer_paye") {"locataire":"<nom du locataire OU numéro du local, ex: A21, B11, C1, R20>","montant":<optionnel, GNF>,"mois":<optionnel, format "AAAA-MM">} : enregistre le loyer comme payé (montant et mois par défaut = loyer du local et cycle en cours si non précisés), génère ET télécharge automatiquement la quittance PDF, puis prépare son envoi WhatsApp au locataire concerné. Le champ "locataire" accepte indifféremment un nom ("Docteur Mamy") ou un numéro de local ("A21") — transmets exactement ce que la personne a dit, sans essayer de deviner toi-même qui occupe le local.
- "envoyer_quittance" {"locataire":"<nom ou numéro de local>"} : retélécharge et renvoie par WhatsApp la dernière quittance déjà payée de ce local/locataire, sans en créer une nouvelle.
- "creer_versement" {"mois":<optionnel, "AAAA-MM">} : crée le versement du cycle le plus ancien non encore fait, génère ET télécharge son reçu PDF, puis prépare son envoi WhatsApp au propriétaire.
- "ajouter_locataire" {"prenom","nom","email","telephone"} : crée un locataire, l'assigne au premier local vacant trouvé.
Si la demande ne correspond à aucune de ces actions, utilise "aucune" et explique brièvement dans "reponse" ce que tu ne peux pas encore faire — n'invente jamais une action qui n'est pas dans cette liste.
Données actuelles : ${JSON.stringify(ctx)}`;
    try {
      const res = await fetch("/.netlify/functions/assistant", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ system, message: clean }) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const d = await res.json();
      let raw = (d.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n").trim().replace(/```json/gi, "").replace(/```/g, "").trim();
      let parsed; try { parsed = JSON.parse(raw); } catch { parsed = { reponse: raw || "Je n'ai pas compris, reformulez ?", action: "aucune", params: {} }; }
      const rep = parsed.reponse || "C'est fait.";
      let extra = null;
      if (parsed.action && parsed.action !== "aucune") { try { extra = execute(parsed.action, parsed.params || {}); } catch {} }
      setLog((l) => [...l, { role: "ai", text: rep, ...(extra || {}) }]); speak(rep);
    } catch { const m = "Connexion à l'assistant impossible pour le moment."; setLog((l) => [...l, { role: "ai", text: m }]); speak(m); }
    finally { setThinking(false); }
  };

  const startListen = () => {
    if (!supported) return;
    const R = window.SpeechRecognition || window.webkitSpeechRecognition; const rec = new R();
    rec.lang = "fr-FR"; rec.interimResults = false; rec.maxAlternatives = 1;
    rec.onresult = (e) => ask(e.results[0][0].transcript);
    rec.onend = () => setListening(false); rec.onerror = () => setListening(false);
    recRef.current = rec; setListening(true); rec.start();
  };
  const stopListen = () => { recRef.current?.stop(); setListening(false); };
  const chips = ["Enregistre le paiement de Docteur Mamy", "Loyers en retard", "Combien encaissé au 5 " + moisNom(curMonth) + " ?", "Crée le versement du mois"];

  return (
    <>
      {open && (
        <>
          {/* Fond invisible : toucher n'importe où en dehors du panneau le referme. */}
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          {/* Ancré en haut ET en bas (pas seulement en bas) : le panneau ne peut donc
              jamais dépasser la hauteur de l'écran, quel que soit le contenu — l'en-tête
              (et son bouton ×) reste toujours atteignable. */}
          <div className="fixed inset-x-4 top-20 bottom-24 z-40 mx-auto flex max-w-sm flex-col overflow-hidden rounded-3xl border border-violet-200/60 bg-white shadow-2xl sm:left-auto sm:right-6">
            <div className="flex shrink-0 items-center justify-between bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-3 text-white">
              <div className="flex items-center gap-2"><Sparkles size={16} /><span className="font-display text-sm font-semibold">Assistant vocal</span></div>
              <div className="flex items-center gap-1">
                <button onClick={() => setVoiceOn((v) => !v)} className="rounded-full p-1.5 hover:bg-white/15">{voiceOn ? <Volume2 size={15} /> : <VolumeX size={15} />}</button>
                <button onClick={() => setOpen(false)} className="rounded-full p-1.5 hover:bg-white/15"><X size={15} /></button>
              </div>
            </div>
            <div ref={scrollRef} className="min-h-0 flex-1 space-y-2.5 overflow-y-auto bg-violet-50/40 px-4 py-3">
              {log.length === 0 && (
                <div className="pt-1"><p className="text-xs text-slate-500">Parlez ou écrivez. Essayez :</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">{chips.map((c) => <button key={c} onClick={() => ask(c)} className="rounded-full border border-violet-200 bg-white px-2.5 py-1 text-[11px] text-violet-700 hover:bg-violet-100">{c}</button>)}</div>
                </div>
              )}
              {log.map((m, i) => (
                <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${m.role === "user" ? "bg-violet-600 text-white" : "bg-white text-slate-700 ring-1 ring-slate-100"}`}>
                    <p>{m.text}</p>
                    {m.waHref && <a href={m.waHref} target="_blank" rel="noopener noreferrer" className="mt-1.5 inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-700"><MessageCircle size={12} /> {m.waLabel || "Ouvrir WhatsApp"}</a>}
                  </div>
                </div>
              ))}
              {thinking && <div className="flex justify-start"><div className="rounded-2xl bg-white px-3 py-2 text-sm text-slate-400 ring-1 ring-slate-100">réflexion…</div></div>}
            </div>
            <div className="flex shrink-0 items-center gap-2.5 border-t border-slate-100 p-3">
              <input className="min-w-0 flex-1 rounded-full border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm outline-none focus:border-violet-400 focus:bg-white" placeholder={supported ? "Écrire ou parler…" : "Écrire une demande…"} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && ask(text)} />
              {supported && <button onClick={listening ? stopListen : startListen} title={listening ? "Arrêter l'écoute" : "Parler à l'assistant"} className={`grid h-12 w-12 shrink-0 place-items-center rounded-full text-white shadow-md transition active:scale-95 ${listening ? "animate-pulse bg-rose-500 shadow-rose-500/40" : "bg-gradient-to-br from-violet-600 to-indigo-600 shadow-violet-500/40 hover:scale-105"}`}><Mic size={22} /></button>}
              <button onClick={() => ask(text)} title="Envoyer" className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-slate-900 text-white hover:bg-slate-700"><Send size={16} /></button>
            </div>
            {!supported && <p className="shrink-0 px-4 pb-3 text-[11px] text-slate-400">Saisie vocale : Chrome ou Edge. La saisie texte fonctionne partout.</p>}
          </div>
        </>
      )}
      <button onClick={() => setOpen((o) => !o)} className="group fixed bottom-6 right-4 z-40 grid h-14 w-14 place-items-center rounded-full bg-gradient-to-br from-violet-500 via-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-500/40 transition hover:scale-105 sm:right-6">
        <span className={`absolute inset-0 rounded-full bg-violet-500 ${listening ? "animate-ping opacity-60" : "opacity-0"}`} />
        {listening ? <Mic size={22} className="relative" /> : <Sparkles size={22} className="relative" />}
      </button>
    </>
  );
}

/* ============================ Login ============================ */
function Login({ isDark }) {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState(""); const [pwd, setPwd] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(""); const [info, setInfo] = useState("");
  const submit = async () => {
    setError(""); setInfo("");
    if (!email.trim() || !pwd) { setError("Renseignez votre email et votre mot de passe."); return; }
    setBusy(true);
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: pwd });
        if (error) throw error;
      } else {
        const { data, error } = await supabase.auth.signUp({ email: email.trim(), password: pwd });
        if (error) throw error;
        if (!data.session) setInfo("Compte créé. Vérifiez votre email pour confirmer, puis connectez-vous.");
      }
    } catch (e) {
      const m = e.message || "";
      setError(m.includes("Invalid login") ? "Email ou mot de passe incorrect." : m.includes("already registered") ? "Un compte existe déjà avec cet email." : m || "Une erreur est survenue.");
    } finally { setBusy(false); }
  };
  return (
    <div className={`flex min-h-screen bg-slate-50 ${isDark ? "dark" : ""}`}>
      <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-teal-900 p-12 text-white lg:flex">
        <div className="absolute inset-0 opacity-[0.07]" style={{ backgroundImage: "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)", backgroundSize: "40px 40px" }} />
        <div className="relative flex items-center gap-2.5"><div className="grid h-9 w-9 place-items-center rounded-xl bg-teal-400/20 ring-1 ring-teal-400/30"><Building2 size={18} className="text-teal-200" /></div><span className="font-display text-xl font-semibold">DRAMÉ Gestion</span></div>
        <div className="relative">
          <h1 className="font-display text-4xl font-semibold leading-tight">La gestion locative,<br />pilotée à la voix.</h1>
          <p className="mt-4 max-w-sm text-teal-100/80">Immeubles, locaux, locataires et recouvrements — en francs guinéens, avec un assistant IA qui répond à vos questions.</p>
        </div>
        <div className="relative text-xs text-teal-100/50">Connecté à Supabase · Authentification email / mot de passe</div>
      </div>
      <div className="flex w-full flex-col justify-center px-6 py-12 lg:w-1/2 lg:px-20">
        <div className="mx-auto w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2.5 lg:hidden"><div className="grid h-9 w-9 place-items-center rounded-xl bg-teal-700"><Building2 size={18} className="text-white" /></div><span className="font-display text-xl font-semibold text-slate-900">DRAMÉ Gestion</span></div>
          <h2 className="font-display text-2xl font-semibold text-slate-900">{mode === "login" ? "Connexion" : "Créer un compte"}</h2>
          <p className="mt-1 text-sm text-slate-500">{mode === "login" ? "Accédez à votre espace de gestion." : "Quelques secondes pour démarrer."}</p>
          <div className="mt-6 space-y-4">
            <Field label="Email"><input className={inputCls} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="vous@email.gn" /></Field>
            <Field label="Mot de passe"><input className={inputCls} type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} value={pwd} onChange={(e) => setPwd(e.target.value)} placeholder="••••••••" onKeyDown={(e) => e.key === "Enter" && submit()} /></Field>
            {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-600">{error}</p>}
            {info && <p className="rounded-lg bg-teal-50 px-3 py-2 text-xs text-teal-700">{info}</p>}
            <PrimaryBtn onClick={submit} disabled={busy} className="w-full">{busy ? "Un instant…" : mode === "login" ? "Se connecter" : "Créer le compte"}</PrimaryBtn>
          </div>
          <p className="mt-6 text-center text-sm text-slate-500">{mode === "login" ? "Pas encore de compte ? " : "Déjà inscrit ? "}<button onClick={() => { setMode(mode === "login" ? "signup" : "login"); setError(""); setInfo(""); }} className="font-semibold text-teal-700 hover:underline">{mode === "login" ? "Créer un compte" : "Se connecter"}</button></p>
        </div>
      </div>
    </div>
  );
}

/* ============================ Recherche globale ============================ */
function GlobalSearch({ data, go }) {
  const [q, setQ] = useState("");
  const [openList, setOpenList] = useState(false);
  const term = q.trim().toLowerCase();

  const results = useMemo(() => {
    if (!term) return [];
    const out = [];
    data.immeubles.forEach((im) => { if (im.nom.toLowerCase().includes(term)) out.push({ type: "Immeuble", label: im.nom, icon: Building2, go: () => go("immeuble", im.id) }); });
    data.locaux.forEach((l) => { if (l.nom.toLowerCase().includes(term)) out.push({ type: "Local", label: l.nom, icon: DoorOpen, go: () => go("local", l.id) }); });
    data.locataires.forEach((t) => {
      const hay = `${t.prenom} ${t.nom} ${t.telephone || ""} ${t.email || ""}`.toLowerCase();
      if (hay.includes(term)) out.push({ type: "Locataire", label: `${t.prenom} ${t.nom}`, icon: Users, go: () => go("locataire", t.id) });
    });
    return out.slice(0, 8);
  }, [term, data]);

  const pick = (r) => { r.go(); setQ(""); setOpenList(false); };

  return (
    <div className="relative hidden md:block">
      <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus-within:border-teal-500 focus-within:bg-white focus-within:ring-2 focus-within:ring-teal-500/20">
        <Search size={15} className="shrink-0 text-slate-400" />
        <input
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpenList(true); }}
          onFocus={() => setOpenList(true)}
          onBlur={() => setTimeout(() => setOpenList(false), 150)}
          placeholder="Rechercher un immeuble, local, locataire…"
          className="w-56 bg-transparent text-xs text-slate-700 outline-none placeholder:text-slate-400"
        />
      </div>
      {openList && term && (
        <div className="absolute right-0 top-full z-30 mt-2 w-72 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
          {results.length === 0 ? (
            <div className="px-4 py-3 text-xs text-slate-400">Aucun résultat pour « {q} ».</div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {results.map((r, i) => (
                <li key={i}>
                  <button onClick={() => pick(r)} className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left hover:bg-slate-50">
                    <r.icon size={14} className="shrink-0 text-slate-400" />
                    <span className="min-w-0 flex-1 truncate text-sm text-slate-700">{r.label}</span>
                    <span className="shrink-0 text-[10px] uppercase text-slate-400">{r.type}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

/* ============================ App ============================ */
const NAV = [
  { k: "dashboard", label: "Tableau de bord", icon: Home, grad: "from-blue-400 to-blue-600" },
  { k: "immeubles", label: "Immeubles", icon: Building2, grad: "from-teal-400 to-teal-600" },
  { k: "locaux", label: "Locaux", icon: DoorOpen, grad: "from-orange-400 to-orange-600" },
  { k: "locataires", label: "Locataires", icon: Users, grad: "from-violet-400 to-violet-600" },
  { k: "paiements", label: "Paiements", icon: Wallet, grad: "from-emerald-400 to-emerald-600" },
  { k: "recouvrement", label: "Recouvrement", icon: Layers, grad: "from-cyan-400 to-cyan-600" },
  { k: "retards", label: "Locataires en retard", icon: AlertTriangle, grad: "from-red-400 to-red-600" },
  { k: "rappels", label: "Rappels", icon: Bell, grad: "from-amber-400 to-amber-600" },
  { k: "versements", label: "Versements", icon: Banknote, grad: "from-green-400 to-green-600" },
  { k: "recus", label: "Reçus", icon: Receipt, grad: "from-fuchsia-400 to-fuchsia-600" },
  { k: "depenses", label: "Dépenses", icon: Coins, grad: "from-rose-400 to-rose-600" },
  { k: "documents", label: "Documents", icon: FolderOpen, grad: "from-indigo-400 to-indigo-600" },
  { k: "rapports", label: "Rapports", icon: BarChart3, grad: "from-purple-400 to-purple-600" },
  { k: "parametres", label: "Paramètres", icon: Settings, grad: "from-slate-400 to-slate-600" },
];
const TITLES = { dashboard: "Tableau de bord", immeubles: "Immeubles", immeuble: "Immeuble", locaux: "Locaux", local: "Local", locataires: "Locataires", locataire: "Locataire", paiements: "Paiements", recouvrement: "Recouvrement", retards: "Locataires en retard", rappels: "Rappels de paiement", versements: "Versements", recus: "Reçus", depenses: "Dépenses", documents: "Documents", rapports: "Rapports", parametres: "Paramètres" };
const ROOT = { immeuble: "immeubles", local: "locaux", locataire: "locataires" };

// Tiroir de navigation mobile, fermable via le bouton retour du téléphone.
function Drawer({ open, onClose, children }) {
  useBackClose(!!open, onClose);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <div className="absolute inset-0 bg-slate-900/40" onClick={onClose} />
      <div className="absolute left-0 top-0 h-full">{children}</div>
    </div>
  );
}

export default function App() {
  // Session Supabase : undefined = en cours de vérification, null = déconnecté, objet = connecté.
  const [session, setSession] = useState(undefined);
  // Pile de navigation : le bouton retour matériel dépile une vue au lieu de quitter l'app.
  const [stack, setStack] = useState([{ view: "dashboard", id: null }]);
  const nav = stack[stack.length - 1];
  const [data, setData] = useState(null); // null tant que les données ne sont pas chargées depuis Supabase
  const [loaded, setLoaded] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [paie, setPaie] = useState({ mois: curMonth, immeuble: "all", statut: "tous" });

  // Suivi de la session Supabase (connexion, déconnexion, expiration).
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  // Au login : on charge les données de CET utilisateur depuis la table app_state (un blob JSON
  // par compte). Si c'est la première connexion (aucune ligne), on initialise avec seed() —
  // qui contient vos données réelles (immeubles, locaux, locataires) — puis on la sauvegarde.
  useEffect(() => {
    if (!session) { setData(null); setLoaded(false); return; }
    let cancelled = false;
    (async () => {
      let d = null;
      try {
        const { data: row } = await supabase.from("app_state").select("data").eq("user_id", session.user.id).maybeSingle();
        if (row && row.data) d = row.data;
      } catch {}
      if (!cancelled) { setData(d || seed()); setLoaded(true); }
    })();
    return () => { cancelled = true; };
  }, [session]);

  // À chaque changement, sauvegarde le blob complet dans Supabase (anti-rebond de 600 ms pour
  // ne pas écrire à chaque frappe). Simple et robuste pour une app de cette taille.
  useEffect(() => {
    if (!loaded || !session || !data) return;
    const t = setTimeout(() => {
      supabase.from("app_state").upsert({ user_id: session.user.id, data, updated_at: new Date().toISOString() }).then(() => {});
    }, 600);
    return () => clearTimeout(t);
  }, [data, loaded, session]);

  // Le bouton retour du téléphone (popstate) dépile la vue courante.
  useEffect(() => {
    const onPop = (e) => {
      // Les couches (modales/tiroir) gèrent elles-mêmes leur propre entrée d'historique
      // via useBackClose. Ici on ne dépile que si l'événement concerne la pile de vues.
      if (e.state && e.state.layer) return;
      setStack((s) => (s.length > 1 ? s.slice(0, -1) : s));
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const go = (view, id = null) => {
    setDrawer(false);
    setStack((s) => {
      const cur = s[s.length - 1];
      if (cur.view === view && cur.id === id) return s; // même vue : rien à empiler
      window.history.pushState({}, ""); // nouvelle entrée -> le retour reviendra ici
      return [...s, { view, id }];
    });
  };
  const openPaie = (f) => { setPaie((p) => ({ ...p, ...f })); go("paiements"); };
  const signOut = () => supabase.auth.signOut();
  const resetDemo = () => { setData(seed()); setStack([{ view: "dashboard", id: null }]); }; // réinitialise aux données de départ (la sauvegarde Supabase suit automatiquement)
  const isDark = useIsDark(data?.parametres?.theme || "system");
  const setTheme = (t) => setData((d) => ({ ...d, parametres: { ...(d.parametres || {}), theme: t } }));

  // Vérification de session en cours.
  if (session === undefined) return (<><FontStyles /><div className={`flex min-h-screen items-center justify-center bg-slate-50 ${isDark ? "dark" : ""}`}><p className="text-sm text-slate-400">Chargement…</p></div></>);
  // Déconnecté → écran de connexion Supabase.
  if (!session) return (<><FontStyles /><Login isDark={isDark} /></>);
  // Connecté mais données pas encore chargées.
  if (!data) return (<><FontStyles /><div className={`flex min-h-screen items-center justify-center bg-slate-50 ${isDark ? "dark" : ""}`}><p className="text-sm text-slate-400">Chargement de vos données…</p></div></>);

  const activeNav = ROOT[nav.view] || nav.view;
  const theme = data.parametres?.theme || "system";

  const Sidebar = (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-slate-200 bg-white">
      <div className="flex items-center gap-2.5 px-5 py-5">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-teal-700"><Building2 size={18} className="text-white" /></div>
        <div className="min-w-0 leading-tight">
          <div className="truncate font-display text-base font-bold text-slate-900">DRAMÉ</div>
          <div className="truncate text-[11px] font-medium uppercase tracking-wide text-slate-400">Gestion</div>
        </div>
      </div>
      <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3 py-2">
        {NAV.map((n) => (
          <button key={n.k} onClick={() => go(n.k)} className={`flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-sm transition ${activeNav === n.k ? "bg-slate-100 font-semibold text-slate-900" : "font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-800"}`}>
            <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br shadow-sm ${n.grad}`}>
              <n.icon size={17} strokeWidth={2.25} className="text-white" />
            </span>
            <span className="truncate">{n.label}</span>
          </button>
        ))}
      </nav>
      <div className="border-t border-slate-100 p-3">
        <div className="flex items-center gap-3 rounded-xl px-3 py-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-600">{((session.user?.email || "U")[0] || "U").toUpperCase()}</div>
          <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-slate-800">{session.user?.email || "Gérant"}</p><p className="text-xs text-slate-400">Gérant</p></div>
          <button onClick={() => setTheme(isDark ? "light" : "dark")} title={isDark ? "Passer au mode clair" : "Passer au mode sombre"} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700">{isDark ? <Sun size={16} /> : <Moon size={16} />}</button>
          <button onClick={signOut} title="Se déconnecter" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-rose-600"><LogOut size={16} /></button>
        </div>
      </div>
    </aside>
  );

  return (
    <div className={`flex h-screen overflow-hidden bg-slate-50 text-slate-900 ${isDark ? "dark" : ""}`}>
      <FontStyles />
      <div className="hidden lg:block">{Sidebar}</div>
      <Drawer open={drawer} onClose={() => setDrawer(false)}>{Sidebar}</Drawer>
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-3.5 lg:px-8">
          <button onClick={() => setDrawer(true)} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 lg:hidden"><Menu size={20} /></button>
          <div className="flex-1"><h1 className="font-display text-lg font-semibold text-slate-900 lg:text-xl">{TITLES[nav.view]}</h1><p className="hidden text-xs text-slate-400 sm:block">{now.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p></div>
          <GlobalSearch data={data} go={go} />
        </header>
        <main className="flex-1 overflow-y-auto p-4 lg:p-8">
          {nav.view === "dashboard" && <Dashboard data={data} go={go} isDark={isDark} />}
          {nav.view === "immeubles" && <Immeubles data={data} setData={setData} go={go} />}
          {nav.view === "immeuble" && <ImmeubleDetail id={nav.id} data={data} setData={setData} go={go} />}
          {nav.view === "locaux" && <Locaux data={data} setData={setData} go={go} />}
          {nav.view === "local" && <LocalDetail id={nav.id} data={data} setData={setData} go={go} />}
          {nav.view === "locataires" && <Locataires data={data} setData={setData} go={go} />}
          {nav.view === "locataire" && <LocataireDetail id={nav.id} data={data} setData={setData} go={go} />}
          {nav.view === "paiements" && <Paiements data={data} setData={setData} go={go} filter={paie} setFilter={setPaie} />}
          {nav.view === "recouvrement" && <Recouvrement data={data} go={go} openPaie={openPaie} />}
          {nav.view === "retards" && <Retards data={data} setData={setData} go={go} />}
          {nav.view === "rappels" && <Rappels data={data} setData={setData} go={go} />}
          {nav.view === "versements" && <Versements data={data} setData={setData} go={go} />}
          {nav.view === "recus" && <Recus data={data} go={go} />}
          {nav.view === "depenses" && <Depenses data={data} setData={setData} go={go} />}
          {nav.view === "documents" && <Documents data={data} setData={setData} go={go} />}
          {nav.view === "rapports" && <Rapports data={data} isDark={isDark} />}
          {nav.view === "parametres" && <Parametres data={data} setData={setData} resetDemo={resetDemo} theme={theme} setTheme={setTheme} />}
        </main>
      </div>
      <VoiceAssistant data={data} setData={setData} go={go} openPaie={openPaie} />
    </div>
  );
}

function FontStyles() {
  return (<style>{`
    @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700&family=Inter:wght@400;500;600&display=swap');
    *{font-family:'Inter',system-ui,-apple-system,sans-serif}
    .font-display{font-family:'Sora','Inter',sans-serif}
    .tabular-nums{font-variant-numeric:tabular-nums}

    /* ===================== Mode sombre =====================
       Implémenté en CSS "maison" (pas via le variant dark: de Tailwind,
       dont la disponibilité n'est pas garantie dans cet environnement
       d'aperçu). Scopé à @media screen pour que les documents imprimés
       (quittances, reçus) restent toujours clairs, quel que soit le thème. */
    @media screen {
      .dark{color-scheme:dark}
      .dark.bg-slate-50,.dark .bg-slate-50{background-color:#0f172a}
      .dark.text-slate-900,.dark .text-slate-900{color:#f1f5f9}

      /* Surfaces */
      .dark .bg-white{background-color:#1e293b}
      .dark .bg-slate-50\/60{background-color:rgba(51,65,85,.5)}
      .dark .bg-slate-50\/70{background-color:rgba(51,65,85,.5)}
      .dark .bg-slate-100{background-color:#334155}
      .dark .bg-slate-200{background-color:#475569}
      .dark .hover\:bg-white:hover{background-color:#1e293b}
      .dark .hover\:bg-slate-50:hover{background-color:#334155}
      .dark .hover\:bg-slate-100:hover{background-color:#475569}
      .dark .hover\:bg-slate-200:hover{background-color:#64748b}
      .dark .focus\:bg-white:focus{background-color:#1e293b}

      /* Texte */
      .dark .text-slate-800{color:#e2e8f0}
      .dark .text-slate-700{color:#cbd5e1}
      .dark .text-slate-600{color:#94a3b8}
      .dark .text-slate-500{color:#94a3b8}
      .dark .text-slate-400{color:#64748b}
      .dark .text-slate-300{color:#475569}
      .dark .hover\:text-slate-700:hover{color:#e2e8f0}
      .dark .hover\:text-slate-800:hover{color:#f1f5f9}

      /* Bordures & séparateurs */
      .dark .border-slate-100{border-color:#334155}
      .dark .border-slate-200{border-color:#334155}
      .dark .border-slate-200\/70{border-color:rgba(51,65,85,.7)}
      .dark .border-slate-300{border-color:#475569}
      .dark .divide-slate-100>:not([hidden])~:not([hidden]){border-color:#334155}
      .dark .ring-slate-100{--tw-ring-color:#334155}
      .dark .ring-slate-900\/5{--tw-ring-color:rgba(255,255,255,.06)}
      .dark .ring-slate-500\/20{--tw-ring-color:rgba(148,163,184,.25)}

      /* Accent marque (teal) utilisé comme lien/texte sur les cartes */
      .dark .text-teal-700{color:#2dd4bf}
      .dark .text-teal-800{color:#5eead4}
      .dark .text-teal-700\/70{color:rgba(45,212,191,.7)}
      .dark .text-teal-700\/80{color:rgba(45,212,191,.8)}
      .dark .bg-slate-300{background-color:#475569}
      .dark .hover\:text-teal-700:hover{color:#5eead4}
      .dark .hover\:text-teal-800:hover{color:#99f6e4}
      .dark .bg-teal-50{background-color:rgba(20,184,166,.15)}
      .dark .bg-teal-50\/60{background-color:rgba(20,184,166,.1)}
      .dark .hover\:bg-teal-800:hover{background-color:#115e59}
      .dark .border-teal-200{border-color:rgba(20,184,166,.3)}

      /* Statuts sémantiques : badges et texte d'emphase */
      .dark .bg-emerald-50{background-color:rgba(16,185,129,.15)}
      .dark .text-emerald-700{color:#6ee7b7}
      .dark .text-emerald-600{color:#34d399}
      .dark .hover\:text-emerald-600:hover{color:#6ee7b7}
      .dark .hover\:bg-emerald-50:hover{background-color:rgba(16,185,129,.2)}
      .dark .hover\:bg-emerald-100:hover{background-color:rgba(16,185,129,.25)}

      .dark .bg-rose-50{background-color:rgba(244,63,94,.15)}
      .dark .bg-rose-50\/50{background-color:rgba(244,63,94,.1)}
      .dark .bg-rose-50\/60{background-color:rgba(244,63,94,.1)}
      .dark .text-rose-700{color:#fda4af}
      .dark .text-rose-600{color:#fb7185}
      .dark .text-rose-600\/70{color:rgba(251,113,133,.7)}
      .dark .text-rose-600\/80{color:rgba(251,113,133,.8)}
      .dark .hover\:bg-rose-50:hover{background-color:rgba(244,63,94,.2)}
      .dark .hover\:text-rose-600:hover{color:#fda4af}
      .dark .border-rose-200{border-color:rgba(244,63,94,.3)}
      .dark .border-rose-300{border-color:rgba(244,63,94,.4)}

      .dark .bg-amber-50{background-color:rgba(245,158,11,.15)}
      .dark .text-amber-700{color:#fcd34d}

      .dark .bg-indigo-50{background-color:rgba(99,102,241,.15)}
      .dark .text-indigo-700{color:#a5b4fc}
      .dark .text-indigo-600{color:#818cf8}

      .dark .bg-cyan-50{background-color:rgba(6,182,212,.15)}
      .dark .text-cyan-700{color:#67e8f9}
      .dark .text-cyan-600{color:#22d3ee}

      .dark .bg-violet-50\/40{background-color:rgba(139,92,246,.08)}
      .dark .text-violet-700{color:#c4b5fd}
      .dark .border-violet-200{border-color:rgba(139,92,246,.3)}
      .dark .border-violet-200\/60{border-color:rgba(139,92,246,.25)}
      .dark .hover\:bg-violet-100:hover{background-color:rgba(139,92,246,.25)}
    }
    @media print{
      body *{visibility:hidden}
      .print-area,.print-area *{visibility:visible;-webkit-print-color-adjust:exact;print-color-adjust:exact;color-adjust:exact}
      /* La modale (et tout élément position:fixed — tiroir, assistant vocal…) est
         neutralisée à l'impression : chaque navigateur traite position:fixed
         différemment en impression, ce qui rendait le positionnement de la zone
         imprimable imprévisible. En figeant tout en position statique, la zone
         imprimable se replace simplement en haut de la page, de façon fiable
         partout. Ces éléments restent de toute façon invisibles (règle ci-dessus). */
      .fixed{position:static!important;inset:auto!important}
      .print-area{position:absolute!important;left:0;top:0;width:100%;margin:0!important}
      .no-print{display:none!important}
    }
  `}</style>);
}
