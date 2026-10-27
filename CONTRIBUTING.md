# Cómo contribuir

¡Gracias por querer mejorar Simple Sample! Toda ayuda es bienvenida: reportes de bugs, ideas, documentación o código.

## Reportar un bug o proponer una idea

Abre un [issue](https://github.com/hstev/simple-sample/issues) e incluye:

- Qué esperabas que pasara y qué pasó en realidad.
- Pasos para reproducirlo.
- Navegador, sistema operativo y dispositivo (móvil / tablet / desktop).
- Formato del audio si el problema es al importar (MP3, WAV, OGG, M4A).

## Preparar el entorno

Requiere Node ≥ 22.12 (recomendado 24, igual que la CI).

```sh
git clone git@github.com:hstev/simple-sample.git
cd simple-sample
nvm use        # o instala la versión de .nvmrc
npm install
npm run dev
```

## Flujo de trabajo

1. Haz un fork y crea una rama desde `main`: `git checkout -b feat/mi-cambio`.
2. Haz cambios pequeños y enfocados; un PR por tema.
3. Antes de abrir el PR, verifica que todo pasa:
   ```sh
   npm run check   # tipos (svelte-check)
   npm run build   # build de producción
   ```
4. Prueba el cambio en el navegador, idealmente también en móvil (`npm run dev` expone la app en tu red local).
5. Abre el Pull Request contra `main` describiendo el qué y el porqué. La CI ejecuta `check` y `build` en cada PR.

### Mensajes de commit

Usamos [Conventional Commits](https://www.conventionalcommits.org/es/):
`feat: …`, `fix: …`, `docs: …`, `refactor: …`, `chore: …`.

## Guía de estilo

- **TypeScript + Svelte 5** (runes). Sigue el estilo del código que ya existe.
- **Sin backend**: todo el procesamiento de audio ocurre en el navegador con la Web Audio API. No agregues dependencias de servidores ni APIs externas.
- **Mobile-first**: cualquier UI nueva debe funcionar con el dedo y en pantallas pequeñas.
- El trabajo pesado (p. ej. cálculo de picos) va en Web Workers para no bloquear la UI.
- Mantén las dependencias al mínimo.

### Estructura

```
src/
  audio/   motor de audio, decodificación, edición, slicer, voces
  input/   teclado y MIDI
  state/   estado del proyecto y persistencia (IndexedDB)
  ui/      componentes Svelte
  lib/     utilidades
docker/    helper opcional con yt-dlp para uso local
```

## Licencia

Al contribuir aceptas que tu aporte se publique bajo la [licencia MIT](LICENSE) del proyecto.
