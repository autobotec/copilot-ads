import { sound } from './audio.js';
import { TRANSLATIONS } from './i18n.js';
import { TRIVIA_QUESTIONS } from './triviaData.js';
import { SPONSORED_ADS } from './adsData.js';
import { GIVEAWAY_INFO } from './giveawaysData.js';
import { PICTURE_TRIVIA_QUESTIONS } from './games/pictureTrivia.js';
import { ColorMemoryGame } from './games/colorMemory.js';
import { SpeedMatchGame } from './games/speedMatch.js';
import { BILLBOARD_TOP_ALBUMS, SPORTS_UPDATES, CURATED_PLAYLISTS, SHORT_VIDEOS } from './mediaData.js';
import { NEWS_ARTICLES } from './newsData.js';
import { WEATHER_INFO } from './weatherData.js';
import { geoService } from './geoService.js';

// Mix Segment Duration Constant (30 seconds per content rotation)
export const MIX_SEGMENT_DURATION = 30;

/* ==========================================================================
   STATE MANAGEMENT
   ========================================================================== */
const state = {
  currentLang: localStorage.getItem('copilot_lang') || 'es',
  score: 0,
  streak: 0,
  currentQuestionIndex: 0,
  currentPicIndex: 0,
  timerSeconds: 12,
  timerInterval: null,
  isAnswerLocked: false,

  // Live Location & Weather state
  liveWeather: null,
  liveNews: [],
  isGpsLoading: false,

  // Mix Mode continuous rotation loop (Trivia -> Weather -> News -> Promo Video)
  mixMode: {
    enabled: true,
    isPaused: false,
    currentStep: 'trivia', // 'trivia' | 'weather' | 'news' | 'promoVideo'
    secondsLeft: MIX_SEGMENT_DURATION,
    duration: MIX_SEGMENT_DURATION,
    interval: null,
    interactionCooldown: null,
    promoVideoIndex: 0
  },

  // Active Player state: protects human players from being interrupted by rotation
  isUserActivelyPlaying: false,
  lastUserInteraction: 0,
  isFullscreenAdActive: false,

  // Trivia lives / strikes (5 errors restarts trivia)
  triviaWrongCount: 0,
  triviaTransitionTimeout: null,

  // Autostart timer on Games Hub
  autostartSeconds: 8,
  autostartInterval: null,
  isAutostartPaused: false,

  // Active game mode: 'none' | 'classic' | 'picture' | 'simon' | 'match'
  activeGameMode: 'none',
  activeGameInstance: null,

  // Ad rotation
  adCountdownInterval: null,
  adCurrentSeconds: 10,
  currentAdIndex: 0,
  questionsSinceLastAd: 0,

  // Giveaway & Tabs
  userTickets: 0,
  activeTab: 'games', // 'games' | 'rideInfo' | 'mediaAds' | 'giveaway' | 'leaderboard'
  activeMediaSubtab: 'deals', // 'deals' | 'billboard' | 'listen' | 'watch'
  selectedTipAmount: 5,

  // Driver Configuration
  driverConfig: {
    name: "Alex Morgan",
    car: "Tesla Model Y · Blanco Perlado",
    rating: "4.99",
    trips: "2,840+",
    tipHandle: "$AlexDriverCopilot",
    playlist: "Copilot Lounge & Chill Vibes",
    bio: "¡Hola y bienvenido a bordo! Siéntete como en casa: hay cargadores rápidos en los respaldos, toallitas y agua fría. Si prefieres otra música, ¡solo dímelo!",
    adFrequency: 4,
    pin: "1234",
    tripsToday: 18,
    triviaPlays: 42,
    pointsEarned: 4200,
    estimatedPayout: 85
  }
};

function getT() {
  return TRANSLATIONS[state.currentLang] || TRANSLATIONS.es;
}

/* ==========================================================================
   DOM ELEMENTS
   ========================================================================== */
const DOM = {
  // Global & Header
  btnLangEs: document.getElementById('btnLangEs'),
  btnLangEn: document.getElementById('btnLangEn'),
  headerSubtitle: document.getElementById('headerSubtitle'),
  quickPillText: document.getElementById('quickPillText'),
  scoreLabelText: document.getElementById('scoreLabelText'),
  userScore: document.getElementById('userScore'),
  btnSound: document.getElementById('btnSound'),
  soundIcon: document.getElementById('soundIcon'),
  btnFullscreen: document.getElementById('btnFullscreen'),
  btnAdminQuick: document.getElementById('btnAdminQuick'),
  btnBrandBadge: document.getElementById('btnBrandBadge'),
  clockTime: document.getElementById('clockTime'),
  clockPeriod: document.getElementById('clockPeriod'),

  // Bottom Dock Navigation
  tabGames: document.getElementById('tabGames'),
  tabWeatherNews: document.getElementById('tabWeatherNews'),
  tabRideInfo: document.getElementById('tabRideInfo'),
  tabMediaAds: document.getElementById('tabMediaAds'),
  tabGiveaway: document.getElementById('tabGiveaway'),
  tabLeaderboard: document.getElementById('tabLeaderboard'),
  dockLabelGames: document.getElementById('dockLabelGames'),
  dockLabelWeatherNews: document.getElementById('dockLabelWeatherNews'),
  dockLabelRideInfo: document.getElementById('dockLabelRideInfo'),
  dockLabelMediaAds: document.getElementById('dockLabelMediaAds'),
  dockLabelGiveaway: document.getElementById('dockLabelGiveaway'),
  dockLabelLeaderboard: document.getElementById('dockLabelLeaderboard'),

  // Mix Mode & Header Controls
  btnToggleMix: document.getElementById('btnToggleMix'),
  mixStatusText: document.getElementById('mixStatusText'),
  mixNextTag: document.getElementById('mixNextTag'),
  mixMiniTimer: document.getElementById('mixMiniTimer'),

  // Views
  viewGames: document.getElementById('viewGames'),
  viewWeatherNews: document.getElementById('viewWeatherNews'),
  viewRideInfo: document.getElementById('viewRideInfo'),
  viewMediaAds: document.getElementById('viewMediaAds'),
  viewGiveaway: document.getElementById('viewGiveaway'),
  viewLeaderboard: document.getElementById('viewLeaderboard'),

  // Weather & News View Elements
  weatherNewsBadge: document.getElementById('weatherNewsBadge'),
  weatherNewsMainTitle: document.getElementById('weatherNewsMainTitle'),
  weatherNewsSubtitle: document.getElementById('weatherNewsSubtitle'),
  btnWnWeather: document.getElementById('btnWnWeather'),
  btnWnNews: document.getElementById('btnWnNews'),
  btnWnWeatherLabel: document.getElementById('btnWnWeatherLabel'),
  btnWnNewsLabel: document.getElementById('btnWnNewsLabel'),
  wnTabWeather: document.getElementById('wnTabWeather'),
  wnTabNews: document.getElementById('wnTabNews'),

  whCityName: document.getElementById('whCityName'),
  whDestTag: document.getElementById('whDestTag'),
  whBadgeStatus: document.getElementById('whBadgeStatus'),
  whHugeIcon: document.getElementById('whHugeIcon'),
  whCurrentTemp: document.getElementById('whCurrentTemp'),
  whFeelsLikeText: document.getElementById('whFeelsLikeText'),
  whHumidityLabel: document.getElementById('whHumidityLabel'),
  whHumidityVal: document.getElementById('whHumidityVal'),
  whWindLabel: document.getElementById('whWindLabel'),
  whWindVal: document.getElementById('whWindVal'),
  whUvLabel: document.getElementById('whUvLabel'),
  whUvVal: document.getElementById('whUvVal'),
  whAqiLabel: document.getElementById('whAqiLabel'),
  whAqiVal: document.getElementById('whAqiVal'),
  whRainLabel: document.getElementById('whRainLabel'),
  whRainVal: document.getElementById('whRainVal'),
  whSunsetLabel: document.getElementById('whSunsetLabel'),
  whSunsetVal: document.getElementById('whSunsetVal'),
  whTipBanner: document.getElementById('whTipBanner'),
  whTipText: document.getElementById('whTipText'),
  whTempUnit: document.getElementById('whTempUnit'),
  btnRefreshGps: document.getElementById('btnRefreshGps'),
  gpsDot: document.getElementById('gpsDot'),
  gpsStatusText: document.getElementById('gpsStatusText'),
  dockWeatherWidget: document.getElementById('dockWeatherWidget'),
  dockWeatherIcon: document.getElementById('dockWeatherIcon'),
  dockWeatherTemp: document.getElementById('dockWeatherTemp'),
  rideWeatherIcon: document.getElementById('rideWeatherIcon'),
  rideWeatherTemp: document.getElementById('rideWeatherTemp'),
  rideWeatherHumidity: document.getElementById('rideWeatherHumidity'),
  rideWeatherWind: document.getElementById('rideWeatherWind'),
  forecastHourlyTitle: document.getElementById('forecastHourlyTitle'),
  hourlyForecastStrip: document.getElementById('hourlyForecastStrip'),
  forecastDaysTitle: document.getElementById('forecastDaysTitle'),
  daysForecastList: document.getElementById('daysForecastList'),

  breakingLabel: document.getElementById('breakingLabel'),
  breakingHeadlineText: document.getElementById('breakingHeadlineText'),
  newsCityTitle: document.getElementById('newsCityTitle'),
  newsLocationBadge: document.getElementById('newsLocationBadge'),
  newsCuratedSubtitle: document.getElementById('newsCuratedSubtitle'),
  newsRatingBadge: document.getElementById('newsRatingBadge'),
  newsCountBadge: document.getElementById('newsCountBadge'),
  newsDetailModal: document.getElementById('newsDetailModal'),
  newsModalContentWrap: document.getElementById('newsModalContentWrap'),
  btnCloseNewsModal: document.getElementById('btnCloseNewsModal'),

  // News Spotlight Rotation
  newsSpotlightContent: document.getElementById('newsSpotlightContent'),
  newsSpotlightProgressFill: document.getElementById('newsSpotlightProgressFill'),
  newsCategoryPills: document.getElementById('newsCategoryPills'),
  newsTimerSeconds: document.getElementById('newsTimerSeconds'),
  newsPauseIcon: document.getElementById('newsPauseIcon'),
  btnPrevNews: document.getElementById('btnPrevNews'),
  btnNextNews: document.getElementById('btnNextNews'),
  btnPauseNewsRotation: document.getElementById('btnPauseNewsRotation'),

  // Video Promo Showcase
  btnMediaVideoPromo: document.getElementById('btnMediaVideoPromo'),
  tabVideoPromoText: document.getElementById('tabVideoPromoText'),
  mediaTabVideoPromo: document.getElementById('mediaTabVideoPromo'),
  promoVideoMainPlayer: document.getElementById('promoVideoMainPlayer'),
  btnPvmSound: document.getElementById('btnPvmSound'),
  pvmTimer: document.getElementById('pvmTimer'),
  pvmProgressFill: document.getElementById('pvmProgressFill'),
  pvmBadgeText: document.getElementById('pvmBadgeText'),
  pvmBrand: document.getElementById('pvmBrand'),
  pvmHeadline: document.getElementById('pvmHeadline'),
  pvmSubtext: document.getElementById('pvmSubtext'),
  pvmQrContainer: document.getElementById('pvmQrContainer'),
  pvmQrInstruction: document.getElementById('pvmQrInstruction'),
  pvmPromoLabel: document.getElementById('pvmPromoLabel'),
  pvmPromoCode: document.getElementById('pvmPromoCode'),
  btnClaimPromoVideo: document.getElementById('btnClaimPromoVideo'),
  btnNextPromoVideo: document.getElementById('btnNextPromoVideo'),

  // Fullscreen Tablet Ad Overlay
  fullscreenAdOverlay: document.getElementById('fullscreenAdOverlay'),
  fsaVideoPlayer: document.getElementById('fsaVideoPlayer'),
  fsaBadgeTitle: document.getElementById('fsaBadgeTitle'),
  fsaSecondsCount: document.getElementById('fsaSecondsCount'),
  fsaCountdownCircle: document.getElementById('fsaCountdownCircle'),
  btnFsaSound: document.getElementById('btnFsaSound'),
  btnFsaClose: document.getElementById('btnFsaClose'),
  fsaSponsorTagline: document.getElementById('fsaSponsorTagline'),
  fsaSponsorTitle: document.getElementById('fsaSponsorTitle'),
  fsaSponsorDesc: document.getElementById('fsaSponsorDesc'),
  fsaPromoVal: document.getElementById('fsaPromoVal'),
  fsaQrContainer: document.getElementById('fsaQrContainer'),
  fsaProgressFill: document.getElementById('fsaProgressFill'),

  // Games Hub Screen & Autostart
  gamesHubScreen: document.getElementById('gamesHubScreen'),
  gameArenaScreen: document.getElementById('gameArenaScreen'),
  hubTag: document.getElementById('hubTag'),
  hubTitleBefore: document.getElementById('hubTitleBefore'),
  hubTitleSpan: document.getElementById('hubTitleSpan'),
  hubSubtitle: document.getElementById('hubSubtitle'),
  autostartLabelText: document.getElementById('autostartLabelText'),
  autostartCounter: document.getElementById('autostartCounter'),
  autostartProgressFill: document.getElementById('autostartProgressFill'),
  btnPauseAutostart: document.getElementById('btnPauseAutostart'),
  cardLaunchClassic: document.getElementById('cardLaunchClassic'),
  cardLaunchPicture: document.getElementById('cardLaunchPicture'),
  cardLaunchSimon: document.getElementById('cardLaunchSimon'),
  cardLaunchMatch: document.getElementById('cardLaunchMatch'),
  cardClassicBadge: document.getElementById('cardClassicBadge'),
  cardClassicDesc: document.getElementById('cardClassicDesc'),
  cardClassicPlayers: document.getElementById('cardClassicPlayers'),
  btnPlayClassic: document.getElementById('btnPlayClassic'),
  cardPicBadge: document.getElementById('cardPicBadge'),
  cardPicDesc: document.getElementById('cardPicDesc'),
  cardPicPlayers: document.getElementById('cardPicPlayers'),
  btnPlayPic: document.getElementById('btnPlayPic'),
  cardSimonBadge: document.getElementById('cardSimonBadge'),
  cardSimonDesc: document.getElementById('cardSimonDesc'),
  cardSimonPlayers: document.getElementById('cardSimonPlayers'),
  btnPlaySimon: document.getElementById('btnPlaySimon'),
  cardMatchBadge: document.getElementById('cardMatchBadge'),
  cardMatchDesc: document.getElementById('cardMatchDesc'),
  cardMatchPlayers: document.getElementById('cardMatchPlayers'),
  btnPlayMatch: document.getElementById('btnPlayMatch'),

  // Arena & Trivia
  btnBackToGamesHub: document.getElementById('btnBackToGamesHub'),
  backToGamesText: document.getElementById('backToGamesText'),
  arenaGameTag: document.getElementById('arenaGameTag'),
  arenaScoreLabelText: document.getElementById('arenaScoreLabelText'),
  arenaScoreVal: document.getElementById('arenaScoreVal'),
  arenaContentMount: document.getElementById('arenaContentMount'),
  triviaArenaContainer: document.getElementById('triviaArenaContainer'),
  triviaCategory: document.getElementById('triviaCategory'),
  triviaCatIcon: document.getElementById('triviaCatIcon'),
  triviaCatName: document.getElementById('triviaCatName'),
  streakBadge: document.getElementById('streakBadge'),
  streakCount: document.getElementById('streakCount'),
  triviaLivesBadge: document.getElementById('triviaLivesBadge'),
  strikesIcons: document.getElementById('strikesIcons'),
  questionCounter: document.getElementById('questionCounter'),
  timerCircle: document.getElementById('timerCircle'),
  timerNumber: document.getElementById('timerNumber'),
  pictureClueCard: document.getElementById('pictureClueCard'),
  picClueVisual: document.getElementById('picClueVisual'),
  picClueCaption: document.getElementById('picClueCaption'),
  triviaQuestion: document.getElementById('triviaQuestion'),
  triviaOptions: document.getElementById('triviaOptions'),
  triviaFeedback: document.getElementById('triviaFeedback'),
  feedbackBadge: document.getElementById('feedbackBadge'),
  feedbackFact: document.getElementById('feedbackFact'),
  feedbackBarFill: document.getElementById('feedbackBarFill'),

  // Ride Info View
  rideWelcomeBadgeText: document.getElementById('rideWelcomeBadgeText'),
  badgeVipDriver: document.getElementById('badgeVipDriver'),
  infoDriverName: document.getElementById('infoDriverName'),
  infoDriverRating: document.getElementById('infoDriverRating'),
  infoDriverTrips: document.getElementById('infoDriverTrips'),
  infoDriverCar: document.getElementById('infoDriverCar'),
  tagCleanText: document.getElementById('tagCleanText'),
  tagLangText: document.getElementById('tagLangText'),
  tagMusicText: document.getElementById('tagMusicText'),
  tagCityText: document.getElementById('tagCityText'),
  driverMessageLabelText: document.getElementById('driverMessageLabelText'),
  infoDriverBio: document.getElementById('infoDriverBio'),
  tipHeaderTitleText: document.getElementById('tipHeaderTitleText'),
  tipHeaderSubText: document.getElementById('tipHeaderSubText'),
  btnCustomTip: document.getElementById('btnCustomTip'),
  btnSendTipLabel: document.getElementById('btnSendTipLabel'),
  btnOpenTipFromRide: document.getElementById('btnOpenTipFromRide'),

  // Route & Weather
  routeTagText: document.getElementById('routeTagText'),
  routeDestText: document.getElementById('routeDestText'),
  routeEtaUnit: document.getElementById('routeEtaUnit'),
  routeKmUnit: document.getElementById('routeKmUnit'),
  routeSpeedUnit: document.getElementById('routeSpeedUnit'),
  routeOriginText: document.getElementById('routeOriginText'),
  routeArrivalText: document.getElementById('routeArrivalText'),
  weatherCondText: document.getElementById('weatherCondText'),
  sunsetPillText: document.getElementById('sunsetPillText'),
  humidityLabelText: document.getElementById('humidityLabelText'),
  windLabelText: document.getElementById('windLabelText'),
  uvLabelText: document.getElementById('uvLabelText'),
  uvValueText: document.getElementById('uvValueText'),
  nowPlayingLabelText: document.getElementById('nowPlayingLabelText'),
  rideCurrentTrack: document.getElementById('rideCurrentTrack'),
  ridePlaylistSub: document.getElementById('ridePlaylistSub'),

  // Media Hub
  mediaBadgeText: document.getElementById('mediaBadgeText'),
  mediaTitleBefore: document.getElementById('mediaTitleBefore'),
  mediaTitleSpan: document.getElementById('mediaTitleSpan'),
  mediaSubtitleText: document.getElementById('mediaSubtitleText'),
  tabDealsText: document.getElementById('tabDealsText'),
  tabBillboardText: document.getElementById('tabBillboardText'),
  tabListenText: document.getElementById('tabListenText'),
  tabWatchText: document.getElementById('tabWatchText'),
  mediaTabDeals: document.getElementById('mediaTabDeals'),
  mediaTabBillboard: document.getElementById('mediaTabBillboard'),
  mediaTabListen: document.getElementById('mediaTabListen'),
  mediaTabWatch: document.getElementById('mediaTabWatch'),
  billboardColumnTitle: document.getElementById('billboardColumnTitle'),
  sportsColumnTitle: document.getElementById('sportsColumnTitle'),
  billboardList: document.getElementById('billboardList'),
  sportsList: document.getElementById('sportsList'),
  listenChannelsGrid: document.getElementById('listenChannelsGrid'),
  watchCardsGrid: document.getElementById('watchCardsGrid'),
  dealsMiniList: document.getElementById('dealsMiniList'),

  // Featured Ad Card
  adBadge: document.getElementById('adBadge'),
  adTimerLabel: document.getElementById('adTimerLabel'),
  adTimerCount: document.getElementById('adTimerCount'),
  adBrandLogo: document.getElementById('adBrandLogo'),
  adBrandName: document.getElementById('adBrandName'),
  adHeadline: document.getElementById('adHeadline'),
  adSubtext: document.getElementById('adSubtext'),
  promoLabelText: document.getElementById('promoLabelText'),
  adPromoCode: document.getElementById('adPromoCode'),
  qrInstructionText: document.getElementById('qrInstructionText'),
  adQrContainer: document.getElementById('adQrContainer'),
  adVideoContainer: document.getElementById('adVideoContainer'),
  adVideoPlayer: document.getElementById('adVideoPlayer'),
  btnNextAd: document.getElementById('btnNextAd'),
  btnClaimAd: document.getElementById('btnClaimAd'),

  // Giveaway & Leaderboard
  jackpotBadgeText: document.getElementById('jackpotBadgeText'),
  giveawayTitleBefore: document.getElementById('giveawayTitleBefore'),
  giveawayTitleSpan: document.getElementById('giveawayTitleSpan'),
  giveawayTitleAfter: document.getElementById('giveawayTitleAfter'),
  giveawaySubtitle: document.getElementById('giveawaySubtitle'),
  btnClaimTicket: document.getElementById('btnClaimTicket'),
  yourTicketsLabel: document.getElementById('yourTicketsLabel'),
  myTicketsCount: document.getElementById('myTicketsCount'),
  recentWinnersTitle: document.getElementById('recentWinnersTitle'),
  winnersList: document.getElementById('winnersList'),
  lbTitleText: document.getElementById('lbTitleText'),
  lbSubText: document.getElementById('lbSubText'),
  thRank: document.getElementById('thRank'),
  thRider: document.getElementById('thRider'),
  thScore: document.getElementById('thScore'),
  thPrize: document.getElementById('thPrize'),
  lbTableBody: document.getElementById('lbTableBody'),
  btnBackToGamesFromLb: document.getElementById('btnBackToGamesFromLb'),

  // Tip Modal
  tipModal: document.getElementById('tipModal'),
  btnCloseTipModal: document.getElementById('btnCloseTipModal'),
  tipModalTitlePre: document.getElementById('tipModalTitlePre'),
  tipModalDriverName: document.getElementById('tipModalDriverName'),
  tipModalSubText: document.getElementById('tipModalSubText'),
  tipHandle: document.getElementById('tipHandle'),
  tipQrGraphic: document.getElementById('tipQrGraphic'),
  btnConfirmTipSent: document.getElementById('btnConfirmTipSent'),

  // Giveaway Modal
  giveawayModal: document.getElementById('giveawayModal'),
  btnCloseGiveawayModal: document.getElementById('btnCloseGiveawayModal'),
  giveawayModalHeading: document.getElementById('giveawayModalHeading'),
  giveawayModalSub: document.getElementById('giveawayModalSub'),
  labelContactText: document.getElementById('labelContactText'),
  riderContact: document.getElementById('riderContact'),
  labelNicknameText: document.getElementById('labelNicknameText'),
  riderNickname: document.getElementById('riderNickname'),
  btnSubmitGiveaway: document.getElementById('btnSubmitGiveaway'),
  legalGiveawayText: document.getElementById('legalGiveawayText'),
  giveawayForm: document.getElementById('giveawayForm'),

  // Admin Modal
  adminModal: document.getElementById('adminModal'),
  btnCloseAdminModal: document.getElementById('btnCloseAdminModal'),
  adminPinScreen: document.getElementById('adminPinScreen'),
  adminSettingsScreen: document.getElementById('adminSettingsScreen'),
  adminModalTitle: document.getElementById('adminModalTitle'),
  adminModalSub: document.getElementById('adminModalSub'),
  btnVerifyPin: document.getElementById('btnVerifyPin'),
  adminPinHint: document.getElementById('adminPinHint'),
  adminPinInput: document.getElementById('adminPinInput'),
  adminSettingsHeading: document.getElementById('adminSettingsHeading'),
  adminSettingsSubheading: document.getElementById('adminSettingsSubheading'),
  statTripsToday: document.getElementById('statTripsToday'),
  statTripsTodayLabel: document.getElementById('statTripsTodayLabel'),
  statTriviaPlays: document.getElementById('statTriviaPlays'),
  statTriviaPlaysLabel: document.getElementById('statTriviaPlaysLabel'),
  statPointsEarned: document.getElementById('statPointsEarned'),
  statPointsEarnedLabel: document.getElementById('statPointsEarnedLabel'),
  statPayout: document.getElementById('statPayout'),
  statPayoutLabel: document.getElementById('statPayoutLabel'),
  lblCfgDriverName: document.getElementById('lblCfgDriverName'),
  cfgDriverName: document.getElementById('cfgDriverName'),
  lblCfgDriverCar: document.getElementById('lblCfgDriverCar'),
  cfgDriverCar: document.getElementById('cfgDriverCar'),
  lblCfgDriverRating: document.getElementById('lblCfgDriverRating'),
  cfgDriverRating: document.getElementById('cfgDriverRating'),
  lblCfgDriverTip: document.getElementById('lblCfgDriverTip'),
  cfgDriverTipHandle: document.getElementById('cfgDriverTipHandle'),
  lblCfgDriverPlaylist: document.getElementById('lblCfgDriverPlaylist'),
  cfgDriverPlaylist: document.getElementById('cfgDriverPlaylist'),
  lblCfgDriverBio: document.getElementById('lblCfgDriverBio'),
  cfgDriverBio: document.getElementById('cfgDriverBio'),
  btnSaveDriverConfig: document.getElementById('btnSaveDriverConfig'),
  btnResetStats: document.getElementById('btnResetStats'),

  // Toast
  toastContainer: document.getElementById('toastContainer')
};

