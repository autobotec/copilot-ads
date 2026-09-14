# 🤖 Copilot Driver - Tablet Kiosk Web App

Aplicación interactiva diseñada para pantallas y tablets de pasajeros en vehículos rideshare (Uber, Lyft, taxis), inspirada en sistemas como PlayOctopus con una estética **Holi / Paint Color Splash Explosion**.

---

## ✨ Características Principales

1. **🎮 Hub de Minijuegos en Vivo**:
   - **Classic Trivia**: Banco masivo de **500 preguntas bilingües** (español e inglés) con algoritmo de barajado aleatorio **Fisher-Yates Shuffle** tanto en las preguntas como en el orden de las 4 opciones.
   - **Picture Trivia**: Reto visual con pistas e imágenes para adivinar películas, monumentos y personajes.
   - **Copilot Splash Says**: Juego de memoria y reflejos tipo Simon con disco interactivo de 4 cuadrantes luminosos y sonido sintetizado.
   - **Speed Match**: Juego de cartas contrarreloj con combinaciones dinámicas y temporizador de 40 segundos.

2. **🗺️ Información de Viaje & Perfil del Conductor**:
   - Barra de progreso de viaje en tiempo real (distancia restante, tiempo estimado y destino).
   - Perfil profesional del conductor con calificación ⭐ 4.98 y más de 3,800 viajes.
   - Módulo de propinas rápidas ($2, $5, $10 o personalizado) con código QR de pago instantáneo.
   - Peticiones amigables al pasajero (selección de música, control de aire acondicionado y cargadores disponibles).

3. **📢 Centro de Medios & Anuncios Interactivos**:
   - Álbumes más escuchados del momento (Billboard Top).
   - Resultados y marcadores de deportes en vivo.
   - Cupones y recompensas exclusivas con códigos QR interactivos para pasajeros.
   - Reproductor de video promocional en bucle.

4. **🌐 Soporte Bilingüe Instantáneo**:
   - Selector en cabecera para alternar dinámicamente entre **Español (ES)** e **Inglés (EN)** sin recargar la página.

5. **🔊 Motor de Audio Web**:
   - Efectos de sonido sintetizados mediante la Web Audio API (aciertos, fallos, clics y fanfarrias).

---

## 🚀 Despliegue y Ejecución

Para iniciar localmente con cualquier servidor estático:

```bash
# Con Python
python3 -m http.server 8888

# Con Node / npx serve
npx serve -l 3009
```
Abre en tu navegador `http://localhost:8888/` o `http://localhost:3009/`.

---

## 📁 Estructura del Proyecto

```
tablet-app/
├── index.html            # Markup principal y vistas de la aplicación
├── style.css             # Sistema de diseño Color Splash ultra-moderno
├── manifest.json         # Configuración PWA para tablets
├── src/
│   ├── app.js            # Controlador central de navegación, vistas y eventos
│   ├── audio.js          # Sintetizador de audio con Web Audio API
│   ├── i18n.js           # Diccionario y motor bilingüe (ES / EN)
│   ├── triviaData.js     # Banco de 500 preguntas bilingües aleatorias
│   ├── mediaData.js      # Datos de álbumes y noticias deportivas
│   ├── adsData.js        # Configuración de anuncios y recompensas QR
│   ├── giveawaysData.js  # Sorteos y promociones de pasajeros
│   └── games/
│       ├── colorMemory.js    # Lógica de Copilot Says
│       ├── pictureTrivia.js  # Lógica del Reto Visual
│       └── speedMatch.js     # Lógica de parejas contrarreloj
└── assets/
    └── videos/
        └── demo_promo.mp4    # Video promocional demostrativo
```
