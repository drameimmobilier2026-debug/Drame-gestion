/* ==================== Graphiques (chargés à la demande) ====================
   La bibliothèque de graphiques (recharts) pèse à elle seule plusieurs centaines de kilo-
   octets une fois compressée. Or elle ne sert que sur 2 écrans sur 17 (Tableau de bord et
   Rapports). En la chargeant d'un bloc au démarrage, chaque ouverture de l'application
   téléchargeait et exécutait tout ce code pour rien — ce qui pénalise lourdement la fluidité,
   en particulier sur téléphone.

   En isolant les graphiques ici, le navigateur ne va chercher ce code QUE lorsqu'on ouvre
   réellement un écran qui en contient. Le reste de l'application démarre nettement plus vite. */
import {
  BarChart, Bar, AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell, CartesianGrid,
} from "recharts";

const infobulle = (isDark) => ({
  borderRadius: 12,
  border: `1px solid ${isDark ? "#334155" : "#e2e8f0"}`,
  fontSize: 12,
  background: isDark ? "#1e293b" : "#fff",
  color: isDark ? "#f1f5f9" : "#0f172a",
});

/* Tableau de bord — encaissements des 6 dernières échéances. */
export function GraphiqueEncaissements({ serie, isDark, money, gridColor, tickColor }) {
  return (
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
        <Tooltip formatter={(v) => [money(v), "Encaissé"]} contentStyle={infobulle(isDark)} />
        <Area type="monotone" dataKey="montant" stroke="#0f766e" strokeWidth={2.5} fill="url(#gEnc)" dot={{ r: 3, fill: "#0f766e" }} activeDot={{ r: 5 }} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/* Tableau de bord — loyers potentiels par immeuble. */
export function GraphiqueParImmeuble({ parImmeuble, isDark, money, axisColor }) {
  return (
    <ResponsiveContainer width="100%" height={230}>
      <BarChart data={parImmeuble} layout="vertical" margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
        <XAxis type="number" hide tickFormatter={(v) => `${v / 1e6}M`} />
        <YAxis type="category" dataKey="nom" width={96} tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: axisColor }} />
        <Tooltip formatter={(v) => [money(v), "Potentiel/mois"]} contentStyle={infobulle(isDark)} />
        <Bar dataKey="potentiel" radius={[0, 6, 6, 0]} maxBarSize={30}>
          <Cell fill="#6366f1" /><Cell fill="#06b6d4" />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/* Rapports — revenus, dépenses et résultat net sur 6 mois. */
export function GraphiqueRevenusDepenses({ serie, isDark, money, gridColor, tickColor }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={serie} margin={{ top: 6, right: 0, left: -8, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={gridColor} />
        <XAxis dataKey="mois" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: tickColor }} />
        <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: tickColor }} tickFormatter={(v) => (v >= 1e6 ? `${v / 1e6}M` : v)} />
        <Tooltip formatter={(v, n) => [money(v), n === "enc" ? "Encaissé" : n === "dep" ? "Dépenses" : "Net"]} contentStyle={infobulle(isDark)} />
        <Bar dataKey="enc" fill="#0f766e" radius={[6, 6, 0, 0]} maxBarSize={20} />
        <Bar dataKey="dep" fill="#fb7185" radius={[6, 6, 0, 0]} maxBarSize={20} />
        <Bar dataKey="net" fill="#34d399" radius={[6, 6, 0, 0]} maxBarSize={20} />
      </BarChart>
    </ResponsiveContainer>
  );
}
