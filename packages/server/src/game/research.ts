import { prisma } from '../db/index.js';
import { TECH_BY_ID, canLearnTech, researchCost } from './data/tech.js';

// Auto-research: deduct from player.research pool to learn the queued tech.
// Returns the techId that was just learned, or null if nothing happened.
export async function processResearch(
  playerId: number,
  researchPool: number,
  researchTechId: number,
): Promise<{ remainingPool: number; learnedTechId: number | null }> {
  if (researchTechId === 0) return { remainingPool: researchPool, learnedTechId: null };

  const tech = TECH_BY_ID.get(researchTechId);
  if (!tech) return { remainingPool: researchPool, learnedTechId: null };

  // Check if player already owns it
  const existing = await prisma.playerTech.findUnique({
    where: { playerId_techId: { playerId, techId: researchTechId } },
  });
  if (existing) return { remainingPool: researchPool, learnedTechId: null };

  // Check prerequisites
  const ownedTechs = await prisma.playerTech.findMany({ where: { playerId } });
  const ownedIds = new Set(ownedTechs.map((t) => t.techId));
  if (!canLearnTech(ownedIds, researchTechId)) {
    return { remainingPool: researchPool, learnedTechId: null };
  }

  const cost = researchCost(researchTechId);
  if (researchPool < cost) return { remainingPool: researchPool, learnedTechId: null };

  // Learn the tech
  await prisma.playerTech.create({
    data: { playerId, techId: researchTechId },
  });

  return { remainingPool: researchPool - cost, learnedTechId: researchTechId };
}
