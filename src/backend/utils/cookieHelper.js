const { CONFIG } = require("../config");

/**
 * Determines cookie domain.
 * Returns undefined for localhost/127.0.0.1 so the browser defaults to host-only cookie
 * (which works seamlessly on localhost and on Vercel *.vercel.app domains).
 */
function getCookieDomain() {
  const domain = process.env.FRONTEND_DOMAIN_COOKIE || CONFIG.FRONTEND_DOMAIN_COOKIE;
  if (!domain || domain === "localhost" || domain === "127.0.0.1" || domain.trim() === "") {
    return undefined;
  }
  return domain;
}

/**
 * Returns standard options for setting cookies
 * @param {number|string} expiryMs 
 * @param {boolean} httpOnly 
 */
function getCookieOptions(expiryMs, httpOnly = true) {
  const domain = getCookieDomain();
  const isProd = process.env.NODE_ENV === "production";

  const options = {
    expires: new Date(Date.now() + parseInt(expiryMs || 300000)),
    httpOnly: !!httpOnly,
    sameSite: "lax",
    secure: isProd,
    path: "/",
  };

  if (domain) {
    options.domain = domain;
  }

  return options;
}

/**
 * Returns options for clearing cookies
 * @param {boolean} httpOnly 
 */
function getClearCookieOptions(httpOnly = true) {
  const domain = getCookieDomain();
  const isProd = process.env.NODE_ENV === "production";

  const options = {
    expires: new Date(0),
    httpOnly: !!httpOnly,
    sameSite: "lax",
    secure: isProd,
    path: "/",
  };

  if (domain) {
    options.domain = domain;
  }

  return options;
}

module.exports = {
  getCookieDomain,
  getCookieOptions,
  getClearCookieOptions,
};
