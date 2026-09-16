import { redirect } from "next/navigation";

// The full auth page lives at /sign-up and switches to login via ?mode=login
// (ported verbatim from the Sonotrade frontend). /sign-in just enters it in
// login mode.
export default function SignInPage() {
  redirect("/sign-up?mode=login");
}
