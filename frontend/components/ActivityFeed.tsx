"use client";

import { useEffect, useState } from "react";
import { TrendingUp, Banknote, Package } from "lucide-react";

const CITIES = ["Lahore", "Karachi", "Islamabad", "Faisalabad", "Rawalpindi", "Peshawar", "Multan", "Hyderabad", "Quetta", "Sialkot"];
const NAMES = ["Ali", "Sara", "Ahmed", "Zara", "Hassan", "Hina", "Usman", "Ayesha", "Bilal", "Nadia", "Kamran", "Sana", "Imran", "Farah"];

function rand<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function randNum(min: number, max: number) { return Math.floor(Math.random() * (max - min + 1)) + min; }

type Activity = { icon: "earn" | "deposit" | "plan"; text: string; id: number };

function generateActivity(): Activity {
  const type = Math.random();
  const name = rand(NAMES);
  const city = rand(CITIES);
  if (type < 0.45) {
    return { icon: "earn", text: `${name} from ${city} earned ₨${randNum(50, 800)} from a task`, id: Date.now() };
  } else if (type < 0.75) {
    return { icon: "deposit", text: `${name} from ${city} deposited ₨${randNum(500, 5000)}`, id: Date.now() };
  } else {
    return { icon: "plan", text: `${name} from ${city} activated a Premium Plan`, id: Date.now() };
  }
}

export function ActivityFeed() {
  const [activity, setActivity] = useState<Activity | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    function show() {
      const a = generateActivity();
      setActivity(a);
      setVisible(true);
      setTimeout(() => setVisible(false), 4000);
    }

    // First show after 5s, then every 8-14s
    const first = setTimeout(() => {
      show();
      const interval = setInterval(() => show(), randNum(8000, 14000));
      return () => clearInterval(interval);
    }, 5000);

    return () => clearTimeout(first);
  }, []);

  if (!activity || !visible) return null;

  const ICON = activity.icon === "earn" ? TrendingUp : activity.icon === "deposit" ? Banknote : Package;
  const COLOR = activity.icon === "earn" ? "var(--color-accent)" : activity.icon === "deposit" ? "var(--color-gold)" : "#a78bfa";

  return (
    <div className="fixed bottom-20 left-4 z-[9998] flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl"
      style={{ background: "rgba(15,28,23,0.95)", border: "1px solid rgba(255,255,255,0.1)", backdropFilter: "blur(16px)", maxWidth: 300, animation: "fadeUp 0.4s ease" }}>
      <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${COLOR}20` }}>
        <ICON size={15} style={{ color: COLOR }} />
      </div>
      <p className="text-xs leading-snug" style={{ color: "rgba(245,242,234,0.8)" }}>{activity.text}</p>
    </div>
  );
}
