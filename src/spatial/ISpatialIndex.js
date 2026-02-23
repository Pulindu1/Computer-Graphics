
export class ISpatialIndex {
  constructor() {
    this.stats = {
      buildMs: 0,
      queryMs: 0,
      candidatesAvg: 0,
      queriesThisFrame: 0,
      nodesVisitedAvg: NaN,
      nodeCount: NaN,
      maxDepthReached: NaN,
    };
  }

  clear() { throw new Error("ISpatialIndex.clear() not implemented"); }
  insert(_agent) { throw new Error("ISpatialIndex.insert() not implemented"); }
  queryInto(_x, _z, _radius, _out) { throw new Error("ISpatialIndex.queryInto() not implemented"); }
}
