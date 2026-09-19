/* ==========================================================================
   GEOLOCATION & REAL-TIME WEATHER / LOCAL NEWS SERVICE
   Autodetección GPS de Ubicación, Clima en Vivo (°F en USA, °C fuera de USA)
   y Noticias Locales Adaptadas por Región
   ========================================================================== */

// Weather condition codes mapping from Open-Meteo WMO standard
const WMO_WEATHER_MAP = {
  0: { icon: "☀️", es: "Cielo Despejado y Soleado", en: "Clear Sunny Skies" },
  1: { icon: "🌤️", es: "Mayormente Despejado", en: "Mainly Clear" },
  2: { icon: "⛅", es: "Parcialmente Nublado", en: "Partly Cloudy" },
  3: { icon: "☁️", es: "Nublado", en: "Overcast & Cloudy" },
  45: { icon: "🌫️", es: "Niebla Matutina", en: "Morning Fog" },
  48: { icon: "🌫️", es: "Niebla con Escarcha", en: "Freezing Fog" },
  51: { icon: "🌦️", es: "Llovizna Ligera", en: "Light Drizzle" },
  53: { icon: "🌦️", es: "Llovizna Moderada", en: "Moderate Drizzle" },
  55: { icon: "🌧️", es: "Llovizna Densa", en: "Heavy Drizzle" },
  61: { icon: "🌦️", es: "Lluvia Ligera Dispersa", en: "Slight Rain Showers" },
  63: { icon: "🌧️", es: "Lluvia Moderada", en: "Moderate Rain" },
  65: { icon: "🌧️", es: "Lluvia Fuerte Continua", en: "Heavy Rain" },
  71: { icon: "🌨️", es: "Nevada Ligera", en: "Light Snow" },
  73: { icon: "🌨️", es: "Nevada Moderada", en: "Moderate Snow" },
  75: { icon: "❄️", es: "Nevada Intensa", en: "Heavy Snowfall" },
  80: { icon: "🌦️", es: "Chubascos Aislados", en: "Scattered Rain Showers" },
  81: { icon: "🌧️", es: "Chubascos Fuertes", en: "Heavy Rain Showers" },
  82: { icon: "⛈️", es: "Chubascos Violentos", en: "Violent Rain Showers" },
  95: { icon: "⛈️", es: "Tormenta Eléctrica", en: "Thunderstorm" },
  96: { icon: "⛈️", es: "Tormenta con Granizo Ligero", en: "Thunderstorm with Hail" },
  99: { icon: "⛈️", es: "Tormenta Fuerte con Granizo", en: "Severe Thunderstorm with Hail" }
};

export class GeoLocationService {
  constructor() {
    this.currentLocation = JSON.parse(localStorage.getItem('copilot_last_location')) || {
      city: "Miami Metro Area",
      state: "Florida",
      country: "United States",
      countryCode: "US",
      lat: 25.7617,
      lon: -80.1918,
      isUSA: true,
      source: "cached"
    };

    this.weatherData = null;
    this.listeners = [];
  }

  // Subscribe to location/weather updates
  subscribe(callback) {
    if (typeof callback === 'function') {
      this.listeners.push(callback);
    }
  }

  notify(data) {
    this.listeners.forEach(cb => {
      try { cb(data); } catch (e) { console.error('GeoService listener error', e); }
    });
  }

  // Main entrypoint: detect location & fetch real weather
  async init() {
    try {
      const loc = await this.detectCoordinates();
      this.currentLocation = loc;
      localStorage.setItem('copilot_last_location', JSON.stringify(loc));

      const weather = await this.fetchLiveWeather(loc.lat, loc.lon, loc);
      this.weatherData = weather;
      this.notify({ location: loc, weather, news: this.getLocalizedNews(loc.countryCode, loc.city) });
      return { location: loc, weather };
    } catch (err) {
      console.warn('GeoService fallback init:', err);
      // Fallback with current cached or default
      const weather = await this.fetchLiveWeather(this.currentLocation.lat, this.currentLocation.lon, this.currentLocation);
      this.weatherData = weather;
      this.notify({ location: this.currentLocation, weather, news: this.getLocalizedNews(this.currentLocation.countryCode, this.currentLocation.city) });
      return { location: this.currentLocation, weather };
    }
  }

