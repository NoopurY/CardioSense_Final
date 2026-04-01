export function isAuthenticatedCookie() {
  if (typeof document === "undefined") return false;
  return document.cookie.includes("access_token=");
}
