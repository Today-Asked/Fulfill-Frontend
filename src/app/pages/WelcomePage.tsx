import React, { useEffect, useRef } from "react";
import { useNavigate } from "react-router";
import { Sparkles } from "lucide-react";

export function WelcomePage() {
  const navigate = useNavigate();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Particle background
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;

    const particles: { x: number; y: number; r: number; dx: number; dy: number; o: number }[] = [];
    for (let i = 0; i < 55; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        r: Math.random() * 1.5 + 0.3,
        dx: (Math.random() - 0.5) * 0.3,
        dy: (Math.random() - 0.5) * 0.3,
        o: Math.random() * 0.5 + 0.1,
      });
    }

    let raf: number;
    function draw() {
      ctx!.clearRect(0, 0, canvas!.width, canvas!.height);
      for (const p of particles) {
        ctx!.beginPath();
        ctx!.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx!.fillStyle = `rgba(200,150,255,${p.o})`;
        ctx!.fill();
        p.x += p.dx;
        p.y += p.dy;
        if (p.x < 0 || p.x > canvas!.width) p.dx *= -1;
        if (p.y < 0 || p.y > canvas!.height) p.dy *= -1;
      }
      raf = requestAnimationFrame(draw);
    }
    draw();
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="relative h-full flex flex-col overflow-hidden select-none">
      {/* Particle canvas */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />

      {/* Glow blobs */}
      <div className="absolute top-[-60px] left-[-60px] w-72 h-72 bg-fuchsia-600/20 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[160px] right-[-40px] w-60 h-60 bg-cyan-500/15 rounded-full blur-[80px] pointer-events-none" />
      <div className="absolute top-[35%] left-[-60px] w-64 h-64 bg-violet-600/15 rounded-full blur-[90px] pointer-events-none" />

      {/* Content */}
      <div className="relative z-10 flex flex-col h-full px-7 pt-16 pb-12">

        {/* Logo + brand */}
        <div className="flex-1 flex flex-col justify-center items-center text-center gap-6">
          {/* Logo mark */}
          <div className="relative">
            <div className="w-20 h-20 rounded-[28px] bg-gradient-to-br from-violet-500 via-fuchsia-500 to-cyan-400 shadow-2xl shadow-fuchsia-500/40 flex items-center justify-center">
              <Sparkles size={36} className="text-white drop-shadow" />
            </div>
            {/* Ring pulse */}
            <div className="absolute inset-0 rounded-[28px] border-2 border-fuchsia-400/30 animate-ping" />
          </div>

          {/* Brand name */}
          <div className="flex flex-col items-center gap-2">
            <h1 className="text-4xl font-bold tracking-tight">
              <span className="bg-gradient-to-r from-violet-300 via-fuchsia-300 to-cyan-300 bg-clip-text text-transparent">
                Fulfill
              </span>
            </h1>
            <p className="text-gray-400 text-sm leading-relaxed max-w-[220px]">
              找到你心目中的創作者，<br />讓靈感化為現實
            </p>
          </div>

          {/* Feature pills */}
          <div className="flex flex-wrap justify-center gap-2 mt-2">
            {["插畫委託", "Live2D", "角色設計", "商業稿"].map((tag) => (
              <span
                key={tag}
                className="px-3 py-1 rounded-full text-xs bg-white/5 border border-white/10 text-gray-400"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>

        {/* CTA buttons */}
        <div className="flex flex-col gap-3 mt-8">
          <button
            onClick={() => navigate("/register")}
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-violet-600 via-fuchsia-600 to-cyan-500 text-white text-sm font-semibold shadow-lg shadow-fuchsia-500/30 hover:opacity-90 active:scale-[0.98] transition-all"
          >
            立即開始
          </button>

          <button
            onClick={() => navigate("/login")}
            className="w-full py-4 rounded-2xl bg-white/6 border border-white/10 text-gray-200 text-sm font-medium hover:bg-white/10 active:scale-[0.98] transition-all"
          >
            已有帳號，登入
          </button>
        </div>

        {/* Fine print */}
        <p className="text-center text-gray-600 text-[10px] mt-4 leading-relaxed">
          繼續即表示你同意我們的服務條款與隱私政策
        </p>
      </div>
    </div>
  );
}
