"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { TrendingUp, Banknote, Package } from "lucide-react";

const CITIES = ["Lahore", "Karachi", "Islamabad", "Faisalabad", "Rawalpindi", "Peshawar", "Multan", "Hyderabad", "Quetta", "Sialkot"];
const NAMES  = ["Ali", "Sara", "Ahmed", "Zara", "Hassan", "Hina", "Usman", "Ayesha", "Bilal", "Nadia", "Kamran", "Sana", "Imran", "Farah"];

function rand<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function randNum(min: number, max: number) { return Math.floor(Math.random() * (max - min + 1)) + min; }

type Activity = { icon: "earn" | "deposit" | "plan"; text: string };

function makeActivity(): Activity {
  const type = Math.random();
  const name = rand(NAMES);
  const city = rand(CITIES);
  if (type < 0.45) return { icon: "earn",    text: `${name} from ${city} earned ₨${randNum(50, 800)} from a task` };
  if (type < 0.75) return { icon: "deposit", text: `${name} from ${city} deposited ₨${randNum(500, 5000)}` };
  return                  { icon: "plan",    text: `${name} from ${city} activated a Premium Plan` };
}

function Popup({ activity }: { activity: Activity }) {
  const COLOR = activity.icon === "earn" ? "var(--color-accent)" : activity.icon === "deposit" ? "var(--color-gold)" : "#a78bfa";
  const ICON  = activity.icon === "earn" ? TrendingUp : activity.icon === "deposit" ? Banknote : Package;
  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-xl"
      style={{ background: "#0f1c17", border: "1px solid #1a3a24", maxWidth: 300 }}>
      <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${COLOR}20` }}>
        <ICON size={15} style={{ color: COLOR }} />
      </div>
      <p className="text-xs leading-snug" style={{ color: "rgba(245,242,234,0.8)" }}>{activity.text}</p>
    </div>
  );
}

function useSlot(firstDelay: number, interval: () => number) {
  const [activity, setActivity] = useState<Activity | null>(null);
  const [visible,  setVisible]  = useState(false);

  useEffect(() => {
    function show() {
      setActivity(makeActivity());
      setVisible(true);
      setTimeout(() => setVisible(false), 4000);
    }

    const first = setTimeout(() => {
      show();
      let t: ReturnType<typeof setTimeout>;
      function schedule() { t = setTimeout(() => { show(); schedule(); }, interval()); }
      schedule();
      return () => clearTimeout(t);
    }, firstDelay);

    return () => clearTimeout(first);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { activity, visible };
}

export function ActivityFeed() {
  const pathname = usePathname();
  const slot1 = useSlot(5000, () => randNum(8000, 14000));

  // Only show this "recent activity" trust widget on the public marketing
  // pages — it was overlapping the sidebar nav on /secure-mgmt (admin) and
  // has no place being shown to already-registered users on /dashboard.
  const isAppRoute = pathname?.startsWith("/secure-mgmt") || pathname?.startsWith("/dashboard");
  if (isAppRoute || !slot1.visible || !slot1.activity) return null;

  return (
    <div className="fixed bottom-20 left-4 z-[9998]">
      <Popup activity={slot1.activity} />
    </div>
  );
}
