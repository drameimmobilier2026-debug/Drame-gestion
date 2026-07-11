// Fonction serverless Netlify : relaie la requête de l'assistant vocal vers l'API Anthropic.
// La clé API reste côté serveur (variable d'environnement ANTHROPIC_API_KEY) — elle n'est
// JAMAIS exposée dans le navigateur. Le front appelle /.netlify/functions/assistant.
//
// Tout le corps est enveloppé dans un try/catch global : la moindre erreur inattendue (y
// compris un plantage avant même d'atteindre notre propre gestion d'erreur) renvoie un JSON
// exploitable plutôt qu'un 502 muet généré par Netlify lui-même.
//
// Les fonctions Netlify synchrones ont une limite dure de 10 secondes — au-delà, Netlify tue
// le processus et renvoie un 502 générique, sans laisser la moindre chance à notre propre
// gestion d'erreur de s'exécuter. On se protège avec un délai contrôlé à 8s : si l'IA met plus
// longtemps à répondre, on l'interrompt nous-mêmes et on renvoie un message clair là-dessus.
exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, body: JSON.stringify({ error: "Méthode non autorisée" }) };
    }

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

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    let res;
    try {
      res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 300, // réponses courtes par design (1-2 phrases) — inutile de permettre plus, ça ne fait qu'allonger le pire des cas
          system,
          messages: [{ role: "user", content: message }],
        }),
        signal: controller.signal,
      });
    } catch (e) {
      if (e.name === "AbortError") {
        return { statusCode: 504, body: JSON.stringify({ error: "L'IA a mis plus de 8 secondes à répondre — réessayez avec une question plus courte." }) };
      }
      throw e;
    } finally {
      clearTimeout(timeoutId);
    }
    const data = await res.json();
    // On renvoie tel quel : le front lit data.content comme une réponse Anthropic classique.
    return { statusCode: res.status, headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) };
  } catch (e) {
    return { statusCode: 502, body: JSON.stringify({ error: "Erreur inattendue dans la fonction assistant: " + (e && e.message ? e.message : String(e)) }) };
  }
};
