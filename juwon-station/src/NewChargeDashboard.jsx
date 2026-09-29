import { useState, useEffect, useRef, useCallback } from 'react';
import { getWeather, WEATHER_PROVIDER } from './weatherApi';
import juwonLogo from './assets/juwon-logo-bh.png';
import commonArrow from './assets/common_arrow.png';
import caseImage from './assets/case.png';
import chargeImage from './assets/charge.png';
import brChargeImage from './assets/br_charge.png';
import connectFail from './assets/connect_fail.png';
import whBackground from './assets/wh_background.png';
import { useNavigate } from 'react-router-dom';
import './newkiosk.css';

/* ============================================================================
   5(충전) — 스테이션 충전 대시보드
   ----------------------------------------------------------------------------
   ★ 보이는 것(색·크기·간격)은 전부 kiosk.css 에 있습니다.

     1번 : 좌/우 스테이션 전환
     2번 : 하단 탭 (1번과 동일 기능)
     3번 : 메인으로 → 1(초기화면)
     4번 : 슬롯별 충전 시작/중지 (CAN ON/OFF)
     5번 : 결제하기 → 6-1(결제-선택)
   ========================================================================== */

const STEPS = ['시작', '인증', '반납', '검사', '충전', '결제', '수령'];
const CURRENT_STEP = 5;

/* CAN 통신 — 충전모드 (PPT 슬라이드 12) */
const MODE_LABEL = {
	IDLE: 'OFF(대기)',
	CHARGING: '충전중',
	DONE: '충전완료',
	EMPTY: '미연결',
};

const SKY = {
	CLEAR: { icon: '☀️', text: '맑음' },
	CLOUDY: { icon: '⛅', text: '구름많음' },
	OVERCAST: { icon: '☁️', text: '흐림' },
	RAIN: { icon: '🌧️', text: '비' },
	SNOW: { icon: '🌨️', text: '눈' },
	SHOWER: { icon: '🌦️', text: '소나기' },
};

/* ============================================================================
   API 레이어
   ----------------------------------------------------------------------------
   TRANSPORT 로 통신 방식을 고릅니다.
     'mock' : 서버 없이 화면 확인
     'http' : 파이썬 서버에 폴링
     'ws'   : 웹소켓 구독 — CAN 프레임이 올 때마다 즉시 갱신 (권장)

   스테이션·슬롯 개수는 코드에 박혀 있지 않습니다.
   서버가 내려주는 stations 배열을 그대로 그립니다.
   ========================================================================== */
const TRANSPORT = 'mock';
const API_BASE = 'http://localhost:8000';
const WS_URL = 'ws://localhost:8000/ws/stations';
const POLL_MS = 1000;
const WEATHER_POLL_MS = 10 * 60 * 1000;

const initialData = {
	stations: [
		{
			id: 'MASTER',
			name: 'MASTER',
			slots: [
				{ no: 1, present: true, mode: 'CHARGING', soc: 72, volt: 54.2, curr: 8.6, temp: 31.5 },
				{ no: 2, present: true, mode: 'DONE', soc: 100, volt: 54.6, curr: 0.0, temp: 28.0 },
			],
		},
		{
			id: 'STATION1',
			name: 'STATION 1',
			slots: [
				{ no: 1, present: true, mode: 'CHARGING', soc: 45, volt: 51.2, curr: 8.1, temp: 29.8 },
				{ no: 2, present: false, mode: 'EMPTY', soc: 0, volt: 0.0, curr: 0.0, temp: 0.0 },
			],
		},
		{
			id: 'STATION2',
			name: 'STATION 2',
			slots: [
				{ no: 1, present: true, mode: 'IDLE', soc: 88, volt: 53.4, curr: 0.0, temp: 27.1 },
				{ no: 2, present: true, mode: 'DONE', soc: 100, volt: 54.5, curr: 0.0, temp: 26.6 },
			],
		},
		{
			id: 'STATION3',
			name: 'STATION 3',
			slots: [
				{ no: 1, present: false, mode: 'EMPTY', soc: 0, volt: 0.0, curr: 0.0, temp: 0.0 },
				{ no: 2, present: true, mode: 'CHARGING', soc: 33, volt: 50.3, curr: 8.8, temp: 32.4 },
			],
		},
	],
};

