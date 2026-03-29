import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import { fetchPatients } from '../../services/api'

// Offline vitals fallback — same as useVitalsWS
const OFFLINE_VITALS = {
  'john-mercer':  { heart_rate: 96, spo2: 93, risk_score: 71, location: { lat: 37.7751, lng: -122.4196, status: 'at_home', dist_from_home_m: 30 }, alert: { type: 'yellow', message: 'HR elevated.' } },
  'rosa-delgado': { heart_rate: 112, spo2: 91, risk_score: 94, location: { lat: 37.7855, lng: -122.4088, status: 'at_home', dist_from_home_m: 80 }, alert: { type: 'critical', message: 'AFib detected.' } },
  'marcus-webb':  { heart_rate: 88, spo2: 95, risk_score: 55, location: { lat: 37.7652, lng: -122.4390, status: 'at_home', dist_from_home_m: 45 }, alert: { type: 'yellow', message: 'Pre-visit tomorrow.' } },
  'sarah-kim':    { heart_rate: 68, spo2: 98, risk_score: 14, location: { lat: 37.7952, lng: -122.3990, status: 'at_home', dist_from_home_m: 55 }, alert: null },
}

const HOSPITAL = { lat: 37.7790, lng: -122.4250, name: 'UCSF Medical Center' }

function riskColor(score) {
  if (score >= 80) return '#FF3B3B'
  if (score >= 65) return '#FF6B35'
  if (score >= 45) return '#FF9500'
  if (score >= 25) return '#00D4FF'
  return '#00FF9D'
}

function riskLabel(score) {
  if (score >= 80) return 'CRITICAL'
  if (score >= 65) return 'HIGH'
  if (score >= 45) return 'MODERATE'
  if (score >= 25) return 'LOW'
  return 'STABLE'
}

function makePatientIcon(initials, score, isCritical) {
  const color = riskColor(score)
  const pulseStyle = isCritical
    ? `animation:markerPulse 2s ease-in-out infinite;`
    : ''
  const ring = isCritical
    ? `<div style="position:absolute;inset:-8px;border-radius:50%;border:2px solid ${color}55;${pulseStyle}"></div>`
    : ''

  return L.divIcon({
    html: `<div style="position:relative;width:40px;height:46px;">
      ${ring}
      <div style="width:40px;height:40px;border-radius:50%;background:#0D1629;border:2.5px solid ${color};
        display:flex;align-items:center;justify-content:center;
        font-family:'DM Mono',monospace;font-size:11px;font-weight:700;color:${color};
        box-shadow:0 0 10px ${color}55;position:relative;">
        ${initials}
      </div>
      <div style="position:absolute;bottom:0;left:50%;transform:translateX(-50%);width:0;height:0;
        border-left:5px solid transparent;border-right:5px solid transparent;border-top:6px solid ${color};"></div>
    </div>`,
    className: '',
    iconSize: [40, 46],
    iconAnchor: [20, 46],
    popupAnchor: [0, -50],
  })
}

function makeHospitalIcon() {
  return L.divIcon({
    html: `<div style="width:36px;height:36px;border-radius:8px;background:#132040;border:2px solid #00D4FF;
      display:flex;align-items:center;justify-content:center;font-size:18px;
      box-shadow:0 0 12px #00D4FF44;">🏥</div>`,
    className: '',
    iconSize: [36, 36],
    iconAnchor: [18, 36],
    popupAnchor: [0, -38],
  })
}

