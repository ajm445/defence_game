import React, { useEffect, useState } from 'react';
import { useUIStore } from '../../stores/useUIStore';

export const Notification: React.FC = () => {
  const notification = useUIStore((state) => state.notification);
  const notificationKey = useUIStore((state) => state.notificationKey);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (notification) {
      setVisible(true);
      const timer = setTimeout(() => setVisible(false), 2500);
      return () => clearTimeout(timer);
    }
  }, [notification, notificationKey]);

  if (!visible || !notification) return null;

  return (
    <div
      className="absolute top-28 inset-x-0 flex justify-center z-50
                 animate-[fadeInOut_2.5s_ease-in-out] pointer-events-none"
    >
      <div className="glass-dark rounded-xl px-6 py-3 border border-neon-cyan/50 shadow-neon-cyan">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-neon-cyan animate-pulse" />
          <span className="text-neon-cyan font-medium whitespace-nowrap">{notification}</span>
          <div className="w-2 h-2 rounded-full bg-neon-cyan animate-pulse" />
        </div>
      </div>
    </div>
  );
};
