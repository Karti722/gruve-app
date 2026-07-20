import { GoogleAuth } from "google-auth-library";
import { config } from "./config";

const googleAuth = new GoogleAuth();

/** Deployed python-service is a private Cloud Run service (see
 * info/deployment.md Step 4: `--no-allow-unauthenticated`), so every call to
 * it needs a Google-signed ID token, granting the `run.invoker` IAM role
 * alone only authorizes the caller, it doesn't attach proof of identity to
 * the actual HTTP request. Neither local dev
 * (`http://localhost:8001`) nor Docker Compose (`http://python-service:8001`,
 * its own internal network hostname, not "localhost") sit behind that auth,
 * so this only activates for an actual deployed Cloud Run address, matched
 * positively by its `.run.app` domain rather than by blacklisting the two
 * local hostnames, which would silently miss the Docker Compose one. Used by
 * every client under src/ that calls python-service (embeddingsClient,
 * summarizeClient, cacheClient, evalClient). */
export async function getPythonServiceAuthHeaders(): Promise<Record<string, string>> {
  if (!config.pythonEmbeddingServiceUrl.includes(".run.app")) return {};

  const client = await googleAuth.getIdTokenClient(config.pythonEmbeddingServiceUrl);
  const token = await client.idTokenProvider.fetchIdToken(config.pythonEmbeddingServiceUrl);
  return { Authorization: `Bearer ${token}` };
}
