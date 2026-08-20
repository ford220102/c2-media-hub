"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const XBOX_URL = "https://www.xbox.com/play";
const STORAGE_KEY = "c2-jellyfin-url";
const SSH_USER_KEY = "c2-ssh-user";
const SSH_PORT_KEY = "c2-ssh-port";

function normalizedUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
  try {
    const parsed = new URL(candidate);
    if (!(["http:", "https:"].includes(parsed.protocol)) || parsed.username || parsed.password) return "";
    return parsed.href;
  } catch {
    return "";
  }
}

function buttonEdge(gamepad: Gamepad, index: number, previous: Map<number, boolean>) {
  const pressed = Boolean(gamepad.buttons[index]?.pressed);
  const edge = pressed && !previous.get(index);
  previous.set(index, pressed);
  return edge;
}

function networkQuality(internet: boolean, latency: number) {
  if (!internet) return "Brak internetu — sprawdź sieć.";
  if (latency <= 60) return "Dobre warunki do grania w chmurze.";
  if (latency <= 120) return "Możliwe wyczuwalne opóźnienie.";
  return "Duże opóźnienie — użyj Ethernetu lub Wi‑Fi 5 GHz.";
}

function validPort(value: string) {
  const port = Number(value);
  return Number.isInteger(port) && port >= 1 && port <= 65535 ? String(port) : "22";
}

function handleGamepad(
  gamepad: Gamepad,
  previous: Map<number, boolean>,
  lastAction: number,
  moveFocus: (direction: number) => void,
  closeOverlays: () => void,
) {
  const now = performance.now();
  const edge = (index: number) => buttonEdge(gamepad, index, previous);
  const axis = gamepad.axes[1] || 0;
  let nextAction = lastAction;
  if (edge(12) || (axis < -0.65 && now - lastAction > 220)) { moveFocus(-1); nextAction = now; }
  if (edge(13) || (axis > 0.65 && now - lastAction > 220)) { moveFocus(1); nextAction = now; }
  if (edge(0)) (document.activeElement as HTMLElement | null)?.click();
  if (edge(1)) closeOverlays();
  return nextAction;
}

