"use client";

import { useEffect } from "react";

type ClarityScriptProps = {
    clarityId: string;
};

export default function ClarityScript({ clarityId }: ClarityScriptProps) {
    useEffect(() => {
        if (!clarityId) return;

        const consent = document.cookie
            .split("; ")
            .find((row) => row.startsWith("analytics_consent="));
        if (!consent || consent.split("=")[1] !== "granted") return;

        const script = document.createElement("script");
        script.type = "text/javascript";
        script.async = true;
        script.innerHTML = `
      (function(c,l,a,r,i,t,y){
        c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
        t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
        y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
      })(window, document, "clarity", "script", "${clarityId}");
    `;
        document.head.appendChild(script);

        return () => {
            document.head.removeChild(script);
        };
    }, [clarityId]);

    return null;
}
