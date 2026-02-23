// stats.js
export const Stats = {
  frameMs: 0,
  fps: 0,
  candidateChecks: 0,   // how many distance checks we attempted
  neighborPairs: 0,     // how many neighbors passed radius test
  queriedCells: 0,      // how many grid cells touched
  resetPerFrame() {
    this.candidateChecks = 0;
    this.neighborPairs = 0;
    this.queriedCells = 0;
  }
};
