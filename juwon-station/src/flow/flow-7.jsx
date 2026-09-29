import { useState, useEffect } from 'react';
import { getWeather } from '../weatherApi';
import juwonLogo from '../assets/juwon-logo-bh.png';
import { useNavigate } from 'react-router-dom';
import './flow.css';
import whBackground from '../assets/wh_background.png';
import batteryIcon2 from '../assets/battery_icon2.png';
import subImg from '../assets/sub_img.png';

const STEPS = ['시작', '인증', '반납', '검사', '충전', '결제', '수령'];
const CURRENT_STEP = 6;
const SKY = {
	CLEAR: { icon: '☀️', text: '맑음' },
	CLOUDY: { icon: '⛅', text: '구름많음' },
	OVERCAST: { icon: '☁️', text: '흐림' },
	RAIN: { icon: '🌧️', text: '비' },
	SNOW: { icon: '🌨️', text: '눈' },
	SHOWER: { icon: '🌦️', text: '소나기' }, 
};

const WEATHER_POLL_MS = 10 * 60 * 1000;
const Ico = {
	/* 메인으로 — 집 */
	home: (
			<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
				<path d="M31.5852 16.5184L17.1866 0.506767C16.5802 -0.168922 15.4156 -0.168922 14.8092 0.506767L0.410565 16.5184C0.203674 16.7485 0.0678724 17.0337 0.0196022 17.3395C-0.028668 17.6453 0.0126625 17.9585 0.138591 18.2412C0.394566 18.8192 0.967313 19.1907 1.59925 19.1907H4.79895V30.3988C4.79895 30.8235 4.96751 31.2308 5.26754 31.531C5.56757 31.8313 5.9745 32 6.3988 32H11.1984C11.6227 32 12.0296 31.8313 12.3296 31.531C12.6296 31.2308 12.7982 30.8235 12.7982 30.3988V23.9942H19.1976V30.3988C19.1976 30.8235 19.3662 31.2308 19.6662 31.531C19.9662 31.8313 20.3731 32 20.7974 32H25.597C26.0213 32 26.4282 31.8313 26.7283 31.531C27.0283 31.2308 27.1968 30.8235 27.1968 30.3988V19.1907H30.3965C30.7064 19.192 31.0099 19.1031 31.2701 18.9348C31.5303 18.7664 31.736 18.5259 31.862 18.2427C31.988 17.9594 32.0289 17.6455 31.9798 17.3393C31.9306 17.0332 31.7936 16.7479 31.5852 16.5184Z" fill="#323232"/>
			</svg>
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
};

/* ============================================================================
	 작은 컴포넌트들
	 ========================================================================== */

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

/* ============================================================================
	 메인
	 ========================================================================== */
export default function Flow7({ }) {
	const navigate = useNavigate();
	const [clock, setClock] = useState(() => new Date());
	const [weather, setWeather] = useState(null);
	const [weatherStale, setWeatherStale] = useState(false);

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
			} catch (e) {
				if (!alive) return;
				setWeatherStale(true);
			}
		};
		tick();
		const t = setInterval(tick, WEATHER_POLL_MS);
		return () => {
			alive = false;
			clearInterval(t);
		};
	}, []);

	const w = '일월화수목금토'[clock.getDay()];
	const hh = clock.getHours();
	const time = `${hh < 12 ? 'AM' : 'PM'} ${((hh + 11) % 12) + 1}:${String(clock.getMinutes()).padStart(2, '0')}`;

	return (
		<div className="flow_7 flow">
			<div className="kiosk__glow" />
			{/* ── 헤더 ── */}
			<header className="hdr">
				
				<div className="hdr_home">
					<span className="icon">{Ico.home}</span>
					<span className="text">HOME</span>
				</div>
				<div className="hdr__center">
					<img className="hdr__logo" src={juwonLogo} alt="JUWON 주원" />
				</div>
				<WeatherBadge weather={weather} stale={weatherStale} />
				<div className="hdr__clock">
					<div className="hdr__time">{time}</div>
				</div>
				<div className="hdr__status">
					<span className="pill">
						{Ico.wifi}
					</span>
					<span className="pill">
						{Ico.fail}
					</span>
				</div>
			</header>
			<StepBar />
		
			{/* ── 본문 ── */}
			<div className="kiosk__body">
				<section className="dash flow_8__dash">
					<img
						className="dash__background"
						src={whBackground}
						alt=""
					/>

					<div className="flow_7__content">

						{/* ── 왼쪽 영역 ── */}
						<div className="flow_7__left">

							{/* 제목 / 안내 */}
							<div className="flow_7__header">
								<div className="flow_7__title">
									결제가 완료되었습니다.
								</div>

								<div className="flow_7__subtitle">
									완충된 배터리를 회수 후 확인버튼을 누르세요.
								</div>
							</div>

							{/* 배터리 잔량 */}
							<div className="flow_7__battery-box">
								<img
									className="flow_7__battery-icon"
									src={batteryIcon2}
									alt=""
								/>

								<span className="flow_7__battery-percent">
									100%
								</span>
							</div>

							{/* 배터리 준비 상태 */}
							<div className="flow_7__ready-text">
								100% 배터리가 준비되었습니다.
							</div>

						</div>

						{/* ── 오른쪽 영역 ── */}
						<div className="flow_7__right">
							<img
								className="flow_7__sub-image"
								src={subImg}
								alt=""
							/>
						</div>

					</div>
				</section>
			</div>

			{/* ── 하단 액션 ── */}
			<div className="actions" onClick={() => navigate('/flow/flow-8')}>
				확인
			</div>
		</div>
	);
}