/* MOCK: CAN 값 변동 흉내 — 실연동 시 이 객체만 삭제 */
const mockStore = { data: structuredClone(initialData) };
const mock = {
	getStations() {
		const now = Date.now();
		mockStore.data.stations.forEach(s =>
			s.slots.forEach(sl => {
				/* 충전 진행 */
				if (sl.mode === 'CHARGING') {
					sl.soc = Math.min(100, +(sl.soc + 0.4).toFixed(1));
					sl.volt = +(48 + sl.soc * 0.07 + (Math.random() - 0.5) * 0.2).toFixed(1);
					sl.curr = +(8.6 + (Math.random() - 0.5) * 0.6).toFixed(1);
					sl.temp = +(30 + Math.random() * 2).toFixed(1);
					if (sl.soc >= 100) {
						sl.mode = 'DONE';
						sl.curr = 0.0;
						sl._t = now;
					}
					return;
				}

				/* [MOCK 전용] 완충 12초 뒤 사용자가 배터리를 수령한 것으로 봅니다.
           그 6초 뒤 방전된 배터리가 들어와 다시 대기 상태가 됩니다.
           이게 없으면 모든 슬롯이 100%로 굳어 데모에서 아무것도 눌리지 않습니다.
           실서버에서는 CAN 이 읽어온 실제 상태가 오므로 이 블록은 필요 없습니다. */
				if (sl.mode === 'DONE' && now - (sl._t ?? now) > 12000) {
					Object.assign(sl, { mode: 'EMPTY', present: false, soc: 0, volt: 0, curr: 0, temp: 0, _t: now });
					return;
				}
				if (sl.mode === 'EMPTY' && now - (sl._t ?? now) > 6000) {
					Object.assign(sl, {
						mode: 'IDLE',
						present: true,
						_t: now,
						soc: +(12 + Math.random() * 25).toFixed(1),
						volt: +(47 + Math.random() * 2).toFixed(1),
						curr: 0.0,
						temp: +(24 + Math.random() * 3).toFixed(1),
					});
				}
			})
		);
		return structuredClone(mockStore.data);
	},

	setCharge(sid, slot, on) {
		const st = mockStore.data.stations.find(x => x.id === sid);
		const sl = st?.slots.find(x => x.no === slot);
		if (!sl?.present) return { ok: false, reason: 'NO_BATTERY' };
		if (on && sl.soc >= 100) return { ok: false, reason: 'ALREADY_FULL' };
		sl.mode = on ? 'CHARGING' : 'IDLE';
		if (!on) sl.curr = 0.0;
		return { ok: true, mode: sl.mode };
	},
};

function makeApi(log) {
	return {
		/* GET /api/stations → 스테이션·슬롯 CAN 상태 */
		async getStations() {
			if (TRANSPORT === 'mock') {
				const r = mock.getStations();
				log('GET', '/api/stations', null, r);
				return r;
			}
			const r = await fetch(`${API_BASE}/api/stations`).then(x => x.json());
			log('GET', '/api/stations', null, r);
			return r;
		},

		/* POST /api/stations/:sid/slots/:no/charge { on } → CAN 충전 ON/OFF */
		async setCharge(sid, no, on) {
			const path = `/api/stations/${sid}/slots/${no}/charge`;
			if (TRANSPORT === 'mock') {
				const r = mock.setCharge(sid, no, on);
				log('POST', path, { on }, r);
				return r;
			}
			const r = await fetch(`${API_BASE}${path}`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ on }),
			}).then(x => x.json());
			log('POST', path, { on }, r);
			return r;
		},

		/* 상태 구독. onData(stations) 를 호출하고 해제 함수를 돌려줍니다. */
		subscribe(onData) {
			if (TRANSPORT === 'ws') {
				let closed = false;
				let ws;
				let retry;
				const connect = () => {
					ws = new WebSocket(WS_URL);
					ws.onopen = () => log('WS', 'open', null, { url: WS_URL });
					ws.onmessage = ev => {
						try {
							const d = JSON.parse(ev.data);
							if (d?.stations) onData(d.stations);
						} catch (e) {
							log('WS', 'parse-error', null, { error: String(e.message ?? e) });
						}
					};
					ws.onclose = () => {
						if (closed) return;
						log('WS', 'closed — 3초 후 재연결', null, {});
						retry = setTimeout(connect, 3000);
					};
					ws.onerror = () => ws.close();
				};
				connect();
				return () => {
					closed = true;
					clearTimeout(retry);
					ws?.close();
				};
			}

			let alive = true;
			const tick = async () => {
				try {
					const d = await this.getStations();
					if (alive && d?.stations) onData(d.stations);
				} catch (e) {
					if (alive) log('GET', '/api/stations', null, { error: String(e.message ?? e) });
				}
			};
			tick();
			const t = setInterval(tick, POLL_MS);
			return () => {
				alive = false;
				clearInterval(t);
			};
		},
	};
}

/* ============================================================================
   아이콘 — 원본 화면과 동일한 모양 (외부 패키지 불필요)
   크기와 색은 CSS 가 정합니다 (width/height 100%, currentColor)
   ========================================================================== */