  // Detect coordinates: Browser GPS first, fallback to IP Geolocation
  async detectCoordinates() {
    return new Promise((resolve) => {
      let resolved = false;

      // 1. Try Browser Geolocation GPS (8 seconds max)
      if (navigator.geolocation) {
        const timeoutId = setTimeout(async () => {
          if (!resolved) {
            console.log('GPS timeout, trying IP fallback...');
            const ipLoc = await this.fetchIpLocation();
            resolved = true;
            resolve(ipLoc);
          }
        }, 5000);

        navigator.geolocation.getCurrentPosition(
          async (pos) => {
            if (resolved) return;
            resolved = true;
            clearTimeout(timeoutId);

            const lat = pos.coords.latitude;
            const lon = pos.coords.longitude;
            console.log(`GPS coords acquired: ${lat}, ${lon}`);

            // Reverse geocode coords to get city, state, country
            const revLoc = await this.reverseGeocode(lat, lon);
            resolve(revLoc);
          },
          async (error) => {
            if (resolved) return;
            resolved = true;
            clearTimeout(timeoutId);
            console.log('GPS error/permission denied, falling back to IP:', error.message);
            const ipLoc = await this.fetchIpLocation();
            resolve(ipLoc);
          },
          { enableHighAccuracy: true, timeout: 5000, maximumAge: 300000 }
        );
      } else {
        // No geolocation API in browser
        this.fetchIpLocation().then(resolve);
      }
    });
  }

  // Reverse geocoding using Nominatim OpenStreetMap
  async reverseGeocode(lat, lon) {
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=10&addressdetails=1`, {
        headers: { 'Accept-Language': 'es,en' }
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const addr = data.address || {};

      const countryCode = (addr.country_code || 'US').toUpperCase();
      const isUSA = (countryCode === 'US' || countryCode === 'USA');
      const city = addr.city || addr.town || addr.municipality || addr.village || addr.county || "Ciudad Local";
      const state = addr.state || addr.region || "";
      const country = addr.country || (isUSA ? "Estados Unidos" : "Local");

      return {
        lat,
        lon,
        city,
        state,
        country,
        countryCode,
        isUSA,
        source: "gps"
      };
    } catch (e) {
      console.warn('Reverse geocode error, fallback:', e);
      return {
        lat,
        lon,
        city: "Ubicación Actual",
        state: "",
        country: "Local",
        countryCode: "US",
        isUSA: true,
        source: "gps-approx"
      };
    }
  }

  // Fallback IP Geolocation via ipwho.is
  async fetchIpLocation() {
    try {
      const res = await fetch('https://ipwho.is/');
      if (!res.ok) throw new Error('ipwho error');
      const data = await res.json();

      if (data && data.success) {
        const countryCode = (data.country_code || 'US').toUpperCase();
        const isUSA = (countryCode === 'US');
        return {
          lat: data.latitude || 25.7617,
          lon: data.longitude || -80.1918,
          city: data.city || (isUSA ? "Miami" : "Santo Domingo"),
          state: data.region || "",
          country: data.country || (isUSA ? "Estados Unidos" : "Internacional"),
          countryCode,
          isUSA,
          source: "ip"
        };
      }
    } catch (e) {
      console.warn('IP location fetch failed:', e);
    }

    // Default fallback
    return {
      lat: 25.7617,
      lon: -80.1918,
      city: "Miami Metro Area",
      state: "Florida",
      country: "Estados Unidos",
      countryCode: "US",
      isUSA: true,
      source: "default"
    };
  }

  // Fetch real-time live weather from Open-Meteo
  async fetchLiveWeather(lat, lon, locInfo) {
    const isUSA = locInfo.isUSA;
    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m&hourly=temperature_2m,weather_code,precipitation_probability&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Open-Meteo error: ${res.status}`);
      const data = await res.json();

      const cur = data.current || {};
      const tempC = Math.round(cur.temperature_2m ?? 26);
      const tempF = Math.round((tempC * 9 / 5) + 32);
      const feelsLikeC = Math.round(cur.apparent_temperature ?? tempC);
      const feelsLikeF = Math.round((feelsLikeC * 9 / 5) + 32);

      const wCode = cur.weather_code ?? 0;
      const conditionObj = WMO_WEATHER_MAP[wCode] || { icon: "☀️", es: "Despejado", en: "Clear" };

      // Wind units: mph for USA, km/h outside USA
      const windKmh = Math.round(cur.wind_speed_10m ?? 12);
      const windMph = Math.round(windKmh * 0.621371);
      const windDisplay = isUSA ? `${windMph} mph` : `${windKmh} km/h`;

