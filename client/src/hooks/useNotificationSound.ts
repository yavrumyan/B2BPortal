import { useEffect, useRef } from 'react';
import notificationSoundPath from '@assets/notification.mp3';

export function useNotificationSound() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  
  useEffect(() => {
    // Create audio element on mount
    const audio = new Audio(notificationSoundPath);
    audio.preload = 'auto';
    audioRef.current = audio;
    
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
    };
  }, []);
  
  const play = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(err => {
        console.error('Failed to play notification sound:', err);
      });
    }
  };
  
  return { play };
}
