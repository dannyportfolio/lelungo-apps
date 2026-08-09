import 'server-only';

/**
 * Traveloka API Client
 *
 * Konfigurasi client untuk memanggil API Traveloka menggunakan Environment Variables.
 */

// Credentials must remain server-only. This adapter is dormant until a real,
// documented provider contract and credentials are available.
const TRAVELOKA_BASE_URL = process.env.TRAVELOKA_BASE_URL || '';
const TRAVELOKA_APP_KEY = process.env.TRAVELOKA_APP_KEY || '';

/**
 * Custom Fetch Wrapper untuk API Traveloka.
 * Mengotomatiskan penambahan App Key ke dalam header (misal: 'x-api-key').
 */
export async function fetchTraveloka<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  if (!TRAVELOKA_BASE_URL || !TRAVELOKA_APP_KEY) {
    throw new Error('Traveloka integration is not configured.');
  }

  // Jika BASE_URL bukan URL penuh (misalnya hanya '0n3Sjl5t'), 
  // Anda mungkin perlu menyesuaikannya dengan host domain API Traveloka yang sebenarnya.
  // Contoh: const url = `https://api.traveloka.com/v1/${TRAVELOKA_BASE_URL}${endpoint}`;
  const url = `${TRAVELOKA_BASE_URL}${endpoint}`;

  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  
  // Asumsi penggunaan header key. Sesuaikan dengan dokumentasi API Traveloka
  // (bisa jadi 'Authorization', 'x-api-key', atau 'x-app-key')
  headers.set("x-api-key", TRAVELOKA_APP_KEY);

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      // Menangani error HTTP standar
      const errorData = await response.json().catch(() => null);
      throw new Error(
        `Traveloka API Error (${response.status}): ${
          errorData?.message || response.statusText
        }`
      );
    }

    return (await response.json()) as T;
  } catch (error) {
    console.error("Fetch Traveloka gagal:", error);
    throw error;
  }
}
