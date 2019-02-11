'use strict';
const Heap = require('fastpriorityqueue');

module.exports = function(bot, sp, ep)
{
    // D* Lite as per S. Koenig, 2002
    // Compute Shortest Path and UpdateVertex as described in http://idm-lab.org/bib/abstracts/papers/aaai02b.pdf
    // Based on an optimized version of D* Lite as presented in Figure 4.

    // The advantage of using D* Lite is it precomputes the global state between the start and end point, this allows for
    // convenient changes of costs at runtime, which can be used for entity avoidance.

    function DLITEReturnState(MainPromise)
    {
        const ReturnState = this;
        let ResolveFunction = function() {return;};

        this.OBSOLETE = [];

        this.on = function(Callback)
        {
            ResolveFunction = function(IntermediateObject)
            {
                ReturnState.ENUMStatus = IntermediateObject.ENUMStatus;
                if (IntermediateObject.ENUMStatus === bot.pathfinder.ENUMStatus.Incomplete)
                {
                    console.warn(
                        'WARNING Pathfinder: Did not find path in allowed MAX_EXPANSIONS,',
                        'returned path to closest valid end point'
                    );
                }

                Callback(ReturnState);
            };

            MainPromise
                .then(ResolveFunction)
                .catch(function(e) {console.error('ERROR Pathfinder:', e);});
        };

        // Path functions
        this.path = {};
        function _peek()
        {
            // First part of Main() in D*Lite
            if (S.start === S.goal) return undefined;
            if (ReturnState.OBSOLETE.length !== 0) return undefined;

            let minState;
            let minCost = Number.POSITIVE_INFINITY;

            // Get successors according to stored state.
            const successors = bot.pathfinder.getSuccessors(S.start.p);
            for (let n = 0, len = successors.length; n < len; n++)
            {
                const sp = ExistingState(successors[n]);
                if (sp)
                {
                    const cost = bot.pathfinder.COST(S.start.p, sp.p) + sp.g;
                    if (minCost > cost)
                    {
                        minCost = cost;
                        minState = sp;
                    }
                }
            }

            return minState;
        }
        this.path.peek = function()
        {
            const temp = _peek();
            if (temp !== undefined)
                return temp.p;
            else return undefined;
        };
        this.path.pop = function()
        {
            const temp = _peek();
            if (temp !== undefined)
            {
                S.start = temp;
                return temp.p;
            }
            else return undefined;
        };
        this.path.replan = function()
        {
            const v = ReturnState.OBSOLETE.pop();
            if (v)
            {
                k_m = k_m + bot.pathfinder.HEURISTIC(S.last.p, S.start.p);
                S.last = S.start;

                // Since the blockUpdate event is only validated when a previously navigable vertex is blocked
                // we need to only accomodate for one case. [c_old < c(u,v)]
                const predecessors = bot.pathfinder.getPredecessors(v.p);
                for (let n = 0, len = predecessors.length; n < len; n++)
                {
                    const u = new State(predecessors[n]);
                    if (floatEqual(u.rhs, bot.pathfinder.COST(u.p, v.p) + v.g) && u !== S.goal)
                    {
                        u.rhs = Number.POSITIVE_INFINITY;

                        const successors = bot.pathfinder.getSuccessors(u.p);
                        for (let m = 0, len = successors.length; m < len; m++)
                        {
                            const sp = new State(successors[m]);
                            if (sp)
                            {
                                const cost = bot.pathfinder.COST(u.p, sp.p) + sp.g;
                                if (u.rhs > cost) u.rhs = cost;
                            }
                        }
                    }

                    UpdateVertex(u);
                }

                ComputeShortestPath().then(ResolveFunction);
            }
            else ResolveFunction();
        };

        // Handles changes in the world state
        bot.on('blockUpdate', function(_, newBlock)
        {
            const v = ExistingState(newBlock.position);
            if (v && CompareKeys(v.k, S.start.k)) // Ensures we havent already passed that block
            {
                ReturnState.OBSOLETE.push(v);
                U.remove(U.check(v));
                S[v.p.x >>> 0][v.p.y >>> 0][v.p.z >>> 0] = undefined;
            }
        });
    };

    // Global state functions
    const S = [];
    S.push = function(s)
    {
        const x = s.p.x >>> 0;
        const y = s.p.y >>> 0;

        if (!this[x])
            this[x] = [];
        if (!this[x][y])
            this[x][y] = [];

        this[x][y][s.p.z >>> 0] = s;
    };
    S.check = function(p)
    {
        const x = p.x >>> 0;
        if (this[x])
        {
            const y = p.y >>> 0;
            if (this[x][y])
            {
                if (this[x][y][p.z >>> 0])

                    return true;
            }
        } return false;
    };

    // Priority queue functions
    const U = new Heap(function(s1, s2) {return CompareKeys(s1.k, s2.k);});
    U.check = function(s)
    {
        for (let i = 0; i < this.size; i++)
            if (this.array[i] === s) return i;
        return undefined;
    };
    U.insert = function(s, k)
    {
        s.k = k;
        this.add(s);
    };
    U.update = function(i, k)
    {
        // Priority queue handles the percolation automatically eitherway
        const k_old = this.array[i].k;
        this.array[i].k = k;

        if (CompareKeys(k_old, k))
            this._percolateDown(i);
        else this._percolateUp(i);
    };

    // Maintain familiarity with original heap implementation
    U.remove = U._removeAt;
    U.pop = U.poll;

    // State functions
    function State(p)
    {
        if (S.check(p))
            return S[p.x >>> 0][p.y >>> 0][p.z >>> 0];
        else
        {
            this.p = p;
            this.g = Number.POSITIVE_INFINITY;
            this.rhs = Number.POSITIVE_INFINITY;

            this.k = [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY];

            S.push(this);
        }
    }

    function ExistingState(p)
    {
        if (S.check(p))
            return S[p.x >>> 0][p.y >>> 0][p.z >>> 0];
        else return undefined;
    }

    // Algorithm functions
    function CalculateKey(s)
    {
        return [Math.min(s.g, s.rhs) + bot.pathfinder.HEURISTIC(S.start.p, s.p) + k_m, Math.min(s.g, s.rhs)];
    }

    function UpdateVertex(u)
    {
        const exists = U.check(u); // Integer index
        const equals = floatEqual(u.g, u.rhs);

        if (!equals && exists !== undefined) U.update(exists, CalculateKey(u));
        else if (!equals && exists === undefined) U.insert(u, CalculateKey(u));
        else if (equals && exists !== undefined) U.remove(exists);
    }

    function ComputeShortestPath()
    {
        const CSPPromise = new Promise(function(resolve)
        {
            for (let i = 0; i < bot.pathfinder.MAX_EXPANSIONS && U.size !== 0 &&
                (CompareKeys(U.peek().k, CalculateKey(S.start)) || S.start.rhs > S.start.g); i++)
            {
                const u = U.peek();
                const k_old = u.k;
                const k_new = CalculateKey(u);

                if (CompareKeys(k_old, k_new))
                    U.update(0, k_new);

                else if (u.g > u.rhs)
                {
                    u.g = u.rhs;
                    U.pop(); // U.remove from first

                    const predecessors = bot.pathfinder.getPredecessors(u.p);
                    for (let n = 0, len = predecessors.length; n < len; n++)
                    {
                        const s = new State(predecessors[n]);

                        if (s !== S.goal) s.rhs = Math.min(s.rhs, bot.pathfinder.COST(s.p, u.p) + u.g);
                        UpdateVertex(s);
                    }
                }
                else
                {
                    const g_old = u.g;
                    u.g = Number.POSITIVE_INFINITY;

                    const predecessors = bot.pathfinder.getPredecessors(u.p);
                    predecessors.push(u.p); // ∪ {u}
                    for (let n = 0, len = predecessors.length; n < len; n++)
                    {
                        const s = new State(predecessors[n]);
                        if (floatEqual(s.rhs, bot.pathfinder.COST(s.p, u.p) + g_old))
                        {
                            if (s !== S.goal)
                            {
                                s.rhs = Number.POSITIVE_INFINITY;

                                const successors = bot.pathfinder.getSuccessors(s.p);
                                for (let m = 0, len = successors.length; m < len; m++)
                                {
                                    const sp = new State(successors[m]);
                                    const cost = bot.pathfinder.COST(s.p, sp.p) + sp.g;
                                    if (s.rhs > cost) s.rhs = cost;
                                }
                            }
                        }
                        UpdateVertex(s);
                    }
                }
            }
            if (S.start.rhs === Number.POSITIVE_INFINITY)
                resolve({ENUMStatus: bot.pathfinder.ENUMStatus.Incomplete});
            else
                resolve({ENUMStatus: bot.pathfinder.ENUMStatus.Complete});
        });

        return CSPPromise;
    }

    // Initialize

    let k_m = 0;

    S.start = new State(sp);
    S.goal = new State(ep);
    S.goal.rhs = 0;

    S.last = S.start;

    U.insert(
        S.goal,
        [bot.pathfinder.HEURISTIC(S.start.p, S.goal.p), 0]
    );

    return new DLITEReturnState(ComputeShortestPath());
};

function CompareKeys(k1, k2)
{
    return (floatEqual(k1[0], k2[0]) && k1[1] < k2[1]) || k1[0] < k2[0];
}

function floatEqual(f1, f2)
{
    if (f1 === Number.POSITIVE_INFINITY && f2 === Number.POSITIVE_INFINITY) return true;
    return Math.abs(f1 - f2) < Number.EPSILON;
}
