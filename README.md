# C2 Media Hub

Pilot-friendly launcher for Jellyfin and the official Xbox Cloud Gaming website, designed for the Hisense C2 projector with VIDAA OS 9.02.

## Features

- large focusable tiles for remote control and gamepad navigation
- real Gamepad API detection with D-pad/A/B navigation (no false "ready" state)
- locally stored Jellyfin server address
- built-in connectivity, latency, Jellyfin reachability, and controller diagnostics
- SSH tile that detects the launcher's host, stores user/port locally, and produces a ready connection command
- no credentials stored by the launcher
- automatic GitHub Actions build on every push and pull request

> Xbox Cloud Gaming requires a device supported by Microsoft. The launcher does not bypass VIDAA, DRM, regional, subscription, or device requirements.

## Low-latency setup

- Prefer Ethernet; otherwise use a strong 5 GHz Wi-Fi signal with the projector near the access point.
- For Jellyfin, use the server's local address and prefer Direct Play media (H.264 video, AAC audio, text subtitles). Enable supported hardware acceleration on the server when transcoding is unavoidable.
- Pair the controller in VIDAA before opening the launcher. The header changes to **Pad wykryty** only after the browser exposes it through the Gamepad API.
- Open **Test połączenia** before starting Xbox Cloud. The value is an HTTP response-time diagnostic, not an Xbox datacenter ping.

## SSH and the projector

The web launcher cannot enable SSH on VIDAA. Do not expose port 22 on the projector unless Hisense provides an official SSH/developer option for the exact firmware. For remote maintenance, enable key-only SSH on the Linux host that serves Jellyfin or this launcher; see [`docs/ssh.md`](docs/ssh.md).

On a supported Linux host, the one-time installer enables key-only SSH and automatic startup:

```bash
sudo scripts/setup-ssh-host.sh media 'ssh-ed25519 AAAA...your-public-key'
```

Never pass a private key to this command.

## Commands

Run `pnpm install`, then `pnpm dev` for development, `pnpm build` for production, or `pnpm test` for the complete build and test suite.
