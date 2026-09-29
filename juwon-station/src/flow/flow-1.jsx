import { useState, useEffect, useRef, useCallback } from 'react';
import { getWeather, WEATHER_PROVIDER } from '../weatherApi';
import juwonLogo from '../assets/juwon-logo-bh.png';
import mainImage from '../assets/main_img.png';
import batteryIcon from '../assets/battery_icon1.png';
import canIcon from '../assets/can_icon.png';
import './flow.css';
import { useNavigate } from 'react-router-dom';

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
	/* 네트워크 — 와이파이 */
	wifi: (
	<svg width="33" height="27" viewBox="0 0 33 27" fill="none" xmlns="http://www.w3.org/2000/svg">
			<path d="M10.0333 17.4841C10.8098 16.6515 11.7486 15.9868 12.7919 15.531C13.8352 15.0753 14.9608 14.8381 16.0993 14.8342C17.2378 14.8303 18.365 15.0597 19.4114 15.5083C20.4578 15.9569 21.4012 16.6152 22.1833 17.4425M6.37667 12.4075C7.619 11.0752 9.12114 10.0117 10.7904 9.2825C12.4597 8.55328 14.2607 8.17385 16.0822 8.1676C17.9038 8.16135 19.7074 8.52843 21.3816 9.24618C23.0558 9.96392 24.5652 11.0171 25.8167 12.3408M1.5 7.86079C3.36352 5.8622 5.61683 4.26668 8.12089 3.17271C10.6249 2.07873 13.3266 1.50949 16.0592 1.50012C18.7918 1.49075 21.4973 2.04144 24.0088 3.11822C26.5203 4.195 28.7845 5.77502 30.6617 7.76078M16.1283 24.8341C15.6863 24.8341 15.2624 24.6585 14.9498 24.346C14.6373 24.0334 14.4617 23.6095 14.4617 23.1675C14.4617 22.7254 14.6373 22.3015 14.9498 21.9889C15.2624 21.6764 15.6863 21.5008 16.1283 21.5008C16.5704 21.5008 16.9943 21.6764 17.3068 21.9889C17.6194 22.3015 17.795 22.7254 17.795 23.1675C17.795 23.6095 17.6194 24.0334 17.3068 24.346C16.9943 24.6585 16.5704 24.8341 16.1283 24.8341Z" stroke="#008834" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
	</svg>
	),
};


/* ============================================================================
	 메인
	 ========================================================================== */
export default function Flow1({ onGoMain, onGoPayment }) {
	const navigate = useNavigate();
	const [clock, setClock] = useState(() => new Date());
	const [weather, setWeather] = useState(null);

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
	}, []);

	const w = '일월화수목금토'[clock.getDay()];
	const hh = clock.getHours();
	const time = `${hh < 12 ? 'AM' : 'PM'} ${((hh + 11) % 12) + 1}:${String(clock.getMinutes()).padStart(2, '0')}`;

	return (
		<div className="flow_1 flow">
			<div className="kiosk__glow" />
			{/* ── 헤더 ── */}
			<header className="hdr">
				<div className="flow_hdr_clock">
					<div className="hdr__time">{clock.getFullYear()}년 {clock.getMonth() + 1}월 {clock.getDate()}일 ({w})    {time}</div>
				</div>
			</header>
			{/* ── 본문 ── */}
			<div className="kiosk__body">
				<section className="flow-main">
					{/* 왼쪽 영역 */}
					<div className="flow-main__left">
						<img
							className="flow-main__logo"
							src={juwonLogo}
							alt="주원"
						/>

						<div className="flow-main__english">
							E-Bike Swap Station
						</div>

						<div className="flow-main__title">
							<span>전기이륜차</span>
							<span>공유배터리 스테이션</span>
						</div>

						<div className="flow-main__status">
							{/* Wi-Fi */}
							<div className="flow-main__status-card animate__animated animate__flipInX" style={{ animationDelay: '0s' }}>
								<div className="flow-main__status-icon">
									{Ico.wifi}
								</div>
								<div className="flow-main__status-value flow-main__status-value--green">
									정상
								</div>
							</div>

							{/* 네트워크 */}
							<div className="flow-main__status-card flow-main__status-card--middle animate__animated animate__flipInX" style={{ animationDelay: '0.5s' }}>
								<div className="flow-main__status-icon">
									<img src={canIcon} alt="" />
								</div>
								<div className="flow-main__status-value flow-main__status-value--green">
									정상
								</div>
							</div>

							{/* 날씨 */}
							<div className="flow-main__status-card animate__animated animate__flipInX" style={{ animationDelay: '1.0s' }}>
								<div className="flow-main__status-icon flow-main__weather-icon">
									{weather ? (SKY[weather.sky] ?? SKY.CLEAR).icon : '☀️'}
								</div>
								<div className="flow-main__weather-value">
									<span className="flow-main__weather-low">
										{weather?.low != null ? Math.round(weather.low) : '--'}°C 
									</span>
									<span className="flow-main__weather-slash"> / </span>
									<span className="flow-main__weather-high">
										{weather?.high != null ? Math.round(weather.high) : '--'}°C
									</span>
								</div>
							</div>
						</div>
					</div>

					{/* 오른쪽 영역 */}
					<div className="flow-main__right">
						<img
							className="flow-main__main-image"
							src={mainImage}
							alt=""
						/>
					</div>
				</section>
			</div>

			{/* ── 하단 액션 (페이지 이동) ── */}
			<div className="actions" onClick={() => navigate('/flow/flow-2')}>
				<img className="actions__battery-icon" src={batteryIcon} alt="" />
				배터리 교환 시작
			</div>
		</div>
	);
}