function buildPopup(patient, vitals) {
  const score = vitals?.risk_score ?? patient.risk_score ?? 0
  const color = riskColor(score)
  const hr = vitals?.heart_rate ? Math.round(vitals.heart_rate) : '—'
  const spo2 = vitals?.spo2 ? Math.round(vitals.spo2) : '—'
  const dist = vitals?.location?.dist_from_home_m ?? patient.location?.dist_from_home_m
  const distText = dist != null ? `${Math.round(dist)}m from home` : ''
  const alertMsg = vitals?.alert?.message || patient.alert?.message || ''

  return `
    <div style="background:#0D1629;border:1px solid ${color};border-radius:12px;padding:12px;min-width:200px;
      font-family:'DM Sans',sans-serif;color:#F0F4FF;font-size:13px;">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
        <div style="width:32px;height:32px;border-radius:50%;background:#132040;border:2px solid ${color};
          display:flex;align-items:center;justify-content:center;font-size:11px;font-family:'DM Mono',monospace;
          font-weight:700;color:${color};">
          ${patient.photo_initials || '??'}
        </div>
        <div>
          <p style="font-weight:600;margin:0;">${patient.name}</p>
          <p style="font-size:11px;color:#8B9FC4;margin:0;">Day ${patient.days_post_op} post-op</p>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:8px;">
        <div style="background:#132040;border-radius:6px;padding:6px;text-align:center;">
          <p style="font-size:9px;color:#4A5F80;text-transform:uppercase;letter-spacing:.05em;margin:0;">Heart Rate</p>
          <p style="font-size:15px;font-weight:700;color:#FF6B9D;font-family:'DM Mono',monospace;margin:0;">${hr}<span style="font-size:10px;font-weight:400;color:#8B9FC4;">bpm</span></p>
        </div>
        <div style="background:#132040;border-radius:6px;padding:6px;text-align:center;">
          <p style="font-size:9px;color:#4A5F80;text-transform:uppercase;letter-spacing:.05em;margin:0;">SpO₂</p>
          <p style="font-size:15px;font-weight:700;color:#00D4FF;font-family:'DM Mono',monospace;margin:0;">${spo2}<span style="font-size:10px;font-weight:400;color:#8B9FC4;">%</span></p>
        </div>
      </div>
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:${alertMsg ? '8px' : '0'};">
        <span style="font-size:10px;color:#4A5F80;">${distText}</span>
        <span style="font-size:11px;font-family:'DM Mono',monospace;font-weight:700;color:${color};">${riskLabel(score)} ${score}</span>
      </div>
      ${alertMsg ? `<div style="background:${color}18;border:1px solid ${color}40;border-radius:6px;padding:6px;font-size:10px;color:${color};">${alertMsg}</div>` : ''}
    </div>`
}

