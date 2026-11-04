document.addEventListener('alpine:init', () => {
            Alpine.data('floodApp', () => ({
                stations: [
                    { id: 'IOT-01', name: 'Station Alpha (Main Bridge)', stage: 5.20, status: 'WARNING', lat: 26.145, lng: 91.736, desc: 'Water level exceeds warning threshold due to upstream basin runoff.' },
                    { id: 'IOT-02', name: 'Station Beta (East Dyke)', stage: 4.10, status: 'NORMAL', lat: 26.160, lng: 91.760, desc: 'Water stage within safe embankments.' },
                    { id: 'IOT-03', name: 'Station Gamma (Sector 7 Lowland)', stage: 6.15, status: 'DANGER', lat: 26.120, lng: 91.710, desc: 'DANGER: Stage exceeds critical limit. Inundation in low residential pockets.' },
                    { id: 'IOT-04', name: 'Station Delta (North Reservoir)', stage: 3.80, status: 'NORMAL', lat: 26.180, lng: 91.720, desc: 'Normal stage maintained.' }
                ],
                shelters: [
                    { name: 'North Hill High School Shelter', cap: '140/300', lat: 26.170, lng: 91.750 },
                    { name: 'Central Indoor Stadium Refuge', cap: '480/500', lat: 26.135, lng: 91.725 },
                    { name: 'West Community Center', cap: '80/200', lat: 26.110, lng: 91.690 }
                ],
                activeStation: {},
                activeBasemap: 'dark',
                
                layers: {
                    stations: true,
                    inundation: true,
                    shelters: true
                },
                sim: {
                    rain: 50,
                    dam: 800,
                    barrier: 1.5,
                    stage: 5.09,
                    area: 16.4,
                    population: 2624,
                    risk: 'WARNING',
                    explanation: 'Moderate precipitation (50 mm/h) and reservoir flow (800 m³/s) result in stage height of 5.09m. Temporary barrier height of 1.5m shields commercial sector, but lowlands are exposed.'
                },
                alertFilter: 'all',
                alerts: [
                    { id: 1, type: 'critical', title: 'Critical Overflow Warning - Sector 7', time: '10:42 AM', body: 'Station Gamma registered stage height of 6.15m (Exceeding 6.0m Danger Mark). Immediate localized evacuation recommended.' },
                    { id: 2, type: 'advisory', title: 'Public Safety Road Closure Notice', time: '09:15 AM', body: 'Route 104 North underpass closed due to 0.6m standing runoff. Divert via East Highway Route 88.' },
                    { id: 3, type: 'advisory', title: 'Upstream Dam Spillway Adjustment', time: '07:30 AM', body: 'Reservoir spillway gate release increased to 800 m³/s to manage catchment inflow.' }
                ],
                userLocation: {
                    fetched: false,
                    status: 'Click Acquire GPS to share live coordinates',
                    lat: null,
                    lng: null
                },
                alarmActive: false,
                sirenActive: false,
                userSilencedAlarm: false,
                audioCtx: null,
                osc1: null,
                osc2: null,
                lfo: null,
                gainNode: null,
                map: null,
                tileLayers: {},
                leafletLayers: {
                    stationsGroup: null,
                    inundationGroup: null,
                    sheltersGroup: null
                },
                chartInstance: null,

                init() {
                    this.activeStation = this.stations[0];
                    this.setupAudioAutoplayUnlock();
                    
                    this.$nextTick(() => {
                        this.initMap();
                        this.initChart();
                        this.updateSimulation(false); // Initial calculation without auto alarm
                    });
                },

                // Pre-unlock AudioContext on user interaction anywhere on the page
                setupAudioAutoplayUnlock() {
                    const unlock = () => {
                        try {
                            const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
                            if (!this.audioCtx && AudioCtxClass) {
                                this.audioCtx = new AudioCtxClass();
                            }
                            if (this.audioCtx && this.audioCtx.state === 'suspended') {
                                this.audioCtx.resume();
                            }
                        } catch(e) {}
                    };
                    ['pointerdown', 'touchstart', 'click', 'input', 'keydown'].forEach(evt => {
                        window.addEventListener(evt, unlock, { passive: true });
                    });
                },

                // Manual risk setting method (triggered by risk cards or scenario buttons)
                manuallySetRisk(level) {
                    this.userSilencedAlarm = false; // Reset silence override on explicit user risk change
                    if (level === 'NORMAL') {
                        this.sim.rain = 20;
                        this.sim.dam = 400;
                        this.sim.barrier = 1.5;
                        this.updateSimulation(true);
                    } else if (level === 'WARNING') {
                        this.sim.rain = 55;
                        this.sim.dam = 850;
                        this.sim.barrier = 1.5;
                        this.updateSimulation(true);
                    } else if (level === 'DANGER') {
                        this.sim.rain = 105;
                        this.sim.dam = 1600;
                        this.sim.barrier = 1.0;
                        this.updateSimulation(true);
                        this.startAlarm(); // Guarantee siren rings immediately
                    } else if (level === 'CRITICAL') {
                        this.sim.rain = 145;
                        this.sim.dam = 2400;
                        this.sim.barrier = 0;
                        this.updateSimulation(true);
                        this.startAlarm(); // Guarantee siren rings immediately
                    }
                },

                // Called on slider drag
                onSliderInput() {
                    // Moving sliders clears user silence flag
                    this.userSilencedAlarm = false;
                    this.updateSimulation(true);
                },

                fetchLocation() {
                    this.userLocation.status = 'Fetching GPS coordinates...';
                    if ("geolocation" in navigator) {
                        navigator.geolocation.getCurrentPosition(
                            (position) => {
                                this.userLocation.lat = position.coords.latitude.toFixed(5);
                                this.userLocation.lng = position.coords.longitude.toFixed(5);
                                this.userLocation.fetched = true;
                                this.userLocation.status = `Acquired: ${this.userLocation.lat}°, ${this.userLocation.lng}°`;
                            },
                            (error) => {
                                // Fallback coordinates if restricted or blocked
                                this.userLocation.lat = 26.14500;
                                this.userLocation.lng = 91.73600;
                                this.userLocation.fetched = true;
                                this.userLocation.status = `Fallback Station GPS: ${this.userLocation.lat}°, ${this.userLocation.lng}°`;
                            },
                            { timeout: 8000, enableHighAccuracy: true }
                        );
                    } else {
                        this.userLocation.lat = 26.14500;
                        this.userLocation.lng = 91.73600;
                        this.userLocation.fetched = true;
                        this.userLocation.status = `GPS Unsupported (Using Fallback)`;
                    }
                },

                toggleAlarm() {
                    if (this.alarmActive || this.sirenActive) {
                        this.userSilencedAlarm = true;
                        this.stopAlarm();
                    } else {
                        this.userSilencedAlarm = false;
                        this.startAlarm();
                    }
                },

                toggleSiren() {
                    this.toggleAlarm();
                },

                startAlarm() {
                    if (this.alarmActive) return;
                    this.alarmActive = true;
                    this.sirenActive = true;

                    try {
                        const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
                        if (!this.audioCtx && AudioCtxClass) {
                            this.audioCtx = new AudioCtxClass();
                        }
                        if (this.audioCtx && this.audioCtx.state === 'suspended') {
                            this.audioCtx.resume().catch(() => {});
                        }

                        // Clean up existing nodes
                        if (this.osc1) { try { this.osc1.stop(); this.osc1.disconnect(); } catch(e){} this.osc1 = null; }
                        if (this.osc2) { try { this.osc2.stop(); this.osc2.disconnect(); } catch(e){} this.osc2 = null; }
                        if (this.lfo) { try { this.lfo.stop(); this.lfo.disconnect(); } catch(e){} this.lfo = null; }

                        if (this.audioCtx) {
                            // Create gain node with smooth attack
                            this.gainNode = this.audioCtx.createGain();
                            const now = this.audioCtx.currentTime || 0;
                            this.gainNode.gain.setValueAtTime(0.001, now);
                            this.gainNode.gain.exponentialRampToValueAtTime(0.18, now + 0.1);

                            // Dual frequency oscillator for dissonant emergency siren
                            this.osc1 = this.audioCtx.createOscillator();
                            this.osc2 = this.audioCtx.createOscillator();
                            this.osc1.type = 'sawtooth';
                            this.osc2.type = 'triangle';

                            // Modulating LFO for repeating siren wail (0.8Hz cycle)
                            this.lfo = this.audioCtx.createOscillator();
                            const lfoGain = this.audioCtx.createGain();
                            this.lfo.frequency.setValueAtTime(0.8, now); // 0.8 Hz wail rate
                            lfoGain.gain.setValueAtTime(320, now); // 320Hz frequency deviation

                            this.osc1.frequency.setValueAtTime(750, now);
                            this.osc2.frequency.setValueAtTime(758, now);

                            this.lfo.connect(lfoGain);
                            lfoGain.connect(this.osc1.frequency);
                            lfoGain.connect(this.osc2.frequency);

                            this.osc1.connect(this.gainNode);
                            this.osc2.connect(this.gainNode);
                            this.gainNode.connect(this.audioCtx.destination);

                            this.lfo.start(now);
                            this.osc1.start(now);
                            this.osc2.start(now);
                        }
                    } catch (e) {
                        console.warn('Web Audio Siren unavailable:', e);
                    }
                },

                stopAlarm() {
                    if (!this.alarmActive && !this.sirenActive) return;
                    try {
                        if (this.gainNode && this.audioCtx) {
                            const now = this.audioCtx.currentTime;
                            // Smooth fade out to eliminate audio popping
                            this.gainNode.gain.setValueAtTime(this.gainNode.gain.value, now);
                            this.gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.15);
                            setTimeout(() => {
                                if (this.osc1) { try { this.osc1.stop(); this.osc1.disconnect(); } catch(e){} this.osc1 = null; }
                                if (this.osc2) { try { this.osc2.stop(); this.osc2.disconnect(); } catch(e){} this.osc2 = null; }
                                if (this.lfo) { try { this.lfo.stop(); this.lfo.disconnect(); } catch(e){} this.lfo = null; }
                            }, 160);
                        } else {
                            if (this.osc1) { try { this.osc1.stop(); } catch(e){} this.osc1 = null; }
                            if (this.osc2) { try { this.osc2.stop(); } catch(e){} this.osc2 = null; }
                            if (this.lfo) { try { this.lfo.stop(); } catch(e){} this.lfo = null; }
                        }
                    } catch(e) {
                        console.warn('Error stopping siren:', e);
                    }
                    this.alarmActive = false;
                    this.sirenActive = false;
                },

                startSiren() { this.startAlarm(); },
                stopSiren() { this.stopAlarm(); },

                get activeLayersCount() {
                    return (this.layers.stations ? 1 : 0) + (this.layers.inundation ? 1 : 0) + (this.layers.shelters ? 1 : 0);
                },

                initMap() {
                    if (this.map) return;
                    
                    this.tileLayers = {
                        street: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                            maxZoom: 19,
                            attribution: '&copy; OpenStreetMap contributors'
                        }),
                        dark: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
                            maxZoom: 16,
                            attribution: 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ'
                        })
                    };

                    this.activeBasemap = 'dark';

                    this.map = L.map('leafletMap', {
                        center: [26.145, 91.736],
                        zoom: 12,
                        zoomControl: false,
                        layers: [this.tileLayers.dark]
                    });

                    L.control.zoom({ position: 'topleft' }).addTo(this.map);

                    this.leafletLayers.stationsGroup = L.layerGroup().addTo(this.map);
                    this.leafletLayers.inundationGroup = L.layerGroup().addTo(this.map);
                    this.leafletLayers.sheltersGroup = L.layerGroup().addTo(this.map);

                    this.renderMapLayers();
                },

                switchBasemap(type) {
                    if (!this.map || !this.tileLayers[type] || this.activeBasemap === type) return;
                    this.map.removeLayer(this.tileLayers[this.activeBasemap]);
                    this.tileLayers[type].addTo(this.map);
                    this.activeBasemap = type;
                },

                recenterMap() {
                    if (this.map) {
                        this.map.flyTo([26.145, 91.736], 12, { duration: 1.2 });
                    }
                },

                renderMapLayers() {
                    if (!this.map) return;
                    
                    this.leafletLayers.stationsGroup.clearLayers();
                    this.leafletLayers.inundationGroup.clearLayers();
                    this.leafletLayers.sheltersGroup.clearLayers();

                    if (this.layers.stations) {
                        this.stations.forEach((st) => {
                            let pulseClass = st.status === 'DANGER' ? 'marker-pulse-danger bg-red-500' : 
                                             st.status === 'WARNING' ? 'marker-pulse-warning bg-amber-500' : 
                                             'marker-pulse-normal bg-emerald-500';

                            let icon = L.divIcon({
                                className: 'custom-leaflet-marker',
                                html: `<div class="relative flex items-center justify-center w-7 h-7 pointer-events-auto">
                                        <div class="w-6 h-6 rounded-full ${pulseClass} border-2 border-slate-900 flex items-center justify-center shadow-lg cursor-pointer">
                                            <div class="w-2 h-2 rounded-full bg-white"></div>
                                        </div>
                                       </div>`,
                                iconSize: [28, 28],
                                iconAnchor: [14, 14]
                            });

                            let marker = L.marker([st.lat, st.lng], { icon: icon });
                            marker.bindPopup(`
                                <div class="font-sans">
                                    <div class="text-[10px] font-bold font-mono text-slate-400 uppercase tracking-wider">${st.id}</div>
                                    <div class="font-bold text-sm text-slate-100">${st.name}</div>
                                    <div class="mt-2 text-xs flex justify-between gap-4">
                                        <span class="text-slate-400">Current Stage:</span>
                                        <span class="font-mono font-bold text-blue-400">${st.stage} m</span>
                                    </div>
                                    <div class="text-xs flex justify-between gap-4 mt-0.5">
                                        <span class="text-slate-400">Status:</span>
                                        <span class="font-bold ${st.status === 'DANGER' ? 'text-red-400' : st.status === 'WARNING' ? 'text-amber-400' : 'text-emerald-400'}">${st.status}</span>
                                    </div>
                                </div>
                            `);

                            marker.on('click', () => {
                                this.activeStation = st;
                            });

                            this.leafletLayers.stationsGroup.addLayer(marker);
                        });
                    }

                    if (this.layers.inundation) {
                        this.renderInundationOverlay();
                    }

                    if (this.layers.shelters) {
                        this.shelters.forEach(sh => {
                            let shelterIcon = L.divIcon({
                                className: 'custom-shelter-marker',
                                html: `<div class="w-6 h-6 rounded-lg bg-purple-600/90 border-2 border-white flex items-center justify-center text-white shadow-lg cursor-pointer">
                                        <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>
                                       </div>`,
                                iconSize: [24, 24],
                                iconAnchor: [12, 12]
                            });

                            let marker = L.marker([sh.lat, sh.lng], { icon: shelterIcon });
                            marker.bindPopup(`
                                <div class="font-sans">
                                    <div class="text-[10px] font-bold text-purple-400 uppercase tracking-widest">Relief Shelter</div>
                                    <div class="font-bold text-slate-100">${sh.name}</div>
                                    <div class="text-xs text-slate-400 mt-1">Occupancy: <strong class="text-emerald-400">${sh.cap}</strong></div>
                                    <div class="mt-2">
                                        <a href="https://www.google.com/maps/dir/?api=1&destination=${sh.lat},${sh.lng}" target="_blank" class="text-xs text-blue-400 hover:underline font-bold">Get Google Maps Directions &rarr;</a>
                                    </div>
                                </div>
                            `);
                            this.leafletLayers.sheltersGroup.addLayer(marker);
                        });
                    }
                },

                renderInundationOverlay() {
                    if (!this.map) return;
                    this.leafletLayers.inundationGroup.clearLayers();

                    let radiusPrimary = 1200 + (this.sim.rain * 22);
                    let radiusOuter = radiusPrimary * 1.35;

                    let outerCircle = L.circle([26.130, 91.715], {
                        radius: radiusOuter,
                        color: '#3b82f6',
                        fillColor: '#2563eb',
                        fillOpacity: 0.12,
                        weight: 1,
                        dashArray: '4, 8'
                    });
                    this.leafletLayers.inundationGroup.addLayer(outerCircle);

                    let innerCircle = L.circle([26.130, 91.715], {
                        radius: radiusPrimary,
                        color: '#60a5fa',
                        fillColor: '#3b82f6',
                        fillOpacity: 0.35,
                        weight: 2
                    });
                    innerCircle.bindPopup(`Simulated Flood Inundation Zone<br><b>Area:</b> ${this.sim.area} km²<br><b>Radius:</b> ${(radiusPrimary/1000).toFixed(2)} km`);
                    this.leafletLayers.inundationGroup.addLayer(innerCircle);
                },

                toggleLayers() {
                    this.renderMapLayers();
                },

                updateSimulation(allowAudioTrigger = true) {
                    this.sim.stage = parseFloat((3.5 + (this.sim.rain * 0.025) + (this.sim.dam * 0.0008) - (this.sim.barrier * 0.2)).toFixed(2));
                    this.sim.area = parseFloat((8.0 + (this.sim.rain * 0.12) + (this.sim.dam * 0.003)).toFixed(1));
                    this.sim.population = Math.round(this.sim.area * 160);

                    if (this.sim.stage >= 7.0) {
                        this.sim.risk = 'CRITICAL';
                        this.sim.explanation = `Extreme hydrological surge (${this.sim.rain} mm/h rainfall, ${this.sim.dam} m³/s release). Stage height reaches ${this.sim.stage}m, breaching secondary levee crests. Immediate mandatory evacuation active.`;
                        if (allowAudioTrigger && !this.userSilencedAlarm) {
                            this.startAlarm();
                        }
                    } else if (this.sim.stage >= 6.0) {
                        this.sim.risk = 'DANGER';
                        this.sim.explanation = `High intensity rainfall (${this.sim.rain} mm/h) and dam release (${this.sim.dam} m³/s) push water stage to ${this.sim.stage}m, breaching danger limits. Emergency evacuation protocols active.`;
                        if (allowAudioTrigger && !this.userSilencedAlarm) {
                            this.startAlarm();
                        }
                    } else if (this.sim.stage >= 4.5) {
                        this.sim.risk = 'WARNING';
                        this.sim.explanation = `Moderate precipitation and reservoir flow result in stage height of ${this.sim.stage}m. Temporary barrier height of ${this.sim.barrier}m shields commercial sector, but lowlands are exposed.`;
                        if (this.alarmActive) {
                            this.stopAlarm();
                        }
                        this.userSilencedAlarm = false;
                    } else {
                        this.sim.risk = 'NORMAL';
                        this.sim.explanation = `Under current parameters (${this.sim.rain} mm/h rainfall), water stage remains at ${this.sim.stage}m safely within main embankments.`;
                        if (this.alarmActive) {
                            this.stopAlarm();
                        }
                        this.userSilencedAlarm = false;
                    }

                    if (this.map && this.layers.inundation) {
                        this.renderInundationOverlay();
                    }
                },

                resetSimulation() {
                    this.sim.rain = 50;
                    this.sim.dam = 800;
                    this.sim.barrier = 1.5;
                    this.userSilencedAlarm = false;
                    this.updateSimulation(false);
                    this.stopAlarm();
                },

                initChart() {
                    const ctx = document.getElementById('telemetryChart');
                    if (!ctx) return;

                    const gradient = ctx.getContext('2d').createLinearGradient(0, 0, 0, 250);
                    gradient.addColorStop(0, 'rgba(59, 130, 246, 0.4)');
                    gradient.addColorStop(1, 'rgba(59, 130, 246, 0.0)');

                    this.chartInstance = new Chart(ctx.getContext('2d'), {
                        type: 'line',
                        data: {
                            labels: ['00:00', '03:00', '06:00', '09:00', '12:00', '15:00', '18:00', '21:00', '00:00+1', '03:00+1'],
                            datasets: [
                                {
                                    label: 'River Water Stage (m)',
                                    data: [3.2, 3.4, 3.8, 4.2, 4.6, 5.0, 5.2, 5.3, 5.1, 4.9],
                                    borderColor: '#38bdf8',
                                    borderWidth: 3,
                                    backgroundColor: gradient,
                                    fill: true,
                                    tension: 0.35,
                                    pointBackgroundColor: '#38bdf8',
                                    pointBorderColor: '#090d16',
                                    pointRadius: 4,
                                    yAxisID: 'y'
                                },
                                {
                                    label: 'Warning Threshold (4.5m)',
                                    data: [4.5, 4.5, 4.5, 4.5, 4.5, 4.5, 4.5, 4.5, 4.5, 4.5],
                                    borderColor: '#f59e0b',
                                    borderWidth: 1.5,
                                    borderDash: [5, 5],
                                    pointRadius: 0,
                                    yAxisID: 'y'
                                },
                                {
                                    label: 'Danger Threshold (6.0m)',
                                    data: [6.0, 6.0, 6.0, 6.0, 6.0, 6.0, 6.0, 6.0, 6.0, 6.0],
                                    borderColor: '#ef4444',
                                    borderWidth: 1.5,
                                    borderDash: [5, 5],
                                    pointRadius: 0,
                                    yAxisID: 'y'
                                }
                            ]
                        },
                        options: {
                            responsive: true,
                            maintainAspectRatio: false,
                            plugins: {
                                legend: { 
                                    position: 'top',
                                    labels: { color: '#94a3b8', font: { family: 'Inter', size: 11 } }
                                }
                            },
                            scales: {
                                y: {
                                    beginAtZero: false,
                                    min: 2.0,
                                    max: 8.0,
                                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                                    ticks: { color: '#94a3b8', font: { family: 'JetBrains Mono', size: 10 } },
                                    title: { display: true, text: 'Water Stage (Meters)', color: '#64748b' }
                                },
                                x: {
                                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                                    ticks: { color: '#94a3b8', font: { family: 'JetBrains Mono', size: 10 } }
                                }
                            }
                        }
                    });
                },

                get filteredAlerts() {
                    if (this.alertFilter === 'all') return this.alerts;
                    return this.alerts.filter(a => a.type === this.alertFilter);
                }
            }));
        });

        // Initialize Lucide Icons
        window.addEventListener('DOMContentLoaded', () => {
            if (window.lucide) {
                lucide.createIcons();
            }
        });
