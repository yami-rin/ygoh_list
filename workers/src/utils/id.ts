/** Generate a random document ID (20 chars, Firestore-compatible) */
export function generateId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const array = new Uint8Array(20);
  crypto.getRandomValues(array);
  return Array.from(array, b => chars[b % chars.length]).join('');
}