/* ==========================================================================
   INITIALIZATION
   ========================================================================== */
function init() {
  loadDriverConfig();
  setupClock();
  setupDayNightTheme();
  setupEventListeners();
  applyLanguage(state.currentLang, false);
  renderLeaderboard();
  renderRecentWinners();
  renderMediaSections();
  loadAd(0);
  startAutostartCountdown();

  // Generate QR for driver tips
  generateQrCode(DOM.tipQrGraphic, "https://cash.app/" + state.driverConfig.tipHandle);
}

/* ==========================================================================
   INTERNATIONALIZATION (I18N) LOGIC
   ========================================================================== */
function setLanguage(lang) {
  if (state.currentLang === lang) return;
  sound.playSplashPop();
  state.currentLang = lang;
  localStorage.setItem('copilot_lang', lang);
  applyLanguage(lang, true);
}

function applyLanguage(lang, showToastNotification = true) {
  const t = getT();

  // Update switcher buttons
  if (DOM.btnLangEs) DOM.btnLangEs.classList.toggle('active', lang === 'es');
  if (DOM.btnLangEn) DOM.btnLangEn.classList.toggle('active', lang === 'en');

  // Header
  if (DOM.headerSubtitle) DOM.headerSubtitle.innerHTML = `<span class="live-dot"></span> ${t.brandSubtitle}`;
  if (DOM.quickPillText) DOM.quickPillText.innerHTML = t.pillBanner;
  if (DOM.scoreLabelText) DOM.scoreLabelText.textContent = t.scoreLabel;

  // Games Hub
  if (DOM.hubTag) DOM.hubTag.textContent = t.hubTag;
  if (DOM.hubTitleBefore) DOM.hubTitleBefore.textContent = t.hubTitleBefore;
  if (DOM.hubTitleSpan) DOM.hubTitleSpan.textContent = t.hubTitleSpan;
  if (DOM.hubSubtitle) DOM.hubSubtitle.innerHTML = t.hubSubtitle;
  if (DOM.autostartLabelText) DOM.autostartLabelText.textContent = t.autostartText;
  if (DOM.btnPauseAutostart) DOM.btnPauseAutostart.textContent = state.isAutostartPaused ? t.resume : t.pause;

  // Games Cards
  if (DOM.cardClassicBadge) DOM.cardClassicBadge.textContent = t.classicBadge;
  if (DOM.cardClassicDesc) DOM.cardClassicDesc.textContent = t.classicDesc;
  if (DOM.cardClassicPlayers) DOM.cardClassicPlayers.textContent = t.classicPlayers;
  if (DOM.btnPlayClassic) DOM.btnPlayClassic.textContent = t.playNow;

  if (DOM.cardPicBadge) DOM.cardPicBadge.textContent = t.pictureBadge;
  if (DOM.cardPicDesc) DOM.cardPicDesc.textContent = t.pictureDesc;
  if (DOM.cardPicPlayers) DOM.cardPicPlayers.textContent = t.picturePlayers;
  if (DOM.btnPlayPic) DOM.btnPlayPic.textContent = t.playNow;

  if (DOM.cardSimonBadge) DOM.cardSimonBadge.textContent = t.simonBadge;
  if (DOM.cardSimonDesc) DOM.cardSimonDesc.textContent = t.simonDesc;
  if (DOM.cardSimonPlayers) DOM.cardSimonPlayers.textContent = t.simonPlayers;
  if (DOM.btnPlaySimon) DOM.btnPlaySimon.textContent = t.playNow;

  if (DOM.cardMatchBadge) DOM.cardMatchBadge.textContent = t.matchBadge;
  if (DOM.cardMatchDesc) DOM.cardMatchDesc.textContent = t.matchDesc;
  if (DOM.cardMatchPlayers) DOM.cardMatchPlayers.textContent = t.matchPlayers;
  if (DOM.btnPlayMatch) DOM.btnPlayMatch.textContent = t.playNow;

  // Arena
  if (DOM.backToGamesText) DOM.backToGamesText.textContent = t.backToGames;
  if (DOM.arenaScoreLabelText) DOM.arenaScoreLabelText.textContent = t.arenaScore;
  if (DOM.streakCount) DOM.streakCount.textContent = `${t.streak} x${Math.max(1, state.streak)}`;

  // Active game re-translation
  if (state.activeGameMode === 'classic') {
    loadClassicQuestion(state.currentQuestionIndex);
  } else if (state.activeGameMode === 'picture') {
    loadPictureQuestion(state.currentPicIndex);
  } else if (state.activeGameInstance && typeof state.activeGameInstance.setLanguage === 'function') {
    state.activeGameInstance.setLanguage(lang);
  }

  // Ride Info
  if (DOM.rideWelcomeBadgeText) DOM.rideWelcomeBadgeText.textContent = t.rideWelcomeBadge;
  if (DOM.badgeVipDriver) DOM.badgeVipDriver.textContent = t.topDriverBadge;
  if (DOM.tagCleanText) DOM.tagCleanText.textContent = `✨ ${t.tagClean}`;
  if (DOM.tagLangText) DOM.tagLangText.textContent = `🗣️ ${t.tagLanguages}`;
  if (DOM.tagMusicText) DOM.tagMusicText.textContent = `🎵 ${t.tagMusic}`;
  if (DOM.tagCityText) DOM.tagCityText.textContent = `📍 ${t.tagCityExpert}`;
  if (DOM.driverMessageLabelText) DOM.driverMessageLabelText.textContent = t.driverMessageLabel;
  if (DOM.infoDriverTrips) DOM.infoDriverTrips.textContent = `(${state.driverConfig.trips} ${t.tripsCompleted})`;
  if (DOM.tipHeaderTitleText) DOM.tipHeaderTitleText.textContent = t.tipHeaderTitle;
  if (DOM.tipHeaderSubText) DOM.tipHeaderSubText.textContent = t.tipHeaderSub;
  if (DOM.btnCustomTip) DOM.btnCustomTip.textContent = t.tipCustom;
  if (DOM.btnSendTipLabel) DOM.btnSendTipLabel.textContent = `${t.sendTipBtn} $${state.selectedTipAmount} ${t.toDriver} ${state.driverConfig.name}`;

  // Route & Weather
  if (DOM.routeTagText) DOM.routeTagText.textContent = t.routeTag;
  if (DOM.routeDestText) DOM.routeDestText.textContent = t.routeDest;
  if (DOM.routeEtaUnit) DOM.routeEtaUnit.textContent = t.routeEta;
  if (DOM.routeKmUnit) DOM.routeKmUnit.textContent = t.routeKm;
  if (DOM.routeSpeedUnit) DOM.routeSpeedUnit.textContent = t.routeSpeed;
  if (DOM.routeOriginText) DOM.routeOriginText.textContent = t.routeOrigin;
  if (DOM.routeArrivalText) DOM.routeArrivalText.textContent = t.routeArrival;
  if (DOM.weatherCondText) DOM.weatherCondText.textContent = t.weatherDesc;
  if (DOM.sunsetPillText) DOM.sunsetPillText.innerHTML = `<span>🌅</span> ${t.sunsetLabel}`;
  if (DOM.humidityLabelText) DOM.humidityLabelText.textContent = t.humidityLabel;
  if (DOM.windLabelText) DOM.windLabelText.textContent = t.windLabel;
  if (DOM.uvLabelText) DOM.uvLabelText.textContent = t.uvLabel;
  if (DOM.uvValueText) DOM.uvValueText.textContent = t.uvValue;
  if (DOM.nowPlayingLabelText) DOM.nowPlayingLabelText.textContent = t.nowPlayingVehicle;
  if (DOM.ridePlaylistSub) DOM.ridePlaylistSub.textContent = t.playlistCuratedBy;

  // Media Hub
  if (DOM.mediaBadgeText) DOM.mediaBadgeText.textContent = t.mediaBadge;
  if (DOM.mediaTitleBefore) DOM.mediaTitleBefore.textContent = t.mediaTitleBefore;
  if (DOM.mediaTitleSpan) DOM.mediaTitleSpan.textContent = t.mediaTitleSpan;
  if (DOM.mediaSubtitleText) DOM.mediaSubtitleText.textContent = t.mediaSubtitle;
  if (DOM.tabDealsText) DOM.tabDealsText.textContent = (t.tabDeals || 'Ofertas').replace('🎁 ', '');
  if (DOM.tabVideoPromoText) DOM.tabVideoPromoText.textContent = lang === 'en' ? "Video Spotlight" : "Video Promo";
  if (DOM.tabBillboardText) DOM.tabBillboardText.textContent = (t.tabBillboard || 'Top Música').replace('📊 ', '');
  if (DOM.tabListenText) DOM.tabListenText.textContent = (t.tabListen || 'Música').replace('🎧 ', '');
  if (DOM.tabWatchText) DOM.tabWatchText.textContent = (t.tabWatch || 'Videos').replace('🎬 ', '');
  if (DOM.billboardColumnTitle) DOM.billboardColumnTitle.textContent = t.billboardTitle;
  if (DOM.sportsColumnTitle) DOM.sportsColumnTitle.textContent = t.sportsTitle;
  if (DOM.adBadge) DOM.adBadge.textContent = t.adBadgeFeatured;
  if (DOM.adTimerLabel) DOM.adTimerLabel.textContent = t.adContinuingIn;
  if (DOM.promoLabelText) DOM.promoLabelText.textContent = t.promoLabel;
  if (DOM.qrInstructionText) DOM.qrInstructionText.innerHTML = t.qrScanInstruction;
  if (DOM.btnNextAd) DOM.btnNextAd.textContent = t.nextAd;
  if (DOM.btnClaimAd) DOM.btnClaimAd.textContent = t.claimAd;

  // Weather & News Panel
  if (DOM.weatherNewsBadge) DOM.weatherNewsBadge.textContent = lang === 'en' ? "🌤️ LIVE WEATHER & TODAY'S STORIES" : "🌤️ CLIMA EN VIVO & NOTICIAS DEL DÍA";
  if (DOM.weatherNewsSubtitle) DOM.weatherNewsSubtitle.textContent = t.weatherSub;
  if (DOM.btnWnWeatherLabel) DOM.btnWnWeatherLabel.textContent = (t.tabWeather || 'Clima').replace('☀️ ', '');
  if (DOM.btnWnNewsLabel) DOM.btnWnNewsLabel.textContent = (t.tabNews || 'Noticias').replace('📰 ', '');
  renderWeatherExpanded();
  renderNewsFeed();

  // Video Promo Showcase
  if (DOM.pvmBadgeText) DOM.pvmBadgeText.textContent = lang === 'en' ? "SPONSORED VIDEO SPOTLIGHT" : "SPOT DE VIDEO PATROCINADO";
  if (DOM.pvmQrInstruction) DOM.pvmQrInstruction.textContent = lang === 'en' ? "📱 Scan with mobile phone" : "📱 Escanea con tu móvil";
  if (DOM.pvmPromoLabel) DOM.pvmPromoLabel.textContent = lang === 'en' ? "PROMO CODE:" : "CÓDIGO:";
  if (DOM.btnClaimPromoVideo) DOM.btnClaimPromoVideo.textContent = t.claimAd;
  if (DOM.btnNextPromoVideo) DOM.btnNextPromoVideo.textContent = t.nextAd;

  // Giveaway & Leaderboard
  if (DOM.jackpotBadgeText) DOM.jackpotBadgeText.textContent = t.jackpotBadge;
  if (DOM.giveawayTitleBefore) DOM.giveawayTitleBefore.textContent = t.giveawayTitleBefore;
  if (DOM.giveawayTitleSpan) DOM.giveawayTitleSpan.textContent = t.giveawayTitleSpan;
  if (DOM.giveawayTitleAfter) DOM.giveawayTitleAfter.textContent = t.giveawayTitleAfter;
  if (DOM.giveawaySubtitle) DOM.giveawaySubtitle.textContent = t.giveawaySub;
  if (DOM.btnClaimTicket) DOM.btnClaimTicket.innerHTML = `<span>🎟️</span> ${(t.btnGenerateTicket || 'Generar Boleto').replace('🎟️ ', '')}`;
  if (DOM.yourTicketsLabel) DOM.yourTicketsLabel.textContent = t.yourTicketsToday;
  if (DOM.recentWinnersTitle) DOM.recentWinnersTitle.textContent = t.recentWinnersTitle;
  if (DOM.lbTitleText) DOM.lbTitleText.textContent = t.leaderboardTitle;
  if (DOM.lbSubText) DOM.lbSubText.textContent = t.leaderboardSub;
  if (DOM.thRank) DOM.thRank.textContent = t.thRank;
  if (DOM.thRider) DOM.thRider.textContent = t.thRider;
  if (DOM.thScore) DOM.thScore.textContent = t.thScore;
  if (DOM.thPrize) DOM.thPrize.textContent = t.thPrize;
  if (DOM.btnBackToGamesFromLb) DOM.btnBackToGamesFromLb.textContent = t.btnBackToGamesFromLb;

  // Bottom Dock
  if (DOM.dockLabelGames) DOM.dockLabelGames.textContent = t.dockGames;
  if (DOM.dockLabelWeatherNews) DOM.dockLabelWeatherNews.textContent = t.dockLabelWeatherNews;
  if (DOM.dockLabelRideInfo) DOM.dockLabelRideInfo.textContent = t.dockRideInfo;
  if (DOM.dockLabelMediaAds) DOM.dockLabelMediaAds.textContent = t.dockMediaAds;
  if (DOM.dockLabelGiveaway) DOM.dockLabelGiveaway.textContent = t.dockGiveaway;
  if (DOM.dockLabelLeaderboard) DOM.dockLabelLeaderboard.textContent = t.dockLeaderboard;

  // Mix mode pill
  updateMixPillUI();

  // Modals
  if (DOM.tipModalTitlePre) DOM.tipModalTitlePre.textContent = t.tipModalTitle;
  if (DOM.tipModalSubText) DOM.tipModalSubText.textContent = t.tipModalSub;
  if (DOM.btnConfirmTipSent) DOM.btnConfirmTipSent.textContent = t.btnConfirmTipSent;

  if (DOM.giveawayModalHeading) DOM.giveawayModalHeading.textContent = t.giveawayModalTitle;
  if (DOM.giveawayModalSub) DOM.giveawayModalSub.textContent = t.giveawayModalSub;
  if (DOM.labelContactText) DOM.labelContactText.textContent = t.labelContact;
  if (DOM.riderContact) DOM.riderContact.placeholder = t.placeholderContact;
  if (DOM.labelNicknameText) DOM.labelNicknameText.textContent = t.labelNickname;
  if (DOM.riderNickname) DOM.riderNickname.placeholder = t.placeholderNickname;
  if (DOM.btnSubmitGiveaway) DOM.btnSubmitGiveaway.innerHTML = `<span>🎟️</span> ${(t.btnRegisterTicket || 'Registrar Boleto').replace('🎟️ ', '')}`;
  if (DOM.legalGiveawayText) DOM.legalGiveawayText.textContent = t.legalGiveaway;

  if (DOM.adminModalTitle) DOM.adminModalTitle.textContent = t.adminModalTitle;
  if (DOM.adminModalSub) DOM.adminModalSub.textContent = t.adminModalSub;
  if (DOM.btnVerifyPin) DOM.btnVerifyPin.textContent = t.btnAccess;
  if (DOM.adminPinHint) DOM.adminPinHint.innerHTML = t.pinHint;
  if (DOM.adminSettingsHeading) DOM.adminSettingsHeading.textContent = t.adminSettingsTitle;
  if (DOM.adminSettingsSubheading) DOM.adminSettingsSubheading.textContent = t.adminSettingsSub;
  if (DOM.statTripsTodayLabel) DOM.statTripsTodayLabel.textContent = t.statTripsToday;
  if (DOM.statTriviaPlaysLabel) DOM.statTriviaPlaysLabel.textContent = t.statTriviaPlays;
  if (DOM.statPointsEarnedLabel) DOM.statPointsEarnedLabel.textContent = t.statPointsEarned;
  if (DOM.statPayoutLabel) DOM.statPayoutLabel.textContent = t.statPayout;
  if (DOM.lblCfgDriverName) DOM.lblCfgDriverName.textContent = t.labelDriverName;
  if (DOM.lblCfgDriverCar) DOM.lblCfgDriverCar.textContent = t.labelVehicle;
  if (DOM.lblCfgDriverRating) DOM.lblCfgDriverRating.textContent = t.labelRating;
  if (DOM.lblCfgDriverTip) DOM.lblCfgDriverTip.textContent = t.labelTipHandle;
  if (DOM.lblCfgDriverPlaylist) DOM.lblCfgDriverPlaylist.textContent = t.labelPlaylist;
  if (DOM.lblCfgDriverBio) DOM.lblCfgDriverBio.textContent = t.labelBio;
  if (DOM.btnResetStats) DOM.btnResetStats.textContent = t.btnResetStats;
  if (DOM.btnSaveDriverConfig) DOM.btnSaveDriverConfig.textContent = t.btnSaveSettings;

  if (showToastNotification) {
    showToast(t.toastLangChanged);
  }
}

