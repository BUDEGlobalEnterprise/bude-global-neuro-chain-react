import React, { useState, useEffect, useCallback } from 'react';
import styles from '../styles/components/Onboarding.module.css';

const STEPS = [
  {
    title: 'Welcome to Neuro-Chain',
    description: 'Explore the global innovation network visualization. Discover how technologies, ideas, and discoveries connect across time and space.',
    icon: '🌐',
    hint: 'Innovation is a network, not a timeline',
    animation: 'pulse',
    target: { x: 0, y: 0, zoom: 1.5 } // Focus on center/Fire
  },
  {
    title: 'Navigate the Universe',
    description: 'Click and drag to pan across the cosmos of ideas. Use your scroll wheel or pinch to zoom in for details or out for the big picture.',
    icon: '🖱️',
    hint: 'Arrow keys also work for navigation',
    animation: 'pan',
    target: { x: 0, y: 0, zoom: 0.6 }, // Zoom out for big picture
    controls: [
      { key: 'Drag', action: 'Pan around' },
      { key: 'Scroll', action: 'Zoom in/out' },
      { key: 'R', action: 'Reset view' }
    ]
  },
  {
    title: 'Discover Connections',
    description: 'Hover over nodes to reveal their connections. Click any node to trigger a signal pulse that travels along historical links.',
    icon: '✨',
    hint: 'Watch the knowledge flow between ideas',
    animation: 'glow',
    target: { x: -280, y: -60, zoom: 1.2 } // Focus on Tools cluster
  },
  {
    title: 'Filter & Explore',
    description: 'Use the legend to toggle clusters. The search bar (Ctrl+K) lets you find specific innovations instantly.',
    icon: '🔍',
    hint: 'Try searching for "electricity" or "printing"',
    animation: 'search',
    target: { x: 240, y: 120, zoom: 1.0 }, // Focus on Electricity
    controls: [
      { key: 'Ctrl+K', action: 'Quick search' },
      { key: 'Space', action: 'Pause animation' },
      { key: 'Esc', action: 'Close dialogs' }
    ]
  },
  {
    title: 'You\'re Ready!',
    description: 'The network awaits. Click on nodes, explore clusters, and discover the hidden connections that shaped human progress.',
    icon: '🚀',
    hint: 'Start by clicking on "Fire" - the origin of it all',
    animation: 'launch',
    target: { x: 434, y: 347, zoom: 1.4 } // Focus on AGI/Intelligence
  }
];

const Onboarding = ({ onComplete, onStepChange }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [direction, setDirection] = useState('next');

  useEffect(() => {
    const hasSeenOnboarding = localStorage.getItem('neuro-chain-onboarding-v2');
    if (!hasSeenOnboarding) {
      // Small delay to let the main canvas load first
      const timer = setTimeout(() => {
          setIsVisible(true);
          if (onStepChange) onStepChange(STEPS[0]);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [onStepChange]);

  const animateTransition = useCallback((newStep, dir) => {
    setIsAnimating(true);
    setDirection(dir);
    setTimeout(() => {
      setCurrentStep(newStep);
      setIsAnimating(false);
      if (onStepChange) onStepChange(STEPS[newStep]);
    }, 300);
  }, [onStepChange]);

  const handleComplete = useCallback(() => {
    localStorage.setItem('neuro-chain-onboarding-v2', 'true');
    setIsVisible(false);
    if (onComplete) onComplete();
  }, [onComplete]);

  const handleNext = useCallback(() => {
    if (currentStep < STEPS.length - 1) {
      animateTransition(currentStep + 1, 'next');
    } else {
      handleComplete();
    }
  }, [currentStep, animateTransition, handleComplete]);

  const handlePrev = useCallback(() => {
    if (currentStep > 0) {
      animateTransition(currentStep - 1, 'prev');
    }
  }, [currentStep, animateTransition]);

  const handleDotClick = (index) => {
    if (index !== currentStep) {
      animateTransition(index, index > currentStep ? 'next' : 'prev');
    }
  };

  const handleKeyDown = useCallback((e) => {
    if (!isVisible) return;
    if (e.key === 'ArrowRight' || e.key === 'Enter') handleNext();
    if (e.key === 'ArrowLeft') handlePrev();
    if (e.key === 'Escape') handleComplete();
  }, [isVisible, handleNext, handlePrev, handleComplete]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  if (!isVisible) return null;

  const step = STEPS[currentStep];
  const progress = ((currentStep + 1) / STEPS.length) * 100;

  return (
    <div className={styles.overlay} onClick={(e) => e.target === e.currentTarget && handleComplete()}>
      <div className={`${styles.modal} ${isAnimating ? styles[direction] : ''}`}>
        {/* Progress Bar */}
        <div className={styles.progressBar}>
          <div className={styles.progressFill} style={{ width: `${progress}%` }} />
        </div>

        {/* Icon with Animation */}
        <div className={`${styles.iconContainer} ${styles[step.animation]}`}>
          <span className={styles.icon}>{step.icon}</span>
          <div className={styles.iconRing} />
          <div className={styles.iconRing2} />
        </div>
        
        {/* Content */}
        <div className={`${styles.content} ${isAnimating ? styles.fadeOut : styles.fadeIn}`}>
          <h2 className={styles.title}>{step.title}</h2>
          <p className={styles.description}>{step.description}</p>
          
          {/* Keyboard Hints */}
          {step.controls && (
            <div className={styles.controlsGrid}>
              {step.controls.map((ctrl, i) => (
                <div key={i} className={styles.controlItem}>
                  <kbd className={styles.kbd}>{ctrl.key}</kbd>
                  <span className={styles.controlAction}>{ctrl.action}</span>
                </div>
              ))}
            </div>
          )}
          
          {/* Hint */}
          <div className={styles.hint}>
            <span className={styles.hintIcon}>💡</span>
            <span>{step.hint}</span>
          </div>
        </div>

        {/* Footer */}
        <div className={styles.footer}>
          {/* Step Dots */}
          <div className={styles.dots}>
            {STEPS.map((_, index) => (
              <button
                key={index}
                className={`${styles.dot} ${index === currentStep ? styles.dotActive : ''} ${index < currentStep ? styles.dotCompleted : ''}`}
                onClick={() => handleDotClick(index)}
                aria-label={`Go to step ${index + 1}`}
              />
            ))}
          </div>

          {/* Buttons */}
          <div className={styles.buttons}>
            {currentStep > 0 && (
              <button className={styles.prevButton} onClick={handlePrev}>
                ← Back
              </button>
            )}
            <button className={styles.skipButton} onClick={handleComplete}>
              Skip
            </button>
            <button className={styles.nextButton} onClick={handleNext}>
              {currentStep === STEPS.length - 1 ? 'Start Exploring' : 'Next →'}
            </button>
          </div>
        </div>

        {/* Step Counter */}
        <div className={styles.stepCounter}>
          {currentStep + 1} / {STEPS.length}
        </div>

        {/* Close Button */}
        <button className={styles.closeButton} onClick={handleComplete} aria-label="Close">
          ✕
        </button>
      </div>
    </div>
  );
};

export default Onboarding;
