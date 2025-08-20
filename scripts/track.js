const axios = require("axios");
const cheerio = require("cheerio");
const fs = require("fs");
const iconv = require("iconv-lite");

const URL =
  "https://cruise.ovscruise.com/cruises/promos/new/cruise_search.jsp?pid=2&langrecno=3&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJjb2JyYW5kIjoiMTEzIiwiY3VzdG9tZXJpZCI6Ik1EQzEwNTQ1MjAiLCJtZW1iZXJpZCI6Ik1EQzEwNTQ1MjAiLCJwaW4iOiIxMzI1IiwibmJmIjoxNzU1NjI2NDIxLCJleHAiOjE3NTU2MjY3ODEsImlzcyI6ImF1dGhvcml0eS5hcnJpdmlhLmNvbSIsImF1ZCI6Im92c2NydWlzZS5jb20ifQ.gp9m8p-ng2Ru8coFvASzZoIRyVq7zRmMB0PfY8_lWPo&CID=MDC&CBID=113&PIN=1325&tpid=&as=1&partnerid=186&nameid=39127934&specid=&cruiseline=-99&ship=-99&destination=19&dport=24&date=2X2026&dur=-99&prange=-99&sort=8&ord=1&webpagerecno=5793";
const HISTORY_FILE = "./public/historial.json";

function cleanPrices(prices) {
  let cleaned = {};
  //   console.log(prices);
  for (const [key, value] of Object.entries(prices)) {
    if (!["Interno", "Vista al océano", "Balcón", "Suite"].includes(key))
      continue;
    let newKey = key
      .replace("Vista al océano", "Vista al oceano")
      .replace("Balcón", "Balcon");
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
  let fechaMatch = clean.match(/Fecha de navegacion: ([^B]*)/i);
  let puertosMatch = clean.match(/Puertos: (.+)/i);

  return {
    fecha: fechaMatch ? fechaMatch[1].trim() : null,
    puertos: puertosMatch ? puertosMatch[1].trim() : null,
  };
}

async function scrapeCruises() {
  try {
    const response = await axios.get(URL, { responseType: "arraybuffer" });
    const data = iconv.decode(response.data, "latin1");

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

  return cruises;
}

// Exportar la función para que pueda ser usada desde otras partes
module.exports = { track, scrapeCruises, saveHistory };

// Si se ejecuta directamente el archivo, ejecutar track()
if (require.main === module) {
  console.log("🚢 Iniciando script de tracking de cruceros...");
  console.log("📅 Fecha:", new Date().toLocaleString("es-CO"));

  track()
    .then((cruises) => {
      if (cruises && cruises.length > 0) {
        console.log(`✅ Script ejecutado correctamente`);
        console.log(`📊 Se encontraron ${cruises.length} cruceros`);
        console.log(`💾 Historial guardado en: ${HISTORY_FILE}`);
      } else {
        console.log("⚠️ No se encontraron cruceros");
      }
      process.exit(0);
    })
    .catch((err) => {
      console.error("❌ Error ejecutando script:", err);
      process.exit(1);
    });
}
