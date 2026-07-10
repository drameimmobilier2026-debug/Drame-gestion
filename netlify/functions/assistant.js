// Fonction serverless Netlify : relaie la requête de l'assistant vocal vers l'API Anthropic.
// La clé API reste côté serveur (variable d'environnement ANTHROPIC_API_KEY) — elle n'est
// JAMAIS exposée dans le navigateur. Le front appelle /.netlify/functions/assistant.
//
// Tout le corps est enveloppé dans un try/catch global : la moindre erreur inattendue (y
// compris un plantage avant même d'atteindre notre propre gestion d'erreur) renvoie un JSON
// exploitable plutôt qu'un 502 muet généré par Netlify lui-même.
exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, body: JSON.stringify({ error: "Méthode non autorisée" }) };
    }

    // fetch() n'existe nativement qu'à partir de Node 18 (voir NODE_VERSION dans netlify.toml).
    // Sans cette vérification, une exécution sur un Node plus ancien plante silencieusement.
    if (typeof fetch === "undefined") {
      return { statusCode: 500, body: JSON.stringify({ error: "fetch indisponible sur ce runtime Netlify (Node trop ancien) — vérifiez NODE_VERSION dans netlify.toml." }) };
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return { statusCode: 500, body: JSON.stringify({ error: "ANTHROPIC_API_KEY non configurée sur Netlify." }) };
    }

    let system = "", message = "";
    try {
      const body = JSON.parse(event.body || "{}");
      system = body.system || "";
      message = body.message || "";
    } catch {
      return { statusCode: 400, body: JSON.stringify({ error: "Corps de requête invalide" }) };
    }

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1000,
        system,
        messages: [{ role: "user", content: message }],
      }),
    });
    const data = await res.json();
    // On renvoie tel quel : le front lit data.content comme une réponse Anthropic classique.
    return { statusCode: res.status, headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) };
  } catch (e) {
    return { statusCode: 502, body: JSON.stringify({ error: "Erreur inattendue dans la fonction assistant: " + (e && e.message ? e.message : String(e)) }) };
  }
};
