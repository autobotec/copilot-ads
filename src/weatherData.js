/* ==========================================================================
   WEATHER DATA (BILINGUAL ES / EN)
   Pronóstico en vivo, radar local y recomendaciones
   ========================================================================== */

export const WEATHER_INFO = {
  city: "Miami Metro Area",
  destination: "Miami Beach · Ocean Dr",
  current: {
    tempC: 28,
    tempF: 82,
    feelsLikeC: 31,
    feelsLikeF: 88,
    condition_es: "Parcialmente Soleado & Cálido",
    condition_en: "Partly Sunny & Warm Breeze",
    icon: "☀️",
    humidity: "64%",
    wind: "16 km/h (10 mph)",
    uvIndex: "7 (Alto / High)",
    airQuality_es: "Excelente (AQI 24)",
    airQuality_en: "Good (AQI 24)",
    sunset: "7:44 PM",
    precipitation: "10%"
  },
  hourly: [
    { time: "Ahora", temp: "28°C", icon: "☀️", pop: "10%" },
    { time: "2:00 PM", temp: "29°C", icon: "🌤️", pop: "15%" },
    { time: "4:00 PM", temp: "28°C", icon: "⛅", pop: "20%" },
    { time: "6:00 PM", temp: "26°C", icon: "🌤️", pop: "10%" },
    { time: "8:00 PM", temp: "24°C", icon: "🌙", pop: "5%" },
    { time: "10:00 PM", temp: "23°C", icon: "✨", pop: "5%" }
  ],
  forecastDays: [
    {
      day_es: "Hoy",
      day_en: "Today",
      max: "29°C",
      min: "23°C",
      icon: "☀️",
      desc_es: "Soleado y despejado",
      desc_en: "Sunny & clear skies"
    },
    {
      day_es: "Mañana",
      day_en: "Tomorrow",
      max: "30°C",
      min: "24°C",
      icon: "🌤️",
      desc_es: "Cálido con brisa marina",
      desc_en: "Warm ocean breeze"
    },
    {
      day_es: "Pasado Mañana",
      day_en: "In 2 Days",
      max: "28°C",
      min: "22°C",
      icon: "🌦️",
      desc_es: "Lloviznas pasajeras",
      desc_en: "Passing light showers"
    }
  ],
  tip_es: "💡 Consejo para tu viaje: La brisa marina en la costa es ideal para caminar por Ocean Drive. ¡No olvides tus gafas de sol!",
  tip_en: "💡 Travel Tip: The pleasant coastal breeze makes it a perfect time for a stroll down Ocean Drive. Don't forget your sunglasses!"
};
