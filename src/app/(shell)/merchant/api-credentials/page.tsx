import { ApiCredentialsPageContent } from "@/components/merchant/api-credentials-page-content";
import { getApiKeyOverview } from "@/lib/db/api-keys";
import { getSessionFromCookies } from "@/lib/db/auth";
import { getPaymentBaseUrl } from "@/lib/payment-link-url";

export default async function ApiCredentialsPage() {
  const session = await getSessionFromCookies();
  if (!session) return null;

  const overview = await getApiKeyOverview(session.workspace._id);

  return (
    <ApiCredentialsPageContent
      initialOverview={overview}
      baseUrl={getPaymentBaseUrl()}
    />
  );
}
