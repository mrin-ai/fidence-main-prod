import { WebhooksPageContent } from "@/components/merchant/webhooks-page-content";
import {
  listWebhookEndpoints,
  listWebhookEventTypes,
} from "@/lib/db/webhooks";
import { requireShellSession } from "@/lib/shell-session";

export default async function MerchantWebhooksPage() {
  const { session } = await requireShellSession("/merchant/webhooks");
  const [endpoints, eventTypes] = await Promise.all([
    listWebhookEndpoints(session.workspace._id),
    Promise.resolve(listWebhookEventTypes()),
  ]);

  return (
    <WebhooksPageContent initialEndpoints={endpoints} eventTypes={eventTypes} />
  );
}
