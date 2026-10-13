import type { Signer } from "./relay";

/** What the (lazy-loaded) Dynamic integration reports back to the rest of the app. */
export type DynamicAuth = {
  /** which screen the sign-in form should show */
  step: "email" | "code" | "wallet";
  /** a user is signed in to Dynamic (their wallet may still be being created) */
  loggedIn: boolean;
  userEmail: string | null;
  busy: boolean;
  error: string | null;
  /** true once a passkey was turned on from this browser */
  passkeyRegistered: boolean;
  passkeyStatus?: string | null;
  passkeyError?: string | null;
  sendCode: (email: string) => Promise<void>;
  verifyCode: (code: string) => Promise<void>;
  /** back to the email step */
  reset: () => void;
  signInWithPasskey: () => Promise<void>;
  /** turn on Face ID / fingerprint for the signed-in user */
  registerPasskey: () => Promise<void>;
  retryWalletSetup: () => Promise<void>;
};

export type Bridge = {
  signer: Signer | null;
  ready: boolean;
  logout: () => void;
  auth?: DynamicAuth;
};