export function PatientMap({ selectedPatientId, onSelectPatient }) {
  const mapRef = useRef(null)       // DOM element
  const leafletRef = useRef(null)   // Leaflet map instance
  const markersRef = useRef({})     // patient id → { marker, circle }
  const [patients, setPatients] = useState([])
  const [error, setError] = useState(null)

  // ── Initialise Leaflet map once ──────────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current || leafletRef.current) return

    try {
      const map = L.map(mapRef.current, {
        center: [37.7749, -122.4194],
        zoom: 13,
        zoomControl: true,
        attributionControl: true,
      })

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap',
        maxZoom: 19,
      }).addTo(map)

      // Hospital marker
      L.marker([HOSPITAL.lat, HOSPITAL.lng], { icon: makeHospitalIcon() })
        .addTo(map)
        .bindPopup(`<div style="background:#0D1629;border-radius:8px;padding:10px;color:#F0F4FF;font-family:DM Sans;">
          <p style="font-weight:600;margin:0;">🏥 ${HOSPITAL.name}</p>
          <p style="font-size:11px;color:#8B9FC4;margin:4px 0 0;">Attending: Dr. Kavitha Rao</p>
        </div>`)

      leafletRef.current = map

      // Force a size recalculate after mount
      setTimeout(() => map.invalidateSize(), 100)
    } catch (e) {
      setError(e.message)
    }

    return () => {
      if (leafletRef.current) {
        leafletRef.current.remove()
        leafletRef.current = null
        markersRef.current = {}
      }
    }
  }, [])

  // ── Load patients (with offline fallback) ───────────────────────────────────
  useEffect(() => {
    let cancelled = false
    const load = () =>
      fetchPatients().then(pts => {
        if (cancelled) return
        setPatients(pts.map(p => ({
          ...p,
          photo_initials: p.photo_initials || p.name?.split(' ').map(n => n[0]).join('') || '??',
          risk_score:    p.risk_score ?? p.current_vitals?.risk_score ?? 0,
          location:      p.location   ?? p.current_vitals?.location   ?? {},
          home_location: p.home_location ?? {},
        })))
      }).catch(() => {})
    load()
    const t = setInterval(load, 10000)
    return () => { cancelled = true; clearInterval(t) }
  }, [])

  // ── Place / update markers whenever patients change ──────────────────────────
  useEffect(() => {
    const map = leafletRef.current
    if (!map || patients.length === 0) return

    patients.forEach(patient => {
      const vitals = OFFLINE_VITALS[patient.id] || {}
      const loc = vitals.location || patient.location || {}
      if (!loc.lat || !loc.lng) return

      const score = vitals.risk_score ?? patient.risk_score ?? 0
      const isCritical = score >= 80 || vitals.alert?.type === 'critical'
      const icon = makePatientIcon(patient.photo_initials, score, isCritical)
      const popupContent = buildPopup(patient, vitals)

      const existing = markersRef.current[patient.id]
      if (existing) {
        // Update position + icon
        existing.marker.setLatLng([loc.lat, loc.lng])
        existing.marker.setIcon(icon)
        existing.marker.setPopupContent(popupContent)
        if (existing.circle && patient.home_location?.lat) {
          existing.circle.setLatLng([patient.home_location.lat, patient.home_location.lng])
        }
      } else {
        // Create new marker
        const marker = L.marker([loc.lat, loc.lng], { icon })
          .addTo(map)
          .bindPopup(popupContent, { maxWidth: 240 })
          .on('click', () => onSelectPatient?.(patient.id))

        let circle = null
        if (patient.home_location?.lat) {
          circle = L.circle(
            [patient.home_location.lat, patient.home_location.lng],
            {
              radius: 200,
              color: isCritical ? '#FF3B3B' : '#00D4FF',
              fillColor: isCritical ? '#FF3B3B' : '#00D4FF',
              fillOpacity: 0.04,
              opacity: 0.25,
              dashArray: '5 5',
              weight: 1,
            }
          ).addTo(map)
        }

        markersRef.current[patient.id] = { marker, circle }
      }
    })
  }, [patients, onSelectPatient])

  // ── Fly to selected patient ──────────────────────────────────────────────────
  useEffect(() => {
    const map = leafletRef.current
    if (!map || !selectedPatientId) return
    const entry = markersRef.current[selectedPatientId]
    if (entry) {
      const pos = entry.marker.getLatLng()
      map.flyTo(pos, 15, { duration: 1.2 })
      entry.marker.openPopup()
    }
  }, [selectedPatientId])

  if (error) {
    return (
      <div style={{
        width: '100%', height: '100%', display: 'flex', alignItems: 'center',
        justifyContent: 'center', background: '#0D1629', borderRadius: '12px',
        border: '1px solid #1E2D4A',
      }}>
        <p style={{ color: '#4A5F80', fontFamily: 'DM Mono', fontSize: '12px' }}>
          Map error: {error}
        </p>
      </div>
    )
  }

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      {/* Legend */}
      <div style={{
        position: 'absolute', top: 10, left: 10, zIndex: 1000,
        background: 'rgba(13,22,41,0.92)', border: '1px solid #1E2D4A',
        borderRadius: '10px', padding: '10px 12px', backdropFilter: 'blur(4px)',
      }}>
        <p style={{ fontSize: '9px', fontFamily: 'DM Mono', color: '#4A5F80', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>Risk Level</p>
        {[
          ['Critical', '#FF3B3B'], ['High', '#FF6B35'], ['Moderate', '#FF9500'],
          ['Low', '#00D4FF'], ['Stable', '#00FF9D'],
        ].map(([label, color]) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: color, flexShrink: 0 }} />
            <span style={{ fontSize: '11px', fontFamily: 'DM Mono', color: '#8B9FC4' }}>{label}</span>
          </div>
        ))}
      </div>

      {/* Patient count */}
      <div style={{
        position: 'absolute', top: 10, right: 10, zIndex: 1000,
        background: 'rgba(13,22,41,0.92)', border: '1px solid #1E2D4A',
        borderRadius: '10px', padding: '8px 12px', backdropFilter: 'blur(4px)',
      }}>
        <p style={{ fontSize: '11px', fontFamily: 'DM Mono', color: '#8B9FC4', margin: 0 }}>{patients.length} patients tracked</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
          <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#FF3B3B', animation: 'livePulse 1.5s ease-in-out infinite' }} />
          <span style={{ fontSize: '11px', fontFamily: 'DM Mono', color: '#FF3B3B' }}>LIVE</span>
        </div>
      </div>

      {/* Map container — pure DOM, Leaflet owns this element */}
      <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
    </div>
  )
}
