// Handles PATCH/HEAD/DELETE to /api/tus/<upload-id> (upload chunks, status, cancel)
export default defineEventHandler((event) => handleTusRequest(event))
