/**
 * Email Virtualization Engine
 * High-performance virtual scrolling for 10k+ email items
 */

class EmailVirtualization {
  constructor(container, options = {}) {
    this.container = container;
    this.options = {
      itemHeight: 120, // Default email item height
      bufferSize: 5, // Number of items to render outside visible area
      scrollDebounce: 16, // Scroll event throttling (60fps)
      overscan: 3, // Additional items to render for smoother scrolling
      estimatedItemCount: 1000,
      ...options
    };

    this.data = [];
    this.visibleItems = new Map();
    this.itemHeights = new Map();
    this.renderCallbacks = new Map();
    
    this.state = {
      scrollTop: 0,
      containerHeight: 0,
      totalHeight: 0,
      startIndex: 0,
      endIndex: 0,
      isScrolling: false,
      lastScrollTime: 0
    };

    this.init();
  }

  init() {
    this.setupContainer();
    this.bindEvents();
    this.updateDimensions();
  }

  setupContainer() {
    // Ensure container has proper styling
    this.container.style.position = 'relative';
    this.container.style.overflow = 'auto';
    this.container.style.height = '100%';

    // Create virtual content wrapper
    this.contentWrapper = document.createElement('div');
    this.contentWrapper.className = 'virtual-scroll-content';
    this.contentWrapper.style.position = 'relative';
    this.contentWrapper.style.minHeight = '100%';

    // Create viewport for visible items
    this.viewport = document.createElement('div');
    this.viewport.className = 'virtual-scroll-viewport';
    this.viewport.style.position = 'absolute';
    this.viewport.style.top = '0';
    this.viewport.style.left = '0';
    this.viewport.style.right = '0';
    this.viewport.style.transform = 'translateZ(0)'; // GPU acceleration

    this.contentWrapper.appendChild(this.viewport);
    this.container.appendChild(this.contentWrapper);
  }

