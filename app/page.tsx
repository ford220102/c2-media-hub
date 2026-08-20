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
  const [xboxOpen, setXboxOpen] = useState(false);
  const [deviceOpen, setDeviceOpen] = useState(false);
  const [deviceConsent, setDeviceConsent] = useState(false);
  const [deviceReport, setDeviceReport] = useState("");
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
          setXboxOpen(false);
          setDeviceOpen(false);
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

  async function launchXbox() {
    try {
      if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
    } catch { /* Fullscreen may be unavailable in VIDAA. */ }
    window.location.assign(XBOX_URL);
  }

  async function runDeviceDiagnostics() {
    const video = document.createElement("video");
    const audio = document.createElement("audio");
    const started = performance.now();
    let xboxReachable = false;
    try {
      await fetch(`https://www.xbox.com/play?diagnostic=${Date.now()}`, { mode: "no-cors", cache: "no-store" });
      xboxReachable = true;
    } catch { /* Reported in the local report. */ }
    let sampleRate: number | string = "niedostępne";
    try {
      const AudioContextClass = window.AudioContext;
      const context = new AudioContextClass();
      sampleRate = context.sampleRate;
      await context.close();
    } catch { /* Web Audio may be unavailable on VIDAA. */ }
    const gamepads = Array.from(navigator.getGamepads?.() || []).filter(Boolean);
    const report = {
      consent: true,
      generatedAt: new Date().toISOString(),
      userAgent: navigator.userAgent,
      platform: navigator.platform || "niedostępna",
      language: navigator.language,
      screen: `${screen.width}x${screen.height}`,
      pixelRatio: window.devicePixelRatio,
      online: navigator.onLine,
      responseTimeMs: Math.round(performance.now() - started),
      fullscreen: Boolean(document.documentElement.requestFullscreen),
      gamepadApi: Boolean(navigator.getGamepads),
      connectedGamepads: gamepads.map((gamepad) => gamepad?.id),
      h264: video.canPlayType('video/mp4; codecs="avc1.42E01E"') || "nie",
      hevc: video.canPlayType('video/mp4; codecs="hvc1"') || "nie",
      vp9: video.canPlayType('video/webm; codecs="vp9"') || "nie",
      aac: audio.canPlayType('audio/mp4; codecs="mp4a.40.2"') || "nie",
      opus: audio.canPlayType('audio/webm; codecs="opus"') || "nie",
      audioSampleRateHz: sampleRate,
      xboxReachable,
      jellyfinConfigured: Boolean(jellyfin),
      localIp: "ukryty przez przeglądarkę",
      ssh: "niewykrywalne z bezpiecznej strony WWW",
    };
    setDeviceReport(JSON.stringify(report, null, 2));
  }

  async function copyDeviceReport() {
    if (deviceReport) await navigator.clipboard.writeText(deviceReport);
  }

  function downloadDeviceReport() {
    if (!deviceReport) return;
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([deviceReport], { type: "application/json" }));
    link.download = "c2-device-report.json";
    link.click();
    URL.revokeObjectURL(link.href);
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
        <button type="button" className="tile xbox" onClick={() => setXboxOpen(true)}><span className="tileIndex">02</span><span className="tileMark">X</span><span className="tileTitle">Xbox Cloud</span><span className="tileMeta">Tryb niskiego opóźnienia dla C2</span><span className="tileAction">PRZYGOTUJ <b>→</b></span></button>
        <button type="button" className="tile ssh" onClick={() => { setSshOpen(true); setCopied(false); }}><span className="tileIndex">03</span><span className="tileMark">›_</span><span className="tileTitle">SSH</span><span className="tileMeta">Dane bezpiecznego dostępu do hosta</span><span className="tileAction">POKAŻ IP <b>→</b></span></button>
      </section>
      <footer><div className="footerActions"><button type="button" className="settings" onClick={editAddress}>⚙ Jellyfin</button><button type="button" className="settings" onClick={() => setDiagnostics(true)}>Test połączenia</button><button type="button" className="settings" onClick={() => { setDeviceOpen(true); setDeviceConsent(false); setDeviceReport(""); }}>Diagnostyka projektora</button></div><p>Strzałki / D-pad · OK / A</p></footer>

      {editing && <dialog open className="overlay" aria-labelledby="dialog-title"><form className="dialog" onSubmit={(event) => { event.preventDefault(); saveAddress(); }}><p className="eyebrow">KONFIGURACJA</p><h2 id="dialog-title">Adres serwera Jellyfin</h2><p className="hint">Najmniejsze opóźnienie daje lokalny adres serwera w tej samej sieci.</p><input inputMode="url" autoComplete="off" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="192.168.1.20:8096" aria-label="Adres serwera Jellyfin" />{message && <p className="message" role="alert">{message}</p>}<div className="dialogActions"><button type="button" onClick={() => setEditing(false)}>Anuluj</button><button type="submit" className="primary">Zapisz</button></div></form></dialog>}
      {diagnostics && <dialog open className="overlay" aria-labelledby="diagnostics-title"><div className="dialog"><p className="eyebrow">DIAGNOSTYKA</p><h2 id="diagnostics-title">Sieć i urządzenia</h2><pre className="result" aria-live="polite">{testResult}</pre><p className="hint">Do Jellyfin wybieraj Direct Play H.264/AAC. Transkodowanie, HDR i napisy graficzne mogą powodować zacięcia.</p><div className="dialogActions"><button type="button" onClick={() => setDiagnostics(false)}>Zamknij</button><button type="button" className="primary" onClick={runDiagnostics}>Uruchom test</button></div></div></dialog>}
      {sshOpen && <dialog open className="overlay" aria-labelledby="ssh-title"><form className="dialog" onSubmit={(event) => { event.preventDefault(); saveSsh(); }}><p className="eyebrow">DOSTĘP ZDALNY</p><h2 id="ssh-title">SSH do hosta</h2><p className="hint">Adres hosta tej strony został wykryty automatycznie. SSH musi być wcześniej uruchomione na tym hoście przez <code>scripts/setup-ssh-host.sh</code>.</p><div className="sshGrid"><label>IP / host<input value={sshHost} readOnly /></label><label>Użytkownik<input value={sshUser} onChange={(event) => setSshUser(event.target.value)} autoComplete="username" /></label><label>Port<input value={sshPort} onChange={(event) => setSshPort(event.target.value)} inputMode="numeric" /></label></div><pre className="result">{sshCommand}</pre>{copied && <output className="message">Komenda skopiowana.</output>}<div className="dialogActions"><button type="button" onClick={() => setSshOpen(false)}>Zamknij</button><button type="button" onClick={copySshCommand}>Kopiuj komendę</button><button type="submit" className="primary">Zapisz</button></div></form></dialog>}
      {xboxOpen && <dialog open className="overlay" aria-labelledby="xbox-title"><div className="dialog xboxDialog"><p className="eyebrow">TRYB XBOX · HISENSE C2</p><h2 id="xbox-title">Przygotowanie bez trzasków i laga</h2><ol className="checklist"><li><b>Sieć:</b> Ethernet albo Wi‑Fi 5 GHz/6E, minimum 20 Mb/s. Nie używaj 2,4 GHz.</li><li><b>Obraz C2:</b> włącz Tryb Gra; wyłącz MEMC, redukcję szumów i inne ulepszacze obrazu.</li><li><b>Dźwięk C2:</b> wybierz Standard oraz PCM/stereo. Wyłącz DTS Virtual:X i dźwięk Bluetooth na czas gry.</li><li><b>Pad:</b> sparuj przed startem; nagłówek launchera powinien pokazywać „Pad wykryty”.</li><li><b>VIDAA:</b> zamknij aplikacje w tle. Jeśli dźwięk nadal charczy, użyj wspieranego urządzenia Xbox/Fire TV przez HDMI.</li></ol><p className="compatibility">Hisense VIDAA nie znajduje się na oficjalnej liście telewizorów Xbox Cloud; launcher nie może zmienić kodeków ani WebRTC systemowej przeglądarki.</p><div className="dialogActions"><button type="button" onClick={() => setXboxOpen(false)}>Wróć</button><button type="button" onClick={() => { setXboxOpen(false); setDiagnostics(true); }}>Test sieci</button><button type="button" className="primary" onClick={launchXbox}>Pełny ekran i uruchom</button></div></div></dialog>}
      {deviceOpen && <dialog open className="overlay" aria-labelledby="device-title"><div className="dialog xboxDialog"><p className="eyebrow">PRYWATNA DIAGNOSTYKA</p><h2 id="device-title">Raport projektora</h2>{!deviceConsent ? <><p className="hint">Test odczyta tylko informacje udostępniane stronie przez przeglądarkę: system, ekran, kodeki, audio, pad i dostępność Xbox. Nie skanuje sieci, nie odczytuje haseł i niczego automatycznie nie wysyła.</p><div className="dialogActions"><button type="button" onClick={() => setDeviceOpen(false)}>Nie zgadzam się</button><button type="button" className="primary" onClick={() => { setDeviceConsent(true); void runDeviceDiagnostics(); }}>Zgadzam się · rozpocznij</button></div></> : <><pre className="result deviceReport" aria-live="polite">{deviceReport || "Trwa diagnostyka…"}</pre><p className="hint">Przeczytaj raport przed udostępnieniem. Lokalny adres IP i SSH są celowo niewidoczne dla strony.</p><div className="dialogActions"><button type="button" onClick={() => { setDeviceReport(""); setDeviceOpen(false); }}>Usuń raport</button><button type="button" disabled={!deviceReport} onClick={copyDeviceReport}>Kopiuj</button><button type="button" disabled={!deviceReport} className="primary" onClick={downloadDeviceReport}>Pobierz JSON</button></div></>}</div></dialog>}
    </main>
  );
}
