import React, { useState, useEffect, useRef } from 'react';
import { ShieldCheck, Lock } from 'lucide-react';
import './PuzzleCaptcha.css';

const PuzzleCaptcha = ({ onVerify }) => {
  const [position, setPosition] = useState(0);
  const [target, setTarget] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [verified, setVerified] = useState(false);
  const trackRef = useRef(null);

  useEffect(() => {
    // Randomize target position between 20% and 80%
    setTarget(Math.floor(Math.random() * 60) + 20);
  }, []);

  const handleMouseDown = (e) => {
    if (verified) return;
    setIsDragging(true);
  };

  const handleMouseMove = (e) => {
    if (!isDragging || verified) return;
    
    if (trackRef.current) {
      const rect = trackRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const width = rect.width;
      const percentage = Math.max(0, Math.min(100, (x / width) * 100));
      setPosition(percentage);
    }
  };

  const handleMouseUp = () => {
    if (!isDragging || verified) return;
    setIsDragging(false);

    // Tolerance of +/- 5%
    if (Math.abs(position - target) < 5) {
      setVerified(true);
      onVerify && onVerify();
    } else {
      // Reset if failed
      setPosition(0);
    }
  };

  // Touch support
  const handleTouchMove = (e) => {
    if (!isDragging || verified) return;
    if (trackRef.current) {
      const rect = trackRef.current.getBoundingClientRect();
      const x = e.touches[0].clientX - rect.left;
      const width = rect.width;
      const percentage = Math.max(0, Math.min(100, (x / width) * 100));
      setPosition(percentage);
    }
  };

  return (
    <div className="captcha-container glass-panel">
      <div className="captcha-header">
        {verified ? (
          <ShieldCheck className="icon-success" size={24} />
        ) : (
          <Lock className="icon-lock" size={24} />
        )}
        <h3>{verified ? 'System Secured' : 'Security Check'}</h3>
      </div>
      
      {!verified && <p className="captcha-instruction">Slide the key to the target zone</p>}

      <div 
        className={`captcha-track ${verified ? 'verified' : ''}`}
        ref={trackRef}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleMouseUp}
      >
        {/* Target Zone */}
        <div 
          className="captcha-target" 
          style={{ left: `${target}%` }}
        >
          <div className="target-pulse"></div>
        </div>

        {/* Slider Handle */}
        <div 
          className="captcha-handle"
          style={{ left: `${position}%` }}
          onMouseDown={handleMouseDown}
          onTouchStart={handleMouseDown}
        >
          <div className="handle-knob"></div>
        </div>

        {/* Progress Fill */}
        <div 
          className="captcha-fill"
          style={{ width: `${position}%` }}
        ></div>
      </div>
    </div>
  );
};

export default PuzzleCaptcha;
