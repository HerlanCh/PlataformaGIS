/** Origen de la API. En Vercel apunta a staging; en desarrollo, a la API local. */
export const URL_API: string = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';
