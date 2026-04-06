import webpush from "web-push";
import { db } from "./db";
import { pushSubscriptions, customers } from "@shared/schema";
import { eq, and, ne } from "drizzle-orm";

let vapidConfigured = false;
let vapidPublicKey: string | null = null;

export function initWebPush() {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:admin@chip.am";

  if (!publicKey || !privateKey) {
    console.log("[PUSH] VAPID keys not configured — push notifications disabled.");
    return;
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
  vapidPublicKey = publicKey;
  vapidConfigured = true;
  console.log("[PUSH] Web Push initialized with VAPID keys.");
}

export function getVapidPublicKey(): string | null {
  return vapidPublicKey;
}

export function isPushEnabled(): boolean {
  return vapidConfigured;
}

export async function saveSubscription(
  customerId: string,
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } }
) {
  // Remove existing subscription with same endpoint for this customer
  await db
    .delete(pushSubscriptions)
    .where(
      and(
        eq(pushSubscriptions.customerId, customerId),
        eq(pushSubscriptions.endpoint, subscription.endpoint)
      )
    );

  await db.insert(pushSubscriptions).values({
    customerId,
    endpoint: subscription.endpoint,
    p256dhKey: subscription.keys.p256dh,
    authKey: subscription.keys.auth,
  });
}

export async function removeSubscription(customerId: string, endpoint: string) {
  await db
    .delete(pushSubscriptions)
    .where(
      and(
        eq(pushSubscriptions.customerId, customerId),
        eq(pushSubscriptions.endpoint, endpoint)
      )
    );
}

async function sendPush(
  subscriptions: { id: string; endpoint: string; p256dhKey: string; authKey: string }[],
  payload: { title: string; body: string; url?: string; tag?: string; image?: string }
) {
  if (!vapidConfigured || subscriptions.length === 0) return;

  const payloadStr = JSON.stringify(payload);

  await Promise.allSettled(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dhKey, auth: sub.authKey },
          },
          payloadStr
        );
      } catch (err: any) {
        // 410 Gone or 404 = subscription expired, clean up
        if (err.statusCode === 410 || err.statusCode === 404) {
          await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, sub.id)).catch(() => {});
        }
      }
    })
  );
}

export async function sendPushToCustomer(
  customerId: string,
  payload: { title: string; body: string; url?: string; tag?: string; image?: string }
) {
  const subs = await db
    .select()
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.customerId, customerId));

  await sendPush(subs, payload);
}

export async function sendPushToAdmins(
  payload: { title: string; body: string; url?: string; tag?: string; image?: string }
) {
  const adminCustomers = await db
    .select({ id: customers.id })
    .from(customers)
    .where(eq(customers.role, "admin"));

  if (adminCustomers.length === 0) return;

  const adminIds = adminCustomers.map((c) => c.id);
  const allSubs: typeof pushSubscriptions.$inferSelect[] = [];

  for (const adminId of adminIds) {
    const subs = await db
      .select()
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.customerId, adminId));
    allSubs.push(...subs);
  }

  await sendPush(allSubs, payload);
}

export async function sendPushToAllCustomers(
  payload: { title: string; body: string; url?: string; tag?: string; image?: string }
) {
  // Get all non-admin customer subscriptions
  const customerList = await db
    .select({ id: customers.id })
    .from(customers)
    .where(ne(customers.role, "admin"));

  if (customerList.length === 0) return;

  const allSubs: typeof pushSubscriptions.$inferSelect[] = [];

  for (const cust of customerList) {
    const subs = await db
      .select()
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.customerId, cust.id));
    allSubs.push(...subs);
  }

  await sendPush(allSubs, payload);
}

export async function getSubscriberCount(): Promise<number> {
  // Count unique non-admin customers who have at least one subscription
  const result = await db
    .selectDistinct({ customerId: pushSubscriptions.customerId })
    .from(pushSubscriptions)
    .innerJoin(customers, eq(pushSubscriptions.customerId, customers.id))
    .where(ne(customers.role, "admin"));

  return result.length;
}
