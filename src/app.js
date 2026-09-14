import { sound } from './audio.js';
import { TRANSLATIONS } from './i18n.js';
import { TRIVIA_QUESTIONS } from './triviaData.js';
import { SPONSORED_ADS } from './adsData.js';
import { GIVEAWAY_INFO } from './giveawaysData.js';
import { PICTURE_TRIVIA_QUESTIONS } from './games/pictureTrivia.js';
import { ColorMemoryGame } from './games/colorMemory.js';
import { SpeedMatchGame } from './games/speedMatch.js';
import { BILLBOARD_TOP_ALBUMS, SPORTS_UPDATES, CURATED_PLAYLISTS, SHORT_VIDEOS } from './mediaData.js';

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
  tabRideInfo: document.getElementById('tabRideInfo'),
  tabMediaAds: document.getElementById('tabMediaAds'),
  tabGiveaway: document.getElementById('tabGiveaway'),
  tabLeaderboard: document.getElementById('tabLeaderboard'),
  dockLabelGames: document.getElementById('dockLabelGames'),
  dockLabelRideInfo: document.getElementById('dockLabelRideInfo'),
  dockLabelMediaAds: document.getElementById('dockLabelMediaAds'),
  dockLabelGiveaway: document.getElementById('dockLabelGiveaway'),
  dockLabelLeaderboard: document.getElementById('dockLabelLeaderboard'),

  // Views
  viewGames: document.getElementById('viewGames'),
  viewRideInfo: document.getElementById('viewRideInfo'),
  viewMediaAds: document.getElementById('viewMediaAds'),
  viewGiveaway: document.getElementById('viewGiveaway'),
  viewLeaderboard: document.getElementById('viewLeaderboard'),

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
  if (DOM.tabDealsText) DOM.tabDealsText.textContent = t.tabDeals.replace('🎁 ', '');
  if (DOM.tabBillboardText) DOM.tabBillboardText.textContent = t.tabBillboard.replace('📊 ', '');
  if (DOM.tabListenText) DOM.tabListenText.textContent = t.tabListen.replace('🎧 ', '');
  if (DOM.tabWatchText) DOM.tabWatchText.textContent = t.tabWatch.replace('🎬 ', '');
  if (DOM.billboardColumnTitle) DOM.billboardColumnTitle.textContent = t.billboardTitle;
  if (DOM.sportsColumnTitle) DOM.sportsColumnTitle.textContent = t.sportsTitle;
  if (DOM.adBadge) DOM.adBadge.textContent = t.adBadgeFeatured;
  if (DOM.adTimerLabel) DOM.adTimerLabel.textContent = t.adContinuingIn;
  if (DOM.promoLabelText) DOM.promoLabelText.textContent = t.promoLabel;
  if (DOM.qrInstructionText) DOM.qrInstructionText.innerHTML = t.qrScanInstruction;
  if (DOM.btnNextAd) DOM.btnNextAd.textContent = t.nextAd;
  if (DOM.btnClaimAd) DOM.btnClaimAd.textContent = t.claimAd;

  // Giveaway & Leaderboard
  if (DOM.jackpotBadgeText) DOM.jackpotBadgeText.textContent = t.jackpotBadge;
  if (DOM.giveawayTitleBefore) DOM.giveawayTitleBefore.textContent = t.giveawayTitleBefore;
  if (DOM.giveawayTitleSpan) DOM.giveawayTitleSpan.textContent = t.giveawayTitleSpan;
  if (DOM.giveawayTitleAfter) DOM.giveawayTitleAfter.textContent = t.giveawayTitleAfter;
  if (DOM.giveawaySubtitle) DOM.giveawaySubtitle.textContent = t.giveawaySub;
  if (DOM.btnClaimTicket) DOM.btnClaimTicket.innerHTML = `<span>🎟️</span> ${t.btnGenerateTicket.replace('🎟️ ', '')}`;
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
  if (DOM.dockLabelRideInfo) DOM.dockLabelRideInfo.textContent = t.dockRideInfo;
  if (DOM.dockLabelMediaAds) DOM.dockLabelMediaAds.textContent = t.dockMediaAds;
  if (DOM.dockLabelGiveaway) DOM.dockLabelGiveaway.textContent = t.dockGiveaway;
  if (DOM.dockLabelLeaderboard) DOM.dockLabelLeaderboard.textContent = t.dockLeaderboard;

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
  if (DOM.btnSubmitGiveaway) DOM.btnSubmitGiveaway.innerHTML = `<span>🎟️</span> ${t.btnRegisterTicket.replace('🎟️ ', '')}`;
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

  const dockPills = [DOM.tabGames, DOM.tabRideInfo, DOM.tabMediaAds, DOM.tabGiveaway, DOM.tabLeaderboard];
  dockPills.forEach(pill => {
    if (pill) pill.classList.toggle('active', pill.dataset.target === targetTab);
  });

  const viewPanels = [DOM.viewGames, DOM.viewRideInfo, DOM.viewMediaAds, DOM.viewGiveaway, DOM.viewLeaderboard];
  viewPanels.forEach(panel => {
    if (panel) panel.classList.remove('active');
  });

  if (targetTab === 'games' && DOM.viewGames) DOM.viewGames.classList.add('active');
  if (targetTab === 'rideInfo' && DOM.viewRideInfo) DOM.viewRideInfo.classList.add('active');
  if (targetTab === 'mediaAds' && DOM.viewMediaAds) DOM.viewMediaAds.classList.add('active');
  if (targetTab === 'giveaway' && DOM.viewGiveaway) DOM.viewGiveaway.classList.add('active');
  if (targetTab === 'leaderboard' && DOM.viewLeaderboard) DOM.viewLeaderboard.classList.add('active');
}

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
  sound.playSplashPop();
  state.activeGameMode = gameType;

  if (DOM.gamesHubScreen) DOM.gamesHubScreen.classList.add('hidden');
  if (DOM.gameArenaScreen) DOM.gameArenaScreen.classList.remove('hidden');

  DOM.arenaContentMount.innerHTML = '';

  if (gameType === 'classic') {
    if (DOM.arenaGameTag) DOM.arenaGameTag.textContent = `❓ ${t.classicBadge}`;
    DOM.arenaContentMount.appendChild(DOM.triviaArenaContainer);
    DOM.pictureClueCard.classList.add('hidden');
    loadClassicQuestion(0);
  } else if (gameType === 'picture') {
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
  clearInterval(state.timerInterval);
  state.activeGameMode = 'none';
  state.activeGameInstance = null;

  if (DOM.gameArenaScreen) DOM.gameArenaScreen.classList.add('hidden');
  if (DOM.gamesHubScreen) DOM.gamesHubScreen.classList.remove('hidden');

  startAutostartCountdown();
}

