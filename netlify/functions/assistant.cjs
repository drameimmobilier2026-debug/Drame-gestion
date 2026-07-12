// Fonction serverless Netlify : relaie la requête de l'assistant vocal vers l'API Google Gemini
// (palier gratuit et durable, sans carte bancaire — contrairement à l'API Anthropic qui exige
// un moyen de paiement). La clé API reste côté serveur (variable d'environnement GEMINI_API_KEY)
// — elle n'est JAMAIS exposée dans le navigateur. Le front appelle /.netlify/functions/assistant.
//
// Tout le corps est enveloppé dans un try/catch global : la moindre erreur inattendue (y
// compris un plantage avant même d'atteindre notre propre gestion d'erreur) renvoie un JSON
// exploitable plutôt qu'un 502 muet généré par Netlify lui-même.
//
// Les fonctions Netlify synchrones ont une limite dure de 10 secondes — au-delà, Netlify tue
// le processus et renvoie un 502 générique. Le délai contrôlé à 6s laisse de la marge au
// démarrage à froid de la fonction ; Gemini a par ailleurs la réputation d'être rapide, ce qui
// aide aussi à rester dans les temps.
exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, body: JSON.stringify({ error: "Méthode non autorisée" }) };
    }

    if (typeof fetch === "undefined") {
      return { statusCode: 500, body: JSON.stringify({ error: "fetch indisponible sur ce runtime Netlify (Node trop ancien) — vérifiez NODE_VERSION dans netlify.toml." }) };
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return { statusCode: 500, body: JSON.stringify({ error: "GEMINI_API_KEY non configurée sur Netlify." }) };
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
    const timeoutId = setTimeout(() => controller.abort(), 6000);
    let res;
    try {
      res = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: message }] }],
          systemInstruction: { parts: [{ text: system }] },
          generationConfig: {
            maxOutputTokens: 200,
            responseMimeType: "application/json",
          },
        }),
        signal: controller.signal,
      });
    } catch (e) {
      if (e.name === "AbortError") {
        return { statusCode: 504, body: JSON.stringify({ error: "L'IA a mis plus de 6 secondes à répondre — réessayez, la seconde tentative est généralement plus rapide." }) };
      }
      throw e;
    } finally {
      clearTimeout(timeoutId);
    }
    const data = await res.json();
    // On renvoie tel quel : le front lit data.candidates[0].content.parts (forme Gemini),
    // différente de la forme Anthropic (data.content) utilisée par l'aperçu Claude.
    return { statusCode: res.status, headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) };
  } catch (e) {
    return { statusCode: 502, body: JSON.stringify({ error: "Erreur inattendue dans la fonction assistant: " + (e && e.message ? e.message : String(e)) }) };
  }
};
