// 📄 src/perf.js
/**
 * Lightweight performance timing utility
 * Use to measure and track hot function execution times
 */
export const Perf = {
  marks: new Map(),
  
  begin(name) {
    this.marks.set(name, performance.now());
  },
  
  end(name) {
    const t0 = this.marks.get(name);
    if (t0 == null) return 0;
    const dt = performance.now() - t0;
    this.marks.delete(name); // Clean up
    return dt;
  }
};
