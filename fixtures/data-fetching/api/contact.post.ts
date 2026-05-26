import { useStorage } from "nitro/storage";
import { readValidatedBody, setCookie } from "nitro/h3";

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

export default async function (event) {
  const body = await readValidatedBody(event, validateContactSubmission, {
    onError: () => ({
      message: "Email and message are required.",
      status: 422
    })
  });
  const storage = useStorage<StoredContactSubmission>("data-fetching");
  const key = `contact:${encodeURIComponent(body.email)}`;
  const stored: StoredContactSubmission = {
    ...body,
    receivedAt: "fixture"
  };

  await storage.setItem(key, stored);

  setCookie(event, "data-fetching-contact", key, {
    path: "/",
    sameSite: "lax"
  });
  event.res.status = 201;
  event.res.headers.set("x-data-fetching-source", "storage");

  return {
    key,
    requestId: event.context.requestId ?? null,
    saved: true,
    stored: await storage.getItem(key)
  };
}