/* ==========================================================================
   CLOCK & STATUS
   ========================================================================== */
function setupClock() {
  function update() {
    const now = new Date();
    let hours = now.getHours();
    const period = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    const mins = String(now.getMinutes()).padStart(2, '0');
    
    if (DOM.clockTime) DOM.clockTime.textContent = `${hours}:${mins}`;
    if (DOM.clockPeriod) DOM.clockPeriod.textContent = period;
  }
  update();
  setInterval(update, 1000);
}

/* ==========================================================================
   NAVIGATION / DOCK TABS
   ========================================================================== */
function switchTab(targetTab) {
  sound.playTap();
  state.activeTab = targetTab;

  if (!isAdminUnlocked && !document.fullscreenElement && !document.webkitFullscreenElement) {
    requestFullscreenSafely();
  }

  const dockPills = [DOM.tabGames, DOM.tabWeatherNews, DOM.tabRideInfo, DOM.tabMediaAds, DOM.tabGiveaway, DOM.tabLeaderboard];
  dockPills.forEach(pill => {
    if (pill) pill.classList.toggle('active', pill.dataset.target === targetTab);
  });

  const viewPanels = [DOM.viewGames, DOM.viewWeatherNews, DOM.viewRideInfo, DOM.viewMediaAds, DOM.viewGiveaway, DOM.viewLeaderboard];
  viewPanels.forEach(panel => {
    if (panel) panel.classList.remove('active');
  });

  if (targetTab === 'games' && DOM.viewGames) DOM.viewGames.classList.add('active');
  if (targetTab === 'weatherNews' && DOM.viewWeatherNews) {
    DOM.viewWeatherNews.classList.add('active');
    switchWeatherNewsSubtab('weather');
    renderWeatherExpanded();
    renderNewsFeed();
  }
  if (targetTab === 'rideInfo' && DOM.viewRideInfo) DOM.viewRideInfo.classList.add('active');
  if (targetTab === 'mediaAds' && DOM.viewMediaAds) {
    DOM.viewMediaAds.classList.add('active');
    switchMediaSubtab('videoPromo');
    syncCurrentVideoSpotlight();
    startPromoVideoPlayback();
  }
  if (targetTab === 'giveaway' && DOM.viewGiveaway) DOM.viewGiveaway.classList.add('active');
  if (targetTab === 'leaderboard' && DOM.viewLeaderboard) DOM.viewLeaderboard.classList.add('active');

  // Clean up trivia and game instances when navigating away from games
  if (targetTab !== 'games') {
    stopTrivia();
    if (state.activeGameInstance && state.activeGameInstance.destroy) {
      state.activeGameInstance.destroy();
    }
    state.isUserActivelyPlaying = false;
  }

  // Pause promo video if leaving mediaAds
  if (targetTab !== 'mediaAds' && DOM.promoVideoMainPlayer) {
    DOM.promoVideoMainPlayer.pause();
  }
}

// Expose globally for inline onclick handlers
window.__appSwitchTab = switchTab;
window.switchTabGlobal = switchTab;

/* ==========================================================================
   AUTOSTART COUNTDOWN (GAMES HUB)
   ========================================================================== */
function startAutostartCountdown() {
  clearInterval(state.autostartInterval);
  state.autostartSeconds = 8;
  state.isAutostartPaused = false;
  updateAutostartUI();

  state.autostartInterval = setInterval(() => {
    if (state.isAutostartPaused) return;

    state.autostartSeconds--;
    updateAutostartUI();

    if (state.autostartSeconds <= 0) {
      clearInterval(state.autostartInterval);
      launchGame('classic');
    }
  }, 1000);
}

function updateAutostartUI() {
  if (DOM.autostartCounter) DOM.autostartCounter.textContent = `${state.autostartSeconds}s`;
  if (DOM.autostartProgressFill) {
    const fraction = (state.autostartSeconds / 8) * 100;
    DOM.autostartProgressFill.style.width = `${Math.max(0, fraction)}%`;
  }
}

function togglePauseAutostart() {
  const t = getT();
  state.isAutostartPaused = !state.isAutostartPaused;
  sound.playTap();
  if (DOM.btnPauseAutostart) {
    DOM.btnPauseAutostart.textContent = state.isAutostartPaused ? t.resume : t.pause;
    DOM.btnPauseAutostart.style.borderColor = state.isAutostartPaused ? 'var(--splash-magenta)' : 'rgba(255,255,255,0.2)';
  }
}

/* ==========================================================================
   GAME LAUNCHER & ROUTER
   ========================================================================== */
function launchGame(gameType) {
  const t = getT();
  clearInterval(state.autostartInterval);
  stopTrivia();
  if (state.activeGameInstance && state.activeGameInstance.destroy) {
    state.activeGameInstance.destroy();
  }
  state.activeGameInstance = null;

  sound.playSplashPop();
  state.activeGameMode = gameType;
  state.isUserActivelyPlaying = true;
  state.lastUserInteraction = Date.now();
  state.mixMode.isPaused = true;
  updateMixPillUI();

  if (!isAdminUnlocked && !document.fullscreenElement && !document.webkitFullscreenElement) {
    requestFullscreenSafely();
  }

  if (DOM.gamesHubScreen) DOM.gamesHubScreen.classList.add('hidden');
  if (DOM.gameArenaScreen) DOM.gameArenaScreen.classList.remove('hidden');

  DOM.arenaContentMount.innerHTML = '';

  if (gameType === 'classic') {
    state.triviaWrongCount = 0;
    updateTriviaStrikesUI();
    if (DOM.arenaGameTag) DOM.arenaGameTag.textContent = `❓ ${t.classicBadge}`;
    DOM.arenaContentMount.appendChild(DOM.triviaArenaContainer);
    DOM.pictureClueCard.classList.add('hidden');
    loadClassicQuestion(0);
  } else if (gameType === 'picture') {
    state.triviaWrongCount = 0;
    updateTriviaStrikesUI();
    if (DOM.arenaGameTag) DOM.arenaGameTag.textContent = `📸 ${t.pictureBadge}`;
    DOM.arenaContentMount.appendChild(DOM.triviaArenaContainer);
    DOM.pictureClueCard.classList.remove('hidden');
    loadPictureQuestion(0);
  } else if (gameType === 'simon') {
    if (DOM.arenaGameTag) DOM.arenaGameTag.textContent = `🎨 ${t.simonBadge}`;
    state.activeGameInstance = new ColorMemoryGame(
      DOM.arenaContentMount,
      (score, deltaPts) => {
        addPoints(deltaPts);
      },
      (finalScore, isVoluntary) => {
        if (!isVoluntary) showToast(`🎮 ${t.simonTitle}: ${finalScore} Pts`);
        returnToGamesHub();
      },
      state.currentLang
    );
    state.activeGameInstance.start();
  } else if (gameType === 'match') {
    if (DOM.arenaGameTag) DOM.arenaGameTag.textContent = `⚡ ${t.matchBadge}`;
    state.activeGameInstance = new SpeedMatchGame(
      DOM.arenaContentMount,
      (score, deltaPts) => {
        addPoints(deltaPts);
      },
      (finalScore, isWin) => {
        if (isWin) {
          showToast(`🏆 ${t.matchTitle}: +${finalScore} Pts!`);
        } else {
          showToast(`⏱️ ${t.timeoutFeedback} (${finalScore} Pts)`);
        }
        returnToGamesHub();
      },
      state.currentLang
    );
    state.activeGameInstance.start();
  }
}

function returnToGamesHub() {
  sound.playTap();
  stopTrivia();
  if (state.activeGameInstance && state.activeGameInstance.destroy) {
    state.activeGameInstance.destroy();
  }
  state.activeGameMode = 'none';
  state.activeGameInstance = null;
  state.isUserActivelyPlaying = false;

  if (DOM.gameArenaScreen) DOM.gameArenaScreen.classList.add('hidden');
  if (DOM.gamesHubScreen) DOM.gamesHubScreen.classList.remove('hidden');

  startAutostartCountdown();
}

function addPoints(pts) {
  state.score += pts;
  sound.playCoin();
  if (DOM.userScore) DOM.userScore.textContent = state.score.toLocaleString();
  if (DOM.arenaScoreVal) DOM.arenaScoreVal.textContent = state.score.toLocaleString();
}

function shuffleTriviaQuestions() {
  state.shuffledTrivia = [...TRIVIA_QUESTIONS];
  for (let i = state.shuffledTrivia.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [state.shuffledTrivia[i], state.shuffledTrivia[j]] = [state.shuffledTrivia[j], state.shuffledTrivia[i]];
  }
}

function stopTrivia() {
  if (state.timerInterval) {
    clearInterval(state.timerInterval);
    state.timerInterval = null;
  }
  if (state.triviaTransitionTimeout) {
    clearTimeout(state.triviaTransitionTimeout);
    state.triviaTransitionTimeout = null;
  }
}

function updateTriviaStrikesUI() {
  const el = DOM.strikesIcons || document.getElementById('strikesIcons');
  if (!el) return;
  const maxLives = 5;
  const wrong = Math.min(maxLives, state.triviaWrongCount || 0);
  const remaining = Math.max(0, maxLives - wrong);
  let hearts = '';
  for (let i = 0; i < maxLives; i++) {
    hearts += (i < remaining) ? '❤️' : '🖤';
  }
  el.textContent = hearts;
}

function triggerTriviaGameOver(isPicTrivia) {
  stopTrivia();
  sound.playWrong();
  const t = getT();
  const isEn = state.currentLang === 'en';
  const msg = isEn ? '💥 5 MISTAKES! RESETTING TRIVIA...' : '💥 ¡5 ERRORES! REINICIANDO TRIVIA...';
  const factMsg = isEn
    ? 'You reached 5 incorrect answers. Starting again from question 1.'
    : 'Has acumulado 5 preguntas incorrectas. La partida comenzará de nuevo desde la pregunta 1.';

  DOM.feedbackBadge.className = 'feedback-badge wrong';
  DOM.feedbackBadge.textContent = msg;
  DOM.feedbackFact.textContent = factMsg;
  DOM.triviaFeedback.classList.remove('hidden');
  showToast(msg);

  state.triviaWrongCount = 0;
  state.streak = 0;
  if (DOM.streakCount) DOM.streakCount.textContent = `${t.streak} x1`;
  updateTriviaStrikesUI();

  state.triviaTransitionTimeout = setTimeout(() => {
    if (state.activeTab !== 'games') return;
    if ((isPicTrivia && state.activeGameMode !== 'picture') || (!isPicTrivia && state.activeGameMode !== 'classic')) return;

    if (isPicTrivia) {
      loadPictureQuestion(0);
    } else {
      shuffleTriviaQuestions();
      loadClassicQuestion(0);
    }
  }, 3200);
}

