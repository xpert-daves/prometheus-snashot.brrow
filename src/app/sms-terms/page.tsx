import { permanentRedirect } from "next/navigation";

export default function SmsTermsRedirectPage() {
  permanentRedirect("/terms-and-conditions#sms-terms");
}