function addPoints(pts) {
  state.score += pts;
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

/* ==========================================================================
   CLASSIC TRIVIA ENGINE (500 RANDOMIZED QUESTIONS)
   ========================================================================== */
function loadClassicQuestion(index) {
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
  clearInterval(state.timerInterval);
  state.timerSeconds = 12;
  updateTriviaTimerUI();

  if (DOM.timerCircle) DOM.timerCircle.classList.remove('warning');

  state.timerInterval = setInterval(() => {
    state.timerSeconds--;
    updateTriviaTimerUI();

    if (state.timerSeconds <= 4 && state.timerSeconds > 0) {
      sound.playTick();
      if (DOM.timerCircle) DOM.timerCircle.classList.add('warning');
    }

    if (state.timerSeconds <= 0) {
      clearInterval(state.timerInterval);
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
  if (state.isAnswerLocked) return;
  state.isAnswerLocked = true;
  clearInterval(state.timerInterval);

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
  }

  if (DOM.streakCount) DOM.streakCount.textContent = `${t.streak} x${Math.max(1, state.streak)}`;
  DOM.feedbackFact.textContent = fact;
  DOM.triviaFeedback.classList.remove('hidden');

  setTimeout(() => {
    state.questionsSinceLastAd++;
    if (state.questionsSinceLastAd >= state.driverConfig.adFrequency) {
      state.questionsSinceLastAd = 0;
      switchTab('mediaAds');
      switchMediaSubtab('deals');
    } else {
      if (isPicTrivia) {
        loadPictureQuestion(state.currentPicIndex + 1);
      } else {
        loadClassicQuestion(state.currentQuestionIndex + 1);
      }
    }
  }, 2500);
}

function handleTriviaTimeout(isPicTrivia) {
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

  setTimeout(() => {
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

  const contents = [DOM.mediaTabDeals, DOM.mediaTabBillboard, DOM.mediaTabListen, DOM.mediaTabWatch];
  contents.forEach(c => {
    if (c) c.classList.remove('active');
  });

  if (target === 'deals' && DOM.mediaTabDeals) DOM.mediaTabDeals.classList.add('active');
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

  if (DOM.adBadge) DOM.adBadge.textContent = state.currentLang === 'en' ? "LOCAL SPONSOR DEAL" : ad.badge;
  if (DOM.adBrandLogo) DOM.adBrandLogo.textContent = ad.icon;
  if (DOM.adBrandName) DOM.adBrandName.textContent = ad.brand;
  if (DOM.adHeadline) DOM.adHeadline.textContent = state.currentLang === 'en' ? "Your favorite artisanal coffee awaits at the next stop!" : ad.headline;
  if (DOM.adSubtext) DOM.adSubtext.textContent = state.currentLang === 'en' ? "Show your rideshare trip and get 30% OFF on your first order + free croissant." : ad.subtext;
  if (DOM.adPromoCode) DOM.adPromoCode.textContent = ad.promoCode;

  generateQrCode(DOM.adQrContainer, ad.qrCodeText);
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
  sound.playTap();
  DOM.adminModal.classList.remove('hidden');
  DOM.adminPinScreen.classList.remove('hidden');
  DOM.adminSettingsScreen.classList.add('hidden');
  DOM.adminPinInput.value = '';
}

function closeAdminModal() {
  DOM.adminModal.classList.add('hidden');
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
   QR CODE VECTOR GENERATOR (SVG CLEAN)
   ========================================================================== */
function generateQrCode(container, text) {
  if (!container) return;
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) - hash) + text.charCodeAt(i);
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
  if (DOM.tabRideInfo) DOM.tabRideInfo.addEventListener('click', () => switchTab('rideInfo'));
  if (DOM.tabMediaAds) DOM.tabMediaAds.addEventListener('click', () => switchTab('mediaAds'));
  if (DOM.tabGiveaway) DOM.tabGiveaway.addEventListener('click', () => switchTab('giveaway'));
  if (DOM.tabLeaderboard) DOM.tabLeaderboard.addEventListener('click', () => switchTab('leaderboard'));

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

  // Media Hub
  setupMediaSubnav();
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

  // Giveaway & Admin
  setupGiveaway();
  setupAdmin();
}

// Bootstrap on DOM loaded
document.addEventListener('DOMContentLoaded', init);