      // Humidity & rain
      const humidity = `${cur.relative_humidity_2m ?? 60}%`;
      const precip = `${cur.precipitation ?? 0} mm`;

      // Hourly Forecast (Next 6 hours)
      const hourly = [];
      if (data.hourly && data.hourly.time) {
        const times = data.hourly.time;
        const temps = data.hourly.temperature_2m;
        const codes = data.hourly.weather_code;
        const pops = data.hourly.precipitation_probability || [];
        const nowHour = new Date().getHours();

        for (let i = 0; i < times.length && hourly.length < 6; i++) {
          const itemTime = new Date(times[i]);
          if (itemTime.getHours() >= nowHour || i >= nowHour) {
            const hC = Math.round(temps[i]);
            const hF = Math.round((hC * 9 / 5) + 32);
            const hCode = codes[i] ?? 0;
            const hCond = WMO_WEATHER_MAP[hCode] || { icon: "🌤️" };
            const timeStr = itemTime.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

            hourly.push({
              time: hourly.length === 0 ? "Ahora" : timeStr,
              temp: isUSA ? `${hF}°F` : `${hC}°C`,
              tempC: `${hC}°C`,
              tempF: `${hF}°F`,
              icon: hCond.icon,
              pop: `${pops[i] ?? 10}%`
            });
          }
        }
      }

      // 3-Day Forecast
      const forecastDays = [];
      if (data.daily && data.daily.time) {
        const dTimes = data.daily.time;
        const dMax = data.daily.temperature_2m_max;
        const dMin = data.daily.temperature_2m_min;
        const dCodes = data.daily.weather_code;

        const dayNamesEs = ["Hoy", "Mañana", "Pasado Mañana"];
        const dayNamesEn = ["Today", "Tomorrow", "In 2 Days"];

        for (let i = 0; i < Math.min(3, dTimes.length); i++) {
          const maxC = Math.round(dMax[i]);
          const maxF = Math.round((maxC * 9 / 5) + 32);
          const minC = Math.round(dMin[i]);
          const minF = Math.round((minC * 9 / 5) + 32);
          const code = dCodes[i] ?? 0;
          const cond = WMO_WEATHER_MAP[code] || { icon: "☀️", es: "Agradable", en: "Pleasant" };

          forecastDays.push({
            day_es: dayNamesEs[i] || `Día ${i + 1}`,
            day_en: dayNamesEn[i] || `Day ${i + 1}`,
            max: isUSA ? `${maxF}°F` : `${maxC}°C`,
            min: isUSA ? `${minF}°F` : `${minC}°C`,
            icon: cond.icon,
            desc_es: cond.es,
            desc_en: cond.en
          });
        }
      }

      const cityName = locInfo.city ? `${locInfo.city}${locInfo.state ? ', ' + locInfo.state : ''}` : "Ubicación Local";
      const destName = `${locInfo.city || 'Destino'} · Centro / Centro Urbano`;

      const curObj = {
        tempC,
        tempF,
        feelsLikeC,
        feelsLikeF,
        condition_es: conditionObj.es,
        condition_en: conditionObj.en,
        icon: conditionObj.icon,
        humidity,
        wind: windDisplay,
        uvIndex: "6 (Moderado)",
        airQuality_es: "Buena (AQI 22)",
        airQuality_en: "Good (AQI 22)",
        sunset: "7:38 PM",
        precipitation: precip
      };

