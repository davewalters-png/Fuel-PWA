import { get, set } from "idb-keyval";
import { submitFuelTicket } from "./api";
import type { QueuedTransaction } from "./types";

const QUEUE_KEY = "yardfuel-queue-v1";

export async function loadQueue(): Promise<QueuedTransaction[]> {
  return (await get<QueuedTransaction[]>(QUEUE_KEY)) ?? [];
}

async function saveQueue(items: QueuedTransaction[]): Promise<void> {
  await set(QUEUE_KEY, items);
}

export async function enqueue(
  item: QueuedTransaction,
): Promise<QueuedTransaction[]> {
  const queue = await loadQueue();
  queue.unshift(item);
  await saveQueue(queue);
  return queue;
}

export async function updateQueueItem(
  id: string,
  patch: Partial<QueuedTransaction>,
): Promise<QueuedTransaction[]> {
  const queue = await loadQueue();
  const next = queue.map((item) =>
    item.id === id ? { ...item, ...patch } : item,
  );
  await saveQueue(next);
  return next;
}

export async function syncPending(
  onChange?: (items: QueuedTransaction[]) => void,
): Promise<QueuedTransaction[]> {
  let queue = await loadQueue();
  const pending = queue.filter(
    (item) => item.status === "pending" || item.status === "error",
  );

  for (const item of pending) {
    queue = await updateQueueItem(item.id, {
      status: "syncing",
      error: undefined,
    });
    onChange?.(queue);
    try {
      const result = await submitFuelTicket(item.payload);
      queue = await updateQueueItem(item.id, {
        status: "synced",
        ticketId: result.ticketId,
        error: undefined,
      });
    } catch (err) {
      queue = await updateQueueItem(item.id, {
        status: "error",
        error: err instanceof Error ? err.message : String(err),
      });
    }
    onChange?.(queue);
  }

  return loadQueue();
}
