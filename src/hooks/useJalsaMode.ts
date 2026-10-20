import { useEffect, useState } from 'react';
import { JALSA_EVENT, setJalsaEnabled } from '@/lib/jalsa-store';
export function useJalsaMode() {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    const update = () => setEnabled(localStorage.getItem('nqai_jalsa') === '1');
    update();
    window.addEventListener(JALSA_EVENT, update);
    window.addEventListener('storage', update);
    return () => { window.removeEventListener(JALSA_EVENT, update); window.removeEventListener('storage', update); };
  }, []);
  return { enabled, setEnabled: setJalsaEnabled };
}