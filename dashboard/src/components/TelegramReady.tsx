"use client";

import { useEffect } from "react";

type TgWebApp = { ready: () => void; expand: () => void };

/** When the dashboard is opened as a Telegram Mini App (Telegram appends tgWebAppData to the URL hash), load Telegram's official script,
 *  tell Telegram the page is ready and use the full height. Outside Telegram this does nothing and loads nothing. */
export function TelegramReady() {
  useEffect(() => {
    if (!window.location.hash.includes("tgWebAppData")) return;
    const s = document.createElement("script");
    s.src = "https://telegram.org/js/telegram-web-app.js";
    s.async = true;
    s.onload = () => {
      const app = (window as unknown as { Telegram?: { WebApp?: TgWebApp } }).Telegram?.WebApp;
      app?.ready();
      app?.expand();
    };
    document.head.appendChild(s);
    return () => s.remove();
  }, []);
  return null;
}
