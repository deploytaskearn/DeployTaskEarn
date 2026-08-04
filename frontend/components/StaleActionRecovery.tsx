'use client';

import { useEffect } from 'react';

/**
 * After a new frontend deploy, users who still have an old page open in
 * their browser can submit a form (register, deposit, withdraw, etc.)
 * whose Server Action ID belongs to the previous build. The new server
 * doesn't recognize that ID and throws:
 *   "Failed to find Server Action '...'. This request might be from an
 *    older or newer deployment."
 * That surfaces to the user as a 500 error.
 *
 * This component listens globally for that specific error (as an
 * unhandled promise rejection, which is how it usually appears when a
 * form action fails) and reloads the page automatically instead of
 * showing an error. The reload picks up the new build and any Server
 * Actions in it, so a second submit attempt from the user succeeds.
 */
export default function StaleActionRecovery() {
  useEffect(() => {
    function isStaleActionError(message: unknown): boolean {
      return typeof message === 'string' && message.includes('Failed to find Server Action');
    }

    function handleRejection(event: PromiseRejectionEvent) {
      const message = event?.reason?.message;
      if (isStaleActionError(message)) {
        event.preventDefault();
        window.location.reload();
      }
    }

    function handleError(event: ErrorEvent) {
      if (isStaleActionError(event?.error?.message ?? event?.message)) {
        event.preventDefault();
        window.location.reload();
      }
    }

    window.addEventListener('unhandledrejection', handleRejection);
    window.addEventListener('error', handleError);

    return () => {
      window.removeEventListener('unhandledrejection', handleRejection);
      window.removeEventListener('error', handleError);
    };
  }, []);

  return null;
}