const Svg = ({ children, filled }) => (
	<svg
		viewBox="0 0 24 24"
		width="1em"
		height="1em"
		aria-hidden="true"
		fill={filled ? 'currentColor' : 'none'}
		stroke={filled ? 'none' : 'currentColor'}
		strokeWidth="2"
		strokeLinecap="round"
		strokeLinejoin="round"
	>
		{children}
	</svg>
);

const Ico = {
	/* 전압 — 온도계 아웃라인 */
	volt: (
		<Svg>
			<path d="M12 3a2.4 2.4 0 0 1 2.4 2.4v8.1a4.4 4.4 0 1 1-4.8 0V5.4A2.4 2.4 0 0 1 12 3z" />
		</Svg>
	),
	/* 전류 — 아치형 게이지 + 상향 바늘 */
	curr: (
		<Svg>
			<path d="M5 19a7 7 0 1 1 14 0" />
			<path d="M12 19v-8" />
			<path d="m9.6 13.2 2.4-2.4 2.4 2.4" />
		</Svg>
	),
	/* 온도 — 온도계 (구부 채움) */
	temp: (
		<Svg>
			<path d="M12 3a2.4 2.4 0 0 1 2.4 2.4v8.1a4.4 4.4 0 1 1-4.8 0V5.4A2.4 2.4 0 0 1 12 3z" />
			<path d="M12 8.5v6.5" strokeWidth="2.6" />
			<circle cx="12" cy="17.4" r="2.2" fill="currentColor" stroke="none" />
		</Svg>
	),
	/* 운영 슬롯 — 클립보드 목록 */
	slots: (
		<Svg>
			<rect x="4.5" y="4" width="14" height="17" rx="2.5" />
			<rect x="8.5" y="2" width="6" height="4" rx="1.4" />
			<path d="M8.5 10.5h6M8.5 14h6M8.5 17.5h3.5" />
		</Svg>
	),
	/* 충전중 — 세로 배터리 + 번개 */
	bolt: (
		<Svg>
			<rect x="7" y="5" width="10" height="16" rx="2.5" />
			<path d="M10 3h4" />
			<path d="M12.6 8.6 10 13h4l-2.6 4.4" />
		</Svg>
	),
	/* 완료 — 원형 체크 */
	check: (
		<Svg>
			<circle cx="12" cy="12" r="8.6" />
			<path d="m8.2 12 2.8 2.8 5-5.6" />
		</Svg>
	),
	/* 알람 — 종 */
	bell: (
		<Svg>
			<path d="M18 9.5a6 6 0 1 0-12 0c0 5.5-2.2 7.5-2.2 7.5h16.4S18 15 18 9.5" />
			<path d="M13.6 20a1.9 1.9 0 0 1-3.2 0" />
		</Svg>
	),
	/* 스와이프 안내 — 손 위에 좌우 화살표 */
	swipe: (
		<svg viewBox="0 0 34 30" width="1em" height="1em" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
			{/* 좌우 화살표 */}
			<path d="M6 5h22" />
			<path d="m9 2-3 3 3 3" />
			<path d="m25 2 3 3-3 3" />
			{/* 손 */}
			<g transform="translate(6.5 8.5) scale(0.88)">
				<path d="M18 11V6a2 2 0 0 0-4 0v5M14 10V4a2 2 0 0 0-4 0v7M10 10.5V6a2 2 0 0 0-4 0v8" />
				<path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2a8 8 0 0 1-8-8v-1a2 2 0 1 1 4 0" />
			</g>
		</svg>
	),
	/* 메인으로 — 집 */
	home: (
<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
		<path d="M31.5852 16.5184L17.1866 0.506767C16.5802 -0.168922 15.4156 -0.168922 14.8092 0.506767L0.410565 16.5184C0.203674 16.7485 0.0678724 17.0337 0.0196022 17.3395C-0.028668 17.6453 0.0126625 17.9585 0.138591 18.2412C0.394566 18.8192 0.967313 19.1907 1.59925 19.1907H4.79895V30.3988C4.79895 30.8235 4.96751 31.2308 5.26754 31.531C5.56757 31.8313 5.9745 32 6.3988 32H11.1984C11.6227 32 12.0296 31.8313 12.3296 31.531C12.6296 31.2308 12.7982 30.8235 12.7982 30.3988V23.9942H19.1976V30.3988C19.1976 30.8235 19.3662 31.2308 19.6662 31.531C19.9662 31.8313 20.3731 32 20.7974 32H25.597C26.0213 32 26.4282 31.8313 26.7283 31.531C27.0283 31.2308 27.1968 30.8235 27.1968 30.3988V19.1907H30.3965C30.7064 19.192 31.0099 19.1031 31.2701 18.9348C31.5303 18.7664 31.736 18.5259 31.862 18.2427C31.988 17.9594 32.0289 17.6455 31.9798 17.3393C31.9306 17.0332 31.7936 16.7479 31.5852 16.5184Z" fill="#323232"/>
</svg>

	),
	/* 결제하기 — 카드 */
	pay: (
		<Svg>
			<rect x="2.5" y="5" width="19" height="14" rx="2.5" />
			<path d="M2.5 10h19" />
			<path d="M6 14.5h3.5" />
		</Svg>
	),
	/* 상세 보기 — 클립보드 */
	detail: (
		<Svg>
			<rect x="5.5" y="4" width="13" height="17" rx="2.5" />
			<rect x="9" y="2" width="6" height="4" rx="1.4" />
			<path d="M9 10.5h6M9 14h6M9 17.5h6" />
		</Svg>
	),
	/* 네트워크 — 와이파이 */
	wifi: (
	<svg width="33" height="27" viewBox="0 0 33 27" fill="none" xmlns="http://www.w3.org/2000/svg">
			<path d="M10.0333 17.4841C10.8098 16.6515 11.7486 15.9868 12.7919 15.531C13.8352 15.0753 14.9608 14.8381 16.0993 14.8342C17.2378 14.8303 18.365 15.0597 19.4114 15.5083C20.4578 15.9569 21.4012 16.6152 22.1833 17.4425M6.37667 12.4075C7.619 11.0752 9.12114 10.0117 10.7904 9.2825C12.4597 8.55328 14.2607 8.17385 16.0822 8.1676C17.9038 8.16135 19.7074 8.52843 21.3816 9.24618C23.0558 9.96392 24.5652 11.0171 25.8167 12.3408M1.5 7.86079C3.36352 5.8622 5.61683 4.26668 8.12089 3.17271C10.6249 2.07873 13.3266 1.50949 16.0592 1.50012C18.7918 1.49075 21.4973 2.04144 24.0088 3.11822C26.5203 4.195 28.7845 5.77502 30.6617 7.76078M16.1283 24.8341C15.6863 24.8341 15.2624 24.6585 14.9498 24.346C14.6373 24.0334 14.4617 23.6095 14.4617 23.1675C14.4617 22.7254 14.6373 22.3015 14.9498 21.9889C15.2624 21.6764 15.6863 21.5008 16.1283 21.5008C16.5704 21.5008 16.9943 21.6764 17.3068 21.9889C17.6194 22.3015 17.795 22.7254 17.795 23.1675C17.795 23.6095 17.6194 24.0334 17.3068 24.346C16.9943 24.6585 16.5704 24.8341 16.1283 24.8341Z" stroke="#008834" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
	</svg>
	),

	/*추가된 아이콘 fail ?*/ 
	fail: (
	<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
	<path d="M12 6.75V5C12 4.46957 12.2107 3.96086 12.5858 3.58579C12.9609 3.21071 13.4696 3 14 3H18C18.5304 3 19.0391 3.21071 19.4142 3.58579C19.7893 3.96086 20 4.46957 20 5V9C20 9.53043 19.7893 10.0391 19.4142 10.4142C19.0391 10.7893 18.5304 11 18 11H15.9513C15.686 11 15.4317 10.8946 15.2441 10.7071C15.0566 10.5196 14.9513 10.2652 14.9513 10C14.9513 9.73478 15.0566 9.48043 15.2441 9.29289C15.4317 9.10536 15.686 9 15.9513 9H18V5H14V6.75C14 7.01522 13.8946 7.26957 13.7071 7.45711C13.5196 7.64464 13.2652 7.75 13 7.75C12.7348 7.75 12.4804 7.64464 12.2929 7.45711C12.1054 7.26957 12 7.01522 12 6.75ZM26.74 26.3275C26.8302 26.4244 26.9002 26.5381 26.9461 26.6623C26.9919 26.7864 27.0127 26.9184 27.0072 27.0506C27.0017 27.1828 26.97 27.3126 26.9139 27.4325C26.8578 27.5524 26.7785 27.6599 26.6806 27.7489C26.5827 27.8379 26.4681 27.9066 26.3434 27.951C26.2187 27.9953 26.0865 28.0145 25.9543 28.0074C25.8222 28.0003 25.6928 27.9671 25.5736 27.9096C25.4544 27.8521 25.3478 27.7715 25.26 27.6725L14.6488 16H9V20H10C10.5304 20 11.0391 20.2107 11.4142 20.5858C11.7893 20.9609 12 21.4696 12 22V26C12 26.5304 11.7893 27.0391 11.4142 27.4142C11.0391 27.7893 10.5304 28 10 28H6C5.46957 28 4.96086 27.7893 4.58579 27.4142C4.21071 27.0391 4 26.5304 4 26V22C4 21.4696 4.21071 20.9609 4.58579 20.5858C4.96086 20.2107 5.46957 20 6 20H7V16H3C2.73478 16 2.48043 15.8946 2.29289 15.7071C2.10536 15.5196 2 15.2652 2 15C2 14.7348 2.10536 14.4804 2.29289 14.2929C2.48043 14.1054 2.73478 14 3 14H12.83L5.26 5.6725C5.16983 5.57564 5.09979 5.46185 5.05392 5.33772C5.00806 5.2136 4.98728 5.0816 4.99281 4.94938C4.99833 4.81717 5.03004 4.68736 5.0861 4.56749C5.14216 4.44762 5.22146 4.34007 5.31939 4.25107C5.41732 4.16208 5.53194 4.0934 5.65661 4.04902C5.78128 4.00465 5.91352 3.98546 6.04566 3.99257C6.1778 3.99968 6.30721 4.03294 6.4264 4.09044C6.54559 4.14793 6.65218 4.22851 6.74 4.3275L26.74 26.3275ZM10 22H6V26H10V22ZM29 14H20.5C20.2348 14 19.9804 14.1054 19.7929 14.2929C19.6054 14.4804 19.5 14.7348 19.5 15C19.5 15.2652 19.6054 15.5196 19.7929 15.7071C19.9804 15.8946 20.2348 16 20.5 16H23V18.8538C23 19.119 23.1054 19.3733 23.2929 19.5609C23.4804 19.7484 23.7348 19.8538 24 19.8538C24.2652 19.8538 24.5196 19.7484 24.7071 19.5609C24.8946 19.3733 25 19.119 25 18.8538V16H29C29.2652 16 29.5196 15.8946 29.7071 15.7071C29.8946 15.5196 30 15.2652 30 15C30 14.7348 29.8946 14.4804 29.7071 14.2929C29.5196 14.1054 29.2652 14 29 14Z" fill="#D50E0E"/>
	</svg>
	),

	/* CAN 통신 — 계층형 노드 */
	can: (
		<Svg>
			<rect x="9.2" y="2.5" width="5.6" height="4.6" rx="1.2" />
			<rect x="2" y="16.9" width="5.2" height="4.6" rx="1.2" />
			<rect x="9.4" y="16.9" width="5.2" height="4.6" rx="1.2" />
			<rect x="16.8" y="16.9" width="5.2" height="4.6" rx="1.2" />
			<path d="M12 7.1v4.6M4.6 16.9v-5.2h14.8v5.2M12 11.7v5.2" />
		</Svg>
	),
	/* 배터리 내부 — 충전중 번개 / 완료 체크 */
	boltFill: (
		<Svg filled>
			<path d="M13 2 4 14h7l-1 8 9-12h-7z" />
		</Svg>
	),
	checkBig: (
		<Svg>
			<circle cx="12" cy="12" r="9" fill="rgba(0,0,0,.25)" />
			<path d="m8 12 3 3 5-6" />
		</Svg>
	),
	/* 충전 버튼 */
	boltSmall: (
		<Svg filled>
			<path d="M13 2 4 14h7l-1 8 9-12h-7z" />
		</Svg>
	),
	pause: (
		<Svg filled>
			<rect x="7" y="4" width="3.5" height="16" rx="1" />
			<rect x="13.5" y="4" width="3.5" height="16" rx="1" />
		</Svg>
	),
};

