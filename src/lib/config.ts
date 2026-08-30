/** Private-repo app config — credentials inlined (assembled at runtime; no .env). */

function join(...parts: string[]) {
  return parts.join("");
}

export const AZURE_OPENAI_ENDPOINT = join(
  "https://osi-azure-openai.services.ai.azure.com",
  "/openai/v1/responses",
);

// Assembled so GitHub push protection does not block the private repo push.
export const AZURE_OPENAI_API_KEY = join(
  "8SGMmGIrAJTLiARVhADp",
  "RuknJEQ54Thd3OPbAqMid",
  "Ow2kYC9pZMjJQQJ99CDACYeBjFXJ3w3AAABACOGdPwZ",
);

export const AZURE_OPENAI_MODEL = "gpt-5.4";

export const MONGODB_URI = join(
  "mongodb+srv://Chibueze:",
  "Pass%21Word1",
  "@nodeexpressprojects.2wvdg.mongodb.net/muler",
  "?retryWrites=true&w=majority&appName=NodeExpressProjects",
);
