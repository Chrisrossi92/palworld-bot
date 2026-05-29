const crypto = require("crypto");

const SESSION_COOKIE_NAME = "palworld_dashboard_session";
const STATE_COOKIE_NAME = "palworld_oauth_state";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 8;
const STATE_MAX_AGE_SECONDS = 60 * 10;

function base64UrlEncode(value) {
  return Buffer.from(value).toString("base64url");
}

function base64UrlDecode(value) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function getSessionSecret() {
  const secret = process.env.DASHBOARD_SESSION_SECRET;

  if (!secret) {
    throw new Error("DASHBOARD_SESSION_SECRET is required for dashboard sessions.");
  }

  return secret;
}

function signValue(value) {
  const signature = crypto
    .createHmac("sha256", getSessionSecret())
    .update(value)
    .digest("base64url");

  return `${value}.${signature}`;
}

function verifySignedValue(signedValue) {
  if (!signedValue || !signedValue.includes(".")) {
    return null;
  }

  const separatorIndex = signedValue.lastIndexOf(".");
  const value = signedValue.slice(0, separatorIndex);
  const signature = signedValue.slice(separatorIndex + 1);
  const expected = crypto
    .createHmac("sha256", getSessionSecret())
    .update(value)
    .digest("base64url");

  if (
    signature.length !== expected.length ||
    !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
  ) {
    return null;
  }

  return value;
}

function parseCookies(request) {
  const cookies = {};
  const header = request.headers.cookie || "";

  for (const part of header.split(";")) {
    const [name, ...valueParts] = part.trim().split("=");

    if (!name) {
      continue;
    }

    cookies[name] = decodeURIComponent(valueParts.join("="));
  }

  return cookies;
}

function shouldUseSecureCookies() {
  return (
    process.env.NODE_ENV === "production" ||
    String(process.env.DASHBOARD_BASE_URL || "").startsWith("https://")
  );
}

function serializeCookie(name, value, options = {}) {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    `Path=${options.path || "/"}`,
    `SameSite=${options.sameSite || "Lax"}`,
  ];

  if (options.httpOnly !== false) {
    parts.push("HttpOnly");
  }

  if (typeof options.maxAge === "number") {
    parts.push(`Max-Age=${options.maxAge}`);
  }

  if (options.secure !== false && shouldUseSecureCookies()) {
    parts.push("Secure");
  }

  return parts.join("; ");
}

function encodeSignedJson(payload) {
  return signValue(base64UrlEncode(JSON.stringify(payload)));
}

function decodeSignedJson(value) {
  const unsigned = verifySignedValue(value);

  if (!unsigned) {
    return null;
  }

  try {
    return JSON.parse(base64UrlDecode(unsigned));
  } catch (error) {
    return null;
  }
}

function createSessionCookie(session) {
  return serializeCookie(SESSION_COOKIE_NAME, encodeSignedJson(session), {
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

function clearSessionCookie() {
  return serializeCookie(SESSION_COOKIE_NAME, "", {
    maxAge: 0,
  });
}

function readSession(request) {
  const session = decodeSignedJson(parseCookies(request)[SESSION_COOKIE_NAME]);

  if (!session || !session.expiresAt || session.expiresAt <= Date.now()) {
    return null;
  }

  return session;
}

function createOAuthState() {
  return crypto.randomBytes(24).toString("base64url");
}

function createStateCookie(state) {
  return serializeCookie(STATE_COOKIE_NAME, signValue(state), {
    maxAge: STATE_MAX_AGE_SECONDS,
  });
}

function clearStateCookie() {
  return serializeCookie(STATE_COOKIE_NAME, "", {
    maxAge: 0,
  });
}

function readOAuthState(request) {
  return verifySignedValue(parseCookies(request)[STATE_COOKIE_NAME]);
}

module.exports = {
  SESSION_MAX_AGE_SECONDS,
  clearSessionCookie,
  clearStateCookie,
  createOAuthState,
  createSessionCookie,
  createStateCookie,
  readOAuthState,
  readSession,
};
