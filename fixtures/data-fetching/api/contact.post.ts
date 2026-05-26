import { useStorage } from "nitro/storage";

interface ContactSubmission {
  readonly email: string;
  readonly message: string;
}

interface StoredContactSubmission extends ContactSubmission {
  readonly receivedAt: string;
}

function validateContactSubmission(input: unknown): ContactSubmission | false {
  if (!isRecord(input)) {
    return false;
  }

  const email = typeof input.email === "string" ? input.email.trim() : "";
  const message = typeof input.message === "string" ? input.message.trim() : "";

  if (!email.includes("@") || message.length < 2) {
    return false;
  }

  return { email, message };
}

function isRecord(input: unknown): input is Record<string, unknown> {
  return typeof input === "object" && input !== null;
}

function submissionFromFormData(formData: FormData) {
  return {
    email: formData.get("email"),
    message: formData.get("message")
  };
}

export default async function (http) {
  const body = validateContactSubmission(
    submissionFromFormData(await http.request.formData())
  );
  if (!body) {
    http.response.status = 422;
    return {
      message: "Email and message are required."
    };
  }

  const storage = useStorage<StoredContactSubmission>("data-fetching");
  const key = `contact:${encodeURIComponent(body.email)}`;
  const stored: StoredContactSubmission = {
    ...body,
    receivedAt: "fixture"
  };

  await storage.setItem(key, stored);

  http.response.status = 201;
  http.response.headers.append(
    "set-cookie",
    `data-fetching-contact=${encodeURIComponent(key)}; Path=/; SameSite=Lax`
  );
  http.response.headers.set("x-data-fetching-source", "storage");

  return {
    key,
    requestId: http.locals.requestId ?? null,
    saved: true,
    stored: await storage.getItem(key)
  };
}
