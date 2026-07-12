// Fonction de diagnostic minimale — aucun appel externe, aucune dépendance, aucune clé API.
// Sert uniquement à vérifier si les fonctions Netlify s'exécutent correctement sur ce site,
// indépendamment de tout ce qui touche à l'assistant vocal ou à une IA. Si CETTE fonction
// renvoie aussi un 502, le problème n'a jamais été l'IA — il est dans l'infrastructure des
// fonctions elle-même sur ce déploiement précis.
exports.handler = async () => {
  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ok: true, message: "La fonction Netlify fonctionne.", heure: new Date().toISOString() }),
  };
};
