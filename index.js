// Archivo: index.js
// Estudiante: Ccapa Yupa Paul Omar

import 'dotenv/config';
import express from 'express';
import Database from 'better-sqlite3';

const app = express();
// Como variable de entorno
const PORT = process.env.PORT || 3000;

// Creación de la base de datos
const db = new Database('historial.db');

db.prepare(`
  CREATE TABLE IF NOT EXISTS historial (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    oLat TEXT,
    oLon TEXT,
    dLat TEXT,
    dLon TEXT,
    distancia TEXT,
    tiempo TEXT,
    fecha DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`).run();

// User-Agent requerido por la política de uso de Nominatim
// Como variable de entorno
const UA = process.env.USER_AGENT;
app.use(express.json());
app.use(express.static('public'));

/* ── Helper: fetch con User-Agent ── */
const osmFetch = url =>
    fetch(url, { headers: { 'User-Agent': UA } }).then(r => r.json());

/* ── Endpoint 1: Geocodificación inversa (Nominatim) ── */
app.get('/api/geocode', async (req, res) => {
    const { lat, lon } = req.query;
    if (!lat || !lon)
        return res.status(400).json({ error: 'Se requieren lat y lon' });
    try {
        const url = `https://nominatim.openstreetmap.org/reverse`
            + `?lat=${lat}&lon=${lon}&format=json`;
        const data = await osmFetch(url);
        res.json({
            direccion: data.display_name,
            ciudad: data.address?.city || data.address?.town,
            pais: data.address?.country,
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

/* ── Endpoint 2: Ruta entre dos puntos (OSRM) ── */
app.get('/api/ruta', async (req, res) => {
    const { oLat, oLon, dLat, dLon } = req.query;
    if (!oLat || !oLon || !dLat || !dLon)
        return res.status(400).json({ error: 'Se requieren coordenadas de origen y destino' });

    try {
        const url = `https://router.project-osrm.org/route/v1/driving/`
            + `${oLon},${oLat};${dLon},${dLat}?overview=full&geometries=geojson`;

        const data = await osmFetch(url);

        if (data.code !== 'Ok')
            return res.status(502).json({ error: data.code });

        const ruta = data.routes[0];

        // Guardar búsqueda dentro de /api/ruta
        db.prepare(
            `INSERT INTO historial (oLat,oLon,dLat,dLon,distancia,tiempo)
   VALUES (?,?,?,?,?,?)`
        ).run(
            oLat,
            oLon,
            dLat,
            dLon,
            (ruta.distance / 1000).toFixed(2),
            (ruta.duration / 60).toFixed(1)
        );

        res.json({
            distancia_km: (ruta.distance / 1000).toFixed(2),
            duracion_min: (ruta.duration / 60).toFixed(1),
            geometry: ruta.geometry
        });

    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

/* ── Endpoint 3: Ver el historial ── */
app.get("/api/historial", (req, res) => {
    try {
        const rows = db
            .prepare("SELECT * FROM historial ORDER BY fecha DESC")
            .all();

        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, () =>
    console.log(`Servidor en http://localhost:${PORT}`)
);

// Verificación de variables de entorno
console.log("PORT:", process.env.PORT);
console.log("USER_AGENT:", process.env.USER_AGENT);