import type L from 'leaflet'
/** App(패널)에서 지도 화면 범위·이동에 접근하기 위한 참조 */
export const mapRef: { current: L.Map | null } = { current: null }