/* ==========================================================================
   CLASSIC TRIVIA ENGINE (500 RANDOMIZED QUESTIONS)
   ========================================================================== */
function loadClassicQuestion(index) {
  if (state.activeTab !== 'games' || state.activeGameMode !== 'classic') {
    stopTrivia();
    return;
  }

  if (!state.shuffledTrivia || state.shuffledTrivia.length === 0) {
    shuffleTriviaQuestions();
  }
  const t = getT();
  const lang = state.currentLang;
  state.currentQuestionIndex = index % state.shuffledTrivia.length;
  const q = state.shuffledTrivia[state.currentQuestionIndex];
  state.isAnswerLocked = false;

  const category = lang === 'en' ? q.category_en : q.category_es;
  const question = lang === 'en' ? q.question_en : q.question_es;
  const rawOptions = lang === 'en' ? q.options_en : q.options_es;

  DOM.triviaCatIcon.textContent = q.categoryIcon;
  DOM.triviaCatName.textContent = category;
  DOM.questionCounter.textContent = `${t.questionOf} ${state.currentQuestionIndex + 1} ${t.ofWord} ${state.shuffledTrivia.length}`;
  DOM.triviaQuestion.textContent = question;
  DOM.triviaFeedback.classList.add('hidden');
  updateTriviaStrikesUI();

  // Shuffle the 4 options so the correct answer is randomized
  const preparedOptions = rawOptions.map((optText, optIdx) => ({
    text: optText,
    isCorrect: optIdx === q.answerIndex
  }));
  for (let i = preparedOptions.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [preparedOptions[i], preparedOptions[j]] = [preparedOptions[j], preparedOptions[i]];
  }

  DOM.triviaOptions.innerHTML = '';
  const letters = ['A', 'B', 'C', 'D'];

  preparedOptions.forEach((optObj, optIdx) => {
    const btn = document.createElement('button');
    btn.className = 'option-btn';
    btn.dataset.correct = optObj.isCorrect ? 'true' : 'false';
    btn.innerHTML = `
      <span class="option-letter">${letters[optIdx]}</span>
      <span class="option-text">${optObj.text}</span>
    `;
    btn.addEventListener('click', () => handleTriviaAnswer(optObj.isCorrect, btn, q, false));
    DOM.triviaOptions.appendChild(btn);
  });

  startTriviaTimer(false);
}

/* ==========================================================================
   PICTURE TRIVIA ENGINE
   ========================================================================== */
function loadPictureQuestion(index) {
  if (state.activeTab !== 'games' || state.activeGameMode !== 'picture') {
    stopTrivia();
    return;
  }

  const t = getT();
  const lang = state.currentLang;
  state.currentPicIndex = index % PICTURE_TRIVIA_QUESTIONS.length;
  const q = PICTURE_TRIVIA_QUESTIONS[state.currentPicIndex];
  state.isAnswerLocked = false;

  const category = lang === 'en' ? q.category_en : q.category_es;
  const question = lang === 'en' ? q.question_en : q.question_es;
  const rawOptions = lang === 'en' ? q.options_en : q.options_es;
  const imageTitle = lang === 'en' ? q.imageTitle_en : q.imageTitle_es;

  DOM.triviaCatIcon.textContent = q.categoryIcon;
  DOM.triviaCatName.textContent = category;
  DOM.questionCounter.textContent = `${t.visualChallengeOf} ${state.currentPicIndex + 1} ${t.ofWord} ${PICTURE_TRIVIA_QUESTIONS.length}`;
  DOM.triviaQuestion.textContent = question;
  DOM.triviaFeedback.classList.add('hidden');
  updateTriviaStrikesUI();

  DOM.picClueVisual.textContent = q.imageEmoji;
  DOM.picClueCaption.textContent = imageTitle;

  // Shuffle options for picture trivia as well
  const preparedOptions = rawOptions.map((optText, optIdx) => ({
    text: optText,
    isCorrect: optIdx === q.answerIndex
  }));
  for (let i = preparedOptions.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [preparedOptions[i], preparedOptions[j]] = [preparedOptions[j], preparedOptions[i]];
  }

  DOM.triviaOptions.innerHTML = '';
  const letters = ['A', 'B', 'C', 'D'];

  preparedOptions.forEach((optObj, optIdx) => {
    const btn = document.createElement('button');
    btn.className = 'option-btn';
    btn.dataset.correct = optObj.isCorrect ? 'true' : 'false';
    btn.innerHTML = `
      <span class="option-letter">${letters[optIdx]}</span>
      <span class="option-text">${optObj.text}</span>
    `;
    btn.addEventListener('click', () => handleTriviaAnswer(optObj.isCorrect, btn, q, true));
    DOM.triviaOptions.appendChild(btn);
  });

  startTriviaTimer(true);
}

function startTriviaTimer(isPicTrivia) {
  stopTrivia();
  if (state.activeTab !== 'games') return;
  if (isPicTrivia && state.activeGameMode !== 'picture') return;
  if (!isPicTrivia && state.activeGameMode !== 'classic') return;

  state.timerSeconds = 12;
  updateTriviaTimerUI();

  if (DOM.timerCircle) DOM.timerCircle.classList.remove('warning');

  state.timerInterval = setInterval(() => {
    // Background guard: If player left games tab or switched game mode, halt timer immediately
    if (state.activeTab !== 'games' || (isPicTrivia && state.activeGameMode !== 'picture') || (!isPicTrivia && state.activeGameMode !== 'classic')) {
      stopTrivia();
      return;
    }

    state.timerSeconds--;
    updateTriviaTimerUI();

    if (state.timerSeconds <= 4 && state.timerSeconds > 0) {
      sound.playTick();
      if (DOM.timerCircle) DOM.timerCircle.classList.add('warning');
    }

    if (state.timerSeconds <= 0) {
      stopTrivia();
      handleTriviaTimeout(isPicTrivia);
    }
  }, 1000);
}

function updateTriviaTimerUI() {
  if (DOM.timerNumber) DOM.timerNumber.textContent = state.timerSeconds;
  const totalDash = 163.36;
  const fraction = state.timerSeconds / 12;
  const offset = totalDash * (1 - fraction);
  if (DOM.timerCircle) DOM.timerCircle.style.strokeDashoffset = offset;
}

function handleTriviaAnswer(isCorrect, selectedBtn, questionData, isPicTrivia) {
  if (state.activeTab !== 'games' || (isPicTrivia && state.activeGameMode !== 'picture') || (!isPicTrivia && state.activeGameMode !== 'classic')) {
    stopTrivia();
    return;
  }

  if (state.isAnswerLocked) return;
  state.isAnswerLocked = true;
  stopTrivia();

  const t = getT();
  const lang = state.currentLang;
  const allBtns = DOM.triviaOptions.querySelectorAll('.option-btn');
  const fact = lang === 'en' ? questionData.fact_en : questionData.fact_es;

  state.driverConfig.triviaPlays++;
  updateDriverStatsInStorage();

  if (isCorrect) {
    sound.playCorrect();
    selectedBtn.classList.add('correct');
    state.streak++;
    const bonus = state.streak > 1 ? 2 : 1;
    const pts = questionData.points * bonus;
    addPoints(pts);

    DOM.feedbackBadge.className = 'feedback-badge correct';
    DOM.feedbackBadge.textContent = `${t.correctFeedback} +${pts} PTS ${state.streak > 1 ? `(${t.streak} x${state.streak} 🔥)` : ''}`;
  } else {
    sound.playWrong();
    selectedBtn.classList.add('wrong');
    state.streak = 0;
    allBtns.forEach(btn => {
      if (btn.dataset.correct === 'true') {
        btn.classList.add('correct');
      }
    });

    DOM.feedbackBadge.className = 'feedback-badge wrong';
    DOM.feedbackBadge.textContent = t.wrongFeedback;

    state.triviaWrongCount = (state.triviaWrongCount || 0) + 1;
    updateTriviaStrikesUI();

    if (state.triviaWrongCount >= 5) {
      triggerTriviaGameOver(isPicTrivia);
      return;
    }
  }

  if (DOM.streakCount) DOM.streakCount.textContent = `${t.streak} x${Math.max(1, state.streak)}`;
  DOM.feedbackFact.textContent = fact;
  DOM.triviaFeedback.classList.remove('hidden');

  // Player is actively engaged: protect session so mix mode does not kick them out
  state.isUserActivelyPlaying = true;
  state.lastUserInteraction = Date.now();
  state.mixMode.isPaused = true;
  updateMixPillUI();

  state.triviaTransitionTimeout = setTimeout(() => {
    if (state.activeTab !== 'games') return;
    if ((isPicTrivia && state.activeGameMode !== 'picture') || (!isPicTrivia && state.activeGameMode !== 'classic')) return;

    // Continue directly to the next question
    if (isPicTrivia) {
      loadPictureQuestion(state.currentPicIndex + 1);
    } else {
      loadClassicQuestion(state.currentQuestionIndex + 1);
    }
  }, 2500);
}

function handleTriviaTimeout(isPicTrivia) {
  if (state.activeTab !== 'games' || (isPicTrivia && state.activeGameMode !== 'picture') || (!isPicTrivia && state.activeGameMode !== 'classic')) {
    stopTrivia();
    return;
  }

  const t = getT();
  const lang = state.currentLang;
  sound.playWrong();
  state.streak = 0;
  if (DOM.streakCount) DOM.streakCount.textContent = `${t.streak} x1`;

  const q = isPicTrivia ? PICTURE_TRIVIA_QUESTIONS[state.currentPicIndex] : state.shuffledTrivia[state.currentQuestionIndex];
  const allBtns = DOM.triviaOptions.querySelectorAll('.option-btn');
  const fact = lang === 'en' ? q.fact_en : q.fact_es;

  allBtns.forEach(btn => {
    if (btn.dataset.correct === 'true') {
      btn.classList.add('correct');
    }
  });

  DOM.feedbackBadge.className = 'feedback-badge wrong';
  DOM.feedbackBadge.textContent = t.timeoutFeedback;
  DOM.feedbackFact.textContent = fact;
  DOM.triviaFeedback.classList.remove('hidden');

  state.triviaWrongCount = (state.triviaWrongCount || 0) + 1;
  updateTriviaStrikesUI();

  if (state.triviaWrongCount >= 5) {
    triggerTriviaGameOver(isPicTrivia);
    return;
  }

  state.triviaTransitionTimeout = setTimeout(() => {
    if (state.activeTab !== 'games') return;
    if ((isPicTrivia && state.activeGameMode !== 'picture') || (!isPicTrivia && state.activeGameMode !== 'classic')) return;

    // Continue directly to the next question without interrupting
    if (isPicTrivia) {
      loadPictureQuestion(state.currentPicIndex + 1);
    } else {
      loadClassicQuestion(state.currentQuestionIndex + 1);
    }
  }, 2500);
}

/* ==========================================================================
   RIDE INFORMATION & TIPPING
   ========================================================================== */
function setupRideInfoControls() {
  const tipButtons = document.querySelectorAll('.tip-choice-btn');
  tipButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      sound.playTap();
      tipButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const t = getT();
      const val = btn.dataset.val;
      if (val) {
        state.selectedTipAmount = parseInt(val, 10);
        if (DOM.btnSendTipLabel) {
          DOM.btnSendTipLabel.textContent = `${t.sendTipBtn} $${state.selectedTipAmount} ${t.toDriver} ${state.driverConfig.name}`;
        }
      } else if (btn.id === 'btnCustomTip') {
        const promptMsg = state.currentLang === 'en' ? "Enter tip amount ($):" : "Ingresa el monto de propina deseado ($):";
        const custom = prompt(promptMsg, "15");
        if (custom && !isNaN(custom)) {
          state.selectedTipAmount = parseInt(custom, 10);
          btn.textContent = `$${state.selectedTipAmount}`;
          if (DOM.btnSendTipLabel) {
            DOM.btnSendTipLabel.textContent = `${t.sendTipBtn} $${state.selectedTipAmount} ${t.toDriver} ${state.driverConfig.name}`;
          }
        }
      }
    });
  });

  if (DOM.btnOpenTipFromRide) {
    DOM.btnOpenTipFromRide.addEventListener('click', openTipModal);
  }
}

function openTipModal() {
  sound.playTap();
  DOM.tipModalDriverName.textContent = state.driverConfig.name;
  DOM.tipHandle.textContent = `CashApp / Venmo: ${state.driverConfig.tipHandle}`;
  generateQrCode(DOM.tipQrGraphic, `https://cash.app/${state.driverConfig.tipHandle}`);
  DOM.tipModal.classList.remove('hidden');
}

function closeTipModal() {
  DOM.tipModal.classList.add('hidden');
}

/* ==========================================================================
   INTERACTIVE MEDIA & ADS HUB
   ========================================================================== */
function setupMediaSubnav() {
  const subnavBtns = document.querySelectorAll('.media-subnav-btn');
  subnavBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      sound.playTap();
      const target = btn.dataset.mediatab;
      switchMediaSubtab(target);
    });
  });
}

function switchMediaSubtab(target) {
  state.activeMediaSubtab = target;
  const subnavBtns = document.querySelectorAll('.media-subnav-btn');
  subnavBtns.forEach(b => b.classList.toggle('active', b.dataset.mediatab === target));

  const contents = [DOM.mediaTabDeals, DOM.mediaTabVideoPromo, DOM.mediaTabBillboard, DOM.mediaTabListen, DOM.mediaTabWatch];
  contents.forEach(c => {
    if (c) c.classList.remove('active');
  });

  if (target === 'deals' && DOM.mediaTabDeals) DOM.mediaTabDeals.classList.add('active');
  if (target === 'videoPromo' && DOM.mediaTabVideoPromo) {
    DOM.mediaTabVideoPromo.classList.add('active');
    startPromoVideoPlayback();
  } else if (DOM.promoVideoMainPlayer) {
    DOM.promoVideoMainPlayer.pause();
  }
  if (target === 'billboard' && DOM.mediaTabBillboard) DOM.mediaTabBillboard.classList.add('active');
  if (target === 'listen' && DOM.mediaTabListen) DOM.mediaTabListen.classList.add('active');
  if (target === 'watch' && DOM.mediaTabWatch) DOM.mediaTabWatch.classList.add('active');
}

function renderMediaSections() {
  // Billboard Top Albums
  if (DOM.billboardList) {
    DOM.billboardList.innerHTML = BILLBOARD_TOP_ALBUMS.map(album => `
      <div class="billboard-item">
        <div class="bb-rank">${album.rank}</div>
        <div class="bb-info">
          <div class="bb-title">${album.title}</div>
          <div class="bb-artist">${album.artist} · ${album.streams}</div>
        </div>
        <div class="bb-meta">
          <span class="bb-badge">${album.badge}</span>
          <div class="bb-trend">${album.trend}</div>
        </div>
      </div>
    `).join('');
  }

  // Sports Scores
  if (DOM.sportsList) {
    DOM.sportsList.innerHTML = SPORTS_UPDATES.map(sp => `
      <div class="sport-card">
        <span class="sport-league">${sp.league}</span>
        <div class="sport-match-row">
          <span class="sport-match-name">${sp.match}</span>
          <strong class="sport-score">${sp.score}</strong>
        </div>
        <span class="sport-status">${sp.status} · ${sp.highlight}</span>
      </div>
    `).join('');
  }

  // Listen / Music Playlists
  if (DOM.listenChannelsGrid) {
    DOM.listenChannelsGrid.innerHTML = CURATED_PLAYLISTS.map(pl => `
      <div class="listen-card" data-playlist="${pl.name}" data-track="${pl.currentTrack}">
        <div class="listen-icon">${pl.icon}</div>
        <div>
          <div class="listen-name">${pl.name}</div>
          <div class="listen-genre">${pl.genre}</div>
          <div class="listen-track">▶ ${pl.currentTrack} (${pl.duration})</div>
        </div>
      </div>
    `).join('');

    DOM.listenChannelsGrid.querySelectorAll('.listen-card').forEach(card => {
      card.addEventListener('click', () => {
        sound.playSplashPop();
        const playlist = card.dataset.playlist;
        const track = card.dataset.track;
        state.driverConfig.playlist = playlist;
        if (DOM.rideCurrentTrack) DOM.rideCurrentTrack.textContent = track;
        showToast(`${getT().toastNowPlaying} ${track} (${playlist})`);
      });
    });
  }

  // Watch / Short Videos
  if (DOM.watchCardsGrid) {
    DOM.watchCardsGrid.innerHTML = SHORT_VIDEOS.map(v => `
      <div class="watch-card" data-title="${v.title}">
        <div class="watch-thumb">${v.icon}</div>
        <div>
          <div class="watch-title">${v.title}</div>
          <div class="watch-meta">
            <span>${v.category}</span>
            <span>⏱️ ${v.duration}</span>
          </div>
        </div>
      </div>
    `).join('');

    DOM.watchCardsGrid.querySelectorAll('.watch-card').forEach(card => {
      card.addEventListener('click', () => {
        sound.playSplashPop();
        showToast(`▶ "${card.dataset.title}"`);
      });
    });
  }
}

