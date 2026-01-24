import React, { useState, useMemo, useCallback } from 'react';
import styles from '../styles/components/SearchBar.module.css';

/**
 * Calculate fuzzy match score (higher = better match)
 */
const calculateMatchScore = (text, term) => {
  const t = text.toLowerCase();
  const s = term.toLowerCase();

  // Exact match = highest score
  if (t === s) return 100;
  // Starts with = high score
  if (t.startsWith(s)) return 80;
  // Contains = medium score
  if (t.includes(s)) return 50;

  return 0;
};

/**
 * Highlight matching text in label
 */
const highlightMatch = (text, term) => {
  if (!term) return text;

  const regex = new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  const parts = text.split(regex);

  return parts.map((part, i) =>
    regex.test(part)
      ? <mark key={i} className={styles.highlight}>{part}</mark>
      : part
  );
};

const SearchBar = React.memo(({ nodes, onNodeSelect, clusters, inputRef, onSearchChange }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const filteredNodes = useMemo(() => {
    if (!searchTerm.trim()) return [];

    const term = searchTerm.toLowerCase();

    return nodes
      .map(node => {
        const labelScore = calculateMatchScore(node.label, term);
        const idScore = calculateMatchScore(node.id, term) * 0.8;
        const clusterScore = calculateMatchScore(clusters[node.cluster]?.label || '', term) * 0.5;
        const score = Math.max(labelScore, idScore, clusterScore);
        return { ...node, score };
      })
      .filter(node => node.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);
  }, [searchTerm, nodes, clusters]);

  // Propagate search state to parent for visual filtering
  React.useEffect(() => {
    if (onSearchChange) {
        onSearchChange({
            term: searchTerm,
            matchedIds: filteredNodes.map(n => n.id)
        });
    }
  }, [searchTerm, filteredNodes, onSearchChange]);

  const [isExpanded, setIsExpanded] = useState(false);

  const handleSelect = useCallback((node) => {
    onNodeSelect(node);
    setSearchTerm('');
    setIsOpen(false);
    setSelectedIndex(0);
    setIsExpanded(false);
  }, [onNodeSelect]);

  const handleBlur = useCallback(() => {
    // Small delay to allow click events on results/clear button
    setTimeout(() => {
        setIsOpen(false);
        if (!searchTerm) {
            setIsExpanded(false);
        }
    }, 200);
  }, [searchTerm]);

  const handleKeyDown = useCallback((e) => {
    if (!isOpen && !isExpanded) return;
    
    // ... existing key logic ...
    
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, filteredNodes.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (filteredNodes[selectedIndex]) {
          handleSelect(filteredNodes[selectedIndex]);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        setSearchTerm('');
        setIsExpanded(false);
        break;
      default:
        break;
    }
  }, [isOpen, isExpanded, filteredNodes, selectedIndex, handleSelect]);

  return (
    <>
      <div
        className={`${styles.backdrop} ${isOpen ? styles.backdropVisible : ''}`}
        onClick={() => {
            setIsOpen(false);
            if (!searchTerm) setIsExpanded(false);
        }}
      />
      <div 
        className={`${styles.searchContainer} ${isExpanded ? styles.expanded : ''}`}
        onClick={() => {
            if (!isExpanded) {
                setIsExpanded(true);
                // focus input after expansion
                setTimeout(() => inputRef.current?.focus(), 100);
            }
        }}
      >
        <div className={styles.searchBox}>
          <span className={styles.searchIcon}>🔍</span>
          <input
            ref={inputRef}
            id="innovation-search"
            name="innovation-search"
            type="text"
            className={styles.searchInput}
            placeholder="Search innovations, clusters..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setIsOpen(true);
              setSelectedIndex(0);
            }}
            onFocus={() => {
                setIsOpen(true);
                setIsExpanded(true);
            }}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
          />
          {searchTerm && (
            <button
              className={styles.clearBtn}
              onClick={(e) => {
                e.stopPropagation();
                setSearchTerm('');
                setIsOpen(false);
                setSelectedIndex(0);
                inputRef.current?.focus();
              }}
            >
              ×
            </button>
          )}
        </div>

        {isOpen && filteredNodes.length > 0 && (
          <div className={styles.searchResults}>
            {filteredNodes.map((node, index) => (
              <div
                key={node.id}
                className={`${styles.searchResult} ${index === selectedIndex ? styles.selected : ''}`}
                onClick={() => handleSelect(node)}
                onMouseEnter={() => setSelectedIndex(index)}
              >
                <div className={styles.resultLabel}>
                  {highlightMatch(node.label, searchTerm)}
                </div>
                <div className={styles.resultCluster}>
                  <span
                    className={styles.resultDot}
                    style={{ backgroundColor: clusters[node.cluster]?.color }}
                  />
                  {clusters[node.cluster]?.label}
                </div>
              </div>
            ))}
          </div>
        )}

        {isOpen && searchTerm && filteredNodes.length === 0 && (
          <div className={styles.searchResults}>
            <div className={styles.noResults}>
              No innovations found for "{searchTerm}"
            </div>
          </div>
        )}
      </div>
    </>
  );
});

SearchBar.displayName = 'SearchBar';

export default SearchBar;

