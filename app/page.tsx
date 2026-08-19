"use client";

import { useEffect, useRef, useState } from "react";

const XBOX_URL = "https://www.xbox.com/play";

function normalizedUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
  try {
    const parsed = new URL(candidate);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.href : "";
  } catch {
    return "";
  }
}

export default function Home() {
  const [jellyfin, setJellyfin] = useState("");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [message, setMessage] = useState("");
  const jellyfinButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const saved = window.localStorage.getItem("c2-jellyfin-url") || "";
    setJellyfin(saved);
    setDraft(saved);
    jellyfinButton.current?.focus();
  }, []);

  function openJellyfin() {
    if (!jellyfin) {
      setEditing(true);
      setMessage("Najpierw wpisz adres serwera Jellyfin.");
      return;
    }
    window.location.assign(jellyfin);
  }

  function saveAddress() {
    const valid = normalizedUrl(draft);
    if (!valid) {
      setMessage("Wpisz poprawny adres, np. 192.168.1.20:8096");
      return;
    }
    window.localStorage.setItem("c2-jellyfin-url", valid);
    setJellyfin(valid);
    setDraft(valid);
    setEditing(false);
    setMessage("Adres Jellyfin zapisany na tym urządzeniu.");
    window.setTimeout(() => jellyfinButton.current?.focus(), 0);
  }

  return (
    <main className="shell">
      <header className="topbar">
        <div><p className="eyebrow">HISENSE C2 · VIDAA OS 9.02</p><h1>C2 Media Hub</h1></div>
        <div className="status"><span /> Pilot i pad gotowe</div>
      </header>

      <section className="hero" aria-label="Wybór usługi">
        <button ref={jellyfinButton} className="tile jellyfin" onClick={openJellyfin}>
          <span className="tileIndex">01</span><span className="tileMark">J</span>
          <span className="tileTitle">Jellyfin</span><span className="tileMeta">Twoje filmy i seriale</span>
          <span className="tileAction">OTWÓRZ <b>→</b></span>
        </button>
        <button className="tile xbox" onClick={() => window.location.assign(XBOX_URL)}>
          <span className="tileIndex">02</span><span className="tileMark">X</span>
          <span className="tileTitle">Xbox Cloud</span><span className="tileMeta">Graj przez oficjalną usługę</span>
          <span className="tileAction">URUCHOM <b>→</b></span>
        </button>
      </section>

      <footer>
        <button className="settings" onClick={() => { setEditing(true); setMessage(""); }}>⚙ Ustaw adres Jellyfin</button>
        <p>Poruszaj się strzałkami · zatwierdź OK</p>
      </footer>

      {editing && (
        <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="dialog-title">
          <form className="dialog" onSubmit={(event) => { event.preventDefault(); saveAddress(); }}>
            <p className="eyebrow">KONFIGURACJA</p><h2 id="dialog-title">Adres serwera Jellyfin</h2>
            <p className="hint">Projektor i serwer muszą być w tej samej sieci.</p>
            <input autoFocus value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="192.168.1.20:8096" aria-label="Adres serwera Jellyfin" />
            {message && <p className="message">{message}</p>}
            <div className="dialogActions"><button type="button" onClick={() => setEditing(false)}>Anuluj</button><button type="submit" className="primary">Zapisz</button></div>
          </form>
        </div>
      )}
    </main>
  );
}
