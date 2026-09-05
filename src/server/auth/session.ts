import { createHmac, timingSafeEqual } from "node:crypto";

import { parseCookie, stringifySetCookie } from "cookie";

export const SESSION_COOKIE_NAME = "clipping_session";

const COOKIE_MAX_AGE = 60 * 60 * 24 * 7;

function getSecret() {
  const secret = process.env.AUTH_COOKIE_SECRET;

  if (!secret) {
    throw new Error("AUTH_COOKIE_SECRET is not configured");
  }

  return secret;
}

function sign(payload: string) {
  return createHmac("sha256", getSecret())
    .update(payload)
    .digest("base64url");
}

export function createSessionToken(userId: string) {
  const payload = `v1.${userId}`;
  const signature = sign(payload);

  return `${payload}.${signature}`;
}

export function verifySessionToken(
  token: string | undefined,
): string | null {
  if (!token) {
    return null;
  }

  const parts = token.split(".");

  if (parts.length !== 3) {
    return null;
  }

  const [version, userId, providedSignature] = parts;

  if (
    version !== "v1" ||
    !userId ||
    !providedSignature
  ) {
    return null;
  }

  const payload = `${version}.${userId}`;
  const expectedSignature = sign(payload);

  const providedBuffer = Buffer.from(providedSignature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (providedBuffer.length !== expectedBuffer.length) {
    return null;
  }

  if (!timingSafeEqual(providedBuffer, expectedBuffer)) {
    return null;
  }

  return userId;
}

export function getSessionUserIdFromRequest(
  request: Request,
): string | null {
  const cookieHeader = request.headers.get("cookie");

  if (!cookieHeader) {
    return null;
  }

  const cookies = parseCookie(cookieHeader);

  return verifySessionToken(
    cookies[SESSION_COOKIE_NAME],
  );
}

export function createSessionCookie(userId: string) {
  return stringifySetCookie({
    name: SESSION_COOKIE_NAME,
    value: createSessionToken(userId),
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });
}

export function clearSessionCookie() {
  return stringifySetCookie({
    name: SESSION_COOKIE_NAME,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}