/* ==========================================================================
   AD & SPONSOR INTERSTITIAL LOGIC
   ========================================================================== */
function loadAd(index) {
  state.currentAdIndex = index % SPONSORED_ADS.length;
  const ad = SPONSORED_ADS[state.currentAdIndex];

  if (DOM.adBadge) DOM.adBadge.textContent = state.currentLang === 'en' ? (ad.badge_en || ad.badge) : ad.badge;
  if (DOM.adBrandLogo) DOM.adBrandLogo.textContent = ad.icon;
  if (DOM.adBrandName) DOM.adBrandName.textContent = ad.brand;
  if (DOM.adHeadline) DOM.adHeadline.textContent = state.currentLang === 'en' ? (ad.headline_en || ad.headline) : ad.headline;
  if (DOM.adSubtext) DOM.adSubtext.textContent = state.currentLang === 'en' ? (ad.subtext_en || ad.subtext) : ad.subtext;
  if (DOM.adPromoCode) DOM.adPromoCode.textContent = ad.promoCode;

  const videoSrc = ad.videoUrl || (ad.id === 'ad-video-1' ? 'assets/videos/anuncia_aqui_autobotec.mp4' : 'assets/videos/anuncia_aqui_autobotec.mp4');
  if (DOM.adVideoContainer) {
    DOM.adVideoContainer.classList.remove('hidden');
  }
  if (DOM.adVideoPlayer) {
    const currentSrc = DOM.adVideoPlayer.getAttribute('src') || '';
    if (!currentSrc.includes(videoSrc)) {
      DOM.adVideoPlayer.src = videoSrc;
    }
    DOM.adVideoPlayer.muted = true;
    const p = DOM.adVideoPlayer.play();
    if (p !== undefined) {
      p.catch(() => {});
    }
  }

  generateQrCode(DOM.adQrContainer, ad.qrCodeText || "https://autobotec.net");
}

function nextAd() {
  sound.playTap();
  loadAd(state.currentAdIndex + 1);
}

function claimCurrentAd() {
  sound.playFanfare();
  showToast(getT().toastAdClaimed);
}

/* ==========================================================================
   WEATHER & NEWS HUB CONTROLS & RENDERING
   ========================================================================== */
function setupWeatherNewsControls() {
  if (DOM.btnWnWeather) {
    DOM.btnWnWeather.addEventListener('click', () => {
      sound.playTap();
      notifyUserInteraction();
      switchWeatherNewsSubtab('weather');
    });
  }
  if (DOM.btnWnNews) {
    DOM.btnWnNews.addEventListener('click', () => {
      sound.playTap();
      notifyUserInteraction();
      switchWeatherNewsSubtab('news');
    });
  }

  // GPS manual refresh button
  if (DOM.btnRefreshGps) {
    DOM.btnRefreshGps.addEventListener('click', async () => {
      sound.playCoin();
      notifyUserInteraction();
      if (DOM.gpsStatusText) DOM.gpsStatusText.textContent = state.currentLang === 'en' ? 'Locating...' : 'Buscando GPS...';
      if (DOM.gpsDot) DOM.gpsDot.classList.add('loading');
      showToast(state.currentLang === 'en' ? '🔍 Detecting GPS & local weather...' : '🔍 Detectando GPS y clima local...');
      try {
        const res = await geoService.init();
        const isUSA = res.location ? res.location.isUSA : true;
        const unit = isUSA ? '°F' : '°C';
        showToast(state.currentLang === 'en' 
          ? `📍 Location: ${res.location.city} (${unit})`
          : `📍 Ubicación: ${res.location.city} (${unit})`);
      } catch (err) {
        console.warn('GPS refresh error', err);
        showToast('⚠️ No se pudo refrescar el GPS');
      }
    });
  }

  // News Detail Modal close handlers
  if (DOM.btnCloseNewsModal) {
    DOM.btnCloseNewsModal.addEventListener('click', () => {
      sound.playTap();
      if (DOM.newsDetailModal) DOM.newsDetailModal.classList.remove('active');
    });
  }
  if (DOM.newsDetailModal) {
    DOM.newsDetailModal.addEventListener('click', (e) => {
      if (e.target === DOM.newsDetailModal) {
        sound.playTap();
        DOM.newsDetailModal.classList.remove('active');
      }
    });
  }
}

function switchWeatherNewsSubtab(target) {
  if (DOM.btnWnWeather) DOM.btnWnWeather.classList.toggle('active', target === 'weather');
  if (DOM.btnWnNews) DOM.btnWnNews.classList.toggle('active', target === 'news');
  if (DOM.wnTabWeather) DOM.wnTabWeather.classList.toggle('active', target === 'weather');
  if (DOM.wnTabNews) DOM.wnTabNews.classList.toggle('active', target === 'news');

  if (target === 'weather') renderWeatherExpanded();
  if (target === 'news') renderNewsFeed();
}

function renderWeatherExpanded() {
  const lang = state.currentLang;
  const w = state.liveWeather || WEATHER_INFO;
  const cur = w.current || w;
  const t = getT();
  const isUSA = (w.isUSA !== undefined) ? w.isUSA : (w.unit === '°F');

  if (DOM.whCityName) DOM.whCityName.textContent = w.city;
  if (DOM.whDestTag) DOM.whDestTag.textContent = lang === 'en' ? `Destination: ${w.destination}` : `Hacia: ${w.destination}`;
  if (DOM.whBadgeStatus) DOM.whBadgeStatus.textContent = lang === 'en' ? (cur.condition_en || cur.condition) : (cur.condition_es || cur.condition);
  if (DOM.whHugeIcon) DOM.whHugeIcon.textContent = cur.icon || '☀️';

  // Dynamic Temperature Unit: USA -> °F, Outside USA -> °C
  const tempVal = isUSA ? (cur.tempF ?? w.tempF ?? 81) : (cur.tempC ?? w.tempC ?? 27);
  const tempUnit = isUSA ? '°F' : '°C';
  if (DOM.whCurrentTemp) DOM.whCurrentTemp.textContent = tempVal;
  if (DOM.whTempUnit) DOM.whTempUnit.textContent = tempUnit;

  if (DOM.whFeelsLikeText) {
    const primaryFeels = isUSA ? `${cur.feelsLikeF ?? w.feelsLikeF ?? 85}°F` : `${cur.feelsLikeC ?? w.feelsLikeC ?? 29}°C`;
    const secondaryFeels = isUSA ? `${cur.feelsLikeC ?? w.feelsLikeC ?? 29}°C` : `${cur.feelsLikeF ?? w.feelsLikeF ?? 85}°F`;
    const condName = lang === 'en' ? (cur.condition_en || 'Fair') : (cur.condition_es || 'Despejado');
    DOM.whFeelsLikeText.textContent = lang === 'en' 
      ? `Feels like: ${primaryFeels} (${secondaryFeels}) · ${condName}`
      : `Sensación térmica: ${primaryFeels} (${secondaryFeels}) · ${condName}`;
  }

  if (DOM.whHumidityLabel) DOM.whHumidityLabel.textContent = t.humidityLabel;
  if (DOM.whHumidityVal) DOM.whHumidityVal.textContent = cur.humidity || '60%';
  if (DOM.whWindLabel) DOM.whWindLabel.textContent = t.windLabel;
  if (DOM.whWindVal) DOM.whWindVal.textContent = cur.wind || (isUSA ? '10 mph' : '16 km/h');
  if (DOM.whUvLabel) DOM.whUvLabel.textContent = t.uvLabel;
  if (DOM.whUvVal) DOM.whUvVal.textContent = cur.uvIndex || '6 (Moderado)';
  if (DOM.whAqiLabel) DOM.whAqiLabel.textContent = t.airQualityLabel;
  if (DOM.whAqiVal) DOM.whAqiVal.textContent = lang === 'en' ? (cur.airQuality_en || 'Good') : (cur.airQuality_es || 'Buena');
  if (DOM.whRainLabel) DOM.whRainLabel.textContent = t.precipitationLabel;
  if (DOM.whRainVal) DOM.whRainVal.textContent = cur.precipitation || '0 mm';
  if (DOM.whSunsetLabel) DOM.whSunsetLabel.textContent = lang === 'en' ? "Sunset" : "Puesta Sol";
  if (DOM.whSunsetVal) DOM.whSunsetVal.textContent = cur.sunset || '7:40 PM';

  if (DOM.whTipText) DOM.whTipText.textContent = lang === 'en' ? (w.tip_en || '') : (w.tip_es || '');
  if (DOM.forecastHourlyTitle) DOM.forecastHourlyTitle.textContent = `⏱️ ${t.hourlyForecastTitle}`;
  if (DOM.forecastDaysTitle) DOM.forecastDaysTitle.textContent = `📅 ${t.threeDayForecastTitle}`;

  // Hourly strip
  if (DOM.hourlyForecastStrip && w.hourly) {
    DOM.hourlyForecastStrip.innerHTML = w.hourly.map(h => {
      const hTemp = isUSA ? (h.tempF || h.temp) : (h.tempC || h.temp);
      return `
      <div class="hourly-item">
        <span class="hourly-time">${h.time}</span>
        <span class="hourly-icon">${h.icon}</span>
        <strong class="hourly-temp">${hTemp}</strong>
        <span class="hourly-pop">💧${h.pop || '10%'}</span>
      </div>
    `;
    }).join('');
  }

  // 3 Days list
  if (DOM.daysForecastList && w.forecastDays) {
    DOM.daysForecastList.innerHTML = w.forecastDays.map(d => {
      const dMax = isUSA ? (d.maxF || d.max) : (d.maxC || d.max);
      const dMin = isUSA ? (d.minF || d.min) : (d.minC || d.min);
      return `
      <div class="day-forecast-row">
        <div class="df-left">
          <span>${d.icon}</span>
          <span class="df-day">${lang === 'en' ? d.day_en : d.day_es}</span>
          <span class="df-desc">${lang === 'en' ? d.desc_en : d.desc_es}</span>
        </div>
        <div class="df-temps">
          <span class="df-max">${dMax}</span>
          <span class="df-min">${dMin}</span>
        </div>
      </div>
    `;
    }).join('');
  }

  // Synchronize bottom dock and ride info widgets
  updateDockWeather(w);
  updateRideWeather(w);
}

function updateDockWeather(w) {
  if (!w) w = state.liveWeather || WEATHER_INFO;
  const cur = w.current || w;
  const isUSA = (w.isUSA !== undefined) ? w.isUSA : (w.unit === '°F');
  const tempVal = isUSA ? (cur.tempF ?? w.tempF ?? 81) : (cur.tempC ?? w.tempC ?? 27);
  const unit = isUSA ? '°F' : '°C';

  if (DOM.dockWeatherIcon) DOM.dockWeatherIcon.textContent = cur.icon || '☀️';
  if (DOM.dockWeatherTemp) DOM.dockWeatherTemp.textContent = `${tempVal}${unit}`;
}

function updateRideWeather(w) {
  if (!w) w = state.liveWeather || WEATHER_INFO;
  const cur = w.current || w;
  const isUSA = (w.isUSA !== undefined) ? w.isUSA : (w.unit === '°F');
  const tempVal = isUSA ? (cur.tempF ?? w.tempF ?? 81) : (cur.tempC ?? w.tempC ?? 27);
  const unit = isUSA ? '°F' : '°C';
  const condName = state.currentLang === 'en' ? (cur.condition_en || 'Fair') : (cur.condition_es || 'Despejado');

  if (DOM.rideWeatherIcon) DOM.rideWeatherIcon.textContent = cur.icon || '☀️';
  if (DOM.rideWeatherTemp) DOM.rideWeatherTemp.textContent = `${tempVal}${unit}`;
  if (DOM.weatherCondText) DOM.weatherCondText.textContent = `${w.rawCity || w.city || 'Ubicación'} · ${condName}`;
  if (DOM.rideWeatherHumidity) DOM.rideWeatherHumidity.textContent = cur.humidity || '60%';
  if (DOM.rideWeatherWind) DOM.rideWeatherWind.textContent = cur.wind || (isUSA ? '10 mph' : '15 km/h');
  if (DOM.sunsetPillText && cur.sunset) {
    DOM.sunsetPillText.innerHTML = `<span>🌅</span> ${state.currentLang === 'en' ? 'Sunset' : 'Puesta'}: ${cur.sunset}`;
  }
}

/* ==========================================================================
   NEWS SPOTLIGHT ROTATION ENGINE (1 CUADRO POR PANTALLA, ROTACIÓN AUTO)
   ========================================================================== */
let newsSpotlightState = {
  currentIndex: 0,
  articles: [],
  secondsLeft: 12,
  totalSeconds: 12,
  isPaused: false,
  interval: null
};

function renderNewsFeed() {
  const lang = state.currentLang;
  const loc = (state.liveWeather && state.liveWeather.city) 
    ? state.liveWeather 
    : geoService.currentLocation;

  let articles = state.liveNews;
  if (!articles || articles.length === 0) {
    articles = geoService.getLocalizedNews(loc.countryCode, loc.city, loc.state, loc);
    state.liveNews = articles;
  }
  if (!articles || articles.length === 0) return;

  newsSpotlightState.articles = articles;
  const cityName = loc.rawCity || loc.city || (loc.isUSA ? "New York City" : "Santo Domingo");
  const flag = loc.isUSA ? '🇺🇸' : (loc.countryCode === 'DO' ? '🇩🇴' : '📍');

  // Location Header
  if (DOM.newsCityTitle) {
    DOM.newsCityTitle.textContent = lang === 'en'
      ? `${flag} Local News: ${cityName}`
      : `${flag} Noticias Locales de ${cityName}`;
  }
  if (DOM.newsLocationBadge) {
    DOM.newsLocationBadge.textContent = lang === 'en' ? 'LIVE · GPS ACTIVE' : '🔴 EN VIVO · GPS ACTIVO';
  }
  if (DOM.newsCuratedSubtitle) {
    DOM.newsCuratedSubtitle.textContent = lang === 'en'
      ? `Daily News Report v3.0 · Curated Transit, Events & Life in ${cityName}`
      : `Reporte Diario Curado v3.0 · Cobertura de Tránsito, Eventos y Vida en ${cityName}`;
  }
  if (DOM.newsRatingBadge) {
    DOM.newsRatingBadge.textContent = lang === 'en' ? '⭐ Quality 5.0 / 5.0' : '⭐ Calidad 5.0 / 5.0';
  }
  if (DOM.newsCountBadge) {
    DOM.newsCountBadge.textContent = `${articles.length} ${lang === 'en' ? 'REPORTS TODAY' : 'REPORTES HOY'}`;
  }

  // Top Breaking Headline (rotating marquee)
  const topStory = articles[newsSpotlightState.currentIndex] || articles[0];
  if (DOM.breakingHeadlineText && topStory) {
    DOM.breakingHeadlineText.textContent = lang === 'en' ? topStory.title_en : topStory.title_es;
  }

  // Category Pills
  renderNewsCategoryPills();

  // Display current spotlight card
  renderSpotlightCard(newsSpotlightState.currentIndex, false);

  // Setup navigation buttons
  setupNewsSpotlightNav();

  // Start auto-rotation
  startNewsSpotlightTimer();
}

function renderNewsCategoryPills() {
  if (!DOM.newsCategoryPills) return;
  const articles = newsSpotlightState.articles;
  DOM.newsCategoryPills.innerHTML = articles.map((item, idx) => {
    const isActive = idx === newsSpotlightState.currentIndex;
    return `<span class="news-cat-pill${isActive ? ' active' : ''}" data-idx="${idx}" style="background:${isActive ? (item.badge_color || '#f8b800') : ''};" title="${item.category_slug || ''}"></span>`;
  }).join('');

  DOM.newsCategoryPills.querySelectorAll('.news-cat-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      const idx = parseInt(pill.getAttribute('data-idx') || '0', 10);
      sound.playTap();
      notifyUserInteraction();
      newsSpotlightState.currentIndex = idx;
      newsSpotlightState.secondsLeft = newsSpotlightState.totalSeconds;
      renderSpotlightCard(idx, true);
      renderNewsCategoryPills();
      updateNewsTimerUI();
    });
  });
}