/* 사이드 패널의 미니 스테이션 — 실물 형태 + 슬롯별 충전 상태 표시 */
const StationGlyph = ({ slots = [] }) => (
	<svg className="sg" viewBox="0 0 62 74" aria-hidden="true">
		<path className="sg__top" d="M9 12 14 5.5h34L53 12Z" />
		<rect className="sg__body" x="9" y="12" width="44" height="56" rx="4" />
		<rect className="sg__label" x="14" y="15.5" width="34" height="5" rx="2" />
		<rect className="sg__bay" x="13.5" y="25" width="15" height="35" rx="3" />
		<rect className="sg__bay" x="33.5" y="25" width="15" height="35" rx="3" />
		{[18.5, 38.5].map((x, i) => (
			<g className="sg__batt" data-mode={slots[i]?.mode ?? 'EMPTY'} key={x}>
				<rect x={x} y="31" width="5" height="21.5" rx="1.6" />
				<rect x={x + 1.3} y="28.8" width="2.4" height="2.8" rx=".8" />
			</g>
		))}
	</svg>
);

/* ============================================================================
   작은 컴포넌트들
   ========================================================================== */

const Marker = ({ n, style }) => (
	<span className="marker" style={style}>
		{n}
	</span>
);

function StepBar() {
	return (
		<nav className="steps" aria-label="진행 단계">
			{STEPS.map((label, i) => {
				const n = i + 1;
				const state = n === CURRENT_STEP ? 'on' : n < CURRENT_STEP ? 'done' : 'todo';
				return (
					<div key={label} style={{ display: 'contents' }}>
						{i > 0 && <span className="step__bar" data-done={n <= CURRENT_STEP} />}
						<div className="step" data-state={state}>
							<span className="step__num">{n}</span>
							<span className="step__label">{label}</span>
						</div>
					</div>
				);
			})}
		</nav>
	);
}

