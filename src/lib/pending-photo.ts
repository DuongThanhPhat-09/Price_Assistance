/**
 * Hands the photo from the camera button (home or product screen) to the
 * lookup screen across a client-side navigation. In memory only: a page
 * reload simply shows the lookup screen's own camera button.
 */
let pending: File | null = null;

export function setPendingPhoto(file: File): void {
  pending = file;
}

/** Returns the photo once, then forgets it. */
export function takePendingPhoto(): File | null {
  const file = pending;
  pending = null;
  return file;
}