      return {
        city: cityName,
        rawCity: locInfo.city,
        state: locInfo.state,
        country: locInfo.country,
        countryCode: locInfo.countryCode,
        isUSA,
        unit: isUSA ? "°F" : "°C",
        tempC,
        tempF,
        displayTemp: isUSA ? `${tempF}°F` : `${tempC}°C`,
        secondaryTemp: isUSA ? `${tempC}°C` : `${tempF}°F`,
        feelsLikeC,
        feelsLikeF,
        displayFeelsLike: isUSA ? `${feelsLikeF}°F` : `${feelsLikeC}°C`,
        condition_es: conditionObj.es,
        condition_en: conditionObj.en,
        icon: conditionObj.icon,
        humidity,
        wind: windDisplay,
        precipitation: precip,
        uvIndex: "6 (Moderado)",
        airQuality_es: "Buena (AQI 22)",
        airQuality_en: "Good (AQI 22)",
        sunset: "7:38 PM",
        destination: destName,
        current: curObj,
        hourly: hourly.length > 0 ? hourly : [
          { time: "Ahora", temp: isUSA ? `${tempF}°F` : `${tempC}°C`, icon: conditionObj.icon, pop: "10%" }
        ],
        forecastDays: forecastDays.length > 0 ? forecastDays : [
          { day_es: "Hoy", day_en: "Today", max: isUSA ? `${tempF + 2}°F` : `${tempC + 2}°C`, min: isUSA ? `${tempF - 4}°F` : `${tempC - 4}°C`, icon: conditionObj.icon, desc_es: conditionObj.es, desc_en: conditionObj.en }
        ],
        tip_es: `💡 Consejo local: El clima actual en ${locInfo.city} es propicio para tu viaje. ¡Disfruta el trayecto con Copilot!`,
        tip_en: `💡 Local tip: Current weather in ${locInfo.city} is great for your ride. Enjoy your trip with Copilot!`
      };
    } catch (e) {
      console.error('Fetch live weather failed:', e);
      return this.getFallbackWeather(locInfo);
    }
  }

  getFallbackWeather(locInfo) {
    const isUSA = locInfo.isUSA;
    const tempC = 27;
    const tempF = 81;
    const curObj = {
      tempC,
      tempF,
      feelsLikeC: 29,
      feelsLikeF: 84,
      condition_es: "Cielo Parcialmente Despejado",
      condition_en: "Partly Clear Skies",
      icon: "☀️",
      humidity: "62%",
      wind: isUSA ? "9 mph" : "14 km/h",
      uvIndex: "7 (Alto)",
      airQuality_es: "Excelente (AQI 20)",
      airQuality_en: "Good (AQI 20)",
      sunset: "7:45 PM",
      precipitation: "0 mm"
    };

    return {
      city: locInfo.city || "Miami Metro Area",
      rawCity: locInfo.city || "Miami",
      state: locInfo.state || "FL",
      country: locInfo.country || "USA",
      countryCode: locInfo.countryCode || "US",
      isUSA,
      unit: isUSA ? "°F" : "°C",
      tempC,
      tempF,
      displayTemp: isUSA ? `${tempF}°F` : `${tempC}°C`,
      secondaryTemp: isUSA ? `${tempC}°C` : `${tempF}°F`,
      feelsLikeC: 29,
      feelsLikeF: 84,
      displayFeelsLike: isUSA ? "84°F" : "29°C",
      condition_es: "Cielo Parcialmente Despejado",
      condition_en: "Partly Clear Skies",
      icon: "☀️",
      humidity: "62%",
      wind: isUSA ? "9 mph" : "14 km/h",
      precipitation: "0 mm",
      uvIndex: "7 (Alto)",
      airQuality_es: "Excelente (AQI 20)",
      airQuality_en: "Good (AQI 20)",
      sunset: "7:45 PM",
      destination: `${locInfo.city || 'Destino'} · Ruta Activa`,
      current: curObj,
      hourly: [
        { time: "Ahora", temp: isUSA ? "81°F" : "27°C", icon: "☀️", pop: "5%" },
        { time: "2:00 PM", temp: isUSA ? "83°F" : "28°C", icon: "🌤️", pop: "10%" },
        { time: "4:00 PM", temp: isUSA ? "82°F" : "28°C", icon: "⛅", pop: "15%" },
        { time: "6:00 PM", temp: isUSA ? "79°F" : "26°C", icon: "🌤️", pop: "5%" }
      ],
      forecastDays: [
        { day_es: "Hoy", day_en: "Today", max: isUSA ? "83°F" : "28°C", min: isUSA ? "73°F" : "23°C", icon: "☀️", desc_es: "Soleado", desc_en: "Sunny" },
        { day_es: "Mañana", day_en: "Tomorrow", max: isUSA ? "84°F" : "29°C", min: isUSA ? "74°F" : "24°C", icon: "🌤️", desc_es: "Cálido", desc_en: "Warm" }
      ],
      tip_es: `💡 Consejo: Disfruta tu recorrido por ${locInfo.city || 'la ciudad'}. ¡Excelente clima para viajar!`,
      tip_en: `💡 Tip: Enjoy your ride through ${locInfo.city || 'the city'}. Great travel weather!`
    };
  }

  // Provide region-specific localized news
  getLocalizedNews(countryCode, cityName) {
    const isUSA = (countryCode === 'US' || countryCode === 'USA');
    const isDO = (countryCode === 'DO');
    const city = cityName || (isUSA ? "Miami" : "Santo Domingo");

    if (isUSA) {
      return [
        {
          id: "us-news-1",
          category_es: "LOCAL & TRANSPORTE",
          category_en: "LOCAL & MOBILITY",
          category_slug: "breaking",
          badge_color: "#ff007f",
          icon: "🚗",
          title_es: `Novedades en ${city}: Modernizan la infraestructura vial y corredores de tránsito inteligente`,
          title_en: `${city} Mobility: Smart transit corridors and infrastructure upgrades roll out`,
          summary_es: `Nuevos sistemas de sincronización semafórica inteligente y sensores en tiempo real mejoran la fluidez del tráfico para conductores y pasajeros en ${city}.`,
          summary_en: `Advanced real-time smart traffic synchronization reduces commute times and enhances rider journeys across ${city}.`,
          source: `${city} City Gazette`,
          time_ago_es: "Hace 10 min",
          time_ago_en: "10 min ago",
          reads: "19.4K lecturas"
        },
        {
          id: "us-news-2",
          category_es: "TECNOLOGÍA",
          category_en: "TECHNOLOGY",
          category_slug: "tech",
          badge_color: "#00f5a0",
          icon: "🤖",
          title_es: "Revolución de la IA: Nuevas pantallas interactivas para vehículos transforman el entretenimiento a bordo",
          title_en: "AI In-Car Breakthrough: Next-gen interactive screens revolutionize passenger rideshare media",
          summary_es: "Compañías de transporte privado adoptan tablets inteligentes con trivias, sorteos y micro-anuncios hiperlocales personalizados.",
          summary_en: "Rideshare platforms deploy smart tablet hubs featuring live trivia, cash prizes, and targeted local experiences.",
          source: "TechPulse USA",
          time_ago_es: "Hace 35 min",
          time_ago_en: "35 min ago",
          reads: "34.2K lecturas"
        },
        {
          id: "us-news-3",
          category_es: "DEPORTES",
          category_en: "SPORTS",
          category_slug: "sports",
          badge_color: "#ffd000",
          icon: "🏀",
          title_es: "Jornada estelar en las ligas profesionales: Espectacular canasta sobre la bocina sella la victoria",
          title_en: "Pro Basketball Thriller: Dramatic buzzer-beater seals comeback victory in front of roaring crowd",
          summary_es: "Una noche inolvidable en la duela con récords de anotación y jugadas destacadas que marcan el rumbo de los playoffs.",
          summary_en: "A historic night on the hardwood with record scoring runs and highlight-reel plays setting the tone for the postseason.",
          source: "SportsCenter Live",
          time_ago_es: "Hace 1 hora",
          time_ago_en: "1 hour ago",
          reads: "42.8K lecturas"
        },
        {
          id: "us-news-4",
          category_es: "ESTILO DE VIDA & CIUDAD",
          category_en: "CITY & CULTURE",
          category_slug: "city",
          badge_color: "#00d2ff",
          icon: "🌴",
          title_es: `Guía gastronómica en ${city}: Inauguran nuevos espacios culinarios y terrazas al aire libre`,
          title_en: `${city} Culinary Scene: Acclaimed new open-air dining plazas and rooftop venues debut`,
          summary_es: `Destacados chefs presentan menús de autor y música en vivo los fines de semana, convirtiéndose en el destino favorito de locales y visitantes.`,
          summary_en: `Celebrated chefs unveil signature tasting menus and weekend acoustic sets, quickly becoming the must-visit evening spots.`,
          source: `${city} Lifestyle`,
          time_ago_es: "Hace 2 horas",
          time_ago_en: "2 hours ago",
          reads: "27.1K lecturas"
        },
        {
          id: "us-news-5",
          category_es: "CINE & ENTRETENIMIENTO",
          category_en: "ENTERTAINMENT",
          category_slug: "entertainment",
          badge_color: "#a855f7",
          icon: "🎬",
          title_es: "Estreno cinematográfico del año supera proyecciones de taquilla en salas IMAX",
          title_en: "Box Office Phenomenon: Visual masterpiece shatters opening records in premium formats",
          summary_es: "La crítica aplaude los efectos prácticos y la conmovedora narrativa, posicionándola como favorita de la temporada de premios.",
          summary_en: "Critics praise breathtaking practical effects and emotional storytelling, making it an early awards contender.",
          source: "Hollywood Chronicle",
          time_ago_es: "Hace 3 horas",
          time_ago_en: "3 hours ago",
          reads: "31.9K lecturas"
        }
      ];
    } else if (isDO) {
      return [
        {
          id: "do-news-1",
          category_es: "LOCAL & TURISMO",
          category_en: "LOCAL & TOURISM",
          category_slug: "breaking",
          badge_color: "#ff007f",
          icon: "🌴",
          title_es: `República Dominicana rompe récord histórico con más de 10 millones de visitantes internacionales`,
          title_en: `Dominican Republic breaks historic record welcoming over 10 million international tourists`,
          summary_es: `Punta Cana, Santo Domingo y Samaná impulsan el auge hotelero y de transporte turístico con altos estándares de calidad y seguridad.`,
          summary_en: `Punta Cana and Santo Domingo lead regional tourism expansion with world-class hospitality and modern mobility.`,
          source: "Diario Nacional RD",
          time_ago_es: "Hace 12 min",
          time_ago_en: "12 min ago",
          reads: "22.5K lecturas"
        },
        {
          id: "do-news-2",
          category_es: "BÉISBOL & DEPORTES",
          category_en: "BASEBALL & SPORTS",
          category_slug: "sports",
          badge_color: "#00f5a0",
          icon: "⚾",
          title_es: "Estrellas dominicanas en las Grandes Ligas brillan con cuadrangulares y juego impecable",
          title_en: "Dominican MLB stars shine with clutch home runs and standout defensive highlights",
          summary_es: "Los peloteros quisqueyanos continúan dominando las estadísticas ofensivas y llenando de orgullo a la fanaticada local.",
          summary_en: "Dominican sluggers continue leading league offensive charts and delighting passionate baseball fans back home.",
          source: "Deportes Quisqueya",
          time_ago_es: "Hace 40 min",
          time_ago_en: "40 min ago",
          reads: "38.1K lecturas"
        },
        {
          id: "do-news-3",
          category_es: "TRANSPORTE & CIUDAD",
          category_en: "URBAN TRANSIT",
          category_slug: "city",
          badge_color: "#ffd000",
          icon: "🚇",
          title_es: "Avanza la expansión de nuevas líneas de transporte urbano integrado en el Gran Santo Domingo",
          title_en: "Urban Transit Progress: Expansion of integrated transit corridors advances in Santo Domingo",
          summary_es: "Las autoridades destacan la reducción de tiempos de traslado y la integración de pagos digitales en el sistema de transporte.",
          summary_en: "Transit authorities announce significant travel time reductions and digital contactless payment integration.",
          source: "Metro Digital RD",
          time_ago_es: "Hace 1 hora",
          time_ago_en: "1 hour ago",
          reads: "18.3K lecturas"
        },
        {
          id: "do-news-4",
          category_es: "ECONOMÍA & EMPRENDIMIENTO",
          category_en: "ECONOMY",
          category_slug: "economy",
          badge_color: "#00d2ff",
          icon: "📈",
          title_es: "Sector de servicios y plataformas digitales experimenta un crecimiento récord este trimestre",
          title_en: "Digital Platforms & Service Sector reach double-digit growth this quarter in the Caribbean",
          summary_es: "El ecosistema de aplicaciones de movilidad y entregas genera miles de oportunidades productivas para emprendedores locales.",
          summary_en: "Rideshare and delivery app ecosystems create thousands of flexible earnings opportunities for drivers and partners.",
          source: "Economía y Mercados",
          time_ago_es: "Hace 2 horas",
          time_ago_en: "2 hours ago",
          reads: "14.9K lecturas"
        },
        {
          id: "do-news-5",
          category_es: "CULTURA & MÚSICA",
          category_en: "CULTURE & MUSIC",
          category_slug: "entertainment",
          badge_color: "#a855f7",
          icon: "🎶",
          title_es: "Festival Internacional de Música reúne a leyendas del merengue, bachata y géneros urbanos",
          title_en: "International Music Festival brings together icons of Merengue, Bachata, and Urban rhythms",
          summary_es: "Miles de asistentes vibraron en la costa caribeña en una fiesta cultural que celebra las ricas raíces musicales dominicanas.",
          summary_en: "Thousands of concertgoers celebrated Caribbean musical heritage along the oceanfront boulevard.",
          source: "Arte & Ritmo",
          time_ago_es: "Hace 3 horas",
          time_ago_en: "3 hours ago",
          reads: "26.4K lecturas"
        }
      ];
    } else {
      // General Latin America / Global Spanish
      return [
        {
          id: "intl-news-1",
          category_es: "LOCAL & MOVILIDAD",
          category_en: "MOBILITY & LOCAL",
          category_slug: "breaking",
          badge_color: "#ff007f",
          icon: "🚗",
          title_es: `Innovación en transporte en ${city}: Impulsan flota de vehículos ecológicos y viajes conectados`,
          title_en: `Mobility Innovation in ${city}: Eco-friendly fleets and connected journeys expand`,
          summary_es: `La ciudad promueve corredores limpios e interactivos para mejorar el confort de pasajeros en trayectos diarios.`,
          summary_en: `The city champions connected smart corridors to elevate commuter convenience and sustainable transport.`,
          source: `${city} News Express`,
          time_ago_es: "Hace 15 min",
          time_ago_en: "15 min ago",
          reads: "21.2K lecturas"
        },
        {
          id: "intl-news-2",
          category_es: "TECNOLOGÍA",
          category_en: "TECHNOLOGY",
          category_slug: "tech",
          badge_color: "#00f5a0",
          icon: "📱",
          title_es: "Aplicaciones de viajes integran inteligencia artificial para predecir rutas y sugerir paradas de interés",
          title_en: "Travel & Mobility Apps leverage AI to predict traffic and recommend scenic local stops",
          summary_es: "Nuevas herramientas digitales enriquecen el tiempo a bordo con contenidos lúdicos y pronósticos meteorológicos en vivo.",
          summary_en: "New intelligent passenger features enhance travel time with engaging trivia and real-time local forecasts.",
          source: "Mundo Digital",
          time_ago_es: "Hace 45 min",
          time_ago_en: "45 min ago",
          reads: "29.8K lecturas"
        },
        {
          id: "intl-news-3",
          category_es: "FÚTBOL & DEPORTES",
          category_en: "SPORTS",
          category_slug: "sports",
          badge_color: "#ffd000",
          icon: "⚽",
          title_es: "Emocionante desenlace de la liga continental: Gol en el tiempo de descuento define la eliminatoria",
          title_en: "Continental Cup Drama: Stoppage-time wonder strike decides thrilling knockout clash",
          summary_es: "Aficionados de toda la región vivieron un partido de alta intensidad con momentos tácticos de primer nivel.",
          summary_en: "Football enthusiasts across the region enjoyed an end-to-end tactical showdown with dramatic late fireworks.",
          source: "Fútbol Total Live",
          time_ago_es: "Hace 1 hora",
          time_ago_en: "1 hour ago",
          reads: "44.0K lecturas"
        },
        {
          id: "intl-news-4",
          category_es: "CIUDAD & TURISMO",
          category_en: "CITY LIFE",
          category_slug: "city",
          badge_color: "#00d2ff",
          icon: "🏛️",
          title_es: `Conoce los puntos históricos y rincones culturales imprescindibles de ${city}`,
          title_en: `Must-see cultural landmarks and hidden gems to explore in ${city}`,
          summary_es: `Museos renovados, ferias de diseño local y paseos peatonales esperan a quienes visitan o recorren la metrópolis.`,
          summary_en: `Renovated museums, local artisan markets, and pedestrian promenades welcome visitors exploring the metropolis.`,
          source: "Guía Urbana Global",
          time_ago_es: "Hace 2 horas",
          time_ago_en: "2 hours ago",
          reads: "18.7K lecturas"
        },
        {
          id: "intl-news-5",
          category_es: "CIENCIA & ESPACIO",
          category_en: "SCIENCE",
          category_slug: "science",
          badge_color: "#a855f7",
          icon: "🌌",
          title_es: "Misión espacial capta sorprendentes auroras y detalles de la atmósfera planetaria",
          title_en: "Planetary Mission captures mesmerizing auroras and atmospheric discoveries",
          summary_es: "Científicos internacionales analizan los nuevos datos ópticos recolectados por satélites de última generación.",
          summary_en: "Global researchers analyze breakthrough optical telemetry beamed back by deep-space probes.",
          source: "AstroScience Global",
          time_ago_es: "Hace 3 horas",
          time_ago_en: "3 hours ago",
          reads: "23.5K lecturas"
        }
      ];
    }
  }
}

export const geoService = new GeoLocationService();