function renderSpotlightCard(idx, animate) {
  const articles = newsSpotlightState.articles;
  if (!articles || articles.length === 0 || !DOM.newsSpotlightContent) return;
  const item = articles[idx % articles.length];
  const lang = state.currentLang;
  const title = lang === 'en' ? item.title_en : item.title_es;
  const summary = lang === 'en' ? item.summary_en : item.summary_es;
  const category = lang === 'en' ? (item.category_en || 'LOCAL') : (item.category_es || 'LOCAL');
  const timeAgo = lang === 'en' ? (item.time_ago_en || 'Recent') : (item.time_ago_es || 'Reciente');
  const keyPoints = lang === 'en' ? (item.key_points_en || item.key_points_es || []) : (item.key_points_es || []);
  const keywords = item.keywords || [];
  const stars = item.quality_stars || '⭐⭐⭐⭐⭐ 5.0';
  const heroGradient = item.hero_gradient || 'linear-gradient(135deg, #1e3c72 0%, #2a5298 100%)';
  const heroTag = item.hero_tag || `${item.icon || '📰'} ${category}`;
  const locationTag = item.location_tag || '';

  const buildHTML = () => {
    DOM.newsSpotlightContent.innerHTML = `
      <div class="spotlight-top-row">
        <span class="spotlight-cat-badge" style="background:${item.badge_color || '#e52521'};">${item.icon || '📰'} ${category}</span>
        <div class="spotlight-score-time">
          <span class="spotlight-score">${stars}</span>
          <span class="spotlight-time">⏱️ ${timeAgo}</span>
        </div>
      </div>

      <div class="spotlight-hero-bar" style="background:${heroGradient};">
        <span class="spotlight-hero-icon">${heroTag}</span>
        <span class="spotlight-hero-location">📍 ${locationTag}</span>
      </div>

      <h2 class="spotlight-title">${title}</h2>
      <p class="spotlight-summary">${summary}</p>

      ${keyPoints && keyPoints.length > 0 ? `
        <div class="spotlight-keypoints">
          <div class="spotlight-kp-title">📌 ${lang === 'en' ? 'KEY TAKEAWAYS' : 'PUNTOS CLAVE'}:</div>
          <ul class="spotlight-kp-list">
            ${keyPoints.map(pt => `<li>${pt}</li>`).join('')}
          </ul>
        </div>
      ` : ''}

      ${keywords && keywords.length > 0 ? `
        <div class="spotlight-keywords-row">
          ${keywords.map(kw => `<span class="spotlight-kw">${kw}</span>`).join('')}
        </div>
      ` : ''}

      <div class="spotlight-footer">
        <span><span class="spotlight-source">✓ ${item.source || 'Copilot News'}</span> · 👁️ ${item.reads || '25K lecturas'}</span>
        <button class="spotlight-read-btn" data-read-idx="${idx}">${lang === 'en' ? 'Read Full Report 📄' : 'Leer Reporte Completo 📄'}</button>
      </div>
    `;

    // Bind read button
    const readBtn = DOM.newsSpotlightContent.querySelector('.spotlight-read-btn');
    if (readBtn) {
      readBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        sound.playCoin();
        notifyUserInteraction();
        openNewsDetailModal(item);
      });
    }
  };

  // Update breaking ticker
  if (DOM.breakingHeadlineText) {
    DOM.breakingHeadlineText.textContent = lang === 'en' ? item.title_en : item.title_es;
  }

  if (animate) {
    DOM.newsSpotlightContent.classList.remove('fade-in');
    DOM.newsSpotlightContent.classList.add('fade-out');
    setTimeout(() => {
      buildHTML();
      DOM.newsSpotlightContent.classList.remove('fade-out');
      DOM.newsSpotlightContent.classList.add('fade-in');
      setTimeout(() => DOM.newsSpotlightContent.classList.remove('fade-in'), 450);
    }, 350);
  } else {
    buildHTML();
  }
}

function setupNewsSpotlightNav() {
  if (DOM.btnPrevNews) {
    DOM.btnPrevNews.onclick = () => {
      sound.playTap();
      notifyUserInteraction();
      const total = newsSpotlightState.articles.length;
      newsSpotlightState.currentIndex = (newsSpotlightState.currentIndex - 1 + total) % total;
      newsSpotlightState.secondsLeft = newsSpotlightState.totalSeconds;
      renderSpotlightCard(newsSpotlightState.currentIndex, true);
      renderNewsCategoryPills();
      updateNewsTimerUI();
    };
  }

  if (DOM.btnNextNews) {
    DOM.btnNextNews.onclick = () => {
      sound.playTap();
      notifyUserInteraction();
      advanceNewsSpotlight();
    };
  }

  if (DOM.btnPauseNewsRotation) {
    DOM.btnPauseNewsRotation.onclick = () => {
      sound.playTap();
      newsSpotlightState.isPaused = !newsSpotlightState.isPaused;
      if (DOM.newsPauseIcon) {
        DOM.newsPauseIcon.textContent = newsSpotlightState.isPaused ? '▶️' : '⏸️';
      }
      if (DOM.btnPauseNewsRotation) {
        DOM.btnPauseNewsRotation.classList.toggle('is-paused', newsSpotlightState.isPaused);
      }
      updateNewsTimerUI();
    };
  }
}

function advanceNewsSpotlight() {
  const total = newsSpotlightState.articles.length;
  newsSpotlightState.currentIndex = (newsSpotlightState.currentIndex + 1) % total;
  newsSpotlightState.secondsLeft = newsSpotlightState.totalSeconds;
  renderSpotlightCard(newsSpotlightState.currentIndex, true);
  renderNewsCategoryPills();
  updateNewsTimerUI();
}

function startNewsSpotlightTimer() {
  clearInterval(newsSpotlightState.interval);
  newsSpotlightState.secondsLeft = newsSpotlightState.totalSeconds;
  updateNewsTimerUI();

  newsSpotlightState.interval = setInterval(() => {
    if (newsSpotlightState.isPaused) return;

    newsSpotlightState.secondsLeft--;
    if (newsSpotlightState.secondsLeft <= 0) {
      advanceNewsSpotlight();
    }
    updateNewsTimerUI();
  }, 1000);
}

function updateNewsTimerUI() {
  const { secondsLeft, totalSeconds, isPaused } = newsSpotlightState;
  const lang = state.currentLang;

  // Timer text
  if (DOM.newsTimerSeconds) {
    if (isPaused) {
      DOM.newsTimerSeconds.textContent = lang === 'en' ? 'Paused ⏸️' : 'Pausado ⏸️';
    } else {
      DOM.newsTimerSeconds.textContent = lang === 'en' ? `Next in ${secondsLeft}s` : `Rotación en ${secondsLeft}s`;
    }
  }

  // Progress bar
  if (DOM.newsSpotlightProgressFill) {
    const pct = ((totalSeconds - secondsLeft) / totalSeconds) * 100;
    DOM.newsSpotlightProgressFill.style.width = `${Math.min(100, Math.max(0, pct))}%`;
  }
}