  bindEvents() {
    // Throttled scroll handler for performance
    let scrollTimeout;
    this.container.addEventListener('scroll', () => {
      this.state.isScrolling = true;
      this.state.lastScrollTime = performance.now();

      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        this.state.isScrolling = false;
      }, 150);

      this.handleScroll();
    }, { passive: true });

    // Handle resize events
    const resizeObserver = new ResizeObserver(entries => {
      for (const entry of entries) {
        if (entry.target === this.container) {
          this.updateDimensions();
          this.render();
        }
      }
    });
    resizeObserver.observe(this.container);

    // Handle visibility changes for performance optimization
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.pauseRendering();
      } else {
        this.resumeRendering();
      }
    });
  }

  handleScroll() {
    // Use requestAnimationFrame for smooth scrolling
    if (this.scrollRAF) {
      cancelAnimationFrame(this.scrollRAF);
    }

    this.scrollRAF = requestAnimationFrame(() => {
      this.state.scrollTop = this.container.scrollTop;
      this.calculateVisibleRange();
      this.render();
    });
  }

  updateDimensions() {
    const rect = this.container.getBoundingClientRect();
    this.state.containerHeight = rect.height;
    this.calculateTotalHeight();
  }

  calculateTotalHeight() {
    if (this.data.length === 0) {
      this.state.totalHeight = 0;
      return;
    }

    // Calculate total height based on actual and estimated item heights
    let totalHeight = 0;
    for (let i = 0; i < this.data.length; i++) {
      const itemHeight = this.getItemHeight(i);
      totalHeight += itemHeight;
    }

    this.state.totalHeight = totalHeight;
    this.contentWrapper.style.height = `${totalHeight}px`;
  }

  getItemHeight(index) {
    // Return cached height if available, otherwise use estimated height
    if (this.itemHeights.has(index)) {
      return this.itemHeights.get(index);
    }
    
    // Use dynamic height estimation based on content
    const item = this.data[index];
    if (item) {
      return this.estimateItemHeight(item);
    }
    
    return this.options.itemHeight;
  }

  estimateItemHeight(item) {
    // Estimate height based on content length and type
    const baseHeight = this.options.itemHeight;
    
    // Factors that affect height
    const subjectLength = (item.subject || '').length;
    const previewLength = (item.preview || item.body || '').length;
    const hasAttachments = item.has_attachments || false;
    const isUrgent = item.classification === 'urgent';
    
    let estimatedHeight = baseHeight;
    
    // Adjust for longer content
    if (subjectLength > 50) estimatedHeight += 10;
    if (previewLength > 100) estimatedHeight += 15;
    if (hasAttachments) estimatedHeight += 5;
    if (isUrgent) estimatedHeight += 5;
    
    return Math.max(estimatedHeight, baseHeight);
  }

  calculateVisibleRange() {
    if (this.data.length === 0) {
      this.state.startIndex = 0;
      this.state.endIndex = 0;
      return;
    }

    const { scrollTop, containerHeight } = this.state;
    const { bufferSize, overscan } = this.options;

    // Find start index
    let currentHeight = 0;
    let startIndex = 0;
    
    for (let i = 0; i < this.data.length; i++) {
      const itemHeight = this.getItemHeight(i);
      if (currentHeight + itemHeight >= scrollTop) {
        startIndex = Math.max(0, i - bufferSize - overscan);
        break;
      }
      currentHeight += itemHeight;
    }

    // Find end index
    let endIndex = startIndex;
    currentHeight = this.getOffsetTop(startIndex);
    
    while (endIndex < this.data.length && currentHeight < scrollTop + containerHeight + (this.options.itemHeight * bufferSize)) {
      currentHeight += this.getItemHeight(endIndex);
      endIndex++;
    }

    endIndex = Math.min(this.data.length, endIndex + bufferSize + overscan);

    this.state.startIndex = startIndex;
    this.state.endIndex = endIndex;
  }

  getOffsetTop(index) {
    let offset = 0;
    for (let i = 0; i < index; i++) {
      offset += this.getItemHeight(i);
    }
    return offset;
  }

  render() {
    if (!this.renderFunction) {
      console.warn('EmailVirtualization: No render function provided');
      return;
    }

    const { startIndex, endIndex } = this.state;
    const fragment = document.createDocumentFragment();
    const currentItems = new Set();

    // Remove items that are no longer visible
    for (const [index, element] of this.visibleItems) {
      if (index < startIndex || index >= endIndex) {
        element.remove();
        this.visibleItems.delete(index);
        this.renderCallbacks.delete(index);
      } else {
        currentItems.add(index);
      }
    }

    // Render new visible items
    for (let i = startIndex; i < endIndex; i++) {
      if (!currentItems.has(i) && this.data[i]) {
        const element = this.renderItem(i);
        if (element) {
          fragment.appendChild(element);
          this.visibleItems.set(i, element);
        }
      }
    }

    // Append new items to viewport
    if (fragment.children.length > 0) {
      this.viewport.appendChild(fragment);
    }

    // Update viewport position
    this.updateViewportPosition();

    // Trigger post-render callbacks
    this.triggerPostRenderCallbacks();
  }

  renderItem(index) {
    const item = this.data[index];
    if (!item) return null;

    const element = this.renderFunction(item, index);
    if (!element) return null;

    // Position the element
    const offsetTop = this.getOffsetTop(index);
    element.style.position = 'absolute';
    element.style.top = `${offsetTop}px`;
    element.style.left = '0';
    element.style.right = '0';
    element.style.zIndex = '1';

    // Add data attributes for debugging and interaction
    element.dataset.virtualIndex = index;
    element.dataset.itemId = item.id || index;

    // Measure actual height after render
    requestAnimationFrame(() => {
      if (element.parentNode) {
        const actualHeight = element.offsetHeight;
        if (actualHeight > 0 && actualHeight !== this.getItemHeight(index)) {
          this.itemHeights.set(index, actualHeight);
          // Recalculate total height if this item's height changed significantly
          const estimatedHeight = this.estimateItemHeight(item);
          if (Math.abs(actualHeight - estimatedHeight) > 10) {
            this.calculateTotalHeight();
            this.render(); // Re-render to adjust positions
          }
        }
      }
    });

    return element;
  }

  updateViewportPosition() {
    // The viewport doesn't need repositioning as items are absolutely positioned
    // This method is kept for future enhancements
  }

  triggerPostRenderCallbacks() {
    const { startIndex, endIndex } = this.state;
    
    // Trigger callbacks for newly rendered items
    for (let i = startIndex; i < endIndex; i++) {
      const callback = this.renderCallbacks.get(i);
      if (callback && typeof callback === 'function') {
        callback(this.visibleItems.get(i), this.data[i], i);
      }
    }
  }

  // Public API methods

  setData(data) {
    this.data = data || [];
    this.itemHeights.clear();
    this.visibleItems.clear();
    this.renderCallbacks.clear();
    
    // Clear viewport
    this.viewport.innerHTML = '';
    
    this.calculateTotalHeight();
    this.calculateVisibleRange();
    this.render();

    // Emit data change event
    this.emit('dataChanged', { data: this.data });
  }

  setRenderFunction(renderFn) {
    if (typeof renderFn !== 'function') {
      throw new Error('Render function must be a function');
    }
    this.renderFunction = renderFn;
  }

  scrollToIndex(index, behavior = 'smooth') {
    if (index < 0 || index >= this.data.length) {
      console.warn(`EmailVirtualization: Invalid index ${index}`);
      return;
    }

    const offsetTop = this.getOffsetTop(index);
    this.container.scrollTo({
      top: offsetTop,
      behavior
    });
  }

  scrollToTop(behavior = 'smooth') {
    this.container.scrollTo({
      top: 0,
      behavior
    });
  }

  getVisibleRange() {
    return {
      startIndex: this.state.startIndex,
      endIndex: this.state.endIndex,
      visibleCount: this.state.endIndex - this.state.startIndex
    };
  }

  getScrollState() {
    return {
      scrollTop: this.state.scrollTop,
      scrollHeight: this.state.totalHeight,
      clientHeight: this.state.containerHeight,
      isScrolling: this.state.isScrolling
    };
  }

  updateItem(index, newData) {
    if (index < 0 || index >= this.data.length) {
      console.warn(`EmailVirtualization: Invalid index ${index}`);
      return;
    }

    this.data[index] = { ...this.data[index], ...newData };
    
    // Remove cached height to trigger re-measurement
    this.itemHeights.delete(index);
    
    // Re-render if item is currently visible
    if (this.visibleItems.has(index)) {
      const element = this.visibleItems.get(index);
      element.remove();
      this.visibleItems.delete(index);
      
      // Will be re-rendered on next render cycle
      this.render();
    }
  }

  insertItem(index, item) {
    if (index < 0 || index > this.data.length) {
      console.warn(`EmailVirtualization: Invalid index ${index}`);
      return;
    }

    this.data.splice(index, 0, item);
    
    // Shift cached heights
    const newHeights = new Map();
    for (const [i, height] of this.itemHeights) {
      if (i >= index) {
        newHeights.set(i + 1, height);
      } else {
        newHeights.set(i, height);
      }
    }
    this.itemHeights = newHeights;

    this.calculateTotalHeight();
    this.calculateVisibleRange();
    this.render();

    this.emit('itemInserted', { index, item });
  }

  removeItem(index) {
    if (index < 0 || index >= this.data.length) {
      console.warn(`EmailVirtualization: Invalid index ${index}`);
      return;
    }

    const removedItem = this.data.splice(index, 1)[0];
    
    // Remove from visible items if present
    if (this.visibleItems.has(index)) {
      this.visibleItems.get(index).remove();
      this.visibleItems.delete(index);
    }

    // Shift cached heights
    const newHeights = new Map();
    for (const [i, height] of this.itemHeights) {
      if (i > index) {
        newHeights.set(i - 1, height);
      } else if (i < index) {
        newHeights.set(i, height);
      }
    }
    this.itemHeights = newHeights;

    this.calculateTotalHeight();
    this.calculateVisibleRange();
    this.render();

    this.emit('itemRemoved', { index, item: removedItem });
  }

  setItemCallback(index, callback) {
    this.renderCallbacks.set(index, callback);
  }

  refresh() {
    this.itemHeights.clear();
    this.calculateTotalHeight();
    this.calculateVisibleRange();
    this.render();
  }

  pauseRendering() {
    this.renderingPaused = true;
  }

  resumeRendering() {
    this.renderingPaused = false;
    this.render();
  }

  destroy() {
    // Cancel any pending animation frames
    if (this.scrollRAF) {
      cancelAnimationFrame(this.scrollRAF);
    }

    // Clear all references
    this.data = [];
    this.visibleItems.clear();
    this.itemHeights.clear();
    this.renderCallbacks.clear();

    // Remove DOM elements
    if (this.contentWrapper && this.contentWrapper.parentNode) {
      this.contentWrapper.parentNode.removeChild(this.contentWrapper);
    }

    // Remove event listeners
    this.container.removeEventListener('scroll', this.handleScroll);

    this.emit('destroyed');
  }

  // Simple event system
  on(event, callback) {
    if (!this.listeners) this.listeners = {};
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(callback);
  }

  off(event, callback) {
    if (!this.listeners || !this.listeners[event]) return;
    const index = this.listeners[event].indexOf(callback);
    if (index > -1) {
      this.listeners[event].splice(index, 1);
    }
  }

  emit(event, data) {
    if (!this.listeners || !this.listeners[event]) return;
    this.listeners[event].forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error('EmailVirtualization event callback error:', error);
      }
    });
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = EmailVirtualization;
} else if (typeof window !== 'undefined') {
  window.EmailVirtualization = EmailVirtualization;
}