export default function Home() {
  const [jellyfin, setJellyfin] = useState(() => typeof window === "undefined" ? "" : normalizedUrl(window.localStorage.getItem(STORAGE_KEY) || ""));
  const [editing, setEditing] = useState(false);
  const [diagnostics, setDiagnostics] = useState(false);
  const [sshOpen, setSshOpen] = useState(false);
  const [sshUser, setSshUser] = useState(() => typeof window === "undefined" ? "media" : window.localStorage.getItem(SSH_USER_KEY) || "media");
  const [sshPort, setSshPort] = useState(() => typeof window === "undefined" ? "22" : window.localStorage.getItem(SSH_PORT_KEY) || "22");
  const [copied, setCopied] = useState(false);
  const [draft, setDraft] = useState(() => typeof window === "undefined" ? "" : normalizedUrl(window.localStorage.getItem(STORAGE_KEY) || ""));
  const [message, setMessage] = useState("");
  const [pad, setPad] = useState(false);
  const [testResult, setTestResult] = useState("Naciśnij „Uruchom test”.");
  const jellyfinButton = useRef<HTMLButtonElement>(null);
  const lastPadAction = useRef(0);

  const moveFocus = useCallback((direction: number) => {
    const items = Array.from(document.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled])'))
      .filter((item) => item.offsetParent !== null);
    if (!items.length) return;
    const current = Math.max(0, items.indexOf(document.activeElement as HTMLElement));
    items[(current + direction + items.length) % items.length]?.focus();
  }, []);

  useEffect(() => {
    jellyfinButton.current?.focus();

    let frame = 0;
    const previous = new Map<number, boolean>();
    const pollGamepads = () => {
      const gamepad = Array.from(navigator.getGamepads?.() || []).find(Boolean);
      setPad(Boolean(gamepad));
      if (gamepad) {
        lastPadAction.current = handleGamepad(gamepad, previous, lastPadAction.current, moveFocus, () => {
          setEditing(false);
          setDiagnostics(false);
          setSshOpen(false);
        });
      }
      frame = requestAnimationFrame(pollGamepads);
    };
    frame = requestAnimationFrame(pollGamepads);
    return () => cancelAnimationFrame(frame);
  }, [moveFocus]);

  const sshHost = typeof window === "undefined" ? "adres-hosta" : window.location.hostname;
  const validSshPort = validPort(sshPort);
  const validSshUser = /^[a-z_][a-z0-9_-]{0,31}$/i.test(sshUser) ? sshUser : "media";
  const sshCommand = `ssh -p ${validSshPort} ${validSshUser}@${sshHost}`;

  function saveSsh() {
    setSshUser(validSshUser);
    setSshPort(validSshPort);
    window.localStorage.setItem(SSH_USER_KEY, validSshUser);
    window.localStorage.setItem(SSH_PORT_KEY, validSshPort);
  }

  async function copySshCommand() {
    saveSsh();
    try { await navigator.clipboard.writeText(sshCommand); setCopied(true); }
    catch { setCopied(false); }
  }

  function openJellyfin() {
    if (!jellyfin) {
      setEditing(true);
      setMessage("Najpierw wpisz adres serwera Jellyfin.");
      window.setTimeout(() => document.querySelector<HTMLInputElement>('[aria-label="Adres serwera Jellyfin"]')?.focus(), 0);
      return;
    }
    window.location.assign(jellyfin);
  }

  function editAddress() {
    setEditing(true);
    setMessage("");
    window.setTimeout(() => document.querySelector<HTMLInputElement>('[aria-label="Adres serwera Jellyfin"]')?.focus(), 0);
  }

  function saveAddress() {
    const valid = normalizedUrl(draft);
    if (!valid) {
      setMessage("Wpisz poprawny adres HTTP(S), np. 192.168.1.20:8096");
      return;
    }
    window.localStorage.setItem(STORAGE_KEY, valid);
    setJellyfin(valid);
    setDraft(valid);
    setEditing(false);
    setMessage("");
    window.setTimeout(() => jellyfinButton.current?.focus(), 0);
  }

  async function runDiagnostics() {
    setTestResult("Testuję połączenie…");
    const started = performance.now();
    let internet = false;
    try {
      await fetch(`https://www.cloudflare.com/cdn-cgi/trace?t=${Date.now()}`, { mode: "no-cors", cache: "no-store" });
      internet = true;
    } catch { /* reported below */ }
    const latency = Math.round(performance.now() - started);
    let server = "adres nieustawiony";
    if (jellyfin) {
      try {
        await fetch(`${jellyfin.replace(/\/$/, "")}/System/Info/Public`, { mode: "no-cors", cache: "no-store" });
        server = "osiągalny";
      } catch { server = "brak odpowiedzi / blokada CORS"; }
    }
    const quality = networkQuality(internet, latency);
    setTestResult(`Internet: ${internet ? "OK" : "BŁĄD"} · odpowiedź ${latency} ms\nJellyfin: ${server}\nPad: ${pad ? "wykryty" : "niewykryty"}\n${quality}`);
  }

  return (
    <main className="shell">
      <header className="topbar">
        <div><p className="eyebrow">HISENSE C2 · VIDAA OS</p><h1>C2 Media Hub</h1></div>
        <div className={`status ${pad ? "connected" : ""}`}><span />{pad ? "Pad wykryty" : "Pilot gotowy · pad niewykryty"}</div>
      </header>
      <section className="hero" aria-label="Wybór usługi">
        <button type="button" ref={jellyfinButton} className="tile jellyfin" onClick={openJellyfin}><span className="tileIndex">01</span><span className="tileMark">J</span><span className="tileTitle">Jellyfin</span><span className="tileMeta">Twoje filmy i seriale</span><span className="tileAction">OTWÓRZ <b>→</b></span></button>
        <button type="button" className="tile xbox" onClick={() => window.location.assign(XBOX_URL)}><span className="tileIndex">02</span><span className="tileMark">X</span><span className="tileTitle">Xbox Cloud</span><span className="tileMeta">Wymaga zgodnej przeglądarki VIDAA</span><span className="tileAction">URUCHOM <b>→</b></span></button>
        <button type="button" className="tile ssh" onClick={() => { setSshOpen(true); setCopied(false); }}><span className="tileIndex">03</span><span className="tileMark">›_</span><span className="tileTitle">SSH</span><span className="tileMeta">Dane bezpiecznego dostępu do hosta</span><span className="tileAction">POKAŻ IP <b>→</b></span></button>
      </section>
      <footer><div className="footerActions"><button type="button" className="settings" onClick={editAddress}>⚙ Jellyfin</button><button type="button" className="settings" onClick={() => setDiagnostics(true)}>Test połączenia</button></div><p>Strzałki / D-pad · OK / A</p></footer>

      {editing && <dialog open className="overlay" aria-labelledby="dialog-title"><form className="dialog" onSubmit={(event) => { event.preventDefault(); saveAddress(); }}><p className="eyebrow">KONFIGURACJA</p><h2 id="dialog-title">Adres serwera Jellyfin</h2><p className="hint">Najmniejsze opóźnienie daje lokalny adres serwera w tej samej sieci.</p><input inputMode="url" autoComplete="off" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="192.168.1.20:8096" aria-label="Adres serwera Jellyfin" />{message && <p className="message" role="alert">{message}</p>}<div className="dialogActions"><button type="button" onClick={() => setEditing(false)}>Anuluj</button><button type="submit" className="primary">Zapisz</button></div></form></dialog>}
      {diagnostics && <dialog open className="overlay" aria-labelledby="diagnostics-title"><div className="dialog"><p className="eyebrow">DIAGNOSTYKA</p><h2 id="diagnostics-title">Sieć i urządzenia</h2><pre className="result" aria-live="polite">{testResult}</pre><p className="hint">Do Jellyfin wybieraj Direct Play H.264/AAC. Transkodowanie, HDR i napisy graficzne mogą powodować zacięcia.</p><div className="dialogActions"><button type="button" onClick={() => setDiagnostics(false)}>Zamknij</button><button type="button" className="primary" onClick={runDiagnostics}>Uruchom test</button></div></div></dialog>}
      {sshOpen && <dialog open className="overlay" aria-labelledby="ssh-title"><form className="dialog" onSubmit={(event) => { event.preventDefault(); saveSsh(); }}><p className="eyebrow">DOSTĘP ZDALNY</p><h2 id="ssh-title">SSH do hosta</h2><p className="hint">Adres hosta tej strony został wykryty automatycznie. SSH musi być wcześniej uruchomione na tym hoście przez <code>scripts/setup-ssh-host.sh</code>.</p><div className="sshGrid"><label>IP / host<input value={sshHost} readOnly /></label><label>Użytkownik<input value={sshUser} onChange={(event) => setSshUser(event.target.value)} autoComplete="username" /></label><label>Port<input value={sshPort} onChange={(event) => setSshPort(event.target.value)} inputMode="numeric" /></label></div><pre className="result">{sshCommand}</pre>{copied && <output className="message">Komenda skopiowana.</output>}<div className="dialogActions"><button type="button" onClick={() => setSshOpen(false)}>Zamknij</button><button type="button" onClick={copySshCommand}>Kopiuj komendę</button><button type="submit" className="primary">Zapisz</button></div></form></dialog>}
    </main>
  );
}
