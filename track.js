const http = require("http");
const axios = require("axios");
const cheerio = require("cheerio");
const fs = require("fs");

const URL =
  "https://cruise.ovscruise.com/cruises/promos/new/cruise_search.jsp?pid=2&langrecno=3&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJjb2JyYW5kIjoiMTEzIiwiY3VzdG9tZXJpZCI6Ik1EQzEwNTQ1MjAiLCJtZW1iZXJpZCI6Ik1EQzEwNTQ1MjAiLCJwaW4iOiIxMzI1IiwibmJmIjoxNzU1NjI2NDIxLCJleHAiOjE3NTU2MjY3ODEsImlzcyI6ImF1dGhvcml0eS5hcnJpdmlhLmNvbSIsImF1ZCI6Im92c2NydWlzZS5jb20ifQ.gp9m8p-ng2Ru8coFvASzZoIRyVq7zRmMB0PfY8_lWPo&CID=MDC&CBID=113&PIN=1325&tpid=&as=1&partnerid=186&nameid=39127934&specid=&cruiseline=-99&ship=-99&destination=19&dport=24&date=2X2026&dur=-99&prange=-99&sort=8&ord=1&webpagerecno=5793";
const HISTORY_FILE = "historial.json";

function cleanPrices(prices) {
  let cleaned = {};
  //   console.log(prices);
  for (const [key, value] of Object.entries(prices)) {
    if (!["Interno", "Vista al oc�ano", "Balc�n", "Suite"].includes(key))
      continue;
    let newKey = key
      .replace("Vista al oc�ano", "Vista al oceano")
      .replace("Balc�n", "Balcon");
    cleaned[newKey] = value;
  }
  return cleaned;
}

function parseCruiseText(text) {
  // Limpiar primero
  let clean = text
    .replace(/\s+/g, " ")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, ""); // quita acentos

  let fechaMatch = clean.match(/Fecha de navegaci�n: ([^B]*)/i);
  let puertosMatch = clean.match(/Puertos: (.+)/i);

  return {
    fecha: fechaMatch ? fechaMatch[1].trim() : null,
    puertos: puertosMatch ? puertosMatch[1].trim() : null,
  };
}

async function scrapeCruises() {
  try {
    const { data } = await axios.get(URL);
    const $ = cheerio.load(data);

    let cruises = [];

    // Selector "padre" de cada crucero (ajústalo a lo que veas en el HTML)
    $("#formattedResults").each((i, el) => {
      let text = $(el).find("#formattedResultsText").text().trim();
      text = parseCruiseText(text);

      // Aquí recolectamos todos los precios dentro de ese bloque
      let prices = {};
      $(el)
        .find(".changedRowBecauseOfBackend")
        .each((j, box) => {
          const type = $(box).find("#hoverPricingLeft").text().trim();
          const priceText = $(box).find("#hoverPricingRight").text().trim();
          const price = parseFloat(
            priceText.replace(/[^0-9,.]/g, "").replace(",", ".")
          );
          if (type) {
            prices[type] = price;
          }
        });

      prices = cleanPrices(prices);
      cruises.push({ text, prices });
    });

    return cruises;
  } catch (err) {
    console.error("Error obteniendo cruceros:", err.message);
    return [];
  }
}

function saveHistory(data) {
  let history = [];

  if (fs.existsSync(HISTORY_FILE)) {
    history = JSON.parse(fs.readFileSync(HISTORY_FILE, "utf8"));
  }

  const entry = { date: new Date().toISOString(), cruises: data };
  history.push(entry);

  fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
}

async function track() {
  const cruises = await scrapeCruises();
  if (cruises.length === 0) return;

  console.log(`Encontrados ${cruises.length} cruceros.`);

  // Aquí podrías comparar con el historial para ver cambios
  saveHistory(cruises);
}

const server = http.createServer(async (req, res) => {
  if (req.url === "/") {
    try {
      // 👇 Aquí va tu script actual
      console.log("Ejecutando script de cruceros...");
      await track();
      // Ejemplo: await miFuncionDeCron();

      // 🔹 Muy importante: siempre responder
      res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("✅ Script de cruceros ejecutado correctamente");
    } catch (err) {
      console.error(err);
      res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("❌ Error ejecutando script");
    }
  } else {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Ruta no encontrada");
  }
});

server.listen(3000, () => {
  console.log("Servidor corriendo en http://localhost:3000");
});
