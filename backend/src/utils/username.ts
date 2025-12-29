import { uniqueNamesGenerator, adjectives, colors, animals } from 'unique-names-generator';
import { prisma } from '../db/index.js';

export async function generateUniqueUsername(): Promise<string> {
  let username = '';
  let isUnique = false;
  let attempts = 0;

  while (!isUnique && attempts < 5) {
    // Generate: "happy_red_panda"
    username = uniqueNamesGenerator({
      dictionaries: [adjectives, colors, animals],
      separator: '-',
      style: 'lowerCase' // or 'capital'
    });

    // Check DB for collision
    const existing = await prisma.user.findUnique({
      where: { username }
    });

    if (!existing) {
      isUnique = true;
    }
    attempts++;
  }

  // Fallback if 5 attempts fail: "user_123456789"
  if (!isUnique) {
    username = `user_${Date.now()}`;
  }

  return username;
}