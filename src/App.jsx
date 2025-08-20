import { useEffect, useState } from "react";

const formatDate = (date) => {
  return new Date(date).toLocaleString("es-CO", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
};

function parseCruiseDate(dateStr) {
  // "01-fe" → 1
  return parseInt(dateStr, 10);
}

function App() {
  const [history, setHistory] = useState([]);

  useEffect(() => {
    fetch("/historial.json")
      .then((res) => res.json())
      .then((data) => setHistory(data));
  }, []);

  if (!history.length) return <p>Cargando...</p>;

  // Tomamos el primer nivel (cada snapshot con fecha)
  // y lo expandimos para graficar
  const chartData = [];
  history.forEach((snapshot) => {
    const snapshotDate = snapshot.date;
    snapshot.cruises.forEach((cruise, i) => {
      const { fecha, puertos } = cruise.text;
      const { prices } = cruise;

      chartData.push({
        snapshotDate: formatDate(snapshotDate),
        cruiseDate: fecha,
        puertos,
        Suite: prices.Suite,
        Balcon: prices.Balcon,
        "Vista al oceano": prices["Vista al oceano"],
        Interno: prices.Interno,
      });
    });
  });

  // Ordenar
  const sorted = chartData.sort((a, b) => {
    // 1. Ordenar por cruiseDate (ascendente)
    const cruiseA = parseCruiseDate(a.cruiseDate);
    const cruiseB = parseCruiseDate(b.cruiseDate);

    if (cruiseA !== cruiseB) {
      return cruiseA - cruiseB;
    }

    // 2. Si tienen mismo cruiseDate, ordenar por snapshotDate (descendente)
    const snapA = new Date(a.snapshotDate);
    const snapB = new Date(b.snapshotDate);

    return snapB - snapA; // mayor a menor
  });

  return (
    <div style={{ padding: "2rem", fontFamily: "sans-serif" }}>
      <h1>📊 Tracker de Cruceros</h1>
      
      <h2>Historial detallado</h2>

      <table
        border="1"
        cellPadding="8"
        style={{ borderCollapse: "collapse", width: "100%" }}
      >
        <thead>
          <tr>
            <th>Fecha de consulta</th>
            <th>Fecha Crucero</th>
            <th>Puertos</th>
            <th>Suite</th>
            <th>Balcon</th>
            <th>Vista al oceano</th>
            <th>Interno</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, i) => (
            <>
              <tr key={i}>
                <td style={{ whiteSpace: "nowrap" }}>{row.snapshotDate}</td>
                <td>{row.cruiseDate}</td>
                <td>{row.puertos}</td>
                <td>{row.Suite ?? "-"}</td>
                <td>{row.Balcon ?? "-"}</td>
                <td>{row["Vista al oceano"] ?? "-"}</td>
                <td>{row.Interno ?? "-"}</td>
              </tr>
              {row.cruiseDate !== sorted[i + 1]?.cruiseDate && (
                <tr>
                  <td
                    colSpan={7}
                    style={{ backgroundColor: "rgb(49 49 49)", height: "6px" }}
                  ></td>
                </tr>
              )}
            </>
          ))}
        </tbody>
      </table>

      {/* <table
        border="1"
        cellPadding="8"
        style={{ borderCollapse: "collapse", width: "100%" }}
      >
        <thead>
          <tr>
            <th>Fecha de consulta</th>
            <th>Fecha Crucero</th>
            <th>Puertos</th>
            <th>Suite</th>
            <th>Balcon</th>
            <th>Vista al oceano</th>
            <th>Interno</th>
          </tr>
        </thead>
        <tbody>
          {chartData.map((row, i) => (
            <tr key={i}>
              <td style={{ whiteSpace: "nowrap" }}>{row.snapshotDate}</td>
              <td>{row.cruiseDate}</td>
              <td>{row.puertos}</td>
              <td>{row.Suite ?? "-"}</td>
              <td>{row.Balcon ?? "-"}</td>
              <td>{row["Vista al oceano"] ?? "-"}</td>
              <td>{row.Interno ?? "-"}</td>
            </tr>
          ))}
        </tbody>
      </table> */}
    </div>
  );
}

export default App;
