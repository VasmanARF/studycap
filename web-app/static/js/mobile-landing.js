const { useState, useEffect, useRef } = React;

// Enhanced inline SVG icons with better styling
const IconCopy = ({ size = 20, className = "" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
    </svg>
);

const IconCalendar = ({ size = 20, className = "" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
        <line x1="16" y1="2" x2="16" y2="6"/>
        <line x1="8" y1="2" x2="8" y2="6"/>
        <line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
);

const IconCheck = ({ size = 16, className = "" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M20 6L9 17l-5-5"/>
    </svg>
);

const IconLaptop = ({ size = 20, className = "" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <rect x="3" y="4" width="18" height="12" rx="2" ry="2"/>
        <line x1="2" y1="20" x2="22" y2="20"/>
    </svg>
);

const IconArrowRight = ({ size = 16, className = "" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <line x1="5" y1="12" x2="19" y2="12"/>
        <polyline points="12,5 19,12 12,19"/>
    </svg>
);

const IconChevronDown = ({ size = 18, className = "", strokeW = 3 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeW} strokeLinecap="round" strokeLinejoin="round" className={className}>
        <polyline points="6 9 12 15 18 9" />
    </svg>
);

const IconSpark = ({ size = 20, className = "" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
        <path d="M12 0L14.09 8.26L22 9L14.09 9.74L12 18L9.91 9.74L2 9L9.91 8.26L12 0Z"/>
    </svg>
);

const IconZap = ({ size = 20, className = "" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
        <polygon points="13,2 3,14 12,14 11,22 21,10 12,10"/>
    </svg>
);

const IconX = ({ size = 24, className = "" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <line x1="18" y1="6" x2="6" y2="18"/>
        <line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
);

const IconPhone = ({ size = 20, className = "" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <rect x="5" y="2" width="14" height="20" rx="2" ry="2"/>
        <line x1="12" y1="18" x2="12.01" y2="18"/>
    </svg>
);

// Social media icons
const SocialYouTube = ({ size = 24 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
        <path d="M23.5 6.2s-.2-1.6-.8-2.3c-.8-.8-1.7-.8-2.1-.9C17.8 2.7 12 2.7 12 2.7s-5.8 0-8.6.3c-.4 0-1.3.1-2.1.9C.7 4.6.5 6.2.5 6.2S.2 8.2.2 10.2v1.6c0 2 .3 4 .3 4s.2 1.6.8 2.3c.8.9 1.9.8 2.4.9 1.7.2 7.3.3 7.3.3s5.8 0 8.6-.3c.4-.1 1.3-.1 2.1-.9.6-.7.8-2.3.8-2.3s.3-2 .3-4V10.2c0-2-.3-4-.3-4zM9.8 13.6V7.9l6 2.9-6 2.8z"/>
    </svg>
);

const SocialTikTok = ({ size = 24 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
        <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
    </svg>
);

const SocialInstagram = ({ size = 24 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
        <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
        <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" fill="white"/>
        <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" stroke="white" strokeWidth="2" strokeLinecap="round"/>
    </svg>
);

function MobileLanding() {
    const [copied, setCopied] = useState(false);
    const [calendarAdded, setCalendarAdded] = useState(false);
    const [sparkleAnimation, setSparkleAnimation] = useState(true);
    const demoRef = useRef(null);
    const [imgInView, setImgInView] = useState(false);
    const [imgProgress, setImgProgress] = useState(0);
    const [isHover, setIsHover] = useState(false);
    const [isPressed, setIsPressed] = useState(false);
    const [showLoginSuccess, setShowLoginSuccess] = useState(false);
    const [showDashboardPopup, setShowDashboardPopup] = useState(false);

    const handleScrollNext = () => {
        const el = document.getElementById('handoff-section');
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    const desktopLink = 'https://study-cap.com';

    // Check for login success on mount
    useEffect(() => {
        if (typeof window.loginSuccess !== 'undefined' && window.loginSuccess === true) {
            setShowLoginSuccess(true);
            const timer = setTimeout(() => {
                setShowLoginSuccess(false);
            }, 4000);
            return () => clearTimeout(timer);
        }
    }, []);

    // Sparkle animation effect
    useEffect(() => {
        const interval = setInterval(() => {
            setSparkleAnimation(prev => !prev);
        }, 2000);
        return () => clearInterval(interval);
    }, []);

    // Reveal image when in view
    useEffect(() => {
        if (!demoRef.current) return;
        const observer = new IntersectionObserver(([entry]) => {
            setImgInView(entry.isIntersecting);
        }, { threshold: 0.25 });
        observer.observe(demoRef.current);
        return () => observer.disconnect();
    }, []);

    // Parallax/scroll progress for the UI image
    useEffect(() => {
        const handle = () => {
            if (!demoRef.current) return;
            const rect = demoRef.current.getBoundingClientRect();
            const vh = window.innerHeight || 1;
            const centerDist = Math.abs((rect.top + rect.height / 2) - vh / 2);
            const norm = Math.max(0, 1 - centerDist / (vh * 0.8));
            setImgProgress(Number.isFinite(norm) ? Math.min(1, Math.max(0, norm)) : 0);
        };
        handle();
        window.addEventListener('scroll', handle, { passive: true });
        window.addEventListener('resize', handle);
        return () => {
            window.removeEventListener('scroll', handle);
            window.removeEventListener('resize', handle);
        };
    }, []);

    const handleCopyLink = async () => {
        try {
            await navigator.clipboard.writeText(desktopLink);
        } catch (err) {
            const ta = document.createElement('textarea');
            ta.value = desktopLink;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
        }
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
    };

    const handleAddToCalendar = () => {
        const now = new Date();
        const start = new Date(now.getTime() + 2 * 60 * 60 * 1000);
        const end = new Date(start.getTime() + 30 * 60 * 1000);
        const fmt = (d) => d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
        
        const ics = [
            'BEGIN:VCALENDAR',
            'VERSION:2.0',
            'PRODID:-//StudyCap//QR Landing//EN',
            'BEGIN:VEVENT',
            `UID:${Date.now()}@studycap.com`,
            `DTSTAMP:${fmt(now)}`,
            `DTSTART:${fmt(start)}`,
            `DTEND:${fmt(end)}`,
            'SUMMARY:🚀 Install StudyCap on Desktop',
            'DESCRIPTION:Time to turn your lectures into smart notes and quizzes! Open StudyCap on your laptop.',
            'END:VEVENT',
            'END:VCALENDAR'
        ].join('\r\n');

        const blob = new Blob([ics], { type: 'text/calendar' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'studycap-reminder.ics';
        a.click();
        URL.revokeObjectURL(url);
        
        setCalendarAdded(true);
        setTimeout(() => setCalendarAdded(false), 2500);
    };

    const handleDashboardClick = (e) => {
        e.preventDefault();
        setShowDashboardPopup(true);
    };

    const goToMobileDashboard = () => {
        window.location.href = '/dashboard-mobile';
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 relative overflow-hidden">
            {/* Dashboard Popup Modal */}
            {showDashboardPopup && (
                <div 
                    className="fixed inset-0 z-50 flex items-center justify-center p-6" 
                    style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)', backdropFilter: 'blur(4px)' }}
                    onClick={() => setShowDashboardPopup(false)}
                >
                    <div 
                        className="bg-white rounded-3xl shadow-2xl p-5 w-full max-w-xs border border-gray-200 relative" 
                        style={{ animation: 'slideUp 0.3s ease-out' }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Close button */}
                        <button 
                            onClick={() => setShowDashboardPopup(false)}
                            className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 transition-colors z-10"
                        >
                            <IconX size={18} />
                        </button>

                        <div className="text-center">
                            {/* Laptop vs Phone comparison */}
                            <div className="flex justify-center items-center gap-3 mb-3">
                                <div className="flex flex-col items-center">
                                    <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-blue-600 rounded-xl flex items-center justify-center mb-1 shadow-lg">
                                        <IconLaptop size={24} className="text-white" />
                                    </div>
                                    <span className="text-[10px] font-bold text-green-600">Full Power</span>
                                </div>
                                <div className="text-lg text-gray-400">vs</div>
                                <div className="flex flex-col items-center opacity-60">
                                    <div className="w-12 h-12 bg-gradient-to-br from-gray-300 to-gray-400 rounded-xl flex items-center justify-center mb-1">
                                        <IconPhone size={20} className="text-white" />
                                    </div>
                                    <span className="text-[10px] font-medium text-gray-500">Limited</span>
                                </div>
                            </div>

                            <h3 className="text-lg font-bold text-gray-800 mb-2">
                                Wait! You're missing out 🚀
                            </h3>
                            
                            <p className="text-xs text-gray-600 mb-3 leading-relaxed">
                                StudyCap on <span className="text-purple-600 font-semibold">laptop</span> unlocks the <span className="text-amber-600 font-semibold">full experience</span>:
                            </p>

                            {/* Feature comparison */}
                            <div className="bg-gray-50 rounded-xl p-3 mb-4 text-left border border-gray-100">
                                <div className="space-y-1.5">
                                    <div className="flex items-center gap-2">
                                        <div className="w-4 h-4 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                                            <IconCheck size={10} className="text-green-600" />
                                        </div>
                                        <span className="text-xs text-gray-700">Panopto lecture summaries</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="w-4 h-4 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                                            <IconCheck size={10} className="text-green-600" />
                                        </div>
                                        <span className="text-xs text-gray-700">Chrome Extension integration</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="w-4 h-4 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                                            <IconCheck size={10} className="text-green-600" />
                                        </div>
                                        <span className="text-xs text-gray-700">Full-screen editing & quizzes</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="w-4 h-4 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                                            <IconCheck size={10} className="text-green-600" />
                                        </div>
                                        <span className="text-xs text-gray-700">Keyboard shortcuts</span>
                                    </div>
                                </div>
                            </div>

                            {/* Primary CTA - Copy link */}
                            <button
                                onClick={handleCopyLink}
                                className="w-full bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white font-bold py-3 px-4 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 mb-2 text-sm hover:shadow-lg"
                            >
                                <IconCopy size={16} />
                                {copied ? '✅ Link Copied!' : 'Copy Link for Laptop'}
                            </button>

                            {/* Secondary CTA - Calendar reminder */}
                            <button
                                onClick={handleAddToCalendar}
                                className="w-full bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-500 hover:to-orange-600 text-white font-semibold py-2.5 px-4 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 mb-3 text-sm"
                            >
                                <IconCalendar size={14} />
                                {calendarAdded ? '✅ Reminder Set!' : 'Remind Me Later'}
                            </button>

                            {/* Tertiary - Go to mobile anyway */}
                            <button
                                onClick={goToMobileDashboard}
                                className="w-full text-gray-500 hover:text-gray-700 text-xs py-1.5 transition-colors flex items-center justify-center gap-1"
                            >
                                <IconPhone size={12} />
                                Continue to limited mobile version
                                <IconArrowRight size={10} />
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Login Success Popup */}
            {showLoginSuccess && (
                <div 
                    className="fixed inset-0 z-50 flex items-center justify-center p-6" 
                    style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)', backdropFilter: 'blur(4px)' }}
                    onClick={() => setShowLoginSuccess(false)}
                >
                    <div 
                        className="bg-white rounded-3xl shadow-2xl p-6 max-w-xs w-full border border-gray-200" 
                        style={{ animation: 'slideUp 0.3s ease-out' }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="text-center">
                            <div className="mx-auto w-14 h-14 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center mb-3 shadow-lg">
                                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                </svg>
                            </div>
                            <h3 className="text-lg font-bold text-gray-800 mb-2">Login Successful! 🎉</h3>
                            <p className="text-sm text-gray-600 mb-4">Welcome to StudyCap! Your laptop is where the magic happens.</p>
                            <button
                                onClick={() => setShowLoginSuccess(false)}
                                className="w-full bg-gradient-to-r from-purple-500 to-blue-500 text-white font-semibold py-3 px-4 rounded-2xl hover:shadow-lg transition-all duration-200 active:scale-95"
                            >
                                Got it!
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Animated background blobs */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className={`absolute -top-20 -right-20 w-40 h-40 bg-gradient-to-br from-purple-400 to-pink-400 rounded-full opacity-20 transition-transform duration-3000 ${sparkleAnimation ? 'scale-110' : 'scale-95'}`}></div>
                <div className={`absolute -bottom-20 -left-20 w-32 h-32 bg-gradient-to-br from-blue-400 to-cyan-400 rounded-full opacity-20 transition-transform duration-3000 ${sparkleAnimation ? 'scale-95' : 'scale-110'}`}></div>
                <div className={`absolute top-1/3 right-8 w-6 h-6 text-yellow-400 transition-all duration-1000 ${sparkleAnimation ? 'opacity-100 scale-100' : 'opacity-50 scale-75'}`}>
                    <IconSpark />
                </div>
            </div>

            {/* Header with animated gradient */}
            <header className="relative z-10 px-6 pt-8 pb-6">
                <div className="max-w-sm mx-auto text-center">
                    <div className="inline-flex items-center gap-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs font-bold px-4 py-2 rounded-full mb-4 shadow-lg animate-pulse">
                        <IconSpark size={14} />
                        Study like a genius
                    </div>
                    <h1 className="text-2xl font-black text-gray-800 mb-3 leading-tight">
                        <span className="bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                            Welcome to StudyCap! 🎉
                        </span>
                    </h1>
                    <p className="text-gray-600 text-sm leading-relaxed">
                        Turn <strong>lectures & documents</strong> into <strong>smart notes</strong>, <strong>instant quizzes</strong>, and <strong>AI answers</strong> in seconds for <strong>FREE</strong>
                    </p>
                    <div className="mt-3 px-3 py-2 bg-amber-50 border border-amber-200 rounded-xl">
                        <p className="text-[11px] text-amber-800 font-semibold text-center">
                            💻 Best on Laptop • 📱 PDFs work on mobile • 🎥 Panopto needs Chrome Extension
                        </p>
                    </div>
                </div>
            </header>

            {/* Demo section with phone mockup */}
            <section className="px-6 py-4">
                <div className="max-w-sm mx-auto">
                    <div className="bg-white rounded-3xl shadow-[0_25px_60px_rgba(31,38,135,0.2)] p-6 border border-gray-100 ring-1 ring-purple-100/60 relative overflow-hidden -mt-3">
                        {/* Color blobs to increase contrast */}
                        <div className="pointer-events-none absolute -top-10 -left-10 w-40 h-40 rounded-full bg-purple-400/15 blur-3xl"></div>
                        <div className="pointer-events-none absolute -bottom-14 -right-12 w-48 h-48 rounded-full bg-cyan-400/15 blur-3xl"></div>
                        {/* Subtle gradient overlay */}
                        <div className="absolute inset-0 bg-gradient-to-br from-purple-50/50 to-blue-50/50 pointer-events-none"></div>
                        
                        <div className="relative z-10">
                            {/* Clean UI showcase using image's natural resolution (no frame) */}
                            <div
                                ref={demoRef}
                                className={`relative mx-auto w-full max-w-[200px] mb-6 group transition-all duration-300 ease-out ${imgInView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
                                onMouseEnter={() => setIsHover(true)}
                                onMouseLeave={() => { setIsHover(false); setIsPressed(false); }}
                                onMouseDown={() => setIsPressed(true)}
                                onMouseUp={() => setIsPressed(false)}
                                onTouchStart={() => setIsPressed(true)}
                                onTouchEnd={() => setIsPressed(false)}
                                style={{
                                    transform: `translateY(${(1 - imgProgress) * 6}px) scale(${(0.92 + imgProgress * 0.08) * (isHover ? 1.03 : 1) * (isPressed ? 1.05 : 1)})`,
                                }}
                            >
                                {/* Animated neon border */}
                                <div
                                    className="pointer-events-none absolute inset-0 rounded-2xl"
                                    style={{
                                        padding: '2px',
                                        background: 'conic-gradient(from 0deg, #7c3aed, #22d3ee, #f472b6, #7c3aed)',
                                        WebkitMask: 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
                                        WebkitMaskComposite: 'xor',
                                        maskComposite: 'exclude',
                                        opacity: Math.max(0.6, imgProgress * 0.95),
                                        boxShadow: '0 0 12px rgba(124,58,237,0.50), 0 0 18px rgba(34,211,238,0.40), 0 0 24px rgba(244,114,182,0.35)',
                                        animation: 'neonFade 4s ease-in-out infinite',
                                        zIndex: 3
                                    }}
                                />
                                <img
                                    src="/static/media/UI.png" 
                                    alt="StudyCap Dashboard Interface"
                                    className="relative block w-full h-auto rounded-2xl shadow-2xl"
                                    style={{ zIndex: 2 }}
                                    onError={(e) => {
                                        // Try alternate path
                                        e.target.src = "/static/UI.png";
                                        e.target.onerror = () => {
                                            e.target.style.display = 'none';
                                            e.target.nextElementSibling.style.display = 'flex';
                                        };
                                    }}
                                />
                                <div className="hidden absolute inset-0 rounded-2xl bg-gradient-to-br from-purple-500 to-blue-600 items-center justify-center text-white text-sm font-bold" style={{ zIndex: 4 }}>
                                    <div className="text-center">
                                        <div className="text-2xl mb-2">📱</div>
                                        <div>StudyCap Dashboard</div>
                                        <div className="text-xs opacity-75 mt-1">AI-Powered Interface</div>
                                    </div>
                                </div>
                                {/* Animated shine effect */}
                                <div className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" style={{ zIndex: 5 }}>
                                    <div className="absolute top-0 left-0 w-full h-full rounded-2xl bg-gradient-to-r from-transparent via-white/30 to-transparent transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>
                                </div>
                            </div>
                            
                            <div className="text-center mb-4">
                                <h3 className="font-bold text-gray-800 mb-2">
                                    Lecture → Summary → Quiz
                                </h3>
                                <p className="text-xs text-gray-600 leading-relaxed">
                                    Watch StudyCap compress a <strong>60-minute Panopto lecture</strong> into clean notes you'll actually use. Pure productivity magic! 🪄
                                </p>
                                <div className="mt-3 px-3 py-2 bg-purple-50 border border-purple-200 rounded-xl">
                                    <p className="text-[10px] text-purple-800 font-semibold">
                                        🔌 Requires Chrome Extension on desktop/laptop
                                    </p>
                                </div>
                            </div>

                            {/* Social icons */}
                            <div className="flex justify-center gap-4 mb-4">
                                <a href="https://www.youtube.com/@getstudycap" target="_blank" rel="noopener" 
                                   className="p-2 text-gray-400 hover:text-red-500 transition-all duration-200 hover:scale-110">
                                    <SocialYouTube size={20} />
                                </a>
                                <a href="https://www.tiktok.com/@studycap" target="_blank" rel="noopener"
                                   className="p-2 text-gray-400 hover:text-black transition-all duration-200 hover:scale-110">
                                    <SocialTikTok size={20} />
                                </a>
                                <a href="https://instagram.com/studycap.app" target="_blank" rel="noopener"
                                   className="p-2 text-gray-400 hover:text-pink-500 transition-all duration-200 hover:scale-110">
                                    <SocialInstagram size={20} />
                                </a>
                            </div>
                            {/* Scroll indicator */}
                            <div className="mt-4 mb-2 flex flex-col items-center justify-center">
                                <button onClick={handleScrollNext} className="flex flex-col items-center focus:outline-none active:scale-95 transition-transform" aria-label="Scroll to next section">
                                    <span className="mb-2 text-[11px] font-semibold bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-transparent">Scroll to explore</span>
                                    <div className="relative flex items-center justify-center">
                                        {/* glow halo */}
                                        <div className="absolute -inset-4 rounded-full bg-blue-500/20 blur-2xl"></div>
                                        {/* pulse ring */}
                                        <div className="absolute inset-0 rounded-full ring-2 ring-blue-400/60" style={{ animation: 'ringPulse 2s ease-out infinite' }}></div>
                                        {/* main button */}
                                        <div className="relative z-10 w-12 h-12 rounded-full bg-gradient-to-br from-blue-600 via-indigo-500 to-cyan-400 shadow-[0_8px_30px_rgba(30,64,175,0.35)] flex items-center justify-center animate-bounce-soft">
                                            <div className="relative h-6 w-6 flex items-center justify-center">
                                                <IconChevronDown strokeW={3.2} className="absolute text-white" style={{ top: '0px', left: 0, right: 0, margin: '0 auto' }} />
                                                <IconChevronDown strokeW={3.2} className="absolute text-white opacity-80" style={{ top: '6px', left: 0, right: 0, margin: '0 auto' }} />
                                                <IconChevronDown strokeW={3.2} className="absolute text-white opacity-55" style={{ top: '12px', left: 0, right: 0, margin: '0 auto' }} />
                                            </div>
                                        </div>
                                    </div>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Interactive handoff section */}
            <section className="px-6 py-6" id="handoff-section">
                <div className="max-w-sm mx-auto space-y-4">
                    {/* Two clear paths */}
                    <div className="text-center mb-4">
                        <h2 className="text-xl font-black text-gray-800 mb-2">
                            Choose Your Path
                        </h2>
                        <p className="text-sm text-gray-600">
                            Pick what you want to summarize
                        </p>
                    </div>

                    {/* Path 1: PDF/PowerPoint - Dashboard */}
                    <div className="bg-gradient-to-br from-green-50 to-emerald-100 rounded-3xl shadow-xl p-6 border-2 border-green-200">
                        <div className="flex items-center justify-center gap-2 mb-3">
                            <IconZap className="text-green-600" />
                            <h2 className="text-lg font-bold text-gray-800 text-center">
                                PDF & PowerPoint Summaries
                            </h2>
                        </div>
                        <p className="text-sm text-gray-700 text-center mb-1 font-semibold">
                            ✅ Available Now on Mobile
                        </p>
                        <p className="text-xs text-gray-600 text-center mb-4">
                            Upload slides and documents directly from your phone or laptop
                        </p>
                        <button
                            onClick={handleDashboardClick}
                            className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold py-4 px-4 rounded-2xl transition-all duration-200 flex items-center justify-center gap-2 hover:scale-105 hover:shadow-lg"
                        >
                            <IconZap />
                            Go to Dashboard
                            <IconArrowRight />
                        </button>
                    </div>

                    {/* Path 2: Panopto Lectures - Chrome Extension */}
                    <div className="bg-gradient-to-br from-purple-50 to-indigo-100 rounded-3xl shadow-xl p-6 border-2 border-purple-200">
                        <div className="flex items-center justify-center gap-2 mb-3">
                            <IconLaptop className="text-purple-600" />
                            <h2 className="text-lg font-bold text-gray-800 text-center">
                                Panopto Lecture Summaries
                            </h2>
                        </div>
                        <p className="text-sm text-gray-700 text-center mb-1 font-semibold">
                            🔌 Requires Chrome Extension
                        </p>
                        <p className="text-xs text-gray-600 text-center mb-4">
                            Install the extension on your <strong>desktop/laptop</strong> to summarize Panopto lectures
                        </p>
                        
                        <div className="space-y-3">
                            <a
                                href="https://chromewebstore.google.com/detail/studycap/ghlepfaadliahcodfkjplojekfffmcjp"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="w-full bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white font-bold py-4 px-4 rounded-2xl transition-all duration-200 flex items-center justify-center gap-2 hover:scale-105 hover:shadow-lg block text-center"
                            >
                                <IconLaptop />
                                Get Chrome Extension
                                <IconArrowRight />
                            </a>
                            
                        </div>
                    </div>

                    {/* Reminder Card - Save link for later */}
                    <div className="bg-white rounded-3xl shadow-xl p-6 border border-gray-100">
                        <h2 className="text-lg font-bold text-gray-800 text-center mb-4">
                            📲 Save for Later
                        </h2>
                        <p className="text-sm text-gray-600 text-center mb-6">
                            Copy the link or set a reminder to continue on your laptop
                        </p>

                        {/* Quick action buttons */}
                        <div className="space-y-3">
                            <button
                                onClick={handleCopyLink}
                                className="w-full bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white font-bold py-4 px-4 rounded-2xl transition-all duration-200 flex items-center justify-center gap-2 hover:scale-105 hover:shadow-lg"
                            >
                                <IconCopy />
                                {copied ? '✅ Copied!' : '📋 Copy link'}
                            </button>
                            
                            <button
                                onClick={handleAddToCalendar}
                                className="w-full bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-500 hover:to-orange-600 text-white font-semibold py-3 px-4 rounded-2xl transition-all duration-200 flex items-center justify-center gap-2 hover:scale-105"
                            >
                                <IconCalendar />
                                {calendarAdded ? '✅ Added!' : '⏰ Remind me later'}
                            </button>
                        </div>
                    </div>
                </div>
            </section>

            {/* Benefits grid */}
            <section className="px-6 py-6">
                <div className="max-w-sm mx-auto grid grid-cols-1 gap-4">
                    <div className="bg-gradient-to-br from-blue-50 to-indigo-100 rounded-2xl p-4 border border-blue-200">
                        <h3 className="font-bold text-blue-800 mb-2 flex items-center gap-2">
                            📱 PDFs & PowerPoints
                        </h3>
                        <ul className="space-y-1 text-sm text-blue-700">
                            <li>• Works on mobile & desktop</li>
                            <li>• Upload files directly from your device</li>
                            <li>• Instant summaries in seconds</li>
                        </ul>
                    </div>
                    
                    <div className="bg-gradient-to-br from-purple-50 to-pink-100 rounded-2xl p-4 border border-purple-200">
                        <h3 className="font-bold text-purple-800 mb-2 flex items-center gap-2">
                            🎥 Panopto Lectures
                        </h3>
                        <ul className="space-y-1 text-sm text-purple-700">
                            <li>• Requires Chrome Extension</li>
                            <li>• Works with Panopto lecture portals</li>
                            <li>• Install on desktop/laptop browser</li>
                        </ul>
                    </div>
                </div>
            </section>

            {/* Sticky bottom bar */}
            <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-lg border-t border-gray-200 px-6 py-3 z-40">
                <div className="max-w-sm mx-auto flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-xs text-gray-600 flex-1">
                        <IconZap size={14} className="text-green-500" />
                        <span className="hidden sm:inline">Start with PDFs</span>
                        <span className="sm:hidden">PDFs</span>
                    </div>
                    <button
                        onClick={handleDashboardClick}
                        className="bg-gradient-to-r from-green-500 to-emerald-600 text-white text-xs font-bold px-4 py-2 rounded-full hover:shadow-lg transition-all duration-200 flex items-center gap-1 hover:scale-105"
                    >
                        Dashboard
                        <IconArrowRight size={12} />
                    </button>
                </div>
            </div>

            {/* Bottom padding for sticky bar */}
            <div className="h-16"></div>
        </div>
    );
}

// Render the app
ReactDOM.render(<MobileLanding />, document.getElementById('root'));
