// Handles POST/OPTIONS to /api/tus/ (base path for creating uploads)
export default defineEventHandler((event) => handleTusRequest(event))
