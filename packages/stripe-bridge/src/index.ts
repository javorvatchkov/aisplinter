import Stripe from 'stripe';
import { AisplinterClient } from '@aisplinter/core';

export interface StripeBridgeConfig {
  aisplinter: AisplinterClient;
  stripeSecretKey: string;
  webhookSecret: string;
  priceToSkuMap: Record<string, string>;
}

export class AisplinterStripeBridge {
  private stripe: Stripe;

  constructor(private config: StripeBridgeConfig) {
    this.stripe = new Stripe(config.stripeSecretKey);
  }

  async handleWebhook(body: string | Buffer, signature: string) {
    let event: Stripe.Event;

    try {
      event = this.stripe.webhooks.constructEvent(
        body,
        signature,
        this.config.webhookSecret
      );
    } catch (err: any) {
      throw new Error(`Webhook signature verification failed: ${err.message}`);
    }

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        await this.handleProvisioning(session);
        break;
      }
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        await this.handleSubscriptionChange(subscription);
        break;
      }
    }

    return { received: true };
  }

  private async handleProvisioning(session: Stripe.Checkout.Session) {
    const externalUserId = session.client_reference_id;
    if (!externalUserId) return;

    // Get the price ID from the session line items
    const lineItems = await this.stripe.checkout.sessions.listLineItems(session.id);
    const priceId = lineItems.data[0]?.price?.id;
    if (!priceId) return;

    const sku = this.config.priceToSkuMap[priceId];
    if (!sku) return;

    await this.config.aisplinter.users.provision({
      external_user_id: externalUserId,
      plan_sku: sku,
      metadata: { stripeCustomerId: session.customer },
    });
  }

  private async handleSubscriptionChange(_subscription: Stripe.Subscription) {
    // Similar logic for updates/deletes
    // TODO: Implement deep syncing for subscriptions
  }
}
