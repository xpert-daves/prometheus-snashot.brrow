import Script from "next/script";

const GOOGLE_TAG_ID = "G-N8R0RDXRM0";
const googleTagInitScript = `
  window.dataLayer = window.dataLayer || [];
  window.gtag = function(){window.dataLayer.push(arguments);}
  window.gtag('js', new Date());

  window.gtag('config', '${GOOGLE_TAG_ID}');
`;

type GoogleTagProps = {
  enabled: boolean;
};

export default function GoogleTag({ enabled }: GoogleTagProps) {
  if (!enabled) {
    return null;
  }

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GOOGLE_TAG_ID}`}
        strategy="lazyOnload"
      />
      <Script id="gtag-init" strategy="lazyOnload">
        {googleTagInitScript}
      </Script>
    </>
  );
}
