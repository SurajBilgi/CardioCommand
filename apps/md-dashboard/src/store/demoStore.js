import { create } from 'zustand'

export const useDemoStore = create((set, get) => ({
  selectedPatientId: 'john-mercer',
  patients: [],
  currentVitals: {},
  alerts: [],

  setSelectedPatient: (id) => set({ selectedPatientId: id }),
  setPatients: (patients) => set({ patients }),
  updateVitals: (patientId, vitals) =>
    set(state => ({
      currentVitals: { ...state.currentVitals, [patientId]: vitals },
    })),
  addAlert: (alert) =>
    set(state => ({
      alerts: [{ ...alert, id: Date.now(), timestamp: new Date().toISOString() }, ...state.alerts].slice(0, 20),
    })),
  dismissAlert: (id) =>
    set(state => ({ alerts: state.alerts.filter(a => a.id !== id) })),
  clearAlerts: () => set({ alerts: [] }),
}))
