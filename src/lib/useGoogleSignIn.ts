import { useCallback } from "react";
import { supabase } from "./supabase";

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string;

interface GisNotification {
  isNotDisplayed(): boolean;
  isSkippedMoment(): boolean;
}

interface GisCredentialResponse {
  credential: string;
}

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: object) => void;
          prompt: (callback?: (n: GisNotification) => void) => void;
          renderButton: (el: HTMLElement, options: object) => void;
          cancel: () => void;
        };
      };
    };
  }
}

/**
 * Returns a stable callback that triggers Google sign-in via the
 * Google Identity Services SDK (id_token flow — no redirects, no *.supabase.co).
 *
 * Strategy:
 *  1. Try One Tap (overlay prompt).
 *  2. If One Tap is blocked/dismissed, fall back to a rendered button click
 *     which opens the standard Google account-picker popup.
 */
export function useGoogleSignIn(
  onSuccess: () => void,
  onError: (message: string) => void
) {
  const signIn = useCallback(() => {
    if (!window.google) {
      onError("Google sign-in is not ready yet — please refresh and try again.");
      return;
    }

    window.google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: async (response: GisCredentialResponse) => {
        const { error } = await supabase.auth.signInWithIdToken({
          provider: "google",
          token: response.credential,
        });
        if (error) {
          onError(error.message);
        } else {
          onSuccess();
        }
      },
    });

    window.google.accounts.id.prompt((notification) => {
      // One Tap was suppressed (third-party cookie restrictions, prior dismissal, etc.)
      // Fall back to the standard popup account picker.
      if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
        const container = document.createElement("div");
        container.style.cssText = "position:absolute;width:0;height:0;overflow:hidden;";
        document.body.appendChild(container);

        window.google!.accounts.id.renderButton(container, {
          type: "icon",
          size: "large",
        });

        const btn = container.querySelector<HTMLElement>("div[role=button]");
        if (btn) btn.click();

        setTimeout(() => {
          if (document.body.contains(container)) {
            document.body.removeChild(container);
          }
        }, 500);
      }
    });
  }, [onSuccess, onError]);

  return signIn;
}
