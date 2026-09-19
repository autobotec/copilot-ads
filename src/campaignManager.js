/**
 * CampaignManager - Sistema de Gestión y Métricas de Publicidad
 * Maneja clientes anunciantes, programación de videos, banners, deals y métricas de retorno.
 */
(function(window) {
  'use strict';

  const STORAGE_KEY_CAMPAIGNS = 'copilot_ads_campaigns_v1';
  const STORAGE_KEY_METRICS = 'copilot_ads_metrics_v1';
  const STORAGE_KEY_FLEET = 'copilot_ads_fleet_v1';
  const STORAGE_KEY_AUTH = 'copilot_ads_auth_v1';

  // Campañas semilla predeterminadas
  const DEFAULT_CAMPAIGNS = [
    {
      id: 'camp-demo-01',
      clientName: 'Copilot Ads Network',
      format: 'video_spotlight', // 'video_spotlight' | 'banner' | 'deal' | 'sponsor'
      status: 'active', // 'active' | 'paused' | 'expired'
      title: 'Tu Marca en Miles de Viajes Rideshare',
      subtitle: 'Alcanza pasajeros en Miami todos los días',
      mediaUrl: 'assets/videos/demo_promo.mp4',
      mediaType: 'video',
      couponCode: 'RIDE25',
      discountOffer: '25% OFF en tu primer mes de pauta',
      targetUrl: 'https://autobotectesting.site/ads?coupon=RIDE25',
      phone: '+1 (305) 555-0199',
      address: 'Brickell City Centre, Miami, FL',
      startDate: '2026-01-01',
      endDate: '2027-12-31',
      scheduleAllDay: true,
      scheduleStart: '06:00',
      scheduleEnd: '23:59',
      priority: 'high',
      impressionsTotal: 1420,
      videoCompletes: 980,
      qrScans: 164,
      taps: 230,
      createdAt: '2026-09-01T10:00:00Z'
    },
    {
      id: 'camp-demo-02',
      clientName: 'Ocean Drive Seafood & Grill',
      format: 'deal',
      status: 'active',
      title: 'Cena con Vista al Mar en South Beach',
      subtitle: 'Mariscos frescos del día y cocteles de autor',
      mediaUrl: 'assets/images/deals/promo_restaurant.webp',
      mediaType: 'image',
      couponCode: 'OCEAN20',
      discountOffer: '2x1 en Cocteles & 20% en Cena',
      targetUrl: 'https://autobotectesting.site/r/oceandrive?coupon=OCEAN20',
      phone: '+1 (305) 538-2020',
      address: '1020 Ocean Dr, Miami Beach, FL',
      startDate: '2026-01-01',
      endDate: '2026-12-31',
      scheduleAllDay: true,
      priority: 'normal',
      impressionsTotal: 890,
      videoCompletes: 0,
      qrScans: 95,
      taps: 140,
      createdAt: '2026-09-05T12:00:00Z'
    },
    {
      id: 'camp-demo-03',
      clientName: 'Wynwood Art & Cocktail Lounge',
      format: 'banner',
      status: 'active',
      title: 'Música en Vivo & Galería Interactiva',
      subtitle: 'Entrada libre para pasajeros de Copilot con cupón',
      mediaUrl: 'assets/images/banners/banner_wynwood.webp',
      mediaType: 'image',
      couponCode: 'WYNVIP',
      discountOffer: 'Bebida de cortesía de bienvenida',
      targetUrl: 'https://autobotectesting.site/r/wynwood?coupon=WYNVIP',
      phone: '+1 (305) 573-0303',
      address: '2550 NW 2nd Ave, Miami, FL',
      startDate: '2026-01-01',
      endDate: '2026-12-31',
      scheduleAllDay: true,
      priority: 'normal',
      impressionsTotal: 2150,
      videoCompletes: 0,
      qrScans: 112,
      taps: 310,
      createdAt: '2026-09-10T14:30:00Z'
    }
  ];

  class CampaignManagerService {
    constructor() {
      this.initStorage();
    }

    initStorage() {
      try {
        if (!localStorage.getItem(STORAGE_KEY_CAMPAIGNS)) {
          localStorage.setItem(STORAGE_KEY_CAMPAIGNS, JSON.stringify(DEFAULT_CAMPAIGNS));
        }
        if (!localStorage.getItem(STORAGE_KEY_AUTH)) {
          localStorage.setItem(STORAGE_KEY_AUTH, JSON.stringify({ pin: '2026', pass: 'admin2026' }));
        }
        if (!localStorage.getItem(STORAGE_KEY_FLEET)) {
          const defaultFleet = [
            { id: 'TBL-01', vehicle: 'Toyota Sienna - Uber XL', driver: 'Carlos M.', city: 'Miami, FL', status: 'online', lastPing: new Date().toISOString(), battery: 94 },
            { id: 'TBL-02', vehicle: 'Honda Accord - Lyft', driver: 'Andrea R.', city: 'Miami Beach, FL', status: 'online', lastPing: new Date().toISOString(), battery: 88 },
            { id: 'TBL-03', vehicle: 'Tesla Model Y - Uber Comfort', driver: 'Javier S.', city: 'Brickell, FL', status: 'standby', lastPing: new Date(Date.now() - 3600000).toISOString(), battery: 72 }
          ];
          localStorage.setItem(STORAGE_KEY_FLEET, JSON.stringify(defaultFleet));
        }
      } catch (e) {
        console.warn('[CampaignManager] Storage error:', e);
      }
    }

    getAuth() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY_AUTH);
        return raw ? JSON.parse(raw) : { pin: '2026', pass: 'admin2026' };
      } catch (e) {
        return { pin: '2026', pass: 'admin2026' };
      }
    }

    verifyAuth(input) {
      if (!input) return false;
      const auth = this.getAuth();
      const trimmed = input.toString().trim();
      return trimmed === auth.pin || trimmed === auth.pass;
    }

    setAuth(pin, pass) {
      const data = { pin: pin || '2026', pass: pass || 'admin2026' };
      localStorage.setItem(STORAGE_KEY_AUTH, JSON.stringify(data));
      return true;
    }

    getCampaigns() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY_CAMPAIGNS);
        return raw ? JSON.parse(raw) : DEFAULT_CAMPAIGNS;
      } catch (e) {
        return DEFAULT_CAMPAIGNS;
      }
    }

    saveCampaigns(campaigns) {
      try {
        localStorage.setItem(STORAGE_KEY_CAMPAIGNS, JSON.stringify(campaigns));
        return true;
      } catch (e) {
        console.error('[CampaignManager] Error saving campaigns:', e);
        return false;
      }
    }

    getActiveCampaigns() {
      const all = this.getCampaigns();
      const now = new Date();
      const todayStr = now.toISOString().split('T')[0];
      const nowMin = now.getHours() * 60 + now.getMinutes();

      return all.filter(c => {
        if (c.status !== 'active') return false;
        if (c.startDate && c.startDate > todayStr) return false;
        if (c.endDate && c.endDate < todayStr) return false;

        if (!c.scheduleAllDay && c.scheduleStart && c.scheduleEnd) {
          const [sh, sm] = c.scheduleStart.split(':').map(Number);
          const [eh, em] = c.scheduleEnd.split(':').map(Number);
          const startMin = sh * 60 + sm;
          const endMin = eh * 60 + em;
          if (startMin <= endMin) {
            if (nowMin < startMin || nowMin > endMin) return false;
          } else {
            if (nowMin < startMin && nowMin > endMin) return false;
          }
        }
        return true;
      });
    }

    getActiveVideoSpotlights() {
      const active = this.getActiveCampaigns();
      return active.filter(c => c.format === 'video_spotlight' || c.mediaType === 'video');
    }

    getActiveBanners() {
      const active = this.getActiveCampaigns();
      return active.filter(c => c.format === 'banner' || c.format === 'sponsor');
    }

    getActiveDeals() {
      const active = this.getActiveCampaigns();
      return active.filter(c => c.format === 'deal' || c.couponCode);
    }

    createCampaign(data) {
      const all = this.getCampaigns();
      const newCamp = {
        id: 'camp-' + Date.now(),
        clientName: data.clientName || 'Cliente Anunciante',
        format: data.format || 'video_spotlight',
        status: data.status || 'active',
        title: data.title || '',
        subtitle: data.subtitle || '',
        mediaUrl: data.mediaUrl || 'assets/videos/demo_promo.mp4',
        mediaType: data.mediaType || (data.format === 'video_spotlight' ? 'video' : 'image'),
        couponCode: (data.couponCode || '').toUpperCase(),
        discountOffer: data.discountOffer || '',
        targetUrl: data.targetUrl || 'https://autobotectesting.site',
        phone: data.phone || '',
        address: data.address || '',
        startDate: data.startDate || new Date().toISOString().split('T')[0],
        endDate: data.endDate || '2027-12-31',
        scheduleAllDay: data.scheduleAllDay !== false,
        scheduleStart: data.scheduleStart || '06:00',
        scheduleEnd: data.scheduleEnd || '23:59',
        priority: data.priority || 'normal',
        impressionsTotal: 0,
        videoCompletes: 0,
        qrScans: 0,
        taps: 0,
        createdAt: new Date().toISOString()
      };
      all.unshift(newCamp);
      this.saveCampaigns(all);
      return newCamp;
    }

    updateCampaign(id, updates) {
      const all = this.getCampaigns();
      const idx = all.findIndex(c => c.id === id);
      if (idx === -1) return null;
      all[idx] = { ...all[idx], ...updates, updatedAt: new Date().toISOString() };
      this.saveCampaigns(all);
      return all[idx];
    }

    toggleCampaignStatus(id) {
      const all = this.getCampaigns();
      const camp = all.find(c => c.id === id);
      if (!camp) return false;
      camp.status = (camp.status === 'active') ? 'paused' : 'active';
      this.saveCampaigns(all);
      return camp.status;
    }

    deleteCampaign(id) {
      const all = this.getCampaigns();
      const filtered = all.filter(c => c.id !== id);
      this.saveCampaigns(filtered);
      return true;
    }

    recordMetric(campaignId, metricType) {
      try {
        const all = this.getCampaigns();
        const camp = all.find(c => c.id === campaignId);
        if (!camp) return;

        if (metricType === 'impression') camp.impressionsTotal = (camp.impressionsTotal || 0) + 1;
        if (metricType === 'video_complete') camp.videoCompletes = (camp.videoCompletes || 0) + 1;
        if (metricType === 'qr_scan') camp.qrScans = (camp.qrScans || 0) + 1;
        if (metricType === 'tap') camp.taps = (camp.taps || 0) + 1;

        this.saveCampaigns(all);
      } catch (e) {
        console.warn('[CampaignManager] Metric record error:', e);
      }
    }

    getFleet() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY_FLEET);
        return raw ? JSON.parse(raw) : [];
      } catch (e) {
        return [];
      }
    }

    registerTabletHeartbeat(tabletId = 'TBL-01', extra = {}) {
      try {
        const fleet = this.getFleet();
        let tablet = fleet.find(t => t.id === tabletId);
        if (!tablet) {
          tablet = { id: tabletId, vehicle: 'Rideshare Vehicle', driver: 'Conductor', city: 'Miami, FL' };
          fleet.push(tablet);
        }
        tablet.status = 'online';
        tablet.lastPing = new Date().toISOString();
        if (extra.battery !== undefined) tablet.battery = extra.battery;
        if (extra.currentCampaign) tablet.currentCampaign = extra.currentCampaign;
        localStorage.setItem(STORAGE_KEY_FLEET, JSON.stringify(fleet));
      } catch (e) {}
    }

    getGlobalKPIs() {
      const all = this.getCampaigns();
      let totalImpressions = 0;
      let totalVideos = 0;
      let totalQr = 0;
      let totalTaps = 0;
      let activeCount = 0;

      all.forEach(c => {
        if (c.status === 'active') activeCount++;
        totalImpressions += (c.impressionsTotal || 0);
        totalVideos += (c.videoCompletes || 0);
        totalQr += (c.qrScans || 0);
        totalTaps += (c.taps || 0);
      });

      const fleet = this.getFleet();
      const onlineFleet = fleet.filter(f => f.status === 'online').length;

      return {
        totalCampaigns: all.length,
        activeCampaigns: activeCount,
        totalImpressions,
        totalVideos,
        totalQr,
        totalTaps,
        onlineFleet,
        totalFleet: fleet.length
      };
    }

    exportJSON() {
      const data = {
        exportedAt: new Date().toISOString(),
        version: '1.0',
        campaigns: this.getCampaigns(),
        fleet: this.getFleet()
      };
      return JSON.stringify(data, null, 2);
    }

    importJSON(jsonString) {
      try {
        const parsed = JSON.parse(jsonString);
        if (parsed.campaigns && Array.isArray(parsed.campaigns)) {
          this.saveCampaigns(parsed.campaigns);
        }
        if (parsed.fleet && Array.isArray(parsed.fleet)) {
          localStorage.setItem(STORAGE_KEY_FLEET, JSON.stringify(parsed.fleet));
        }
        return true;
      } catch (e) {
        console.error('[CampaignManager] Error importing JSON:', e);
        return false;
      }
    }
  }

  window.CampaignManager = new CampaignManagerService();

})(window);