function SlotCard({ slot, onToggle, showMarkers, busy }) {
	const charging = slot.mode === 'CHARGING';
	const full = slot.mode === 'DONE';

	const disabled = !slot.present || full || busy;

	/* CAN 통신 — 충전상태 : 충전 전압 XX.X V / 충전 전류 X.X A / 내부 온도 XX.X ℃ */
	const rows = [
		['충전 전압', slot.volt.toFixed(1), 'V'],
		['충전 전류', slot.curr.toFixed(1), 'A'],
		['내부 온도', slot.temp.toFixed(1), '℃'],
	];

	const fillHeight = Math.min(slot.soc * 3.18, 318);

	return (
		
		<article className="slot" data-mode={slot.mode}>
			<header className="slot__head">
				<h3 className="slot__name">SLOT {slot.no}</h3>
			</header>
			<div className="slot__content">

				{/* 왼쪽 : 배터리 */}
				<div className="battery-test">

					{slot.soc > 0 && (
						<div
							className={`battery-test__fill battery-test__fill--${
								slot.soc <= 33
									? 'red'
									: slot.soc <= 66
										? 'yellow'
										: slot.soc < 100
											? 'green'
											: 'blue'
							}`}
							style={{ height: `${fillHeight}px` }}
						/>
					)}

					<img
						className="battery-test__case"
						src={caseImage}
						alt=""
					/>

					{/* 0%면 br_charge, 그 외에는 charge */}
					<img
						className="battery-test__charge"
						src={slot.soc === 0 ? brChargeImage : chargeImage}
						alt=""
					/>

					{/* 0%면 숫자 색상 변경 */}
					<div
						className="battery-test__pct"
						style={{
							color: slot.soc === 0 ? '#605F5F' : undefined,
						}}
					>
						{Math.round(slot.soc)}%
					</div>

				</div>


				{/* 오른쪽 : 충전 버튼 + CAN */}
				<div className="slot__charge-area">

					{/* 충전 버튼 */}
					<button
							className={`charge-button ${
								!slot.present
									? 'charge-button--disconnected'
									: `charge-button--${
										slot.soc <= 33
											? 'red'
											: slot.soc <= 66
												? 'yellow'
												: slot.soc < 100
													? 'green'
													: 'blue'
									}`
							}`}
						onClick={() => onToggle(slot.no, !charging)}
						disabled={disabled}
					>
						<div className="charge-button__content">
							<img
								className="charge-button__charge"
								src={!slot.present ? connectFail : chargeImage}
								alt=""
							/>

							<span className="charge-button__text">
								{!slot.present ? '미연결' : '충전 시작'}
							</span>
						</div>
					</button>


					{/* CAN 값 */}
					<dl className="can">
						{rows.map(([key, val, unit]) => (
							<div className="can__row" key={key}>
								<dd className="can__val">
									<span className="can__key">{key}</span>
									<span className="can__number">{val}</span>
									<span className="can__unit">{unit}</span>
								</dd>
							</div>
						))}
					</dl>

				</div>

			</div>

		</article>
	);

}

