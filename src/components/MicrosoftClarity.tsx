const CLARITY_PROJECT_ID = "xijsk7z6i2";
const clarityScript = `
  (function(c,l,a,r,i,t,y){
    if (c.location && c.location.pathname.indexOf("/admin") === 0) return;
    c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
    t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
    y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
  })(window, document, "clarity", "script", "${CLARITY_PROJECT_ID}");
`;

type MicrosoftClarityProps = {
  enabled: boolean;
};

export default function MicrosoftClarity({ enabled }: MicrosoftClarityProps) {
  if (!enabled) {
    return null;
  }

  return (
    <script
      id="microsoft-clarity"
      type="text/javascript"
      dangerouslySetInnerHTML={{ __html: clarityScript }}
    />
  );
}
