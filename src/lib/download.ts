'use client';

/**
 * Downloading a file from an endpoint that needs a bearer token.
 *
 * A plain `<a href>` cannot carry the Authorization header, so the browser
 * would arrive unauthenticated and download a 401 page named like a report —
 * which looks like a corrupt file rather than a permission problem. So the
 * request is made with fetch, and the response is handed to the browser as a
 * blob.
 *
 * The filename comes from the server's Content-Disposition when there is one.
 * The server already dates and names these; duplicating that here would be a
 * second source of truth that drifts from the first.
 */

const FILENAME_PATTERN = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i;

function filenameFrom(disposition: string | null, fallback: string): string {
  if (!disposition) return fallback;
  const match = FILENAME_PATTERN.exec(disposition);
  return match ? decodeURIComponent(match[1].trim()) : fallback;
}

export async function downloadWithAuth(
  url: string,
  token: string,
  fallbackName: string,
): Promise<void> {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    // Read the API's own message rather than inventing one — a 403 here means
    // "your role cannot see this report", which is worth saying plainly.
    let detail = `Download failed (${response.status})`;
    try {
      const body = await response.json();
      if (body?.detail) detail = typeof body.detail === 'string' ? body.detail : detail;
    } catch {
      /* not JSON — keep the status message */
    }
    throw new Error(detail);
  }

  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');

  anchor.href = objectUrl;
  anchor.download = filenameFrom(
    response.headers.get('Content-Disposition'), fallbackName,
  );
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  // Freed on the next tick: revoking synchronously can cancel the download in
  // some browsers before it has started reading.
  setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
}