function WeatherBadge({ weather, stale }) {
	if (!weather) return <div className="weather__loading">날씨 불러오는 중…</div>;
	const s = SKY[weather.sky] ?? SKY.CLEAR;
	return (
		<div className={`weather${stale ? ' weather--stale' : ''}`}>
			<span className="weather__ico">{s.icon}</span>
			<div className="weather__now">
				<div className="weather__temp">{weather.temp.toFixed(0)}°C</div>
			</div>
		</div>
	);
}

const Summary = ({ icon, label, value, tone }) => (
	<div className="sum" style={{ '--tone': tone }}>
		{icon}
		<div>
			<div className="sum__k">{label}</div>
			<div className="sum__v">{value}</div>
		</div>
	</div>
);

/* ============================================================================
   메인
   ========================================================================== */
export default function ChargeDashboard({ onGoMain, onGoPayment }) {
	const navigate = useNavigate();
	const [stations, setStations] = useState(initialData.stations);
	const [idx, setIdx] = useState(0);
	const [pending, setPending] = useState(null);
	const [logs, setLogs] = useState([]);
	const [logOpen, setLogOpen] = useState(false);
	const [showMarkers, setShowMarkers] = useState(false);
	const [clock, setClock] = useState(() => new Date());
	const [weather, setWeather] = useState(null);
	const [weatherStale, setWeatherStale] = useState(false);
	const stripRef = useRef(null);
	const dragX = useRef(null);

	const log = useCallback((method, path, payload, res) => {
		setLogs(prev =>
			[
				{
					id: `${Date.now()}-${Math.random()}`,
					method,
					path,
					payload: payload ? JSON.stringify(payload) : null,
					res: JSON.stringify(res).slice(0, 200),
					at: new Date().toLocaleTimeString('ko-KR', { hour12: false }),
				},
				...prev,
			].slice(0, 60)
		);
	}, []);

	const [api] = useState(() => makeApi(log));

	/* CAN 상태 구독 (ws면 push, 아니면 폴링) */
	useEffect(() => api.subscribe(setStations), [api]);

	/* 시계 */
	useEffect(() => {
		const t = setInterval(() => setClock(new Date()), 1000);
		return () => clearInterval(t);
	}, []);

	/* 날씨 — 프론트에서 외부 API 직접 호출 (10분 주기) */
	useEffect(() => {
		let alive = true;
		const tick = async () => {
			const t0 = performance.now();
			try {
				const d = await getWeather();
				if (!alive) return;
				setWeather(d);
				setWeatherStale(false);
				log('GET', `weather(${WEATHER_PROVIDER}) ${Math.round(performance.now() - t0)}ms`, null, d);
			} catch (e) {
				if (!alive) return;
				setWeatherStale(true);
				log('GET', `weather(${WEATHER_PROVIDER})`, null, { error: String(e.message ?? e) });
			}
		};
		tick();
		const t = setInterval(tick, WEATHER_POLL_MS);
		return () => {
			alive = false;
			clearInterval(t);
		};
	}, [log]);

	const station = stations[idx] ?? stations[0];
	const move = useCallback(d => setIdx(i => Math.min(stations.length - 1, Math.max(0, i + d))), [stations.length]);
	const atFirst = idx === 0;
	const atLast = idx === stations.length - 1;

	/* 방향키로 스테이션 이동 + 검토용 단축키
     Ctrl+Shift+L : API 로그 / Ctrl+Shift+M : 버튼 번호 */
	useEffect(() => {
		const onKey = e => {
			if (e.ctrlKey && e.shiftKey) {
				const k = e.key.toLowerCase();
				if (k === 'l') {
					e.preventDefault();
					setLogOpen(v => !v);
				}
				if (k === 'm') {
					e.preventDefault();
					setShowMarkers(v => !v);
				}
				return;
			}
			if (e.key === 'ArrowLeft') move(-1);
			if (e.key === 'ArrowRight') move(1);
		};
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	}, [move]);

	/* 사이드 스트립에서 현재 스테이션이 항상 보이도록 자동 스크롤 */
	useEffect(() => {
		const el = stripRef.current?.querySelector('[aria-current="true"]');
		el?.scrollIntoView({ block: 'nearest', inline: 'center' });
	}, [idx]);

	/* 좌우 스와이프 (터치·마우스 공통) */
	const onPointerDown = e => {
		dragX.current = e.clientX;
	};
	const onPointerUp = e => {
		if (dragX.current === null) return;
		const dx = e.clientX - dragX.current;
		dragX.current = null;
		if (Math.abs(dx) > 60) move(dx < 0 ? 1 : -1);
	};

	/* 4번 버튼 — CAN 충전 ON/OFF.
     왕복 지연 중 연타로 ON/OFF가 꼬이지 않게 요청 중에는 잠급니다. */
	const handleToggle = async (slotNo, on) => {
		if (pending) return;
		setPending(`${station.id}:${slotNo}`);

		/* 실제 잔량은 곧 도착하는 CAN 값으로 덮어써집니다. */
		setStations(prev =>
			prev.map(s =>
				s.id !== station.id
					? s
					: {
							...s,
							slots: s.slots.map(sl => (sl.no !== slotNo ? sl : { ...sl, mode: on ? 'CHARGING' : 'IDLE', curr: on ? sl.curr : 0 })),
						}
			)
		);

		try {
			const r = await api.setCharge(station.id, slotNo, on);
			if (r?.ok === false) {
				const d = await api.getStations();
				if (d?.stations) setStations(d.stations);
			}
		} finally {
			setPending(null);
		}
	};

	const present = station.slots.filter(s => s.present).length;
	const charging = station.slots.filter(s => s.mode === 'CHARGING').length;
	const done = station.slots.filter(s => s.mode === 'DONE').length;

	const w = '일월화수목금토'[clock.getDay()];
	const hh = clock.getHours();
	const time = `${hh < 12 ? 'AM' : 'PM'} ${((hh + 11) % 12) + 1}:${String(clock.getMinutes()).padStart(2, '0')}`;

	return (
		<div className="new-kiosk">
			<div className="kiosk__glow" />
			{/* ── 헤더 ── */}
			<header className="hdr">
				
				<div className="hdr_home">
					<span className="icon">{Ico.home}</span>
					<span className="text">HOME</span>
				</div>
				<div className="hdr__center">
					<img className="hdr__logo" src={juwonLogo} alt="JUWON 주원" />
					{/* <div className="hdr__sub">현재 화면: {station.name}</div> */}
				</div>
				<WeatherBadge weather={weather} stale={weatherStale} />
				<div className="hdr__clock">
					{/* <div className="hdr__date">
						{clock.getFullYear()}. {clock.getMonth() + 1}. {clock.getDate()} ({w})
					</div> */}
					<div className="hdr__time">{time}</div>
				</div>
				<div className="hdr__status">
					<span className="pill">
						{Ico.wifi}
						{/* <span className="pill__text">네트워크 정상</span> */}
					</span>
					<span className="pill">
						{Ico.fail}
						{/* <span className="pill__text">CAN 통신 정상</span> */}
					</span>
				</div>
			</header>
			<StepBar />
			

			{/* ── 본문 ── */}
			<div className="kiosk__body" onPointerDown={onPointerDown} onPointerUp={onPointerUp}>
				{/* <img src={whBackground} alt="흰 배경이미지"></img> */}
				{/* 1번 — 이전 스테이션 */}
				<button className="arrow" onClick={() => move(-1)} disabled={atFirst} aria-label="이전 스테이션">
					{showMarkers && <Marker n={1} style={{ bottom: 0, left: '-6px' }} />}‹
					<img className="left-arrow" src={commonArrow} alt="공통 좌우측 버튼 영역" />
				</button>
				<section className="dash">
					    <img
									className="dash__background"
									src={whBackground}
									alt=""
							/>
					<div className="slots">
						{station.slots.map(s => (
							<SlotCard key={s.no} slot={s} onToggle={handleToggle} showMarkers={showMarkers} busy={pending === `${station.id}:${s.no}`} />
						))}
					</div>

				</section>

				{/* 1번 — 다음 스테이션 */}
				<button className="arrow" onClick={() => move(1)} disabled={atLast} aria-label="다음 스테이션">
					{showMarkers && <Marker n={1} style={{ bottom: 0, right: '-6px' }} />}›
					<img className="right-arrow" src={commonArrow} alt="공통 좌우측 버튼 영역" />
				</button>
						
			</div>

			{/* ── 2번 — 탭 ── */}
			<div className="tabs-area">
				<div className="tabs" role="tablist">
					{showMarkers && (
						<Marker n={2} style={{ top: '8px', right: '40px' }} />
					)}

					{stations.map((s, i) => (
						<button
							key={s.id}
							className="kbtn tab"
							role="tab"
							aria-selected={i === idx}
							onClick={() => setIdx(i)}
						>
							{s.name}
						</button>
					))}
				</div>

				{/* 확장 자리 */}
				<button className="kbtn tab tab--add" disabled aria-hidden="true">
					+
				</button>
			</div>
			{/* ── 하단 액션 (3번 메인으로 / 5번 결제하기) ── */}
			<div className="actions" onClick={() => navigate('/flow/flow-6')}>
					{Ico.pay} 결제하기
			</div>

			{/* ── API 로그 (검토용, Ctrl+Shift+L) ── */}
			{logOpen && (
				<div className="log">
					{logs.length === 0 && <div className="log__empty">호출 대기 중…</div>}
					{logs.map(l => (
						<div className="log__row" key={l.id}>
							<span className="log__at">{l.at}</span> <b className="log__method">{l.method}</b> {l.path}
							{l.payload && <div>&nbsp;&nbsp;→ {l.payload}</div>}
							<div className="log__res">&nbsp;&nbsp;← {l.res}</div>
						</div>
					))}
				</div>
			)}
		</div>
	);
}
