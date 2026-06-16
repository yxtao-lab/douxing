import {
  recallUserMemory,
  writeTripMemory,
  PetMemoryType,
} from '../../services/pet-memory.service.js';
import {
  recallMemoryInputSchema,
  writeMemoryInputSchema,
  toolFail,
  toolSuccess,
} from './schemas.js';

export async function runRecallUserMemoryTool(raw: unknown) {
  const parsed = recallMemoryInputSchema.safeParse(raw);
  if (!parsed.success) {
    return toolFail(parsed.error.message, 'INVALID_INPUT');
  }

  const memories = await recallUserMemory(parsed.data.userId, {
    query: parsed.data.query,
    limit: parsed.data.limit,
  });
  return toolSuccess({ memories });
}

export async function runWriteTripMemoryTool(raw: unknown) {
  const parsed = writeMemoryInputSchema.safeParse(raw);
  if (!parsed.success) {
    return toolFail(parsed.error.message, 'INVALID_INPUT');
  }

  const id = await writeTripMemory({
    userId: parsed.data.userId,
    memoryType: parsed.data.memoryType as (typeof PetMemoryType)[keyof typeof PetMemoryType],
    content: parsed.data.content,
    importance: parsed.data.importance,
    metadata: parsed.data.metadata,
  });
  return toolSuccess({ memoryId: id });
}
