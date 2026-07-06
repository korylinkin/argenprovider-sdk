// Rate limiter en memoria (ventana deslizante simple).
// Suficiente para una instancia única. Si se escala horizontalmente,
// reemplazar por un backend compartido (Redis).

// Cada bucket recuerda SU propia ventana: distintas claves pueden usar
// windowMs distintos y la limpieza global no debe podar una ventana larga con
// la ventana corta de otra clave (bug: dejaba pasar hits que seguían vigentes).
type Bucket = { timestamps: number[]; windowMs: number };

const buckets = new Map<string, Bucket>();

const CLEANUP_INTERVAL_MS = 10 * 60 * 1000;
let lastCleanup = Date.now();

function cleanup() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;
  for (const [key, bucket] of buckets) {
    bucket.timestamps = bucket.timestamps.filter((t) => now - t < bucket.windowMs);
    if (bucket.timestamps.length === 0) buckets.delete(key);
  }
}

/**
 * Registra un hit y devuelve true si la petición está dentro del límite.
 * `key` identifica al cliente (userId, IP, etc.).
 */
export function rateLimit(key: string, maxRequests: number, windowMs: number): boolean {
  cleanup();
  const now = Date.now();
  const bucket = buckets.get(key) ?? { timestamps: [], windowMs };
  bucket.windowMs = windowMs;
  bucket.timestamps = bucket.timestamps.filter((t) => now - t < windowMs);

  if (bucket.timestamps.length >= maxRequests) {
    buckets.set(key, bucket);
    return false;
  }

  bucket.timestamps.push(now);
  buckets.set(key, bucket);
  return true;
}
