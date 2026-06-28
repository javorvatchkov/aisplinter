import { db } from '../db/index.js';
import { webhookDeliveries, projects } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';

export async function queueWebhook(projectId: string, eventType: string, payload: any) {
  const [delivery] = await db.insert(webhookDeliveries).values({
    projectId,
    eventType,
    payload,
    status: 'PENDING',
    nextAttemptAt: new Date(),
  }).returning();

  // Trigger async dispatch
  dispatchWebhook(delivery.id).catch(console.error);
}

async function dispatchWebhook(deliveryId: string) {
  const delivery = await db.query.webhookDeliveries.findFirst({
    where: eq(webhookDeliveries.id, deliveryId),
  });

  if (!delivery || delivery.status === 'SUCCESS') return;

  const project = await db.query.projects.findFirst({
    where: eq(projects.id, delivery.projectId),
  });

  if (!project || !project.webhookUrl) return;

  const payloadString = JSON.stringify({
    id: delivery.id,
    type: delivery.eventType,
    created_at: delivery.createdAt,
    data: delivery.payload,
  });

  const signature = project.webhookSecret
    ? crypto.createHmac('sha256', project.webhookSecret).update(payloadString).digest('hex')
    : '';

  try {
    const response = await fetch(project.webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-AISplinter-Signature': signature,
      },
      body: payloadString,
    });

    if (response.ok) {
      await db.update(webhookDeliveries)
        .set({ status: 'SUCCESS' })
        .where(eq(webhookDeliveries.id, deliveryId));
    } else {
      throw new Error(`Status ${response.status}`);
    }
  } catch (e) {
    const nextRetry = new Date();
    nextRetry.setMinutes(nextRetry.getMinutes() + Math.pow(2, delivery.retryCount + 1));

    await db.update(webhookDeliveries)
      .set({
        status: 'FAILED',
        retryCount: delivery.retryCount + 1,
        nextAttemptAt: nextRetry,
      })
      .where(eq(webhookDeliveries.id, deliveryId));
  }
}
