/// <reference types="chrome" />
import { useEffect } from "react";

export interface ImportPayload {
  title: string;
  text: string;
  url: string;
}

export function useExtensionImport(onImport: (payload: ImportPayload) => void) {
  useEffect(() => {
    const isExtension = typeof chrome !== "undefined" && chrome.runtime?.id;

    if (!isExtension) return;

    chrome.storage.session
      .get("artemis:pendingImport")
      .then((stored: { [key: string]: unknown }) => {
        const payload = stored["artemis:pendingImport"] as ImportPayload | undefined;
        if (payload) {
          chrome.storage.session.remove("artemis:pendingImport");
          onImport(payload);
        }
      });

    const handler = (
      msg: { type: string; payload: ImportPayload },
    ) => {
      if (msg.type === "ARTEMIS_IMPORT") {
        onImport(msg.payload);
      }
    };
    chrome.runtime.onMessage.addListener(handler);

    return () => chrome.runtime.onMessage.removeListener(handler);
  }, [onImport]);
}