function openNewsDetailModal(item) {
  if (!DOM.newsDetailModal || !DOM.newsModalContentWrap) return;
  const lang = state.currentLang;
  const title = lang === 'en' ? item.title_en : item.title_es;
  const summary = lang === 'en' ? item.summary_en : item.summary_es;
  const category = lang === 'en' ? item.category_en : item.category_es;
  const keyPoints = lang === 'en' ? (item.key_points_en || item.key_points_es || []) : (item.key_points_es || []);
  const keywords = item.keywords || [];

  DOM.newsModalContentWrap.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;padding-bottom:10px;border-bottom:2px solid var(--smb3-gold);">
      <span style="background:${item.badge_color || '#e52521'};color:#fff;font-family:var(--font-pixel,monospace);font-size:10px;padding:4px 10px;border-radius:6px;font-weight:900;">${item.icon || '📰'} ${category}</span>
      <span style="color:var(--smb3-gold);font-family:var(--font-pixel,monospace);font-size:11px;">${item.quality_stars || '⭐⭐⭐⭐⭐ 5.0'}</span>
    </div>
    <div style="font-size:11px;color:#94a3b8;margin-bottom:8px;">📍 ${item.location_tag || 'Ubicación Local'} · ⏱️ ${lang === 'en' ? item.time_ago_en : item.time_ago_es} · Fuente: <strong style="color:#fff;">${item.source}</strong></div>
    <h2 style="font-family:var(--font-display);font-size:18px;font-weight:900;color:#fff;line-height:1.3;margin-bottom:12px;">${title}</h2>
    <p style="font-size:13px;color:#cbd5e1;line-height:1.5;margin-bottom:16px;">${summary}</p>
    
    ${keyPoints && keyPoints.length > 0 ? `
      <div style="background:rgba(0,0,0,0.6);border:1.5px solid var(--smb3-gold);border-radius:8px;padding:12px 14px;margin-bottom:16px;">
        <h4 style="font-family:var(--font-pixel,monospace);font-size:11px;color:var(--smb3-gold);margin:0 0 8px 0;letter-spacing:0.5px;">📌 ${lang === 'en' ? 'VERIFIED KEY TAKEAWAYS (DAILY NEWS REPORT)' : 'PUNTOS CLAVE VERIFICADOS (DAILY NEWS REPORT)'}</h4>
        <ul style="margin:0;padding-left:18px;color:#f1f5f9;font-size:12px;line-height:1.6;">
          ${keyPoints.map(pt => `<li>${pt}</li>`).join('')}
        </ul>
      </div>
    ` : ''}

    ${keywords && keywords.length > 0 ? `
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:16px;">
        ${keywords.map(kw => `<span style="font-size:10px;color:#38bdf8;background:rgba(56,189,248,0.15);padding:3px 8px;border-radius:4px;">${kw}</span>`).join('')}
      </div>
    ` : ''}

    <div style="display:flex;align-items:center;justify-content:space-between;padding-top:10px;border-top:1px solid rgba(255,255,255,0.1);font-size:11px;color:#94a3b8;">
      <span>👁️ ${item.reads || '30K lecturas'} · Estándar Daily News Report v3.0</span>
      <button id="btnCloseNewsModalInner" style="background:linear-gradient(135deg,#f8b800,#d87800);color:#000;font-weight:900;border:none;padding:8px 16px;border-radius:6px;cursor:pointer;">${lang === 'en' ? 'Close Window ✕' : 'Cerrar Ventana ✕'}</button>
    </div>
  `;

  DOM.newsDetailModal.classList.add('active');

  const btnInner = document.getElementById('btnCloseNewsModalInner');
  if (btnInner) {
    btnInner.addEventListener('click', () => {
      sound.playTap();
      DOM.newsDetailModal.classList.remove('active');
    });
  }
}

/* ==========================================================================
   PROMOTIONAL VIDEO SHOWCASE (CONNECTED TO CAMPAIGN MANAGER)
   ========================================================================== */
let currentVideoSpotlightIndex = 0;
let currentActiveCampId = null;

function syncCurrentVideoSpotlight() {
  if (!window.CampaignManager) return;
  const spotlights = window.CampaignManager.getActiveVideoSpotlights();
  if (!spotlights || spotlights.length === 0) return;

  const camp = spotlights[currentVideoSpotlightIndex % spotlights.length];
  if (!camp) return;

  currentActiveCampId = camp.id;

  if (DOM.pvmBrand) DOM.pvmBrand.textContent = (camp.clientName || 'COPILOT MEDIA').toUpperCase();
  if (DOM.pvmHeadline) DOM.pvmHeadline.textContent = camp.title || '';
  if (DOM.pvmSubtext) DOM.pvmSubtext.textContent = camp.subtitle || camp.discountOffer || '';
  if (DOM.pvmPromoCode) DOM.pvmPromoCode.textContent = camp.couponCode || 'COPILOT';

  if (DOM.promoVideoMainPlayer && camp.mediaUrl) {
    const currentSrc = DOM.promoVideoMainPlayer.getAttribute('src') || '';
    if (!currentSrc.includes(camp.mediaUrl)) {
      DOM.promoVideoMainPlayer.src = camp.mediaUrl;
      DOM.promoVideoMainPlayer.load();
    }
  }

  if (DOM.pvmQrContainer) {
    generateQrCode(DOM.pvmQrContainer, camp.targetUrl || "https://autobotec.net");
  }

  // Registrar impresión y ping de la tablet
  window.CampaignManager.recordMetric(camp.id, 'impression');
  window.CampaignManager.registerTabletHeartbeat('TBL-01', { currentCampaign: camp.clientName, battery: 94 });
}

function setupVideoPromoShowcase() {
  if (DOM.btnMediaVideoPromo) {
    DOM.btnMediaVideoPromo.addEventListener('click', () => {
      sound.playTap();
      notifyUserInteraction();
      switchMediaSubtab('videoPromo');
      syncCurrentVideoSpotlight();
      startPromoVideoPlayback();
    });
  }

  if (DOM.btnPvmSound) {
    DOM.btnPvmSound.addEventListener('click', () => {
      if (DOM.promoVideoMainPlayer) {
        DOM.promoVideoMainPlayer.muted = !DOM.promoVideoMainPlayer.muted;
        DOM.btnPvmSound.textContent = DOM.promoVideoMainPlayer.muted ? '🔇' : '🔊';
        showToast(DOM.promoVideoMainPlayer.muted ? getT().toastSoundMuted : getT().toastSoundActive);
      }
    });
  }

  if (DOM.btnClaimPromoVideo) {
    DOM.btnClaimPromoVideo.addEventListener('click', () => {
      sound.playFanfare();
      notifyUserInteraction();
      if (currentActiveCampId && window.CampaignManager) {
        window.CampaignManager.recordMetric(currentActiveCampId, 'tap');
      }
      showToast('🚀 <strong>Autobotec.net:</strong> Escanea el código QR con tu celular o visita <u>www.autobotec.net</u> para contratar publicidad interactiva.');
    });
  }

  if (DOM.btnNextPromoVideo) {
    DOM.btnNextPromoVideo.addEventListener('click', () => {
      sound.playTap();
      notifyUserInteraction();
      currentVideoSpotlightIndex++;
      syncCurrentVideoSpotlight();
      startPromoVideoPlayback();
    });
  }

  if (DOM.pvmQrContainer) {
    DOM.pvmQrContainer.addEventListener('click', () => {
      if (currentActiveCampId && window.CampaignManager) {
        window.CampaignManager.recordMetric(currentActiveCampId, 'qr_scan');
      }
      showToast('📲 ¡Código escaneado registrado!');
    });
  }

  if (DOM.promoVideoMainPlayer) {
    DOM.promoVideoMainPlayer.addEventListener('ended', () => {
      if (currentActiveCampId && window.CampaignManager) {
        window.CampaignManager.recordMetric(currentActiveCampId, 'video_complete');
      }
    });
  }

  syncCurrentVideoSpotlight();
}

function startPromoVideoPlayback() {
  syncCurrentVideoSpotlight();
  if (!DOM.promoVideoMainPlayer) return;
  DOM.promoVideoMainPlayer.currentTime = 0;
  const playPromise = DOM.promoVideoMainPlayer.play();
  if (playPromise !== undefined) {
    playPromise.catch(() => {
      DOM.promoVideoMainPlayer.muted = true;
      DOM.promoVideoMainPlayer.play().catch(() => {});
    });
  }
}

/* ==========================================================================
   MIX ENGINE: SMART MULTI-CONTENT CONTINUOUS ROTATION SYSTEM
   Cycles smoothly between:
   1. Trivia & Games (Plays 2 questions)
   2. Weather Forecast & Radar
   3. Trending News Feed
   4. Sponsored Video Spotlight
   ========================================================================== */
function initMixEngine() {
  if (!state.mixMode.enabled) return;

  setupUserActivityListener();

  if (DOM.btnToggleMix) {
    DOM.btnToggleMix.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleMixMode();
    });
  }

  updateMixPillUI();
  startMixTicker();
}

function startMixTicker() {
  clearInterval(state.mixMode.interval);
  state.mixMode.interval = setInterval(() => {
    if (state.mixMode.isPaused) {
      updateMixPillUI();
      return;
    }

    if (state.mixMode.currentStep === 'trivia') {
      // IF player is actively answering questions or playing, DO NOT leave trivia!
      if (state.isUserActivelyPlaying) {
        state.mixMode.secondsLeft = MIX_SEGMENT_DURATION;
        updateMixPillUI();
        return;
      }
      state.mixMode.secondsLeft--;
      if (state.mixMode.secondsLeft <= 0) {
        advanceMixSegment('weather');
      }
    } else if (state.mixMode.currentStep === 'weather') {
      state.mixMode.secondsLeft--;
      if (state.mixMode.secondsLeft <= 0) {
        advanceMixSegment('news');
      }
    } else if (state.mixMode.currentStep === 'news') {
      state.mixMode.secondsLeft--;
      if (state.mixMode.secondsLeft <= 0) {
        advanceMixSegment('promoVideo');
      }
    } else if (state.mixMode.currentStep === 'promoVideo') {
      state.mixMode.secondsLeft--;
      updateFullscreenAdProgress(state.mixMode.secondsLeft, MIX_SEGMENT_DURATION);

      if (DOM.pvmTimer) {
        DOM.pvmTimer.textContent = `0:${String(Math.max(0, state.mixMode.secondsLeft)).padStart(2, '0')}`;
      }
      if (DOM.pvmProgressFill) {
        const pct = ((MIX_SEGMENT_DURATION - state.mixMode.secondsLeft) / MIX_SEGMENT_DURATION) * 100;
        DOM.pvmProgressFill.style.width = `${Math.min(100, Math.max(0, pct))}%`;
      }
      if (state.mixMode.secondsLeft <= 0) {
        closeFullscreenAd();
        advanceMixSegment('trivia');
      }
    }

    updateMixPillUI();
  }, 1000);
}

function advanceMixSegment(forceNextStep = null) {
  const steps = ['trivia', 'weather', 'news', 'promoVideo'];
  let nextStep = forceNextStep;
  if (!nextStep) {
    const currentIndex = steps.indexOf(state.mixMode.currentStep);
    nextStep = steps[(currentIndex + 1) % steps.length];
  }

  state.mixMode.currentStep = nextStep;
  state.mixMode.secondsLeft = MIX_SEGMENT_DURATION;

  if (nextStep === 'trivia') {
    closeFullscreenAd();
    switchTab('games');
    if (state.activeGameMode !== 'classic') {
      launchGame('classic');
    }
  } else if (nextStep === 'weather') {
    closeFullscreenAd();
    switchTab('weatherNews');
    switchWeatherNewsSubtab('weather');
  } else if (nextStep === 'news') {
    closeFullscreenAd();
    switchTab('weatherNews');
    switchWeatherNewsSubtab('news');
  } else if (nextStep === 'promoVideo') {
    switchTab('mediaAds');
    switchMediaSubtab('videoPromo');
    openFullscreenAd();
  }

  updateMixPillUI();
}

/* ==========================================================================
   FULLSCREEN TABLET AD CONTROLS & LIFECYCLE
   ========================================================================== */
function openFullscreenAd(customAd = null) {
  state.isFullscreenAdActive = true;
  const ad = customAd || SPONSORED_ADS[state.mixMode.promoVideoIndex % SPONSORED_ADS.length] || SPONSORED_ADS[0];
  state.mixMode.promoVideoIndex++;

  if (DOM.fullscreenAdOverlay) {
    DOM.fullscreenAdOverlay.classList.remove('hidden');
    DOM.fullscreenAdOverlay.classList.add('active');
    DOM.fullscreenAdOverlay.setAttribute('aria-hidden', 'false');
  }

  if (DOM.fsaBadgeTitle) {
    DOM.fsaBadgeTitle.textContent = state.currentLang === 'en' 
      ? (ad.badge_en || ad.badge || "SPONSORED VIDEO SPOT") 
      : (ad.badge || "SPOT DE VIDEO PATROCINADO");
  }
  if (DOM.fsaSponsorTagline) {
    DOM.fsaSponsorTagline.textContent = ad.brand || "AUTOBOTEC.NET · MEDIA NETWORK";
  }
  if (DOM.fsaSponsorTitle) {
    DOM.fsaSponsorTitle.textContent = state.currentLang === 'en' 
      ? (ad.headline_en || ad.headline || "ADVERTISE YOUR BUSINESS HERE!") 
      : (ad.headline || "¡ANUNCIA TU NEGOCIO AQUÍ!");
  }
  if (DOM.fsaSponsorDesc) {
    DOM.fsaSponsorDesc.textContent = state.currentLang === 'en' 
      ? (ad.subtext_en || ad.subtext || "Reach captive passengers every month with interactive high-converting screens.") 
      : (ad.subtext || "Llega a más de 3,000+ pasajeros cautivos al mes en Uber y Lyft con pantallas interactivas de alta conversión. Escanea el código QR para contratar tu pauta publicitaria en Autobotec.net.");
  }
  if (DOM.fsaPromoVal) {
    DOM.fsaPromoVal.textContent = ad.promoCode || "COPILOT30";
  }

  if (DOM.fsaQrContainer) {
    generateQrCode(DOM.fsaQrContainer, ad.qrCodeText || "https://autobotec.net");
  }

  if (DOM.fsaVideoPlayer) {
    DOM.fsaVideoPlayer.src = ad.videoUrl || "assets/videos/anuncia_aqui_autobotec.mp4";
    DOM.fsaVideoPlayer.currentTime = 0;
    DOM.fsaVideoPlayer.muted = sound.isMuted();
    const playPromise = DOM.fsaVideoPlayer.play();
    if (playPromise !== undefined) {
      playPromise.catch(() => {
        DOM.fsaVideoPlayer.muted = true;
        DOM.fsaVideoPlayer.play().catch(() => {});
      });
    }
  }

  updateFullscreenAdProgress(state.mixMode.secondsLeft, MIX_SEGMENT_DURATION);
}

function closeFullscreenAd(andAdvance = false) {
  if (!state.isFullscreenAdActive) return;
  state.isFullscreenAdActive = false;

  if (DOM.fullscreenAdOverlay) {
    DOM.fullscreenAdOverlay.classList.remove('active');
    DOM.fullscreenAdOverlay.classList.add('hidden');
    DOM.fullscreenAdOverlay.setAttribute('aria-hidden', 'true');
  }

  if (DOM.fsaVideoPlayer) {
    DOM.fsaVideoPlayer.pause();
  }

  if (andAdvance) {
    advanceMixSegment('trivia');
  }
}

function updateFullscreenAdProgress(secondsLeft, totalDuration) {
  const safeSec = Math.max(0, secondsLeft);
  if (DOM.fsaSecondsCount) {
    DOM.fsaSecondsCount.textContent = `${safeSec}s`;
  }
  const pct = Math.min(100, Math.max(0, ((totalDuration - safeSec) / totalDuration) * 100));
  if (DOM.fsaProgressFill) {
    DOM.fsaProgressFill.style.width = `${pct}%`;
  }
  if (DOM.fsaCountdownCircle) {
    // Circumference stroke-dasharray is 100
    const dashoffset = 100 - ((safeSec / totalDuration) * 100);
    DOM.fsaCountdownCircle.style.strokeDashoffset = `${dashoffset}`;
  }
}

function setupFullscreenAdControls() {
  if (DOM.btnFsaSound) {
    DOM.btnFsaSound.addEventListener('click', () => {
      sound.playTap();
      if (DOM.fsaVideoPlayer) {
        DOM.fsaVideoPlayer.muted = !DOM.fsaVideoPlayer.muted;
        DOM.btnFsaSound.textContent = DOM.fsaVideoPlayer.muted ? '🔇' : '🔊';
      }
    });
  }

  if (DOM.btnFsaClose) {
    DOM.btnFsaClose.addEventListener('click', () => {
      sound.playTap();
      closeFullscreenAd(true);
    });
  }

  // Also hook into ad cards in deals tab to preview in fullscreen
  if (DOM.btnClaimAd) {
    DOM.btnClaimAd.addEventListener('click', () => {
      openFullscreenAd(SPONSORED_ADS[state.currentAdIndex]);
    });
  }
}

/* ==========================================================================
   DEVICE & SCREEN ADAPTER (RESPONSIVE AUTO-DETECTION)
   ========================================================================== */
function initDeviceScreenAdapter() {
  function adaptLayout() {
    const w = window.innerWidth || document.documentElement.clientWidth;
    const h = window.innerHeight || document.documentElement.clientHeight;
    const ratio = w / (h || 1);
    const root = document.documentElement;

    root.style.setProperty('--vh', `${h * 0.01}px`);
    root.style.setProperty('--app-window-width', `${w}px`);
    root.style.setProperty('--app-window-height', `${h}px`);

    // Screen height tier
    let heightTier = 'tall';
    if (h <= 660) {
      heightTier = 'compact';
    } else if (h <= 820) {
      heightTier = 'medium';
    }
    root.setAttribute('data-screen-height', heightTier);

    // Screen width tier
    let widthTier = 'wide';
    if (w <= 800) {
      widthTier = 'compact';
    } else if (w <= 1100) {
      widthTier = 'medium';
    }
    root.setAttribute('data-screen-width', widthTier);

    // Aspect ratio category
    let aspectCategory = 'landscape-wide';
    if (ratio < 1.1) {
      aspectCategory = 'portrait';
    } else if (ratio < 1.45) {
      aspectCategory = 'landscape-standard';
    }
    root.setAttribute('data-aspect-ratio', aspectCategory);

    const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    root.setAttribute('data-touch-device', isTouch ? 'true' : 'false');
    root.setAttribute('data-orientation', h > w ? 'portrait' : 'landscape');
  }

  adaptLayout();
  window.addEventListener('resize', adaptLayout, { passive: true });
  window.addEventListener('orientationchange', () => setTimeout(adaptLayout, 150), { passive: true });
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', adaptLayout, { passive: true });
  }
}

function toggleMixMode() {
  sound.playTap();
  state.mixMode.isPaused = !state.mixMode.isPaused;
  clearTimeout(state.mixMode.interactionCooldown);
  updateMixPillUI();
  const t = getT();
  showToast(state.mixMode.isPaused ? t.mixPillPaused : t.mixPillActive);
}

// Expose globally for inline onclick handlers
window.__appToggleMixMode = toggleMixMode;
window.toggleMixModeGlobal = toggleMixMode;
window.advanceMixSegmentGlobal = advanceMixSegment;

function notifyUserInteraction() {
  state.lastUserInteraction = Date.now();
  if (state.activeTab === 'games' && state.activeGameMode !== 'none') {
    state.isUserActivelyPlaying = true;
  }

  if (!state.mixMode.enabled) return;

  state.mixMode.isPaused = true;
  updateMixPillUI();

  clearTimeout(state.mixMode.interactionCooldown);
  state.mixMode.interactionCooldown = setTimeout(() => {
    // If playing actively and interacted within 60s, maintain pause!
    if (state.isUserActivelyPlaying && (Date.now() - state.lastUserInteraction < 60000)) {
      return;
    }
    state.isUserActivelyPlaying = false;
    state.mixMode.isPaused = false;
    updateMixPillUI();
  }, 60000); // 60s idle timeout
}

function setupUserActivityListener() {
  const events = ['pointerdown', 'touchstart', 'keydown'];
  events.forEach(evt => {
    document.addEventListener(evt, (e) => {
      if (e.target && (e.target.closest('#btnToggleMix') || e.target.closest('.dock-pill') || e.target.closest('.bottom-dock') || e.target.closest('.dock-weather'))) return;
      notifyUserInteraction();
    }, { passive: true });
  });
}

function updateMixPillUI() {
  const btn = DOM.btnToggleMix || document.getElementById('btnToggleMix');
  if (!btn) return;
  const t = getT();
  const isPaused = state.mixMode.isPaused;

  btn.classList.toggle('paused', isPaused);
  const statusEl = DOM.mixStatusText || document.getElementById('mixStatusText');
  if (statusEl) {
    statusEl.textContent = isPaused ? (t.mixPillPaused || 'MIX PAUSADO') : (t.mixPillActive || 'SUPER STAR MIX');
  }

  const nextTagEl = DOM.mixNextTag || document.getElementById('mixNextTag');
  if (nextTagEl) {
    const nextMap = {
      trivia: t.mixSegmentWeather || 'Clima',
      weather: t.mixSegmentNews || 'Noticias',
      news: t.mixSegmentPromo || 'Video',
      promoVideo: t.mixSegmentTrivia || 'Trivia'
    };
    const prefix = t.mixNextIn || 'Próx:';
    nextTagEl.textContent = `${prefix} ${nextMap[state.mixMode.currentStep] || ''}`;
  }

  const timerEl = DOM.mixMiniTimer || document.getElementById('mixMiniTimer');
  if (timerEl) {
    timerEl.textContent = isPaused ? '⏸️' : `${state.mixMode.secondsLeft}s`;
  }
}

/* ==========================================================================
   GIVEAWAY & LEADERBOARD
   ========================================================================== */
function setupGiveaway() {
  if (DOM.btnClaimTicket) {
    DOM.btnClaimTicket.addEventListener('click', () => {
      sound.playTap();
      DOM.giveawayModal.classList.remove('hidden');
    });
  }

  if (DOM.btnCloseGiveawayModal) {
    DOM.btnCloseGiveawayModal.addEventListener('click', () => {
      DOM.giveawayModal.classList.add('hidden');
    });
  }

  if (DOM.giveawayForm) {
    DOM.giveawayForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const contact = DOM.riderContact.value.trim();
      const nickname = DOM.riderNickname.value.trim() || 'VIP Rider';
      if (!contact) return;

      state.userTickets += 2;
      if (DOM.myTicketsCount) DOM.myTicketsCount.textContent = state.userTickets;
      DOM.giveawayModal.classList.add('hidden');

      sound.playFanfare();
      showToast(`${getT().toastTicketRegistered} (${nickname})`);
    });
  }
}

function renderRecentWinners() {
  if (!DOM.winnersList) return;
  DOM.winnersList.innerHTML = GIVEAWAY_INFO.recentWinners.map(w => `
    <div class="winner-row">
      <span><strong>${w.name}</strong> (${w.city})</span>
      <span style="color:var(--splash-lime); font-weight:800;">${w.prize}</span>
    </div>
  `).join('');
}

function renderLeaderboard() {
  if (!DOM.lbTableBody) return;
  const riders = [
    { rank: "🥇 1", name: "NeonRider", score: "4,250 pts", prize: "$100 Bono" },
    { rank: "🥈 2", name: "MiamiCruiser", score: "3,890 pts", prize: "$50 Bono" },
    { rank: "🥉 3", name: "SpeedyGonz", score: "3,420 pts", prize: "$25 Bono" },
    { rank: "4", name: "AquaWave", score: "2,980 pts", prize: "Boleto VIP" },
    { rank: "5", name: "CyberPassenger", score: "2,450 pts", prize: "Boleto VIP" }
  ];

  DOM.lbTableBody.innerHTML = riders.map(r => `
    <tr>
      <td><strong>${r.rank}</strong></td>
      <td>${r.name}</td>
      <td><span style="color:var(--splash-cyan); font-weight:700;">${r.score}</span></td>
      <td>${r.prize}</td>
    </tr>
  `).join('');
}

/* ==========================================================================
   ANDROID DEVELOPER-STYLE 7-TAPS ADMIN & KIOSK FULLSCREEN CONTROLLER
   ========================================================================== */
function showAndroidToast(msg) {
  const existing = document.querySelector('.android-toast-bubble');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = 'android-toast-bubble';
  toast.innerHTML = `<span>🤖</span> <span>${msg}</span>`;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
    toast.style.opacity = '0';
    toast.style.transform = 'translate(-50%, 25px) scale(0.92)';
    setTimeout(() => toast.remove(), 320);
  }, 2200);
}

function requestFullscreenSafely() {
  if (isAdminUnlocked) return;
  const elem = document.documentElement;
  try {
    const opts = { navigationUI: 'hide' };
    if (elem.requestFullscreen) {
      elem.requestFullscreen(opts).catch(() => {
        elem.requestFullscreen().catch(() => {});
      });
    } else if (elem.webkitRequestFullscreen) {
      elem.webkitRequestFullscreen();
    } else if (elem.msRequestFullscreen) {
      elem.msRequestFullscreen();
    }
  } catch (e) {
    console.warn('Fullscreen error:', e);
  }
}

function exitFullscreenSafely() {
  try {
    if (document.fullscreenElement || document.webkitFullscreenElement) {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      }
    }
  } catch (e) {
    console.warn('Exit fullscreen error:', e);
  }
}

/* ==========================================================================
   SCREEN WAKE LOCK CONTROLLER (KEEP TABLET AWAKE PERMANENTLY)
   ========================================================================== */
let screenWakeLockSentinel = null;

async function requestScreenWakeLock() {
  try {
    if ('wakeLock' in navigator) {
      screenWakeLockSentinel = await navigator.wakeLock.request('screen');
      console.log('Screen Wake Lock active: Tablet will stay awake');
      screenWakeLockSentinel.addEventListener('release', () => {
        screenWakeLockSentinel = null;
      });
    }
  } catch (err) {
    console.warn('Screen WakeLock notice:', err);
  }

  // Fallback: Trigger play on the hidden keep-awake video
  const keepAwakeVid = document.getElementById('kioskKeepAwakeVideo');
  if (keepAwakeVid && keepAwakeVid.paused) {
    keepAwakeVid.play().catch(() => {});
  }
}

function setupScreenWakeLock() {
  requestScreenWakeLock();

  // Re-acquire when user returns to app or tab becomes visible
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      requestScreenWakeLock();
    }
  });

  // Re-acquire on user interactions
  window.addEventListener('pointerdown', () => {
    if (!screenWakeLockSentinel) {
      requestScreenWakeLock();
    }
  }, { passive: true });
}

/* ==========================================================================
   DAY / NIGHT AUTO-THEME SYSTEM
   ========================================================================== */
function setupDayNightTheme() {
  updateDayNightTheme();
  // Check every 30 seconds for automatic time change
  setInterval(updateDayNightTheme, 30000);
}

function updateDayNightTheme() {
  const manualTheme = localStorage.getItem('copilot_manual_theme') || 'auto';
  const currentHour = new Date().getHours();
  // Daytime is considered 6:00 AM to 6:59 PM (18:59)
  const isDayTime = currentHour >= 6 && currentHour < 19;
  const isDay = (manualTheme === 'day') || (manualTheme === 'auto' && isDayTime);

  if (isDay) {
    document.documentElement.classList.add('theme-day');
    document.documentElement.classList.remove('theme-night');
    if (document.body) {
      document.body.classList.add('theme-day');
      document.body.classList.remove('theme-night');
    }
  } else {
    document.documentElement.classList.remove('theme-day');
    document.documentElement.classList.add('theme-night');
    if (document.body) {
      document.body.classList.remove('theme-day');
      document.body.classList.add('theme-night');
    }
  }
}

let adminTapCount = 0;
let adminTapTimer = null;
let isAdminUnlocked = false;

function triggerAdminTap(e) {
  if (e) e.stopPropagation();

  clearTimeout(adminTapTimer);
  adminTapCount++;

  // Reset counter after 2.5s without tapping
  adminTapTimer = setTimeout(() => {
    adminTapCount = 0;
  }, 2500);

  if (adminTapCount >= 3 && adminTapCount < 7) {
    const remaining = 7 - adminTapCount;
    sound.playTap();
    const msg = state.lang === 'en'
      ? `You are ${remaining} steps away from Administrator Mode...`
      : `Faltan ${remaining} toques para activar el Modo Administrador...`;
    showAndroidToast(msg);
  } else if (adminTapCount >= 7) {
    adminTapCount = 0;
    isAdminUnlocked = true;
    sound.playFanfare();
    const msg = state.lang === 'en'
      ? `🔓 Administrator Mode Unlocked! Fullscreen released.`
      : `🔓 ¡Modo Administrador Desbloqueado! Pantalla completa liberada.`;
    showAndroidToast(msg);

    // Release fullscreen to reveal tablet browser bar
    exitFullscreenSafely();

    // Show admin controls
    if (DOM.btnAdminQuick) DOM.btnAdminQuick.classList.remove('hidden');
    if (DOM.btnFullscreen) DOM.btnFullscreen.classList.remove('hidden');

    // Open Admin Modal immediately
    openAdminModal();
  }
}

function setupKioskMode() {
  const btnLockKiosk = document.getElementById('btnLockKioskFullscreen');
  const btnExitKioskBar = document.getElementById('btnExitKioskBar');
  const adminHotspot = document.getElementById('adminSecretHotspot');
  const headerBadge = document.getElementById('btnBrandBadge');
  const dockBrand = document.getElementById('dockBrandLogo');

  // Enforce fullscreen on ANY user interaction when not unlocked by admin
  const ensureFullscreenOnInteraction = () => {
    if (!isAdminUnlocked && !document.fullscreenElement && !document.webkitFullscreenElement) {
      requestFullscreenSafely();
    }
  };
  window.addEventListener('pointerdown', ensureFullscreenOnInteraction);
  window.addEventListener('click', ensureFullscreenOnInteraction);
  window.addEventListener('touchstart', ensureFullscreenOnInteraction, { passive: true });

  // Listen to fullscreen changes: if browser exited fullscreen unexpectedly while locked
  document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement && !document.webkitFullscreenElement && !isAdminUnlocked) {
      requestFullscreenSafely();
    }
  });

  // Strict Fullscreen Watchdog: ensures kiosk remains fullscreen unless admin unlocked
  setInterval(() => {
    if (!isAdminUnlocked && !document.fullscreenElement && !document.webkitFullscreenElement) {
      requestFullscreenSafely();
    }
  }, 2500);

  // Initialize Screen WakeLock
  setupScreenWakeLock();

  // Bind 7-tap admin mode listeners on secret hotspots
  if (adminHotspot) adminHotspot.addEventListener('pointerdown', triggerAdminTap);
  if (dockBrand) dockBrand.addEventListener('pointerdown', triggerAdminTap);
  if (headerBadge) headerBadge.addEventListener('pointerdown', triggerAdminTap);
  if (DOM.dockBrandLogo) DOM.dockBrandLogo.addEventListener('pointerdown', triggerAdminTap);

  // Fallback for any .smb3-brand-badge
  document.querySelectorAll('.smb3-brand-badge, .brand-badge').forEach(el => {
    el.addEventListener('pointerdown', triggerAdminTap);
  });

  // Admin Modal: Lock Kiosk in Fullscreen
  if (btnLockKiosk) {
    btnLockKiosk.addEventListener('click', () => {
      sound.playTap();
      isAdminUnlocked = false;
      closeAdminModal();
      requestFullscreenSafely();
      if (DOM.btnAdminQuick) DOM.btnAdminQuick.classList.add('hidden');
      if (DOM.btnFullscreen) DOM.btnFullscreen.classList.add('hidden');
      showToast(state.lang === 'en' ? '🔒 Kiosk Fullscreen Locked' : '🔒 Pantalla Completa Kiosco Bloqueada');
    });
  }

  // Admin Modal: Exit to browser bar
  if (btnExitKioskBar) {
    btnExitKioskBar.addEventListener('click', () => {
      sound.playTap();
      isAdminUnlocked = true;
      exitFullscreenSafely();
      closeAdminModal();
      showToast(state.lang === 'en' ? '🌐 Browser Toolbar Active' : '🌐 Barra del Navegador Activa');
    });
  }
}

/* ==========================================================================
   DRIVER ADMIN & SETTINGS (PIN 1234)
   ========================================================================== */
function setupAdmin() {
  if (DOM.btnAdminQuick) {
    DOM.btnAdminQuick.addEventListener('click', openAdminModal);
  }
  if (DOM.btnCloseAdminModal) {
    DOM.btnCloseAdminModal.addEventListener('click', closeAdminModal);
  }
  if (DOM.btnVerifyPin) {
    DOM.btnVerifyPin.addEventListener('click', verifyAdminPin);
  }
  if (DOM.btnSaveDriverConfig) {
    DOM.btnSaveDriverConfig.addEventListener('click', saveAdminSettings);
  }
  if (DOM.btnResetStats) {
    DOM.btnResetStats.addEventListener('click', () => {
      state.driverConfig.tripsToday = 0;
      state.driverConfig.triviaPlays = 0;
      state.driverConfig.pointsEarned = 0;
      updateDriverStatsInStorage();
      populateAdminSettings();
      sound.playTap();
      showToast('Stats reset.');
    });
  }
}

function openAdminModal() {
  DOM.adminModal.classList.remove('hidden');
  DOM.adminPinScreen.classList.remove('hidden');
  DOM.adminSettingsScreen.classList.add('hidden');
  DOM.adminPinInput.value = '';
}

function closeAdminModal() {
  DOM.adminModal.classList.add('hidden');
  // When closing admin modal, lock back to kiosk fullscreen if not intentionally staying in browser mode
  if (!document.fullscreenElement && !document.webkitFullscreenElement) {
    isAdminUnlocked = false;
    requestFullscreenSafely();
    if (DOM.btnAdminQuick) DOM.btnAdminQuick.classList.add('hidden');
    if (DOM.btnFullscreen) DOM.btnFullscreen.classList.add('hidden');
  }
}

function verifyAdminPin() {
  const pin = DOM.adminPinInput.value.trim();
  if (pin === state.driverConfig.pin || pin === "1234") {
    sound.playCorrect();
    DOM.adminPinScreen.classList.add('hidden');
    DOM.adminSettingsScreen.classList.remove('hidden');
    populateAdminSettings();
  } else {
    sound.playWrong();
    showToast(getT().toastPinWrong);
    DOM.adminPinInput.value = '';
  }
}

function populateAdminSettings() {
  DOM.cfgDriverName.value = state.driverConfig.name;
  DOM.cfgDriverCar.value = state.driverConfig.car;
  DOM.cfgDriverRating.value = state.driverConfig.rating;
  DOM.cfgDriverTipHandle.value = state.driverConfig.tipHandle;
  DOM.cfgDriverPlaylist.value = state.driverConfig.playlist;
  DOM.cfgDriverBio.value = state.driverConfig.bio;

  const selTheme = document.getElementById('cfgThemeMode');
  if (selTheme) {
    selTheme.value = localStorage.getItem('copilot_manual_theme') || 'auto';
  }

  DOM.statTripsToday.textContent = state.driverConfig.tripsToday;
  DOM.statTriviaPlays.textContent = state.driverConfig.triviaPlays;
  DOM.statPointsEarned.textContent = (state.driverConfig.triviaPlays * 100).toLocaleString();
  DOM.statPayout.textContent = `$${(state.driverConfig.tripsToday * 2.5 + state.driverConfig.triviaPlays * 0.5 + 40).toFixed(2)}`;
}

function saveAdminSettings() {
  state.driverConfig.name = DOM.cfgDriverName.value.trim() || state.driverConfig.name;
  state.driverConfig.car = DOM.cfgDriverCar.value.trim() || state.driverConfig.car;
  state.driverConfig.rating = DOM.cfgDriverRating.value || state.driverConfig.rating;
  state.driverConfig.tipHandle = DOM.cfgDriverTipHandle.value.trim() || state.driverConfig.tipHandle;
  state.driverConfig.playlist = DOM.cfgDriverPlaylist.value.trim() || state.driverConfig.playlist;
  state.driverConfig.bio = DOM.cfgDriverBio.value.trim() || state.driverConfig.bio;

  const selTheme = document.getElementById('cfgThemeMode');
  if (selTheme) {
    localStorage.setItem('copilot_manual_theme', selTheme.value);
    updateDayNightTheme();
  }

  localStorage.setItem('copilot_driver_config', JSON.stringify(state.driverConfig));
  applyDriverConfigToUI();
  closeAdminModal();
  sound.playCorrect();
  showToast(getT().toastSettingsSaved);
}

function loadDriverConfig() {
  try {
    const saved = localStorage.getItem('copilot_driver_config');
    if (saved) {
      state.driverConfig = { ...state.driverConfig, ...JSON.parse(saved) };
    }
  } catch (e) {
    console.error('Error loading driver config', e);
  }
  applyDriverConfigToUI();
}

function updateDriverStatsInStorage() {
  try {
    localStorage.setItem('copilot_driver_config', JSON.stringify(state.driverConfig));
  } catch (e) {}
}

function applyDriverConfigToUI() {
  const t = getT();
  if (DOM.infoDriverName) DOM.infoDriverName.textContent = state.driverConfig.name;
  if (DOM.infoDriverRating) DOM.infoDriverRating.textContent = state.driverConfig.rating;
  if (DOM.infoDriverCar) DOM.infoDriverCar.innerHTML = `<span>🚗</span> ${state.driverConfig.car}`;
  if (DOM.infoDriverTrips) DOM.infoDriverTrips.textContent = `(${state.driverConfig.trips} ${t.tripsCompleted})`;
  if (DOM.infoDriverBio) DOM.infoDriverBio.textContent = `"${state.driverConfig.bio}"`;
  if (DOM.tipModalDriverName) DOM.tipModalDriverName.textContent = state.driverConfig.name;
  if (DOM.tipHandle) DOM.tipHandle.textContent = `CashApp / Venmo: ${state.driverConfig.tipHandle}`;
}

/* ==========================================================================
   QR CODE VECTOR GENERATOR (STANDARDS-COMPLIANT SCANNABLE SVG)
   ========================================================================== */
function generateQrCode(container, text) {
  if (!container) return;
  const targetUrl = text || "https://autobotec.net";

  try {
    const qrLib = (typeof qrcode === 'function') ? qrcode : (window.qrcode || null);
    if (qrLib) {
      // Version 0 (auto-sizing), level 'M' (15% error correction)
      const qr = qrLib(0, 'M');
      qr.addData(targetUrl);
      qr.make();
      const svgTag = qr.createSvgTag({ scalable: true, margin: 2 });
      container.innerHTML = svgTag;
      const svgEl = container.querySelector('svg');
      if (svgEl) {
        svgEl.style.width = '100%';
        svgEl.style.height = '100%';
        svgEl.style.display = 'block';
        svgEl.style.borderRadius = '6px';
        svgEl.setAttribute('role', 'img');
        svgEl.setAttribute('aria-label', `Código QR: ${targetUrl}`);
      }
      return;
    }
  } catch (err) {
    console.warn('QR generator notice:', err);
  }

  // Fallback if library failed
  let hash = 0;
  for (let i = 0; i < targetUrl.length; i++) {
    hash = ((hash << 5) - hash) + targetUrl.charCodeAt(i);
    hash |= 0;
  }

  const size = 25;
  const cellSize = 5;
  const svgSize = size * cellSize;
  let rects = '';

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const inTopLeft = (r < 7 && c < 7);
      const inTopRight = (r < 7 && c >= size - 7);
      const inBottomLeft = (r >= size - 7 && c < 7);

      let isFilled = false;
      if (inTopLeft || inTopRight || inBottomLeft) {
        const localR = inBottomLeft ? r - (size - 7) : r;
        const localC = inTopRight ? c - (size - 7) : c;
        if (localR === 0 || localR === 6 || localC === 0 || localC === 6) {
          isFilled = true;
        } else if (localR >= 2 && localR <= 4 && localC >= 2 && localC <= 4) {
          isFilled = true;
        }
      } else {
        const seed = (r * 31 + c * 17 + Math.abs(hash)) % 100;
        isFilled = seed % 2 === 0;
      }

      if (isFilled) {
        rects += `<rect x="${c * cellSize}" y="${r * cellSize}" width="${cellSize}" height="${cellSize}" fill="#0b0f19" />`;
      }
    }
  }

  container.innerHTML = `
    <svg viewBox="0 0 ${svgSize} ${svgSize}" xmlns="http://www.w3.org/2000/svg" style="width:100%; height:100%; display:block;">
      <rect width="${svgSize}" height="${svgSize}" fill="#ffffff" rx="6" />
      ${rects}
    </svg>
  `;
}

/* ==========================================================================
   TOAST NOTIFICATION
   ========================================================================== */
function showToast(message) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = message;
  DOM.toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-10px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3200);
}

/* ==========================================================================
   EVENT LISTENERS SETUP
   ========================================================================== */
function setupEventListeners() {
  // Language switcher
  if (DOM.btnLangEs) DOM.btnLangEs.addEventListener('click', () => setLanguage('es'));
  if (DOM.btnLangEn) DOM.btnLangEn.addEventListener('click', () => setLanguage('en'));

  // Bottom Dock Navigation
  if (DOM.tabGames) DOM.tabGames.addEventListener('click', () => switchTab('games'));
  if (DOM.tabWeatherNews) DOM.tabWeatherNews.addEventListener('click', () => switchTab('weatherNews'));
  if (DOM.tabRideInfo) DOM.tabRideInfo.addEventListener('click', () => switchTab('rideInfo'));
  if (DOM.tabMediaAds) DOM.tabMediaAds.addEventListener('click', () => switchTab('mediaAds'));
  if (DOM.tabGiveaway) DOM.tabGiveaway.addEventListener('click', () => switchTab('giveaway'));
  if (DOM.tabLeaderboard) DOM.tabLeaderboard.addEventListener('click', () => switchTab('leaderboard'));

  // Fallback delegation on dock pills container
  const dockNav = document.querySelector('.dock-nav-pills');
  if (dockNav) {
    dockNav.addEventListener('click', (e) => {
      const btn = e.target.closest('.dock-pill');
      if (btn && btn.dataset.target) {
        switchTab(btn.dataset.target);
      }
    });
  }

  // Weather widgets in dock and ride info
  const dockWeatherWidget = document.querySelector('.dock-weather');
  if (dockWeatherWidget) {
    dockWeatherWidget.style.cursor = 'pointer';
    dockWeatherWidget.title = 'Ver pronóstico y noticias';
    dockWeatherWidget.addEventListener('click', () => switchTab('weatherNews'));
  }
  const weatherCardInRide = document.querySelector('.weather-full-card');
  if (weatherCardInRide) {
    weatherCardInRide.style.cursor = 'pointer';
    weatherCardInRide.title = 'Ver pronóstico extendido';
    weatherCardInRide.addEventListener('click', () => switchTab('weatherNews'));
  }

  // Autostart Pause
  if (DOM.btnPauseAutostart) {
    DOM.btnPauseAutostart.addEventListener('click', (e) => {
      e.stopPropagation();
      togglePauseAutostart();
    });
  }

  // Games Hub Cards
  if (DOM.cardLaunchClassic) DOM.cardLaunchClassic.addEventListener('click', () => launchGame('classic'));
  if (DOM.cardLaunchPicture) DOM.cardLaunchPicture.addEventListener('click', () => launchGame('picture'));
  if (DOM.cardLaunchSimon) DOM.cardLaunchSimon.addEventListener('click', () => launchGame('simon'));
  if (DOM.cardLaunchMatch) DOM.cardLaunchMatch.addEventListener('click', () => launchGame('match'));

  // Back from Game Arena
  if (DOM.btnBackToGamesHub) DOM.btnBackToGamesHub.addEventListener('click', returnToGamesHub);

  // Return from Leaderboard
  if (DOM.btnBackToGamesFromLb) {
    DOM.btnBackToGamesFromLb.addEventListener('click', () => switchTab('games'));
  }

  // Weather & News Controls
  setupWeatherNewsControls();

  // Media Hub & Video Promo Showcase
  setupMediaSubnav();
  setupVideoPromoShowcase();
  if (DOM.btnNextAd) DOM.btnNextAd.addEventListener('click', nextAd);
  if (DOM.btnClaimAd) DOM.btnClaimAd.addEventListener('click', claimCurrentAd);

  // Sound Toggle
  if (DOM.btnSound) {
    DOM.btnSound.addEventListener('click', () => {
      const isMuted = sound.toggleMute();
      if (DOM.soundIcon) DOM.soundIcon.textContent = isMuted ? '🔇' : '🔊';
      showToast(isMuted ? getT().toastSoundMuted : getT().toastSoundActive);
    });
  }

  // Fullscreen Kiosk Toggle
  if (DOM.btnFullscreen) {
    DOM.btnFullscreen.addEventListener('click', () => {
      sound.playTap();
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(err => {
          console.warn('Fullscreen error:', err);
        });
        showToast(getT().toastFullscreen);
      } else {
        document.exitFullscreen();
        showToast(getT().toastNormalScreen);
      }
    });
  }

  // Ride Info & Tips
  setupRideInfoControls();
  if (DOM.btnCloseTipModal) DOM.btnCloseTipModal.addEventListener('click', closeTipModal);
  if (DOM.btnConfirmTipSent) {
    DOM.btnConfirmTipSent.addEventListener('click', () => {
      sound.playFanfare();
      closeTipModal();
      showToast(getT().toastTipThankYou);
    });
  }

  // Device Screen Adaptive Analyzer & Fullscreen Ads
  initDeviceScreenAdapter();
  setupFullscreenAdControls();

  // Giveaway, Admin & Kiosk Mode
  setupGiveaway();
  setupAdmin();
  setupKioskMode();

  // Initialize Mix Engine (Trivia -> Weather -> News -> Video Promo)
  initMixEngine();

  // GeoLocation & Live Weather & Regional News Subscription
  geoService.subscribe(({ location, weather, news }) => {
    state.liveWeather = weather;
    state.liveNews = news;
    state.isGpsLoading = false;

    if (DOM.gpsDot) {
      DOM.gpsDot.classList.remove('loading');
      DOM.gpsDot.classList.add('active');
    }
    if (DOM.gpsStatusText) {
      const flag = location.isUSA ? '🇺🇸' : (location.countryCode === 'DO' ? '🇩🇴' : '📍');
      DOM.gpsStatusText.textContent = `${flag} ${location.city || 'GPS Activo'}`;
    }

    renderWeatherExpanded();
    renderNewsFeed();
    updateDockWeather(weather);
    updateRideWeather(weather);
  });

  // Trigger initial geolocation detection (high-accuracy GPS or fast IP fallback)
  geoService.init().catch(err => {
    console.warn('Initial geolocation detection notice:', err);
  });
}

// Bootstrap safely on DOM loaded or immediate if already interactive
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
